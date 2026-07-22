import type { MovingAveragePoint, TimeCoordinateMap } from "@simoncharts/chart-engine";
import type { Candle } from "../contracts";
import { shanghaiTradingDayKey } from "../data/pagedSeriesStore";

const shanghaiOffsetMilliseconds = 8 * 60 * 60 * 1_000;
const morningStartMinute = 9 * 60 + 30;
const morningEndMinute = 11 * 60 + 30;
const afternoonStartMinute = 13 * 60;
const afternoonEndMinute = 15 * 60;
const morningMinuteSpan = morningEndMinute - morningStartMinute;
const afternoonMinuteSpan = afternoonEndMinute - afternoonStartMinute;
const intradaySlotCount = morningMinuteSpan + afternoonMinuteSpan + 2;
const overflowPaddingPercent = 0.1;
const overflowStepPercent = 0.1;

export function calculateFixedIntradayPercentExtent(
  candles: readonly Candle[],
  previousClose: number,
  priceLimitPercent: number
): number {
  let observedExtent = priceLimitPercent;
  for (const candle of candles) {
    observedExtent = Math.max(
      observedExtent,
      Math.abs((candle.high / previousClose - 1) * 100),
      Math.abs((candle.low / previousClose - 1) * 100)
    );
  }
  if (observedExtent <= priceLimitPercent + Number.EPSILON * 100) return priceLimitPercent;
  return Math.ceil((observedExtent + overflowPaddingPercent) / overflowStepPercent)
    * overflowStepPercent;
}

export function calculateIntradayAverage(
  candles: readonly Candle[]
): MovingAveragePoint[] {
  let tradingDay: number | undefined;
  let cumulativeVolume = 0;
  let cumulativeTurnover = 0;

  return candles.map((candle) => {
    const nextTradingDay = shanghaiTradingDayKey(candle.time);
    if (nextTradingDay !== tradingDay) {
      tradingDay = nextTradingDay;
      cumulativeVolume = 0;
      cumulativeTurnover = 0;
    }
    cumulativeVolume += candle.volume;
    cumulativeTurnover += candle.turnover;
    return {
      time: candle.time,
      value: cumulativeVolume > 0 ? cumulativeTurnover / cumulativeVolume : undefined
    };
  });
}

export function createIntradayTimeCoordinates(
  candles: readonly Candle[],
  plotWidth: number
): TimeCoordinateMap | undefined {
  if (candles.length === 0 || !Number.isFinite(plotWidth) || plotWidth <= 0) return undefined;

  const tradingDays: number[] = [];
  const dayIndexByKey = new Map<number, number>();
  const dayStartIndices: number[] = [];
  for (const [index, candle] of candles.entries()) {
    const day = shanghaiTradingDayKey(candle.time);
    if (dayIndexByKey.has(day)) continue;
    dayIndexByKey.set(day, tradingDays.length);
    tradingDays.push(day);
    dayStartIndices.push(index);
  }

  const dayWidth = plotWidth / tradingDays.length;
  const minuteSlotWidth = dayWidth / intradaySlotCount;
  const positions = candles.map((candle) => {
    const dayIndex = dayIndexByKey.get(shanghaiTradingDayKey(candle.time)) ?? 0;
    return dayIndex * dayWidth
      + (tradingMinuteSlot(candle.time) + 0.5) * minuteSlotWidth;
  });

  return {
    positions,
    barWidth: minuteSlotWidth * 0.7,
    dayStartIndices,
    dayStartOffsets: tradingDays.map((_, index) => index * dayWidth)
  };
}

function tradingMinuteSlot(time: number): number {
  const shanghai = new Date(time + shanghaiOffsetMilliseconds);
  const minute = shanghai.getUTCHours() * 60 + shanghai.getUTCMinutes();
  return minute <= morningEndMinute
    ? clamp(minute - morningStartMinute, 0, morningMinuteSpan)
    : morningMinuteSpan + 1
      + clamp(minute - afternoonStartMinute, 0, afternoonMinuteSpan);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
