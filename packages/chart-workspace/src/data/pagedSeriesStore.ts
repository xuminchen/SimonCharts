import type { AdjustMode, Candle, ChartSymbol, Timeframe } from "../contracts";
import type { ValidatedSeriesPage } from "./seriesPageValidation";

export const defaultMaxCachedPages = 128;
export const defaultMaxEstimatedBytes = 64 * 1024 * 1024;
const estimatedBytesPerCandle = 64;
const dayMilliseconds = 24 * 60 * 60 * 1_000;
const shanghaiOffsetMilliseconds = 8 * 60 * 60 * 1_000;

export function shanghaiTradingDayKey(time: number): number {
  return Math.floor((time + shanghaiOffsetMilliseconds) / dayMilliseconds);
}

export interface SeriesSelection {
  readonly symbol: ChartSymbol;
  readonly timeframe: Timeframe;
  readonly adjustMode: AdjustMode;
}

export interface PageDescriptor {
  requestCursor?: string;
  beforeCursor?: string;
  hasMoreBefore: boolean;
  dataVersion: string;
  minTime: number;
  maxTime: number;
  sourceCandleCount: number;
  candleCount: number;
  tradingDayKeys: readonly number[];
  excludedOverlapTimes: readonly number[];
  candles?: readonly Candle[];
  lastAccess: number;
  estimatedBytes: number;
}

export interface SeriesStoreSnapshot {
  readonly selection?: Readonly<SeriesSelection>;
  readonly dataVersion?: string;
  readonly descriptors: readonly PageDescriptor[];
  readonly candles: readonly Candle[];
}

export interface SeriesStoreDiagnostics {
  readonly descriptorCount: number;
  readonly cachedPageCount: number;
  readonly estimatedBytes: number;
  readonly maxPages: number;
  readonly maxEstimatedBytes: number;
}

export type PageMergeResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "STORE_NOT_INITIALIZED"
        | "DATA_VERSION_MISMATCH"
        | "UNEXPECTED_CURSOR"
        | "CONFLICTING_BOUNDARY_CANDLE"
        | "RELOAD_DESCRIPTOR_MISMATCH";
      message: string;
    };

export interface PagedSeriesStore {
  reset(selection: SeriesSelection, dataVersion: string): void;
  mergePage(requestCursor: string | undefined, page: ValidatedSeriesPage): PageMergeResult;
  getNextBeforeCursor(): string | undefined;
  getDescriptorForCursor(requestCursor: string | undefined): PageDescriptor | undefined;
  getReloadCursorForTime(time: number): string | undefined;
  listDescriptors(): readonly PageDescriptor[];
  touch(requestCursor: string | undefined): void;
  getSnapshot(): SeriesStoreSnapshot;
  getDiagnostics(): SeriesStoreDiagnostics;
  clear(): void;
}

export interface PagedSeriesStoreOptions {
  readonly maxPages?: number;
  readonly maxEstimatedBytes?: number;
}

function sameCandle(left: Candle, right: Candle): boolean {
  return (
    left.time === right.time &&
    left.open === right.open &&
    left.high === right.high &&
    left.low === right.low &&
    left.close === right.close &&
    left.volume === right.volume &&
    left.turnover === right.turnover
  );
}

function cloneCandle(candle: Candle): Readonly<Candle> {
  return Object.freeze({ ...candle });
}

