import type { Candle, CandleSeries } from "@simoncharts/chart-engine";

const dayMs = 24 * 60 * 60 * 1_000;
const startTime = Date.UTC(2026, 0, 1);
const candleCount = 120;

function createFixtureCandle(index: number): Candle {
  const baseline = 100 + index * 0.35;
  const wave = (index % 12) - 6;
  const open = Number((baseline + wave * 0.18).toFixed(2));
  const close = Number((open + ((index % 7) - 3) * 0.22).toFixed(2));
  const high = Number((Math.max(open, close) + 1.1 + (index % 5) * 0.07).toFixed(2));
  const low = Number((Math.min(open, close) - 1.05 - (index % 4) * 0.06).toFixed(2));
  const volume = 50_000 + index * 320 + (index % 9) * 125;

  return {
    time: startTime + index * dayMs,
    open,
    high,
    low,
    close,
    volume,
    turnover: Number((volume * close).toFixed(2))
  };
}

export const fixtureDailyCandleSeries: CandleSeries = {
  symbol: "SIMON",
  timeframe: "1d",
  adjustMode: "none",
  dataVersion: "fixture-2026-06-23",
  candles: Array.from({ length: candleCount }, (_, index) => createFixtureCandle(index))
};
