import {
  coreIndicatorIds,
  deserializeDrawingObject,
  serializeDrawingObject,
  supportedPriceScaleModes,
  supportedSeriesTypes,
  type DrawingObject,
  type PriceScaleMode,
  type SeriesType
} from "@simoncharts/chart-engine";
import type { AdjustMode, ChartSymbol } from "../contracts";
import { createWorkspaceError, type ChartWorkspaceError } from "../errors";
import type { IndicatorConfig } from "../runtime/indicatorRuntime";

const schemaVersion = 1;

export interface DrawingPaletteState {
  readonly x: number;
  readonly y: number;
  readonly collapsed: boolean;
  readonly recentTool?: string;
}

export interface BottomPanelState {
  readonly height: number;
  readonly collapsed: boolean;
  readonly activeTab: "objects" | "properties" | "data";
}

export interface WorkspaceLayoutState {
  readonly bottomPanel: BottomPanelState;
  readonly drawingPalette: DrawingPaletteState;
}

export interface WorkspacePreferences {
  readonly seriesType: SeriesType;
  readonly priceScaleMode: PriceScaleMode;
  readonly gridVisible: boolean;
}

export const defaultLayoutState: WorkspaceLayoutState = Object.freeze({
  bottomPanel: Object.freeze({ height: 240, collapsed: false, activeTab: "objects" }),
  drawingPalette: Object.freeze({ x: 12, y: 12, collapsed: false })
});

export const defaultPreferences: WorkspacePreferences = Object.freeze({
  seriesType: "candles",
  priceScaleMode: "linear",
  gridVisible: true
});

export type BrowserPersistenceErrorHandler = (error: ChartWorkspaceError) => void;

export interface BrowserPersistence {
  loadLayout(): WorkspaceLayoutState;
  saveLayout(value: WorkspaceLayoutState): void;
  loadPreferences(): WorkspacePreferences;
  savePreferences(value: WorkspacePreferences): void;
  loadIndicators(): readonly IndicatorConfig[];
  saveIndicators(value: readonly IndicatorConfig[]): void;
  loadDrawings(symbol: ChartSymbol, adjustMode: AdjustMode): readonly DrawingObject[];
  saveDrawings(symbol: ChartSymbol, adjustMode: AdjustMode, value: readonly DrawingObject[]): void;
}

interface Envelope {
  schemaVersion: 1;
  value: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLayout(value: unknown): value is WorkspaceLayoutState {
  if (!isRecord(value) || !isRecord(value.bottomPanel) || !isRecord(value.drawingPalette)) return false;
  const panel = value.bottomPanel;
  const palette = value.drawingPalette;
  return (
    typeof panel.height === "number" &&
    Number.isFinite(panel.height) &&
    typeof panel.collapsed === "boolean" &&
    ["objects", "properties", "data"].includes(String(panel.activeTab)) &&
    typeof palette.x === "number" &&
    Number.isFinite(palette.x) &&
    typeof palette.y === "number" &&
    Number.isFinite(palette.y) &&
    typeof palette.collapsed === "boolean" &&
    (palette.recentTool === undefined || typeof palette.recentTool === "string")
  );
}

function isPreferences(value: unknown): value is WorkspacePreferences {
  return (
    isRecord(value) &&
    supportedSeriesTypes.includes(value.seriesType as SeriesType) &&
    supportedPriceScaleModes.includes(value.priceScaleMode as PriceScaleMode) &&
    typeof value.gridVisible === "boolean"
  );
}

function isIndicators(value: unknown): value is readonly IndicatorConfig[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        coreIndicatorIds.includes(item.id as IndicatorConfig["id"]) &&
        isRecord(item.params) &&
        Object.values(item.params).every(
          (parameter) => typeof parameter === "number" && Number.isFinite(parameter)
        ) &&
        typeof item.visible === "boolean"
    )
  );
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createBrowserPersistence(
  workspaceId: string,
  storage: Storage,
  onError: BrowserPersistenceErrorHandler
): BrowserPersistence {
  const prefix = `simoncharts:workspace:v${schemaVersion}:${encodeURIComponent(workspaceId)}`;
  const layoutKey = `${prefix}:layout`;
  const preferencesKey = `${prefix}:preferences`;
  const indicatorsKey = `${prefix}:indicators`;
  const drawingKey = (symbolId: string, adjustMode: AdjustMode) =>
    `${prefix}:drawings:${encodeURIComponent(symbolId)}:${adjustMode}`;

  const reportReadError = (): void =>
    onError(
      createWorkspaceError(
        "STORAGE_READ_FAILED",
        "storage",
        true,
        "Stored workspace state is invalid"
      )
    );
  const reportWriteError = (): void =>
    onError(
      createWorkspaceError(
        "STORAGE_WRITE_FAILED",
        "storage",
        true,
        "Workspace state could not be stored"
      )
    );

  const read = <T>(key: string, fallback: T, validate: (value: unknown) => value is T): T => {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return clone(fallback);
      const envelope = JSON.parse(raw) as unknown;
      if (
        !isRecord(envelope) ||
        envelope.schemaVersion !== schemaVersion ||
        !validate(envelope.value)
      ) {
        throw new Error("Invalid storage envelope");
      }
      return clone(envelope.value);
    } catch {
      try {
        storage.removeItem(key);
      } catch {
        // The original read error remains the only user-visible storage event.
      }
      reportReadError();
      return clone(fallback);
    }
  };

  const write = (key: string, value: unknown): void => {
    try {
      const envelope: Envelope = { schemaVersion, value: clone(value) };
      storage.setItem(key, JSON.stringify(envelope));
    } catch {
      reportWriteError();
    }
  };

  return {
    loadLayout: () => read(layoutKey, defaultLayoutState, isLayout),
    saveLayout: (value) => write(layoutKey, value),
    loadPreferences: () => read(preferencesKey, defaultPreferences, isPreferences),
    savePreferences: (value) => write(preferencesKey, value),
    loadIndicators: () => read(indicatorsKey, [] as readonly IndicatorConfig[], isIndicators),
    saveIndicators: (value) => write(indicatorsKey, value),
    loadDrawings(symbol, adjustMode) {
      const serialized = read(
        drawingKey(symbol.id, adjustMode),
        [] as readonly unknown[],
        Array.isArray
      );
      try {
        return serialized.map((item) => deserializeDrawingObject(item));
      } catch {
        try {
          storage.removeItem(drawingKey(symbol.id, adjustMode));
        } catch {
          // The invalid drawing namespace is already isolated from runtime state.
        }
        reportReadError();
        return [];
      }
    },
    saveDrawings(symbol, adjustMode, value) {
      write(
        drawingKey(symbol.id, adjustMode),
        value.map((drawing) => serializeDrawingObject(drawing))
      );
    }
  };
}
