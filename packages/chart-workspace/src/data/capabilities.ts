import type {
  AdjustMode,
  ChartDataCapabilities,
  ChartDataSeriesCapability,
  ChartSymbol,
  Timeframe
} from "../contracts";

const timeframes: readonly Timeframe[] = Object.freeze([
  "1m", "5m", "15m", "30m", "60m", "1d", "1w", "1mo"
]);
const adjustModes: readonly AdjustMode[] = Object.freeze(["none", "forward", "backward"]);

function isUniqueSubset<T extends string>(value: unknown, allowed: readonly T[]): value is readonly T[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => allowed.includes(item as T)) &&
    new Set(value).size === value.length
  );
}

export function normalizeDataCapabilities(
  symbol: ChartSymbol,
  value: ChartDataCapabilities
): ChartDataCapabilities | undefined {
  if (!Array.isArray(value?.series) || value.series.length === 0) return undefined;
  const intradayScale = value.intradayScale;
  if (
    intradayScale !== undefined &&
    (
      intradayScale === null ||
      typeof intradayScale !== "object" ||
      !Number.isFinite(intradayScale.previousClose) ||
      intradayScale.previousClose <= 0 ||
      (intradayScale.priceLimitPercent !== undefined && (
        !Number.isFinite(intradayScale.priceLimitPercent) ||
        intradayScale.priceLimitPercent <= 0 ||
        intradayScale.priceLimitPercent > 100
      ))
    )
  ) return undefined;
  const declaredTimeframes = value.series.map((item) => item?.timeframe);
  if (!isUniqueSubset(declaredTimeframes, timeframes)) return undefined;
  const series: ChartDataSeriesCapability[] = [];
  for (const item of value.series) {
    if (!isUniqueSubset(item?.adjustModes, adjustModes)) return undefined;
    if (symbol.kind === "index" && !item.adjustModes.includes("none")) return undefined;
    const normalizedAdjustModes: readonly AdjustMode[] =
      symbol.kind === "index" ? ["none"] : [...item.adjustModes];
    series.push(Object.freeze({
      timeframe: item.timeframe,
      adjustModes: Object.freeze(normalizedAdjustModes)
    }));
  }
  return Object.freeze({
    series: Object.freeze(series),
    ...(intradayScale === undefined
      ? {}
      : {
          intradayScale: Object.freeze({
            previousClose: intradayScale.previousClose,
            ...(intradayScale.priceLimitPercent === undefined
              ? {}
              : { priceLimitPercent: intradayScale.priceLimitPercent })
          })
        })
  });
}

export function selectSupportedTimeframe(
  capabilities: ChartDataCapabilities,
  preferred: Timeframe
): Timeframe {
  if (capabilities.series.some((item) => item.timeframe === preferred)) return preferred;
  if (capabilities.series.some((item) => item.timeframe === "1d")) return "1d";
  return capabilities.series[0].timeframe;
}

export function adjustModesForTimeframe(
  capabilities: ChartDataCapabilities,
  timeframe: Timeframe
): readonly AdjustMode[] {
  return capabilities.series.find((item) => item.timeframe === timeframe)?.adjustModes ?? [];
}

export function selectSupportedAdjustMode(
  symbol: ChartSymbol,
  capabilities: ChartDataCapabilities,
  timeframe: Timeframe,
  preferred: AdjustMode
): AdjustMode {
  if (symbol.kind === "index") return "none";
  const supported = adjustModesForTimeframe(capabilities, timeframe);
  if (supported.includes(preferred)) return preferred;
  if (supported.includes("forward")) return "forward";
  if (supported.includes("none")) return "none";
  return supported[0];
}
