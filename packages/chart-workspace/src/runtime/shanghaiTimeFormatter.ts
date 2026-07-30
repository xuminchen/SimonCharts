import type { ChartLocale, Timeframe } from "../contracts";

const intradayTimeframes = new Set<Timeframe>(["1m", "5m", "15m", "30m", "60m"]);
const executionTimeFormatters: Record<ChartLocale, Intl.DateTimeFormat> = {
  "zh-CN": executionTimeFormatter("zh-CN"),
  "en-US": executionTimeFormatter("en-US")
};
const shanghaiPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function executionTimeFormatter(locale: ChartLocale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
}

function parts(epoch: number): Record<string, string> {
  return Object.fromEntries(
    shanghaiPartsFormatter
      .formatToParts(new Date(epoch))
      .map((part) => [part.type, part.value])
  );
}

export function formatShanghaiTime(epoch: number, timeframe: Timeframe): string {
  const value = parts(epoch);
  const date = `${value.year}-${value.month}-${value.day}`;
  return intradayTimeframes.has(timeframe) ? `${date} ${value.hour}:${value.minute}` : date;
}

export function formatShanghaiExecutionTime(
  firstTime: number,
  lastTime: number | undefined,
  locale: ChartLocale
): string {
  const formatter = executionTimeFormatters[locale];
  const first = formatter.format(new Date(firstTime));
  if (lastTime === undefined || firstTime === lastTime) return first;
  const last = formatter.format(new Date(lastTime));
  return first === last
    ? `${first} – ${last}`
    : formatter.formatRange(new Date(firstTime), new Date(lastTime));
}
