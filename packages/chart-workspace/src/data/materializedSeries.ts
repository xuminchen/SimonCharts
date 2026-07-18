import type { CandleSeries } from "@simoncharts/chart-engine";
import type { Candle, ChartIntradayScale, IntradayDayCount } from "../contracts";
import {
  shanghaiTradingDayKey,
  type PagedSeriesStore,
  type SeriesSelection
} from "./pagedSeriesStore";

export interface MaterializedIntradayScale {
  readonly previousClose: number;
  readonly priceLimitPercent?: number;
}

export interface MaterializedSeries {
  selection: SeriesSelection;
  series: CandleSeries;
  sourceIndexOffset: number;
  anchorTime?: number;
  sourceMinTime?: number;
  sourceMaxTime?: number;
  hasMoreBefore: boolean;
  hasKnownOlderData: boolean;
  hasKnownNewerPages: boolean;
  missingRequestCursors: Array<string | undefined>;
  intradayDays?: IntradayDayCount;
  intradayScale?: MaterializedIntradayScale;
}

export interface MaterializeSeriesOptions {
  readonly store: PagedSeriesStore;
  readonly selection: SeriesSelection;
  readonly anchorTime?: number;
  readonly visibleCount: number;
  readonly overscanCount: number;
  readonly intradayDayCount?: IntradayDayCount;
  readonly intradayScale?: ChartIntradayScale;
  readonly additionalCandles?: readonly Candle[];
  readonly availableRequestCursors?: readonly (string | undefined)[];
}

