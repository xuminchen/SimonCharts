import { describe, expect, it } from "vitest";
import type { Candle, SeriesPage } from "../index";
import { validateSeriesPage } from "../data/seriesPageValidation";

const candle = (time: number): Candle => ({
  time,
  open: 10,
  high: 12,
  low: 9,
  close: 11,
  volume: 100,
  turnover: 1_100
});

const validPage: SeriesPage = {
  candles: [candle(100), candle(150)],
  beforeCursor: "cursor-3",
  hasMoreBefore: true,
  dataVersion: "revision-1"
};

const context = {
  requestCursor: "cursor-2",
  seenCursors: new Set(["cursor-1", "cursor-2"]),
  currentEarliestTime: 200
};

describe("series page validation", () => {
  it("accepts by cloning and deeply freezing an atomic page", () => {
    const result = validateSeriesPage(validPage, context);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.page).not.toBe(validPage);
    expect(result.page.candles).not.toBe(validPage.candles);
    expect(result.page.candles[0]).not.toBe(validPage.candles[0]);
    expect(Object.isFrozen(result.page)).toBe(true);
    expect(Object.isFrozen(result.page.candles)).toBe(true);
    expect(Object.isFrozen(result.page.candles[0])).toBe(true);
  });

  it("rejects an empty data version before candle validation", () => {
    const invalid = { ...validPage, dataVersion: " ", candles: [{ ...candle(100), open: NaN }] };
    expect(validateSeriesPage(invalid, context)).toMatchObject({
      ok: false,
      code: "EMPTY_DATA_VERSION"
    });
  });

  it.each([
    ["time", NaN],
    ["open", Infinity],
    ["high", -Infinity],
    ["low", 0],
    ["close", -1],
    ["volume", -1],
    ["turnover", -1]
  ] as const)("rejects invalid candle field %s", (field, value) => {
    const invalid = { ...candle(100), [field]: value };
    expect(validateSeriesPage({ ...validPage, candles: [invalid] }, context)).toMatchObject({
      ok: false,
      code: "INVALID_CANDLE",
      invalidIndex: 0
    });
  });

  it.each([
    { low: 11 },
    { high: 10 }
  ])("rejects invalid OHLC bounds", (change) => {
    const invalid = { ...candle(100), ...change };
    expect(validateSeriesPage({ ...validPage, candles: [invalid] }, context)).toMatchObject({
      ok: false,
      code: "INVALID_CANDLE",
      invalidIndex: 0
    });
  });

  it("rejects duplicate times before the ordering check", () => {
    const page = { ...validPage, candles: [candle(100), candle(150), candle(100)] };
    expect(validateSeriesPage(page, context)).toMatchObject({
      ok: false,
      code: "DUPLICATE_TIME",
      invalidIndex: 2
    });
  });

  it("rejects descending candle time", () => {
    const page = { ...validPage, candles: [candle(150), candle(100)] };
    expect(validateSeriesPage(page, context)).toMatchObject({
      ok: false,
      code: "NON_INCREASING_TIME",
      invalidIndex: 1
    });
  });

  it("requires a non-empty next cursor when older history exists", () => {
    const page = { ...validPage, beforeCursor: "" };
    expect(validateSeriesPage(page, context)).toMatchObject({
      ok: false,
      code: "MISSING_CURSOR"
    });
  });

  it("rejects a cursor already present in the pagination chain", () => {
    const page = { ...validPage, beforeCursor: "cursor-1" };
    expect(validateSeriesPage(page, context)).toMatchObject({
      ok: false,
      code: "CURSOR_NOT_ADVANCING"
    });
  });

  it("rejects a history page with no candle earlier than current data", () => {
    const page = { ...validPage, candles: [candle(200), candle(250)] };
    expect(validateSeriesPage(page, context)).toMatchObject({
      ok: false,
      code: "PAGE_NOT_EARLIER"
    });
  });
});
