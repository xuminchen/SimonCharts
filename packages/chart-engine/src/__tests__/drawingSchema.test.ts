import { describe, expect, it } from "vitest";
import {
  deserializeDrawingObject,
  migrateSerializedDrawing,
  serializeDrawingObject
} from "../index";

describe("drawing schema", () => {
  it("serializes with schema version", () => {
    const serialized = serializeDrawingObject({
      id: "d1",
      type: "trendLine",
      anchors: [
        { x: 10, y: 20 },
        { x: 30, y: 40 }
      ],
      style: { color: "#111827", lineWidth: 2 },
      visible: true,
      locked: false
    });

    expect(serialized.schemaVersion).toBe(1);
    expect(serialized.type).toBe("trendLine");
  });

  it("migrates legacy drawings without mutating the input", () => {
    const legacy = {
      id: "legacy",
      type: "horizontalLine",
      anchors: [{ x: 12, y: 30 }]
    };

    const migrated = migrateSerializedDrawing(legacy);

    expect(migrated).toMatchObject({
      schemaVersion: 1,
      id: "legacy",
      type: "horizontalLine"
    });
    expect(legacy).not.toHaveProperty("schemaVersion");
  });

  it("round-trips drawing state", () => {
    const drawing = deserializeDrawingObject(
      serializeDrawingObject({
        id: "d2",
        type: "text",
        anchors: [{ x: 10, y: 20 }],
        text: "Breakout",
        visible: false,
        locked: true
      })
    );

    expect(drawing).toEqual({
      id: "d2",
      type: "text",
      anchors: [{ x: 10, y: 20 }],
      text: "Breakout",
      visible: false,
      locked: true
    });
  });
});
