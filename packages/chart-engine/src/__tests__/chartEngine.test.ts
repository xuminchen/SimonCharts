import { describe, expect, it } from "vitest";
import { createChartEngine, fixtureDailyCandleSeries } from "../index";

describe("chart engine facade", () => {
  it("updates neutral state through public API", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });

    engine.setSeriesType("line");
    engine.setViewport({
      visibleRange: { from: 1, to: 10 },
      candleWidth: 8,
      scrollOffset: 0,
      priceScaleMode: "linear"
    });

    expect(engine.getState().seriesType).toBe("line");
    expect(engine.getState().viewport.visibleRange).toEqual({ from: 1, to: 10 });
  });

  it("emits neutral events", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });
    const events: unknown[] = [];
    const unsubscribe = engine.subscribe((event) => events.push(event));

    engine.setSeriesType("area");
    unsubscribe();
    engine.setSeriesType("line");

    expect(events).toEqual([{ type: "seriesTypeChanged", seriesType: "area" }]);
  });

  it("stores neutral interaction and render snapshots", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });

    engine.setInteractionState({
      pointer: { mode: "hover", point: { x: 10, y: 20 } },
      crosshair: { visible: false },
      tooltip: { visible: false },
      cursor: "crosshair",
      magnet: { mode: "off" },
      keyboard: { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false }
    });
    engine.setRenderState({
      pending: false,
      dirtyLayers: ["crosshair"],
      layoutRequired: false,
      metrics: {
        totalRenderCount: 2,
        renderCountByPass: { static: 1, dynamic: 0, overlay: 1 },
        lastRenderDuration: 3,
        dirtyLayerCount: 1,
        lastInvalidationReasons: ["pointerMoved"],
        slowFrameCount: 0
      }
    });

    expect(engine.getState().interaction?.cursor).toBe("crosshair");
    expect(engine.getState().render?.metrics.totalRenderCount).toBe(2);
  });
});
