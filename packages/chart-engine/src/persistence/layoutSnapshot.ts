import type { DrawingObject } from "../drawing/drawingTypes";
import {
  deserializeDrawingObject,
  serializeDrawingObject
} from "../drawing/drawingSerialization";
import type { SerializedDrawingObject } from "../drawing/drawingSchema";
import type { ViewportState } from "../model/runtime";
import type { ChartSettings } from "../settings/chartSettings";

export const currentLayoutSnapshotSchemaVersion = 1;

export interface ChartLayoutSnapshot {
  viewport: ViewportState;
  drawings: DrawingObject[];
  indicatorIds: string[];
  settings?: Partial<ChartSettings>;
}

export interface SerializedChartLayoutSnapshot {
  schemaVersion: typeof currentLayoutSnapshotSchemaVersion;
  viewport: ViewportState;
  drawings: SerializedDrawingObject[];
  indicatorIds: string[];
  settings?: Partial<ChartSettings>;
}

export function serializeChartLayoutSnapshot(
  snapshot: ChartLayoutSnapshot
): SerializedChartLayoutSnapshot {
  const serialized: SerializedChartLayoutSnapshot = {
    schemaVersion: currentLayoutSnapshotSchemaVersion,
    viewport: clone(snapshot.viewport),
    drawings: snapshot.drawings.map(serializeDrawingObject),
    indicatorIds: [...snapshot.indicatorIds]
  };

  if (snapshot.settings !== undefined) {
    serialized.settings = clone(snapshot.settings);
  }

  return serialized;
}

export function deserializeChartLayoutSnapshot(
  value: unknown
): ChartLayoutSnapshot {
  if (!isRecord(value)) {
    throw new Error("Chart layout snapshot must be an object");
  }

  if (value.schemaVersion !== currentLayoutSnapshotSchemaVersion) {
    throw new Error(`Unsupported chart layout schema version: ${String(value.schemaVersion)}`);
  }

  if (!isViewportState(value.viewport)) {
    throw new Error("Chart layout snapshot viewport must be an object");
  }

  if (!Array.isArray(value.drawings)) {
    throw new Error("Chart layout snapshot drawings must be an array");
  }

  if (!Array.isArray(value.indicatorIds)) {
    throw new Error("Chart layout snapshot indicatorIds must be an array");
  }

  const snapshot: ChartLayoutSnapshot = {
    viewport: clone(value.viewport),
    drawings: value.drawings.map(deserializeDrawingObject),
    indicatorIds: value.indicatorIds.map((indicatorId) => {
      if (typeof indicatorId !== "string") {
        throw new Error("Chart layout snapshot indicatorIds must contain strings");
      }

      return indicatorId;
    })
  };

  if (value.settings !== undefined) {
    if (!isRecord(value.settings)) {
      throw new Error("Chart layout snapshot settings must be an object");
    }

    snapshot.settings = clone(value.settings) as Partial<ChartSettings>;
  }

  return snapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isViewportState(value: unknown): value is ViewportState {
  if (!isRecord(value) || !isRecord(value.visibleRange)) {
    return false;
  }

  return (
    typeof value.visibleRange.from === "number" &&
    typeof value.visibleRange.to === "number" &&
    typeof value.candleWidth === "number" &&
    typeof value.scrollOffset === "number" &&
    (value.priceScaleMode === "linear" || value.priceScaleMode === "log")
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
