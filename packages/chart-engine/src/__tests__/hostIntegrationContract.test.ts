import { describe, expect, it } from "vitest";
import {
  createChartEngine,
  fixtureDailyCandleSeries,
  serializeChartLayoutSnapshot,
  type HostAdapter
} from "../index";

describe("host integration contract", () => {
  it("adapts neutral engine state without requiring host business models", async () => {
    const viewportChanges: unknown[] = [];
    const drawingChanges: unknown[] = [];
    const persistedLayouts: unknown[] = [];
    const adapter: HostAdapter = {
      onViewportChange(viewport) {
        viewportChanges.push(viewport);
      },
      onDrawingChange(drawing) {
        drawingChanges.push(drawing);
      },
      persistLayout(layout) {
        persistedLayouts.push(layout);
      }
    };
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });
    const viewport = {
      visibleRange: { from: 5, to: 20 },
      candleWidth: 8,
      scrollOffset: 0,
      priceScaleMode: "linear" as const
    };
    const drawing = {
      id: "host-neutral-drawing",
      type: "horizontalLine" as const,
      anchors: [{ x: 10, y: 20, time: 1, price: 12 }]
    };

    engine.setViewport(viewport);
    adapter.onViewportChange?.(engine.getState().viewport);
    engine.setDrawings([drawing]);
    adapter.onDrawingChange?.(engine.getState().drawings[0]!);

    const serialized = serializeChartLayoutSnapshot({
      viewport: engine.getState().viewport,
      drawings: engine.getState().drawings,
      indicatorIds: ["MACD"],
      settings: engine.getState().settings
    });

    await adapter.persistLayout?.({
      viewport: serialized.viewport,
      drawings: serialized.drawings.map((item) => ({
        id: item.id,
        type: item.type,
        anchors: item.anchors
      })),
      indicators: serialized.indicatorIds
    });

    expect(viewportChanges).toEqual([viewport]);
    expect(drawingChanges).toEqual([drawing]);
    expect(persistedLayouts).toHaveLength(1);
    expect(serialized.schemaVersion).toBe(1);
    expect(serialized.indicatorIds).toEqual(["MACD"]);
  });
});
