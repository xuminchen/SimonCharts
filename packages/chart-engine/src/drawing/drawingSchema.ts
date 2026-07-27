import type { DrawingAnchor, DrawingObject, DrawingStyle, DrawingType } from "./drawingTypes";

export const currentDrawingSchemaVersion = 1 as const;

export interface SerializedDrawingObjectV1 {
  schemaVersion: typeof currentDrawingSchemaVersion;
  id: string;
  type: DrawingType;
  anchors: DrawingAnchor[];
  style?: DrawingStyle;
  text?: string;
  visible?: boolean;
  locked?: boolean;
  interactive?: boolean;
  affectsPriceScale?: boolean;
  zIndex?: number;
  metadata?: Record<string, unknown>;
}

export type SerializedDrawingObject = SerializedDrawingObjectV1;

export function toSerializedDrawingV1(drawing: DrawingObject): SerializedDrawingObjectV1 {
  const serialized: SerializedDrawingObjectV1 = {
    schemaVersion: currentDrawingSchemaVersion,
    id: drawing.id,
    type: drawing.type,
    anchors: cloneJson(drawing.anchors)
  };

  if (drawing.style !== undefined) {
    serialized.style = cloneJson(drawing.style);
  }

  if (drawing.text !== undefined) {
    serialized.text = drawing.text;
  }

  if (drawing.visible !== undefined) {
    serialized.visible = drawing.visible;
  }

  if (drawing.locked !== undefined) {
    serialized.locked = drawing.locked;
  }

  if (drawing.interactive !== undefined) {
    serialized.interactive = drawing.interactive;
  }

  if (drawing.affectsPriceScale !== undefined) {
    serialized.affectsPriceScale = drawing.affectsPriceScale;
  }

  if (drawing.zIndex !== undefined) {
    serialized.zIndex = drawing.zIndex;
  }

  if (drawing.metadata !== undefined) {
    serialized.metadata = cloneJson(drawing.metadata);
  }

  return serialized;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