function cloneDescriptor(descriptor: PageDescriptor): PageDescriptor {
  return Object.freeze({
    ...descriptor,
    ...(descriptor.candles === undefined ? {} : { candles: descriptor.candles })
  });
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function createPagedSeriesStore(
  options: PagedSeriesStoreOptions = {}
): PagedSeriesStore {
  const maxPages = options.maxPages ?? defaultMaxCachedPages;
  const maxEstimatedBytes = options.maxEstimatedBytes ?? defaultMaxEstimatedBytes;
  let selection: Readonly<SeriesSelection> | undefined;
  let dataVersion: string | undefined;
  let descriptors: PageDescriptor[] = [];
  let accessClock = 0;

  const cachedDescriptors = (): PageDescriptor[] =>
    descriptors.filter((descriptor) => descriptor.candles !== undefined);

  const estimatedBytes = (): number =>
    descriptors.reduce((total, descriptor) => total + descriptor.estimatedBytes, 0);

  const evictPayloads = (pinned: PageDescriptor): void => {
    while (cachedDescriptors().length > maxPages || estimatedBytes() > maxEstimatedBytes) {
      const cached = cachedDescriptors();
      const unpinned = cached.filter((descriptor) => descriptor !== pinned);
      const candidates = unpinned.length > 0 ? unpinned : cached;
      const target = candidates.reduce((oldest, descriptor) =>
        descriptor.lastAccess < oldest.lastAccess ? descriptor : oldest
      );
      target.candles = undefined;
      target.estimatedBytes = 0;
    }
  };

  const publicDescriptors = (): readonly PageDescriptor[] =>
    Object.freeze(descriptors.map(cloneDescriptor));

  return {
    reset(nextSelection, nextDataVersion) {
      selection = Object.freeze({
        symbol: Object.freeze({ ...nextSelection.symbol }),
        timeframe: nextSelection.timeframe,
        adjustMode: nextSelection.adjustMode
      });
      dataVersion = nextDataVersion;
      descriptors = [];
      accessClock = 0;
    },

    mergePage(requestCursor, page) {
      if (selection === undefined || dataVersion === undefined) {
        return {
          ok: false,
          code: "STORE_NOT_INITIALIZED",
          message: "Paged series store must be reset before merging pages."
        };
      }
      if (page.dataVersion !== dataVersion) {
        return {
          ok: false,
          code: "DATA_VERSION_MISMATCH",
          message: "Series page dataVersion does not match the active snapshot."
        };
      }

      const existingIndex = descriptors.findIndex(
        (descriptor) => descriptor.requestCursor === requestCursor
      );
      const isReload = existingIndex >= 0;
      const existingDescriptor = descriptors[existingIndex];
      const expectedCursor = descriptors.at(-1)?.beforeCursor;
      if (!isReload && descriptors.length > 0 && requestCursor !== expectedCursor) {
        return {
          ok: false,
          code: "UNEXPECTED_CURSOR",
          message: "Series page request cursor does not continue the descriptor chain."
        };
      }
      if (!isReload && descriptors.length === 0 && requestCursor !== undefined) {
        return {
          ok: false,
          code: "UNEXPECTED_CURSOR",
          message: "The first series page must use an undefined request cursor."
        };
      }

      const trustedCandles = new Map<number, Candle>();
      const deduplicationCandles = new Map<number, Candle>();
      for (const [index, descriptor] of descriptors.entries()) {
        if (isReload && index === existingIndex) continue;
        for (const item of descriptor.candles ?? []) {
          trustedCandles.set(item.time, item);
          if (!isReload || index < existingIndex) deduplicationCandles.set(item.time, item);
        }
      }

      for (const item of page.candles) {
        const duplicate = trustedCandles.get(item.time);
        if (duplicate !== undefined && !sameCandle(duplicate, item)) {
          return {
            ok: false,
            code: "CONFLICTING_BOUNDARY_CANDLE",
            message: "A duplicate boundary candle conflicts with trusted data."
          };
        }
      }

      const excludedOverlapTimes = isReload && existingDescriptor !== undefined
        ? existingDescriptor.excludedOverlapTimes
        : Object.freeze(
            page.candles
              .filter((item) => deduplicationCandles.has(item.time))
              .map((item) => item.time)
          );
      const excludedTimeSet = new Set(excludedOverlapTimes);
      const tradingDayKeys = Object.freeze([
        ...new Set(page.candles.map((item) => shanghaiTradingDayKey(item.time)))
      ].sort((left, right) => left - right));
      const candles = Object.freeze(
        page.candles
          .filter((item) => !excludedTimeSet.has(item.time))
          .map((item) => cloneCandle(item))
      );
      if (
        isReload &&
        existingDescriptor !== undefined &&
        (
          page.beforeCursor !== existingDescriptor.beforeCursor ||
          page.hasMoreBefore !== existingDescriptor.hasMoreBefore ||
          page.candles.length !== existingDescriptor.sourceCandleCount ||
          candles.length !== existingDescriptor.candleCount ||
          !sameNumbers(tradingDayKeys, existingDescriptor.tradingDayKeys) ||
          page.candles[0]?.time !== existingDescriptor.minTime ||
          page.candles.at(-1)?.time !== existingDescriptor.maxTime
        )
      ) {
        return {
          ok: false,
          code: "RELOAD_DESCRIPTOR_MISMATCH",
          message: "Reloaded series page does not match its trusted descriptor boundary."
        };
      }
      const descriptor: PageDescriptor = {
        ...(requestCursor === undefined ? {} : { requestCursor }),
        ...(page.beforeCursor === undefined ? {} : { beforeCursor: page.beforeCursor }),
        hasMoreBefore: page.hasMoreBefore,
        dataVersion: page.dataVersion,
        minTime: page.candles[0]?.time ?? Number.POSITIVE_INFINITY,
        maxTime: page.candles.at(-1)?.time ?? Number.NEGATIVE_INFINITY,
        sourceCandleCount: page.candles.length,
        candleCount: candles.length,
        tradingDayKeys,
        excludedOverlapTimes,
        candles,
        lastAccess: ++accessClock,
        estimatedBytes: candles.length * estimatedBytesPerCandle
      };

      if (isReload) descriptors[existingIndex] = descriptor;
      else descriptors.push(descriptor);
      evictPayloads(descriptor);
      return { ok: true };
    },

    getNextBeforeCursor() {
      const oldest = descriptors.at(-1);
      return oldest?.hasMoreBefore ? oldest.beforeCursor : undefined;
    },

    getDescriptorForCursor(requestCursor) {
      const descriptor = descriptors.find((item) => item.requestCursor === requestCursor);
      return descriptor === undefined ? undefined : cloneDescriptor(descriptor);
    },

    getReloadCursorForTime(time) {
      return descriptors.find((descriptor) => time >= descriptor.minTime && time <= descriptor.maxTime)
        ?.requestCursor;
    },

    listDescriptors() {
      return publicDescriptors();
    },

    touch(requestCursor) {
      const descriptor = descriptors.find((item) => item.requestCursor === requestCursor);
      if (descriptor !== undefined && descriptor.candles !== undefined) {
        descriptor.lastAccess = ++accessClock;
      }
    },

    getSnapshot() {
      const candleMap = new Map<number, Candle>();
      for (const descriptor of descriptors) {
        for (const item of descriptor.candles ?? []) candleMap.set(item.time, item);
      }
      const candles = Object.freeze(
        [...candleMap.values()].sort((left, right) => left.time - right.time)
      );
      return Object.freeze({
        ...(selection === undefined ? {} : { selection }),
        ...(dataVersion === undefined ? {} : { dataVersion }),
        descriptors: publicDescriptors(),
        candles
      });
    },

    getDiagnostics() {
      return Object.freeze({
        descriptorCount: descriptors.length,
        cachedPageCount: cachedDescriptors().length,
        estimatedBytes: estimatedBytes(),
        maxPages,
        maxEstimatedBytes
      });
    },

    clear() {
      selection = undefined;
      dataVersion = undefined;
      descriptors = [];
      accessClock = 0;
    }
  };
}
