import type {
  ChartMark,
  IndicatorMarkerOutput,
  VisualTooltipRow
} from "@simoncharts/chart-engine";
import type { Candle, ChartExecution, ChartLocale, Timeframe } from "../contracts";
import { formatShanghaiExecutionTime } from "./shanghaiTimeFormatter";

export const executionVisualOutputId = "__executions";

interface ExecutionGroup {
  readonly index: number;
  readonly side: ChartExecution["side"];
  readonly label: string;
  readonly executions: ChartExecution[];
}

const shanghaiDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const shanghaiTimeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function dateParts(time: number): { year: number; month: number; day: number } {
  const parts = Object.fromEntries(
    shanghaiDateParts.formatToParts(new Date(time)).map((part) => [part.type, part.value])
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function calendarBucket(time: number, timeframe: "1d" | "1w" | "1mo"): string {
  const { year, month, day } = dateParts(time);
  if (timeframe === "1mo") return `${year}-${month}`;
  if (timeframe === "1d") return `${year}-${month}-${day}`;
  const utcDay = Date.UTC(year, month - 1, day);
  const monday = new Date(utcDay - ((new Date(utcDay).getUTCDay() + 6) % 7) * 86_400_000);
  return `${monday.getUTCFullYear()}-${monday.getUTCMonth() + 1}-${monday.getUTCDate()}`;
}

function minuteDuration(timeframe: Exclude<Timeframe, "1d" | "1w" | "1mo">): number {
  return Number.parseInt(timeframe, 10) * 60_000;
}

function isSessionCloseBoundary(time: number): boolean {
  const parts = Object.fromEntries(
    shanghaiTimeParts.formatToParts(new Date(time)).map((part) => [part.type, part.value])
  );
  return (parts.hour === "11" && parts.minute === "30") ||
    (parts.hour === "15" && parts.minute === "00");
}

function isOpeningAuctionExecution(time: number): boolean {
  const parts = Object.fromEntries(
    shanghaiTimeParts.formatToParts(new Date(time)).map((part) => [part.type, part.value])
  );
  return parts.hour === "09" && Number(parts.minute) >= 25 && Number(parts.minute) < 30;
}

export function executionCandleIndex(
  candles: readonly Candle[],
  executionTime: number,
  timeframe: Timeframe
): number | undefined {
  if (candles.length === 0) return undefined;
  if (timeframe === "1d" || timeframe === "1w" || timeframe === "1mo") {
    const bucket = calendarBucket(executionTime, timeframe);
    const index = candles.findIndex((candle) => calendarBucket(candle.time, timeframe) === bucket);
    return index < 0 ? undefined : index;
  }

  const executionDay = calendarBucket(executionTime, "1d");
  const firstSameDayIndex = candles.findIndex(
    (candle) => calendarBucket(candle.time, "1d") === executionDay
  );
  if (
    firstSameDayIndex >= 0 &&
    executionTime < candles[firstSameDayIndex]!.time &&
    isOpeningAuctionExecution(executionTime)
  ) return firstSameDayIndex;

  let low = 0;
  let high = candles.length - 1;
  let containing = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (candles[middle]!.time <= executionTime) {
      containing = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (containing < 0) return undefined;
  const bucketEnd = candles[containing]!.time + minuteDuration(timeframe);
  return executionTime < bucketEnd || (executionTime === bucketEnd && isSessionCloseBoundary(executionTime))
    ? containing
    : undefined;
}

export function createExecutionMarkerOutput(
  executions: readonly ChartExecution[],
  candles: readonly Candle[],
  timeframe: Timeframe
): IndicatorMarkerOutput | undefined {
  const groups = new Map<string, ExecutionGroup>();
  for (const execution of executions) {
    const index = executionCandleIndex(candles, execution.time, timeframe);
    if (index === undefined) continue;
    const label = execution.label?.trim() || (execution.side === "buy" ? "B" : "S");
    const key = JSON.stringify([index, execution.side, label]);
    const group = groups.get(key) ?? { index, side: execution.side, label, executions: [] };
    group.executions.push({ ...execution, label });
    groups.set(key, group);
  }

  const stackCounts = new Map<string, number>();
  const marks: ChartMark[] = [...groups.values()].map((group) => {
    const rows = group.executions.sort((left, right) => left.time - right.time);
    const price = timeframe === "1d" || timeframe === "1w" || timeframe === "1mo"
      ? (group.side === "buy" ? candles[group.index]!.low : candles[group.index]!.high)
      : rows[rows.length - 1]!.price;
    const stackKey = `${group.index}:${group.side}`;
    const stackIndex = stackCounts.get(stackKey) ?? 0;
    stackCounts.set(stackKey, stackIndex + 1);
    return {
      id: `${executionVisualOutputId}:${candles[group.index]!.time}:${group.side}:${group.label}`,
      time: candles[group.index]!.time,
      index: group.index,
      price,
      direction: group.side === "buy" ? "below" : "above",
      label: rows.length === 1 ? group.label : `${group.label} ×${rows.length}`,
      metadata: { kind: "execution", side: group.side, stackIndex, executions: rows }
    };
  });

  return marks.length === 0
    ? undefined
    : { id: executionVisualOutputId, label: "Executions", type: "marker", panelId: "main", marks };
}

export function executionsFromMark(mark: ChartMark): readonly ChartExecution[] {
  const rows = mark.metadata?.executions;
  return Array.isArray(rows) ? rows as ChartExecution[] : [];
}

export function executionTooltipRows(
  mark: ChartMark,
  locale: ChartLocale,
  formatPrice?: (price: number) => string
): VisualTooltipRow[] {
  const executions = executionsFromMark(mark);
  const zh = locale === "zh-CN";
  const number = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 4 });
  return executions.flatMap((execution, index) => {
    const prefix = executions.length > 1 ? `#${index + 1} ` : "";
    const firstTime = execution.firstTime;
    const lastTime = execution.lastTime;
    const hasTimeRange = firstTime !== undefined && lastTime !== undefined;
    const formattedTime = formatShanghaiExecutionTime(
      hasTimeRange ? firstTime : execution.time,
      hasTimeRange ? lastTime : undefined,
      locale
    );
    const rows: VisualTooltipRow[] = [
      { label: `${prefix}${zh ? "时间" : "Time"}`, value: formattedTime },
      { label: zh ? "价格" : "Price", value: formatPrice?.(execution.price) ?? number(execution.price) },
      { label: zh ? "数量" : "Quantity", value: number(execution.quantity) }
    ];
    if (execution.amount !== undefined) rows.push({ label: zh ? "金额" : "Amount", value: number(execution.amount) });
    if (execution.fee !== undefined) rows.push({ label: zh ? "费用" : "Fee", value: number(execution.fee) });
    if (execution.tQuantity !== undefined) {
      rows.push({ label: zh ? "T 数量" : "T quantity", value: number(execution.tQuantity) });
      rows.push({ label: zh ? "普通数量" : "Regular quantity", value: number(execution.quantity - execution.tQuantity) });
    }
    return rows;
  });
}
