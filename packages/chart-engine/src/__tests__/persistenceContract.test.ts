import { describe, expect, it } from "vitest";
import {
  currentLayoutSnapshotSchemaVersion,
  deserializeChartLayoutSnapshot,
  serializeChartLayoutSnapshot,
  type ChartLayoutSnapshot
} from "../index";

describe("layout persistence contract", () => {
  it("serializes neutral layout state with nested drawing schema versions", () => {
    const serialized = serializeChartLayoutSnapshot(createLayoutSnapshot());

    expect(serialized.schemaVersion).toBe(currentLayoutSnapshotSchemaVersion);
    expect(serialized.drawings[0]?.schemaVersion).toBe(1);
    expect(serialized.indicatorIds).toEqual(["MACD", "BOLL"]);
  });

  it("round-trips layout state without sharing mutable references", () => {
    const source = createLayoutSnapshot();
    const serialized = serializeChartLayoutSnapshot(source);
    const restored = deserializeChartLayoutSnapshot(serialized);

    source.viewport.visibleRange.from = 99;
    source.drawings[0]!.anchors[0]!.price = 999;
    source.settings!.theme = "light";
    serialized.drawings[0]!.anchors[0]!.price = 777;
    serialized.indicatorIds.push("RSI");

    expect(restored).toEqual(createLayoutSnapshot());
    expect(restored.viewport).not.toBe(source.viewport);
    expect(restored.drawings[0]).not.toBe(source.drawings[0]);
    expect(restored.settings).not.toBe(source.settings);
  });

  it("rejects unsupported layout schema versions", () => {
    expect(() =>
      deserializeChartLayoutSnapshot({
        schemaVersion: 2,
        viewport: createLayoutSnapshot().viewport,
        drawings: [],
        indicatorIds: []
      })
    ).toThrow("Unsupported chart layout schema version: 2");
  });

  it("rejects malformed indicator ids", () => {
    expect(() =>
      deserializeChartLayoutSnapshot({
        schemaVersion: 1,
        viewport: createLayoutSnapshot().viewport,
        drawings: [],
        indicatorIds: ["MACD", 123]
      })
    ).toThrow("Chart layout snapshot indicatorIds must contain strings");
  });
});

function createLayoutSnapshot(): ChartLayoutSnapshot {
  return {
    viewport: {
      visibleRange: { from: 10, to: 80 },
      candleWidth: 8,
      scrollOffset: 0,
      priceScaleMode: "linear"
    },
    drawings: [
      {
        id: "drawing-1",
        type: "trendLine",
        anchors: [
          { x: 10, y: 20, time: 1, price: 11 },
          { x: 40, y: 50, time: 2, price: 12 }
        ],
        style: { color: "#2563eb", lineWidth: 2 },
        metadata: { nested: { value: 1 } }
      }
    ],
    indicatorIds: ["MACD", "BOLL"],
    settings: {
      theme: "dark",
      showGrid: true
    }
  };
}
