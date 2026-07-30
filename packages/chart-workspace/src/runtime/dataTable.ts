import type {
  IndicatorVisualOutput,
  SeriesRenderModel,
  SeriesRenderPoint,
  SeriesType
} from "@simoncharts/chart-engine";
import type { Candle, ChartSeriesType, Timeframe } from "../contracts";
import type { ComparisonDataSnapshot } from "../data/comparisonCoordinator";
import { comparisonBaseValue } from "./comparisonProjection";
import type { IndicatorConfig } from "./indicatorRuntime";
import { indicatorOutputPrefix } from "./indicatorRuntime";
import { formatPrice } from "./priceFormatter";
import { formatShanghaiTime } from "./shanghaiTimeFormatter";

export interface DataTableColumn {
  readonly id: string;
  readonly label: string;
  readonly color?: string;
}

export interface DataTableRow {
  readonly time: number;
  cells(): readonly string[];
}

export interface DataTableSnapshot {
  readonly status: "ready" | "loading" | "blocked";
  readonly columns: readonly DataTableColumn[];
  readonly rows: readonly DataTableRow[];
}

const ohlcSeries = new Set<ChartSeriesType>([
  "bars",
  "candles",
  "hollowCandles",
  "volumeCandles",
  "highLow",
  "heikinAshi",
  "renko",
  "lineBreak",
  "kagi",
  "pointAndFigure"
]);
const numberFormatters = {
  "zh-CN": new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }),
  "en-US": new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 })
} as const;

function number(value: number | null | undefined, locale: string): string {
  return value === undefined || value === null || !Number.isFinite(value)
    ? "--"
    : numberFormatters[locale === "en-US" ? "en-US" : "zh-CN"].format(value);
}

function price(
  value: number | null | undefined,
  precision: number | undefined,
  locale: string
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "--";
  return precision === undefined ? number(value, locale) : formatPrice(value, precision);
}

function sourcePoints(candles: readonly Readonly<Candle>[]): SeriesRenderPoint[] {
  return candles.map((candle) => ({ ...candle }));
}

function valueMap(
  points: readonly { readonly time: number; readonly value: number | null }[]
): ReadonlyMap<number, number | null> {
  return new Map(points.map((point) => [point.time, point.value]));
}

