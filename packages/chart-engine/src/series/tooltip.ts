import type { SeriesHitTestResult, SeriesTooltipRow } from "./seriesTypes";

export function getDefaultSeriesTooltipRows(hit: SeriesHitTestResult): SeriesTooltipRow[] {
  const point = hit.point;

  return [
    { label: "Time", value: String(point.time) },
    { label: "Open", value: formatNumber(point.open ?? point.close) },
    { label: "High", value: formatNumber(point.high ?? point.close) },
    { label: "Low", value: formatNumber(point.low ?? point.close) },
    { label: "Close", value: formatNumber(point.close) },
    { label: "Volume", value: formatNumber(point.volume ?? hit.sourceCandle?.volume ?? 0) },
    { label: "Turnover", value: formatNumber(point.turnover ?? hit.sourceCandle?.turnover ?? 0) }
  ];
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
