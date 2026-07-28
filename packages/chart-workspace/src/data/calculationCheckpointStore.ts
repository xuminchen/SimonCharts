import type {
  CoreIndicatorCheckpoint,
  SeriesTransformCheckpoint
} from "@simoncharts/chart-engine";
import type { ChartJsonValue } from "../contracts";

export const defaultMaxCalculationCheckpointEntries = 2048;
export const defaultMaxCalculationCheckpointBytes = 4 * 1024 * 1024;

export interface CalculationCheckpointKey {
  readonly selectionKey: string;
  readonly dataVersion: string;
  readonly kind: "indicator" | "series";
  readonly id: string;
  readonly paramsHash: string;
  readonly descriptorCursor?: string;
}

export interface CustomStudyCheckpoint {
  readonly kind: "customStudy";
  readonly id: string;
  readonly definitionVersion: string;
  readonly processedCount: number;
  readonly state?: ChartJsonValue;
}

export type CalculationCheckpoint =
  | CoreIndicatorCheckpoint
  | SeriesTransformCheckpoint
  | CustomStudyCheckpoint;

export interface CalculationCheckpointStore {
  get(key: CalculationCheckpointKey): CalculationCheckpoint | undefined;
  set(key: CalculationCheckpointKey, value: CalculationCheckpoint): void;
  invalidateAfter(selectionKey: string, descriptorCursor?: string): void;
  invalidateConfiguration(kind: "indicator" | "series", id: string): void;
  getDiagnostics(): { entryCount: number; estimatedBytes: number };
  clear(): void;
}

export interface CalculationCheckpointStoreOptions {
  readonly maxEntries?: number;
  readonly maxEstimatedBytes?: number;
}

interface Entry {
  key: CalculationCheckpointKey;
  value: CalculationCheckpoint;
  bytes: number;
  lastAccess: number;
  sequence: number;
}

function keyOf(key: CalculationCheckpointKey): string {
  return JSON.stringify([
    key.selectionKey,
    key.dataVersion,
    key.kind,
    key.id,
    key.paramsHash,
    key.descriptorCursor ?? null
  ]);
}

function cloneCheckpoint(value: CalculationCheckpoint): CalculationCheckpoint {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function createCalculationCheckpointStore(
  options: CalculationCheckpointStoreOptions = {}
): CalculationCheckpointStore {
  const maxEntries = options.maxEntries ?? defaultMaxCalculationCheckpointEntries;
  const maxEstimatedBytes = options.maxEstimatedBytes ?? defaultMaxCalculationCheckpointBytes;
  const entries = new Map<string, Entry>();
  let clock = 0;
  let sequence = 0;

  const totalBytes = (): number =>
    [...entries.values()].reduce((total, entry) => total + entry.bytes, 0);
  const evict = (): void => {
    while (entries.size > maxEntries || totalBytes() > maxEstimatedBytes) {
      const oldest = [...entries.entries()].reduce((selected, candidate) =>
        candidate[1].lastAccess < selected[1].lastAccess ? candidate : selected
      );
      entries.delete(oldest[0]);
    }
  };

  return {
    get(key) {
      const entry = entries.get(keyOf(key));
      if (entry === undefined) return undefined;
      entry.lastAccess = ++clock;
      return cloneCheckpoint(entry.value);
    },

    set(key, value) {
      const clonedKey = Object.freeze({ ...key });
      const clonedValue = cloneCheckpoint(value);
      const serialized = JSON.stringify(clonedValue);
      entries.set(keyOf(key), {
        key: clonedKey,
        value: clonedValue,
        bytes: new TextEncoder().encode(serialized).byteLength,
        lastAccess: ++clock,
        sequence: ++sequence
      });
      evict();
    },

    invalidateAfter(selectionKey, descriptorCursor) {
      const matching = [...entries.values()].filter(
        (entry) =>
          entry.key.selectionKey === selectionKey &&
          entry.key.descriptorCursor === descriptorCursor
      );
      const fromSequence = Math.min(...matching.map((entry) => entry.sequence));
      for (const [id, entry] of entries) {
        if (
          entry.key.selectionKey === selectionKey &&
          (descriptorCursor === undefined || entry.sequence >= fromSequence)
        ) {
          entries.delete(id);
        }
      }
    },

    invalidateConfiguration(kind, id) {
      for (const [key, entry] of entries) {
        if (entry.key.kind === kind && entry.key.id === id) entries.delete(key);
      }
    },

    getDiagnostics() {
      return { entryCount: entries.size, estimatedBytes: totalBytes() };
    },

    clear() {
      entries.clear();
      clock = 0;
      sequence = 0;
    }
  };
}
