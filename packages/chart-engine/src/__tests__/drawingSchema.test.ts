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

  it("migrates legacy drawings with detached nested fields", () => {
    const legacy = {
      id: "legacy",
      type: "horizontalLine",
      anchors: [{ x: 12, y: 30 }],
      metadata: { nested: { value: 1 } }
    };

    const migrated = migrateSerializedDrawing(legacy);

    expect(migrated).toEqual({ schemaVersion: 1, ...legacy });
    expect(migrated.anchors).not.toBe(legacy.anchors);
    expect(migrated.anchors[0]).not.toBe(legacy.anchors[0]);
    expect(migrated.metadata).not.toBe(legacy.metadata);
    expect(migrated.metadata?.nested).not.toBe(legacy.metadata.nested);

    legacy.anchors[0].x = 99;
    legacy.metadata.nested.value = 2;

    expect(migrated.anchors[0].x).toBe(12);
    expect(migrated.metadata?.nested).toEqual({ value: 1 });
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

  it("deserializes schema-v1 drawings with detached nested fields", () => {
    const serialized = {
      schemaVersion: 1 as const,
      id: "d3",
      type: "rectangle" as const,
      anchors: [{ x: 1, y: 2 }],
      metadata: { nested: { value: 1 } }
    };

    const drawing = deserializeDrawingObject(serialized);

    expect(drawing).toEqual({
      id: "d3",
      type: "rectangle",
      anchors: [{ x: 1, y: 2 }],
      metadata: { nested: { value: 1 } }
    });
    expect(drawing.anchors).not.toBe(serialized.anchors);
    expect(drawing.anchors[0]).not.toBe(serialized.anchors[0]);
    expect(drawing.metadata).not.toBe(serialized.metadata);
    expect(drawing.metadata?.nested).not.toBe(serialized.metadata.nested);

    serialized.anchors[0].x = 99;
    serialized.metadata.nested.value = 2;

    expect(drawing.anchors[0].x).toBe(1);
    expect(drawing.metadata?.nested).toEqual({ value: 1 });
  });

  it("rejects unsupported schema versions during migration", () => {
    expect(() =>
      migrateSerializedDrawing({
        schemaVersion: 2,
        id: "bad",
        type: "trendLine",
        anchors: []
      })
    ).toThrow("Unsupported drawing schema version: 2");
  });

  it("rejects unsupported schema versions during deserialization", () => {
    expect(() =>
      deserializeDrawingObject({
        schemaVersion: 2,
        id: "bad",
        type: "trendLine",
        anchors: []
      })
    ).toThrow("Unsupported drawing schema version: 2");
  });
});
