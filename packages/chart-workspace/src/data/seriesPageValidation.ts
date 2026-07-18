import type { Candle, SeriesPage } from "../contracts";

export type SeriesPageValidationCode =
  | "EMPTY_DATA_VERSION"
  | "INVALID_CANDLE"
  | "CANDLE_AFTER_CUTOFF"
  | "DUPLICATE_TIME"
  | "NON_INCREASING_TIME"
  | "MISSING_CURSOR"
  | "CURSOR_NOT_ADVANCING"
  | "PAGE_NOT_EARLIER";

export interface ValidatedSeriesPage {
  readonly candles: readonly Readonly<Candle>[];
  readonly beforeCursor?: string;
  readonly hasMoreBefore: boolean;
  readonly dataVersion: string;
}

export interface SeriesPageValidationContext {
  readonly requestCursor?: string;
  readonly seenCursors: ReadonlySet<string>;
  readonly currentEarliestTime?: number;
  readonly dataCutoffTime?: number;
}

export type SeriesPageValidationResult =
  | { ok: true; page: ValidatedSeriesPage }
  | {
      ok: false;
      code: SeriesPageValidationCode;
      message: string;
      invalidIndex?: number;
    };

function isValidCandle(candle: Candle): boolean {
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
    candle.low <= Math.min(candle.open, candle.close) &&
    Math.max(candle.open, candle.close) <= candle.high
  );
}

function invalid(
  code: SeriesPageValidationCode,
  message: string,
  invalidIndex?: number
): SeriesPageValidationResult {
  return invalidIndex === undefined
    ? { ok: false, code, message }
    : { ok: false, code, message, invalidIndex };
}

export function validateSeriesPage(
  page: SeriesPage,
  context: SeriesPageValidationContext
): SeriesPageValidationResult {
  if (page.dataVersion.trim().length === 0) {
    return invalid("EMPTY_DATA_VERSION", "Series page dataVersion must not be empty.");
  }

  for (let index = 0; index < page.candles.length; index += 1) {
    if (!isValidCandle(page.candles[index])) {
      return invalid("INVALID_CANDLE", "Series page contains an invalid candle.", index);
    }
  }

  if (context.dataCutoffTime !== undefined) {
    for (let index = 0; index < page.candles.length; index += 1) {
      if (page.candles[index].time > context.dataCutoffTime) {
        return invalid(
          "CANDLE_AFTER_CUTOFF",
          "Series page contains a candle after the configured data cutoff.",
          index
        );
      }
    }
  }

  const seenTimes = new Set<number>();
  for (let index = 0; index < page.candles.length; index += 1) {
    const time = page.candles[index].time;
    if (seenTimes.has(time)) {
      return invalid("DUPLICATE_TIME", "Series page contains a duplicate candle time.", index);
    }
    seenTimes.add(time);
  }

  for (let index = 1; index < page.candles.length; index += 1) {
    if (page.candles[index].time <= page.candles[index - 1].time) {
      return invalid(
        "NON_INCREASING_TIME",
        "Series page candle times must be strictly increasing.",
        index
      );
    }
  }

  if (page.hasMoreBefore && (page.beforeCursor === undefined || page.beforeCursor.length === 0)) {
    return invalid("MISSING_CURSOR", "Series page must provide a cursor for older history.");
  }

  if (
    page.beforeCursor !== undefined &&
    (page.beforeCursor === context.requestCursor || context.seenCursors.has(page.beforeCursor))
  ) {
    return invalid("CURSOR_NOT_ADVANCING", "Series page cursor does not advance pagination.");
  }

  const currentEarliestTime = context.currentEarliestTime;
  if (
    context.requestCursor !== undefined &&
    currentEarliestTime !== undefined &&
    !page.candles.some((item) => item.time < currentEarliestTime)
  ) {
    return invalid("PAGE_NOT_EARLIER", "Series page contains no candle earlier than current data.");
  }

  const candles = Object.freeze(
    page.candles.map((item) => Object.freeze({ ...item }))
  );
  const validated = Object.freeze({
    candles,
    ...(page.beforeCursor === undefined ? {} : { beforeCursor: page.beforeCursor }),
    hasMoreBefore: page.hasMoreBefore,
    dataVersion: page.dataVersion
  });

  return { ok: true, page: validated };
}
