import { describe, expect, it } from "vitest";
import { createEngineCapabilityManifest } from "@simoncharts/chart-engine";
import { normalizeDataCapabilities } from "../data/capabilities";
import { createToolbarModel } from "../ui/topToolbar";

describe("workspace capability matrix", () => {
  it("derives every toolbar capability from the engine manifest", () => {
    const model = createToolbarModel(createEngineCapabilityManifest());
    expect(model.timeframes).toHaveLength(8);
    expect(model.seriesTypes).toHaveLength(17);
    expect(model.indicators).toHaveLength(16);
    expect(model.priceScaleModes).toEqual(["linear", "log", "percentage"]);
    expect(createEngineCapabilityManifest().drawingTools).toHaveLength(63);
    expect(model.adjustModes).toEqual(["none", "forward", "backward"]);
  });

  it("preserves an exact non-cartesian provider matrix", () => {
    const capabilities = {
      series: [
        { timeframe: "1d" as const, adjustModes: ["forward" as const] },
        { timeframe: "5m" as const, adjustModes: ["none" as const] }
      ]
    };
    const daily = createToolbarModel(createEngineCapabilityManifest(), capabilities, "1d");
    const intraday = createToolbarModel(createEngineCapabilityManifest(), capabilities, "5m");

    expect(daily.timeframes).toEqual(["5m", "1d"]);
    expect(daily.adjustModes).toEqual(["forward"]);
    expect(intraday.adjustModes).toEqual(["none"]);
  });

  it("forces indexes to none and rejects empty capability declarations", () => {
    const index = { id: "index", code: "000001", name: "上证指数", exchange: "SSE" as const, kind: "index" as const };

    expect(normalizeDataCapabilities(index, {
      series: [{ timeframe: "1d", adjustModes: ["none", "forward"] }]
    })).toEqual({ series: [{ timeframe: "1d", adjustModes: ["none"] }] });
    expect(normalizeDataCapabilities(index, {
      series: []
    })).toBeUndefined();
  });

  it("validates and freezes the optional intraday scale contract", () => {
    const stock = { id: "stock", code: "600000", name: "浦发银行", exchange: "SSE" as const, kind: "stock" as const };
    const series = [{ timeframe: "1m" as const, adjustModes: ["forward" as const] }];

    const fixed = normalizeDataCapabilities(stock, {
      series,
      intradayScale: { previousClose: 10, priceLimitPercent: 20 }
    });
    const unlimited = normalizeDataCapabilities(stock, {
      series,
      intradayScale: { previousClose: 10 }
    });

    expect(fixed?.intradayScale).toEqual({ previousClose: 10, priceLimitPercent: 20 });
    expect(Object.isFrozen(fixed?.intradayScale)).toBe(true);
    expect(unlimited?.intradayScale).toEqual({ previousClose: 10 });
    for (const intradayScale of [
      null,
      { previousClose: 0 },
      { previousClose: Number.NaN },
      { previousClose: 10, priceLimitPercent: 0 },
      { previousClose: 10, priceLimitPercent: 101 }
    ]) {
      expect(normalizeDataCapabilities(stock, {
        series,
        intradayScale
      } as never)).toBeUndefined();
    }
  });
});
