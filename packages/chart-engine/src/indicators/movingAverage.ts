import type { CandleSeries } from "../model/market";

export type MovingAveragePeriod = 5 | 10 | 20 | 60;

export interface MovingAveragePoint {
  time: number;
  value: number | undefined;
}

export function calculateMovingAverage(
  series: CandleSeries,
  period: number
): MovingAveragePoint[] {
  if (!Number.isFinite(period) || !Number.isInteger(period)) {
    throw new Error("Moving average period must be a finite integer");
  }

  if (period <= 0) {
    throw new Error("Moving average period must be greater than 0");
  }

  let closeSum = 0;

  return series.candles.map((candle, index) => {
    closeSum += candle.close;

    if (index >= period) {
      closeSum -= series.candles[index - period].close;
    }

    return {
      time: candle.time,
      value: index >= period - 1 ? closeSum / period : undefined
    };
  });
}

export function calculateDefaultMovingAverages(
  series: CandleSeries
): Record<"MA5" | "MA10" | "MA20" | "MA60", MovingAveragePoint[]> {
  return {
    MA5: calculateMovingAverage(series, 5),
    MA10: calculateMovingAverage(series, 10),
    MA20: calculateMovingAverage(series, 20),
    MA60: calculateMovingAverage(series, 60)
  };
}
