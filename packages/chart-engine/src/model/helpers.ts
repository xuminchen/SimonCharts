import type { Candle, CandleSeries } from "./market";

export function isValidCandle(candle: Candle): boolean {
  return (
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume) &&
    Number.isFinite(candle.turnover) &&
    candle.open > 0 &&
    candle.high > 0 &&
    candle.low > 0 &&
    candle.close > 0 &&
    candle.volume >= 0 &&
    candle.turnover >= 0 &&
    candle.low <= candle.open &&
    candle.low <= candle.high &&
    candle.low <= candle.close &&
    candle.open <= candle.high &&
    candle.close <= candle.high
  );
}

export function assertCandleSeries(series: CandleSeries): void {
  if (series.candles.length === 0) {
    throw new Error("Candle series must contain at least one candle");
  }

  for (let index = 0; index < series.candles.length; index += 1) {
    const candle = series.candles[index];

    if (!isValidCandle(candle)) {
      throw new Error(`Candle at index ${index} has invalid OHLC bounds`);
    }

    if (index > 0 && candle.time <= series.candles[index - 1].time) {
      throw new Error(`Candle time must be strictly increasing at index ${index}`);
    }
  }
}

export function getCandleAtIndex(series: CandleSeries, index: number): Candle | undefined {
  return series.candles[index];
}

export function findCandleByTime(series: CandleSeries, time: number): Candle | undefined {
  return series.candles.find((candle) => candle.time === time);
}
