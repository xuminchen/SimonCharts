import { drawingTypes, type DrawingObject } from "./drawingTypes";
import { migrateSerializedDrawing } from "./drawingMigrations";
import { toSerializedDrawingV1, type SerializedDrawingObject } from "./drawingSchema";

export function serializeDrawingObject(drawing: DrawingObject): SerializedDrawingObject {
  return toSerializedDrawingV1(drawing);
}

export function deserializeDrawingObject(value: unknown): DrawingObject {
  const serialized = migrateSerializedDrawing(value);
  const drawing: DrawingObject = {
    id: serialized.id,
    type: serialized.type,
    anchors: serialized.anchors
  };

  if (serialized.style !== undefined) {
    drawing.style = serialized.style;
  }

  if (serialized.text !== undefined) {
    drawing.text = serialized.text;
  }

  if (serialized.visible !== undefined) {
    drawing.visible = serialized.visible;
  }

  if (serialized.locked !== undefined) {
    drawing.locked = serialized.locked;
  }

  if (serialized.zIndex !== undefined) {
    drawing.zIndex = serialized.zIndex;
  }

  if (serialized.metadata !== undefined) {
    drawing.metadata = serialized.metadata;
  }

  return cloneDrawingObject(drawing);
}

export function parseDrawingObject(value: unknown): DrawingObject {
  if (!isRecord(value)) {
    throw new Error("Drawing object must be an object");
  }

  if (hasOwn(value, "schemaVersion")) {
    throw new Error(
      "Serialized drawing payload must be deserialized with deserializeDrawingObject"
    );
  }

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

  return cloneDrawingObject(drawing);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function cloneDrawingObject(drawing: DrawingObject): DrawingObject {
  return JSON.parse(JSON.stringify(drawing)) as DrawingObject;
}
