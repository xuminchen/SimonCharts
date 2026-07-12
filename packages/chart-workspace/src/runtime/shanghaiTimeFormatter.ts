import type { Timeframe } from "../contracts";

const intradayTimeframes = new Set<Timeframe>(["1m", "5m", "15m", "30m", "60m"]);

function parts(epoch: number): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(new Date(epoch))
      .map((part) => [part.type, part.value])
  );
}

export function formatShanghaiTime(epoch: number, timeframe: Timeframe): string {
  const value = parts(epoch);
  const date = `${value.year}-${value.month}-${value.day}`;
  return intradayTimeframes.has(timeframe) ? `${date} ${value.hour}:${value.minute}` : date;
}
