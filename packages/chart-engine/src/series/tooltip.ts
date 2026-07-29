import type {
  SeriesHitTestResult,
  SeriesTooltipRow,
  TooltipFormattingContext
} from "./seriesTypes";

export function getDefaultSeriesTooltipRows(
  hit: SeriesHitTestResult,
  formatting: TooltipFormattingContext
): SeriesTooltipRow[] {
  const point = hit.point;

  return [
    { label: "Time", value: formatting.formatTime(point.time, formatting.timeframe) },
    { label: "Open", value: formatPrice(point.open ?? point.close, formatting) },
    { label: "High", value: formatPrice(point.high ?? point.close, formatting) },
    { label: "Low", value: formatPrice(point.low ?? point.close, formatting) },
    { label: "Close", value: formatPrice(point.close, formatting) },
    { label: "Volume", value: formatNumber(point.volume ?? hit.sourceCandle?.volume ?? 0) },
    { label: "Turnover", value: formatNumber(point.turnover ?? hit.sourceCandle?.turnover ?? 0) }
  ];
}

function formatPrice(value: number, formatting: TooltipFormattingContext): string {
  return formatting.formatPrice?.(value) ?? formatNumber(value);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
