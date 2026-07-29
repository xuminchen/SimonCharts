import { describe, expect, it } from "vitest";
import { parseChartSymbol } from "../data/chartSymbol";
import { formatPrice } from "../runtime/priceFormatter";

const symbol = {
  id: "stock:SSE:600000",
  code: "600000",
  name: "浦发银行",
  exchange: "SSE",
  kind: "stock"
} as const;

describe("chart symbol", () => {
  it.each([0, 4, 8])("accepts and defensively clones pricePrecision=%s", (pricePrecision) => {
    const source = { ...symbol, pricePrecision };
    const parsed = parseChartSymbol(source);

    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    source.pricePrecision = 2;
    expect(parsed?.pricePrecision).toBe(pricePrecision);
  });

  it.each([-1, 9, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid pricePrecision=%s",
    (pricePrecision) => {
      expect(parseChartSymbol({ ...symbol, pricePrecision })).toBeUndefined();
    }
  );

  it("keeps legacy symbols valid when pricePrecision is omitted", () => {
    expect(parseChartSymbol(symbol)).toEqual(symbol);
  });

  it("pads explicit precision without exposing negative zero", () => {
    expect(formatPrice(10.2, 4)).toBe("10.2000");
    expect(formatPrice(-0.00001, 4)).toBe("0.0000");
  });
});