export function createDataTableSnapshot(input: {
  readonly seriesType: SeriesType;
  readonly timeframe: Timeframe;
  readonly candles: readonly Readonly<Candle>[];
  readonly seriesModel?: SeriesRenderModel;
  readonly pricePrecision?: number;
  readonly locale: "zh-CN" | "en-US";
  readonly indicators: readonly IndicatorConfig[];
  readonly studyOutputs: readonly IndicatorVisualOutput[];
  readonly comparisons: readonly ComparisonDataSnapshot[];
  readonly visibleRange: { readonly from: number; readonly to: number };
  readonly studyTitleFor?: (config: Readonly<IndicatorConfig>) => string;
}): DataTableSnapshot {
  const english = input.locale === "en-US";
  const points = input.seriesModel?.type === input.seriesType
    ? input.seriesModel.points
    : sourcePoints(input.candles);
  const hasOhlc = ohlcSeries.has(input.seriesType);
  const hasHlc = input.seriesType === "hlcArea";
  const columns: DataTableColumn[] = [
    { id: "time", label: english ? "Time" : "时间" },
    ...(hasOhlc
      ? [
          { id: "open", label: english ? "Open" : "开" },
          { id: "high", label: english ? "High" : "高" },
          { id: "low", label: english ? "Low" : "低" },
          { id: "close", label: english ? "Close" : "收" }
        ]
      : hasHlc
        ? [
            { id: "high", label: english ? "High" : "高" },
            { id: "low", label: english ? "Low" : "低" },
            { id: "close", label: english ? "Close" : "收" }
          ]
      : [{ id: "value", label: english ? "Value" : "值" }]),
    { id: "change", label: english ? "Change" : "涨跌" },
    { id: "changePercent", label: english ? "Change %" : "涨跌幅" },
    { id: "volume", label: english ? "Volume" : "成交量" },
    { id: "turnover", label: english ? "Turnover" : "成交额" }
  ];
  const extraCells: Array<(time: number) => string> = [];

  for (const config of input.indicators.filter((candidate) => candidate.visible)) {
    const prefix = indicatorOutputPrefix(config.instanceId);
    const title = input.studyTitleFor?.(config) ?? config.id;
    for (const output of input.studyOutputs.filter(
      (candidate) => candidate.visible !== false && candidate.id.startsWith(prefix)
    )) {
      const id = output.id.slice(prefix.length);
      const label = `${title} · ${output.label}`;
      if (output.type === "band") {
        const upper = valueMap(output.upper);
        const lower = valueMap(output.lower);
        columns.push(
          { id: `study:${config.instanceId}:${id}:upper`, label: `${label} ${english ? "Upper" : "上轨"}` },
          { id: `study:${config.instanceId}:${id}:lower`, label: `${label} ${english ? "Lower" : "下轨"}` }
        );
        extraCells.push(
          (time) => number(upper.get(time), input.locale),
          (time) => number(lower.get(time), input.locale)
        );
      } else if (output.type === "marker") {
        const values = new Map<number, string>();
        for (const mark of output.marks) {
          const rendered = mark.price === undefined
            ? mark.label ?? "●"
            : price(mark.price, input.pricePrecision, input.locale);
          values.set(mark.time, values.has(mark.time)
            ? `${values.get(mark.time)} · ${rendered}`
            : rendered);
        }
        columns.push({ id: `study:${config.instanceId}:${id}`, label });
        extraCells.push((time) => values.get(time) ?? "--");
      } else {
        const values = valueMap(output.values);
        columns.push({ id: `study:${config.instanceId}:${id}`, label });
        extraCells.push((time) => number(values.get(time), input.locale));
      }
    }
  }

  for (const snapshot of input.comparisons.filter(
    (candidate) =>
      candidate.status === "ready" &&
      candidate.comparison.visible !== false
  )) {
    const values = new Map(snapshot.candles.map((candle) => [candle.time, candle.close]));
    const base = comparisonBaseValue({
      comparison: snapshot.comparison,
      mainCandles: input.candles,
      comparisonCandles: snapshot.candles,
      visibleRange: input.visibleRange,
      ...(snapshot.previousClose === undefined
        ? {}
        : { previousClose: snapshot.previousClose })
    });
    columns.push({
      id: `comparison:${snapshot.comparison.symbol.id}`,
      label: `${snapshot.comparison.symbol.name} ${snapshot.comparison.symbol.code}`,
      ...(snapshot.comparison.color === undefined
        ? {}
        : { color: snapshot.comparison.color })
    });
    extraCells.push((time) => {
      const value = values.get(time);
      if (value === undefined) return "--";
      const rendered = price(
        value,
        snapshot.comparison.symbol.pricePrecision,
        input.locale
      );
      return base === undefined || base <= 0
        ? rendered
        : `${rendered} (${number((value / base - 1) * 100, input.locale)}%)`;
    });
  }

  const rows = points.map((point, index) => ({
    time: point.time,
    cells: () => {
      const previous = points[index - 1]?.close ?? point.open ?? point.close;
      const change = point.close - previous;
      const mainCells = hasOhlc
        ? [
            price(point.open, input.pricePrecision, input.locale),
            price(point.high, input.pricePrecision, input.locale),
            price(point.low, input.pricePrecision, input.locale),
            price(point.close, input.pricePrecision, input.locale)
          ]
        : hasHlc
          ? [
              price(point.high, input.pricePrecision, input.locale),
              price(point.low, input.pricePrecision, input.locale),
              price(point.close, input.pricePrecision, input.locale)
            ]
        : [price(point.close, input.pricePrecision, input.locale)];
      return [
        formatShanghaiTime(point.time, input.timeframe),
        ...mainCells,
        price(change, input.pricePrecision, input.locale),
        `${number(previous === 0 ? 0 : (change / previous) * 100, input.locale)}%`,
        number(point.volume, input.locale),
        number(point.turnover, input.locale),
        ...extraCells.map((cell) => cell(point.time))
      ];
    }
  })).reverse();

  return { status: "ready", columns, rows };
}
