import {
  currentDrawingSchemaVersion,
  toSerializedDrawingV1,
  type SerializedDrawingObject
} from "./drawingSchema";
import { drawingTypes, type DrawingObject } from "./drawingTypes";

export function migrateSerializedDrawing(value: unknown): SerializedDrawingObject {
  const record = requireDrawingRecord(value);

  if (hasOwn(record, "schemaVersion")) {
    const version = record.schemaVersion;

    if (version !== currentDrawingSchemaVersion) {
      throw new Error(`Unsupported drawing schema version: ${String(version)}`);
    }
  }

  return toSerializedDrawingV1(parseDrawingShape(record));
}

function parseDrawingShape(value: Record<string, unknown>): DrawingObject {
  if (typeof value.id !== "string") {
    throw new Error("Drawing object id must be a string");
  }

  if (
    typeof value.type !== "string" ||
    !drawingTypes.includes(value.type as DrawingObject["type"])
  ) {
    throw new Error(`Unsupported drawing type: ${String(value.type)}`);
  }

  if (!Array.isArray(value.anchors)) {
    throw new Error("Drawing object anchors must be an array");
  }

  const drawing: DrawingObject = {
    id: value.id,
    type: value.type as DrawingObject["type"],
    anchors: value.anchors as DrawingObject["anchors"]
  };

  if (value.style !== undefined) {
    drawing.style = value.style as DrawingObject["style"];
  }

  if (value.text !== undefined) {
    drawing.text = value.text as DrawingObject["text"];
  }

  if (value.visible !== undefined) {
    drawing.visible = value.visible as DrawingObject["visible"];
  }

  if (value.locked !== undefined) {
    drawing.locked = value.locked as DrawingObject["locked"];
  }

  if (value.zIndex !== undefined) {
    drawing.zIndex = value.zIndex as DrawingObject["zIndex"];
  }

  if (value.metadata !== undefined) {
    drawing.metadata = value.metadata as DrawingObject["metadata"];
  }

  return drawing;
}

function requireDrawingRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Drawing object must be an object");
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
