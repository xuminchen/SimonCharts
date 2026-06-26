import {
  currentDrawingSchemaVersion,
  toSerializedDrawingV1,
  type SerializedDrawingObject
} from "./drawingSchema";
import { parseDrawingObject } from "./drawingSerialization";

export function migrateSerializedDrawing(value: unknown): SerializedDrawingObject {
  const record = requireDrawingRecord(value);
  const hasSchemaVersion = hasOwn(record, "schemaVersion");

  if (hasSchemaVersion) {
    const version = record.schemaVersion;

    if (version !== currentDrawingSchemaVersion) {
      throw new Error(`Unsupported drawing schema version: ${String(version)}`);
    }
  }

  return toSerializedDrawingV1(
    parseDrawingObject(hasSchemaVersion ? omitSchemaVersion(record) : record)
  );
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

function omitSchemaVersion(value: Record<string, unknown>): Record<string, unknown> {
  const { schemaVersion: _schemaVersion, ...drawingValue } = value;
  return drawingValue;
}
