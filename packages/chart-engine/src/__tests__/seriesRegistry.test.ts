import { describe, expect, it } from "vitest";
import {
  createSeriesRendererRegistry,
  supportedSeriesTypes,
  type SeriesRenderer
} from "../index";

describe("series renderer registry", () => {
  it("declares the 17 v0.1 chart types in deterministic order", () => {
    expect(supportedSeriesTypes).toEqual([
      "bars",
      "candles",
      "hollowCandles",
      "volumeCandles",
      "line",
      "lineWithMarkers",
      "stepLine",
      "area",
      "hlcArea",
      "baseline",
      "columns",
      "highLow",
      "heikinAshi",
      "renko",
      "lineBreak",
      "kagi",
      "pointAndFigure"
    ]);
  });

  it("registers and retrieves a renderer by series type", () => {
    const registry = createSeriesRendererRegistry();
    const renderer: SeriesRenderer = {
      type: "line",
      render() {},
      getAutoscale() {
        return undefined;
      },
      hitTest() {
        return undefined;
      },
      getTooltipRows() {
        return [];
      }
    };

    registry.register(renderer);

    expect(registry.get("line")).toBe(renderer);
  });

  it("unregisters a renderer and returns the removed value", () => {
    const registry = createSeriesRendererRegistry();
    const renderer: SeriesRenderer = {
      type: "line",
      render() {},
      getAutoscale() {
        return undefined;
      },
      hitTest() {
        return undefined;
      },
      getTooltipRows() {
        return [];
      }
    };

    registry.register(renderer);

    expect(registry.unregister("line")).toBe(renderer);
    expect(registry.get("line")).toBeUndefined();
    expect(registry.unregister("line")).toBeUndefined();
  });

  it("throws a clear error when a renderer is missing", () => {
    const registry = createSeriesRendererRegistry();

    expect(() => registry.require("renko")).toThrow("Series renderer is not registered: renko");
  });
});
