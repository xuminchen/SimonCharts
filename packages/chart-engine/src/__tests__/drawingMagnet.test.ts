import { describe, expect, it } from "vitest";
import {
  createDrawingAnchorMagnetTargets,
  createMainPanelPriceScale,
  createOhlcMagnetTargetsFromSeries,
  getMagnetSnapState,
  priceToY,
  type CandleSeries,
  type ViewportState
} from "../index";

function createSeries(): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: [
      { time: 1, open: 10, high: 14, low: 8, close: 12, volume: 1, turnover: 12 },
      { time: 2, open: 12, high: 18, low: 11, close: 17, volume: 1, turnover: 17 },
      { time: 3, open: 17, high: 20, low: 15, close: 16, volume: 1, turnover: 16 }
    ]
  };
}

const viewport: ViewportState = {
  visibleRange: { from: 1, to: 2 },
  candleWidth: 10,
  scrollOffset: 0,
  priceScaleMode: "linear"
};

const linearPriceScale = { mode: "linear", basePrice: 1, min: 10, max: 20 } as const;

describe("OHLC magnet target projection", () => {
  it("does not expose non-interactive drawing anchors as magnet targets", () => {
    expect(createDrawingAnchorMagnetTargets([
      {
        id: "active",
        type: "trendLine",
        anchors: [{ x: 1, y: 2 }]
      },
      {
        id: "passive",
        type: "trendLine",
        anchors: [{ x: 3, y: 4 }],
        interactive: false
      }
    ])).toEqual([{
      type: "drawingAnchor",
      x: 1,
      y: 2,
      drawingId: "active",
      anchorIndex: 0
    }]);
  });

  it("creates targets for visible candle OHLC values", () => {
    expect(
      createOhlcMagnetTargetsFromSeries({
        series: createSeries(),
        viewport,
        plotArea: { x: 100, y: 20, width: 200, height: 100 },
        priceScale: linearPriceScale,
        fields: ["high", "low"]
      })
    ).toEqual([
      { type: "ohlc", x: 105, y: 40, field: "high", dataIndex: 1 },
      { type: "ohlc", x: 105, y: 110, field: "low", dataIndex: 1 },
      { type: "ohlc", x: 115, y: 20, field: "high", dataIndex: 2 },
      { type: "ohlc", x: 115, y: 70, field: "low", dataIndex: 2 }
    ]);
  });

  it("uses the supplied shared price scale", () => {
    const targets = createOhlcMagnetTargetsFromSeries({
      series: createSeries(),
      viewport,
      plotArea: { x: 0, y: 0, width: 200, height: 100 },
      priceScale: linearPriceScale,
      fields: ["close"]
    });

    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatchObject({ type: "ohlc", field: "close", dataIndex: 1 });
    expect(Number.isFinite(targets[0].y)).toBe(true);
  });

  it("defaults to all OHLC fields", () => {
    const targets = createOhlcMagnetTargetsFromSeries({
      series: createSeries(),
      viewport: { ...viewport, visibleRange: { from: 2, to: 2 } },
      plotArea: { x: 0, y: 0, width: 200, height: 100 },
      priceScale: linearPriceScale
    });

    expect(targets.map((target) => target.field)).toEqual(["open", "high", "low", "close"]);
    expect(targets.every((target) => target.dataIndex === 2)).toBe(true);
  });

  it("clamps visible ranges to available candle indices", () => {
    const targets = createOhlcMagnetTargetsFromSeries({
      series: createSeries(),
      viewport: { ...viewport, visibleRange: { from: -5, to: 20 } },
      plotArea: { x: 0, y: 0, width: 200, height: 100 },
      priceScale: { mode: "linear", basePrice: 1, min: 0, max: 20 },
      fields: ["open"]
    });

    expect(targets.map((target) => target.dataIndex)).toEqual([0, 1, 2]);
    expect(targets.every((target) => Number.isFinite(target.x) && Number.isFinite(target.y))).toBe(
      true
    );
  });

  it("returns no targets for empty or inverted visible ranges", () => {
    expect(
      createOhlcMagnetTargetsFromSeries({
        series: { ...createSeries(), candles: [] },
        viewport,
        plotArea: { x: 0, y: 0, width: 100, height: 100 },
        priceScale: linearPriceScale
      })
    ).toEqual([]);

    expect(
      createOhlcMagnetTargetsFromSeries({
        series: createSeries(),
        viewport: { ...viewport, visibleRange: { from: 4, to: 2 } },
        plotArea: { x: 0, y: 0, width: 100, height: 100 },
        priceScale: linearPriceScale
      })
    ).toEqual([]);
  });

  it("feeds projected targets into snap state", () => {
    const targets = createOhlcMagnetTargetsFromSeries({
      series: createSeries(),
      viewport,
      plotArea: { x: 100, y: 20, width: 200, height: 100 },
      priceScale: linearPriceScale,
      fields: ["high"]
    });

    expect(getMagnetSnapState({ point: { x: 106, y: 41 }, targets, radius: 4 }).magnet.mode).toBe(
      "ohlc"
    );
  });

  it.each(["linear", "log", "percentage"] as const)(
    "projects drawing targets with the shared %s scale",
    (priceScaleMode) => {
      const series = createSeries();
      const priceScale = createMainPanelPriceScale(
        series,
        viewport.visibleRange,
        priceScaleMode,
        [
          {
            id: "boll",
            label: "BOLL",
            type: "band",
            panelId: "main",
            upper: [{ time: 2, value: 30 }],
            lower: [{ time: 2, value: 5 }]
          }
        ],
        []
      );
      const plotArea = { x: 100, y: 20, width: 200, height: 100 };
      const targets = createOhlcMagnetTargetsFromSeries({
        series,
        viewport,
        plotArea,
        priceScale,
        fields: ["high"]
      });

      expect(targets).toHaveLength(2);
      expect(targets[0].y).toBeCloseTo(
        priceToY(series.candles[1].high, priceScale, plotArea.y, plotArea.height)
      );
      expect(targets.every((target) => target.y >= 20 && target.y <= 120)).toBe(true);
    }
  );
});
