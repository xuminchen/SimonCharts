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
});
