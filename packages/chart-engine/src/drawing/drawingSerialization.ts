import { drawingTypes, type DrawingObject } from "./drawingTypes";

export function serializeDrawingObject(drawing: DrawingObject): DrawingObject {
  return JSON.parse(JSON.stringify(drawing)) as DrawingObject;
}

export function parseDrawingObject(value: unknown): DrawingObject {
  if (!isRecord(value)) {
    throw new Error("Drawing object must be an object");
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
    ...(value as Omit<DrawingObject, "id" | "type" | "anchors">),
    id: value.id,
    type: value.type as DrawingObject["type"],
    anchors: value.anchors as DrawingObject["anchors"]
  };

  return serializeDrawingObject(drawing);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
