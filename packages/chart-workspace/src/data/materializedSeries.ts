import type { CandleSeries } from "@simoncharts/chart-engine";
import type { PagedSeriesStore, SeriesSelection } from "./pagedSeriesStore";

export interface MaterializedSeries {
  series: CandleSeries;
  sourceIndexOffset: number;
  anchorTime?: number;
  sourceMinTime?: number;
  sourceMaxTime?: number;
  hasMoreBefore: boolean;
  hasKnownNewerPages: boolean;
  missingRequestCursors: Array<string | undefined>;
}

export interface MaterializeSeriesOptions {
  readonly store: PagedSeriesStore;
  readonly selection: SeriesSelection;
  readonly anchorTime?: number;
  readonly visibleCount: number;
  readonly overscanCount: number;
}

export function materializeSeriesAroundTime(options: MaterializeSeriesOptions): MaterializedSeries {
  const snapshot = options.store.getSnapshot();
  const descriptors = snapshot.descriptors;
  const cached = [...snapshot.candles].sort((left, right) => left.time - right.time);
  const maximumCount = Math.max(0, options.visibleCount + options.overscanCount * 2);
  const anchorTime = options.anchorTime;
  const anchorDescriptorIndex =
    anchorTime === undefined
      ? 0
      : descriptors.findIndex(
          (descriptor) => anchorTime >= descriptor.minTime && anchorTime <= descriptor.maxTime
        );
  const missingRequestCursors: Array<string | undefined> = [];
  const anchorDescriptor = descriptors[anchorDescriptorIndex];
  if (anchorDescriptor?.candles === undefined) {
    missingRequestCursors.push(anchorDescriptor.requestCursor);
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

  if (sourceMinTime !== undefined && sourceMaxTime !== undefined) {
    for (const descriptor of descriptors) {
      if (
        descriptor.candles === undefined &&
        descriptor.maxTime >= sourceMinTime &&
        descriptor.minTime <= sourceMaxTime &&
        !missingRequestCursors.includes(descriptor.requestCursor)
      ) {
        missingRequestCursors.push(descriptor.requestCursor);
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
    series,
    sourceIndexOffset,
    ...(anchorTime === undefined ? {} : { anchorTime }),
    ...(sourceMinTime === undefined ? {} : { sourceMinTime }),
    ...(sourceMaxTime === undefined ? {} : { sourceMaxTime }),
    hasMoreBefore: descriptors.at(-1)?.hasMoreBefore ?? false,
    hasKnownNewerPages: anchorDescriptorIndex > 0,
    missingRequestCursors
  };
}
