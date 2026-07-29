import { describe, expect, it } from "vitest";
import type { ChartComparison, ChartSymbol } from "../contracts";
import {
  chartComparisonColors,
  maxChartComparisons,
  parseComparisons
} from "../data/comparisons";

const main: ChartSymbol = {
  id: "stock:SSE:600000",
  code: "600000",
  name: "浦发银行",
  exchange: "SSE",
  kind: "stock"
};

const compare: ChartComparison = {
  symbol: {
    id: "stock:SZSE:000001",
    code: "000001",
    name: "平安银行",
    exchange: "SZSE",
    kind: "stock",
    pricePrecision: 2
  },
  color: "#7c83ff",
  visible: false
};

describe("comparison public contract", () => {
  it("normalizes defaults and returns a defensive copy", () => {
    const source = [{ symbol: { ...compare.symbol } }];
    const parsed = parseComparisons(source, main);

    expect(parsed).toEqual([{
      symbol: compare.symbol,
      color: chartComparisonColors[0],
      visible: true
    }]);
    expect(parsed).not.toBe(source);
    expect(parsed[0]!.symbol).not.toBe(source[0]!.symbol);

    source[0]!.symbol.name = "changed";
    expect(parsed[0]!.symbol.name).toBe("平安银行");
  });

  it("accepts bounded concrete colors and explicit visibility", () => {
    expect(parseComparisons([compare], main)).toEqual([compare]);
  });

  it("assigns stable distinct colors when callers omit them", () => {
    const second = {
      ...compare,
      symbol: { ...compare.symbol, id: "stock:SZSE:000002", code: "000002" },
      color: undefined
    };

    expect(parseComparisons([
      { symbol: compare.symbol },
      { symbol: second.symbol }
    ], main).map((item) => item.color)).toEqual(
      chartComparisonColors.slice(0, 2)
    );
  });

  it.each([
    undefined,
    {},
    [{ symbol: main }],
    [compare, compare],
    [{ ...compare, visible: "yes" }],
    [{ ...compare, color: "var(--host-color)" }],
    [{ ...compare, extra: true }],
    Array.from({ length: maxChartComparisons + 1 }, (_, index) => ({
      symbol: { ...compare.symbol, id: `stock:SZSE:${index}`, code: String(index) }
    }))
  ])("rejects invalid comparison batches atomically", (value) => {
    expect(() => parseComparisons(value, main)).toThrow(TypeError);
  });
});