export function materializeSeriesAroundTime(options: MaterializeSeriesOptions): MaterializedSeries {
  const snapshot = options.store.getSnapshot();
  const descriptors = snapshot.descriptors;
  const candleMap = new Map<number, Candle>();
  for (const candle of [...snapshot.candles, ...(options.additionalCandles ?? [])]) {
    candleMap.set(candle.time, candle);
  }
  const allCached = [...candleMap.values()].sort((left, right) => left.time - right.time);
  const intradayDayCount = options.intradayDayCount;
  const intraday = intradayDayCount !== undefined;
  const knownTradingDays = [...new Set([
    ...descriptors.flatMap((descriptor) => descriptor.tradingDayKeys),
    ...allCached.map((candle) => shanghaiTradingDayKey(candle.time))
  ])].sort((left, right) => left - right);
  const selectedTradingDays = intraday
    ? knownTradingDays.slice(-intradayDayCount)
    : [];
  const selectedTradingDaySet = new Set(selectedTradingDays);
  const referenceTradingDay = intraday && selectedTradingDays.length > 0
    ? knownTradingDays[knownTradingDays.indexOf(selectedTradingDays[0]) - 1]
    : undefined;
  const cached = intraday
    ? allCached.filter((candle) => selectedTradingDaySet.has(shanghaiTradingDayKey(candle.time)))
    : allCached;
  const maximumCount = intraday
    ? Math.min(cached.length, intradayDayCount * 1_440 + 1)
    : Math.max(0, options.visibleCount + options.overscanCount * 2);
  const anchorTime = options.anchorTime;
  const anchorDescriptorIndex =
    anchorTime === undefined
      ? 0
      : descriptors.findIndex(
          (descriptor) => anchorTime >= descriptor.minTime && anchorTime <= descriptor.maxTime
        );
  const missingRequestCursors: Array<string | undefined> = [];
  const descriptorIsAvailable = (requestCursor: string | undefined): boolean =>
    options.availableRequestCursors?.some((cursor) => cursor === requestCursor) ?? false;
  const addMissingCursor = (requestCursor: string | undefined): void => {
    if (!missingRequestCursors.some((cursor) => cursor === requestCursor)) {
      missingRequestCursors.push(requestCursor);
    }
  };
  const anchorDescriptor = descriptors[anchorDescriptorIndex];
  if (
    anchorDescriptor !== undefined &&
    anchorDescriptor.candles === undefined &&
    !descriptorIsAvailable(anchorDescriptor.requestCursor)
  ) {
    addMissingCursor(anchorDescriptor.requestCursor);
  }
  const olderAnchorDescriptor = descriptors[anchorDescriptorIndex + 1];
  if (
    !intraday &&
    anchorTime !== undefined &&
    anchorDescriptor !== undefined &&
    anchorTime <= anchorDescriptor.minTime &&
    olderAnchorDescriptor !== undefined &&
    olderAnchorDescriptor.candles === undefined &&
    !descriptorIsAvailable(olderAnchorDescriptor.requestCursor)
  ) {
    addMissingCursor(olderAnchorDescriptor.requestCursor);
  }

  if (intraday) {
    const requiredTradingDays = new Set(selectedTradingDays);
    if (referenceTradingDay !== undefined) requiredTradingDays.add(referenceTradingDay);
    for (const descriptor of descriptors) {
      if (
        descriptor.candles === undefined &&
        !descriptorIsAvailable(descriptor.requestCursor) &&
        descriptor.tradingDayKeys.some((day) => requiredTradingDays.has(day))
      ) addMissingCursor(descriptor.requestCursor);
    }
  }

  let anchorIndex = cached.length - 1;
  if (anchorTime !== undefined && cached.length > 0) {
    anchorIndex = cached.reduce(
      (nearest, candle, index) =>
        Math.abs(candle.time - anchorTime) < Math.abs(cached[nearest].time - anchorTime)
          ? index
          : nearest,
      0
    );
  }
  const desiredBefore = Math.floor(options.visibleCount / 2) + options.overscanCount;
  const maximumStart = Math.max(0, cached.length - maximumCount);
  const start = Math.min(Math.max(0, anchorIndex - desiredBefore), maximumStart);
  const candles = cached.slice(start, start + maximumCount).map((candle) => ({ ...candle }));
  const sourceMinTime = candles[0]?.time;
  const sourceMaxTime = candles.at(-1)?.time;
  const previousTradingDayClose = referenceTradingDay === undefined
    ? undefined
    : allCached
        .filter((candle) => shanghaiTradingDayKey(candle.time) === referenceTradingDay)
        .at(-1)?.close;
  const previousClose = intradayDayCount === 1
    ? options.intradayScale?.previousClose ?? previousTradingDayClose
    : previousTradingDayClose;
  const intradayScale = previousClose !== undefined && Number.isFinite(previousClose) && previousClose > 0
    ? {
        previousClose,
        ...(intradayDayCount === 1 && options.intradayScale?.priceLimitPercent !== undefined
          ? { priceLimitPercent: options.intradayScale.priceLimitPercent }
          : {})
      }
    : undefined;

  if (sourceMinTime !== undefined && sourceMaxTime !== undefined) {
    for (const descriptor of descriptors) {
      if (
        descriptor.candles === undefined &&
        !descriptorIsAvailable(descriptor.requestCursor) &&
        descriptor.maxTime >= sourceMinTime &&
        descriptor.minTime <= sourceMaxTime &&
        !missingRequestCursors.some((cursor) => cursor === descriptor.requestCursor)
      ) {
        addMissingCursor(descriptor.requestCursor);
      }
    }
  }

  let sourceIndexOffset = 0;
  if (sourceMinTime !== undefined) {
    for (const descriptor of [...descriptors].reverse()) {
      if (sourceMinTime >= descriptor.minTime && sourceMinTime <= descriptor.maxTime) {
        const localIndex = descriptor.candles?.findIndex((candle) => candle.time === sourceMinTime) ?? 0;
        sourceIndexOffset += Math.max(0, localIndex);
        break;
      }
      sourceIndexOffset += descriptor.candleCount;
    }
  }

  const series: CandleSeries = {
    symbol: options.selection.symbol.id,
    timeframe: options.selection.timeframe,
    adjustMode: options.selection.adjustMode,
    dataVersion: snapshot.dataVersion ?? "",
    candles
  };

  return {
    selection: options.selection,
    series,
    sourceIndexOffset,
    ...(anchorTime === undefined ? {} : { anchorTime }),
    ...(sourceMinTime === undefined ? {} : { sourceMinTime }),
    ...(sourceMaxTime === undefined ? {} : { sourceMaxTime }),
    hasMoreBefore: intraday ? false : descriptors.at(-1)?.hasMoreBefore ?? false,
    hasKnownOlderData:
      !intraday &&
      sourceMinTime !== undefined &&
      (
        (cached[0] !== undefined && sourceMinTime > cached[0].time) ||
        descriptors.some((descriptor) => descriptor.minTime < sourceMinTime)
      ),
    hasKnownNewerPages:
      anchorDescriptorIndex > 0 ||
      (sourceMaxTime !== undefined && cached.at(-1) !== undefined && sourceMaxTime < cached.at(-1)!.time),
    missingRequestCursors,
    ...(intradayDayCount === undefined ? {} : { intradayDays: intradayDayCount }),
    ...(intradayScale === undefined ? {} : { intradayScale })
  };
}
