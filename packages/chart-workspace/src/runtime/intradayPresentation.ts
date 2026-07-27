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
  priceLimitPercent: number,
  additionalPrices: readonly number[] = []
): number {
  const nominalExtent = symmetricPercentageExtentIsSafe(previousClose, priceLimitPercent)
    ? priceLimitPercent
    : 0;
  let observedExtent = nominalExtent;
  for (const candle of candles) {
    const extent = Math.max(
      Math.abs((candle.high / previousClose - 1) * 100),
      Math.abs((candle.low / previousClose - 1) * 100)
    );
    if (symmetricPercentageExtentIsSafe(previousClose, extent)) {
      observedExtent = Math.max(observedExtent, extent);
    }
  }
  for (let index = 0; index < additionalPrices.length; index += 2) {
    const prices = additionalPrices.slice(index, index + 2);
    const extents = prices.map((price) => Math.abs((price / previousClose - 1) * 100));
    const extent = Math.max(...extents);
    if (
      prices.length !== 2 ||
      !symmetricPercentageExtentIsSafe(previousClose, extent)
    ) continue;
    observedExtent = Math.max(observedExtent, extent);
  }
  if (observedExtent <= nominalExtent + Number.EPSILON * 100) return nominalExtent;
  const padded = observedExtent + overflowPaddingPercent;
  const paddedExtent =
    symmetricPercentageExtentIsSafe(previousClose, padded) ? padded : observedExtent;
  const roundedExtent = Math.ceil(
    (paddedExtent - Number.EPSILON * Math.max(1, Math.abs(paddedExtent)) * 16) /
      overflowStepPercent
  )
    * overflowStepPercent;
  const safeExtent = symmetricPercentageExtentIsSafe(previousClose, roundedExtent)
    ? roundedExtent
    : paddedExtent;
  return Math.max(observedExtent, safeExtent);
}

function symmetricPercentageExtentIsSafe(
  previousClose: number,
  extent: number
): boolean {
  return (
    Number.isFinite(extent) &&
    extent >= 0 &&
    Number.isFinite(extent * 2) &&
    Number.isFinite(previousClose * (1 - extent / 100)) &&
    Number.isFinite(previousClose * (1 + extent / 100))
  );
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
