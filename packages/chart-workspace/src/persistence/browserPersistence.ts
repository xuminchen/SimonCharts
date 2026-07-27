import {
  deserializeDrawingObject,
  serializeDrawingObject,
  supportedPriceScaleModes,
  supportedSeriesTypes,
  type DrawingObject,
  type PriceScaleMode,
  type SeriesType
} from "@simoncharts/chart-engine";
import type { AdjustMode, ChartSymbol, Timeframe } from "../contracts";
import { createChartError, type ChartError } from "../errors";
import {
  fromEngineDrawings,
  parseIndicators,
  toEngineDrawings
} from "../programmableApi";
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

export type FavoriteTimeframe = Timeframe | "intraday";
export const maxFavoriteTimeframes = 4;

export interface WorkspacePreferences {
  readonly seriesType: SeriesType;
  readonly priceScaleMode: PriceScaleMode;
  readonly gridVisible: boolean;
  readonly favoriteTimeframes: readonly FavoriteTimeframe[];
}

type StoredWorkspacePreferences = Omit<WorkspacePreferences, "favoriteTimeframes"> & {
  readonly favoriteTimeframes?: readonly FavoriteTimeframe[];
};

const favoriteTimeframeValues: readonly FavoriteTimeframe[] = [
  "1m", "5m", "15m", "30m", "60m", "1d", "1w", "1mo", "intraday"
];

export const defaultLayoutState: WorkspaceLayoutState = Object.freeze({
  bottomPanel: Object.freeze({ height: 300, collapsed: true, activeTab: "objects" }),
  drawingPalette: Object.freeze({ x: 12, y: 12, collapsed: true })
});

export const defaultPreferences: WorkspacePreferences = Object.freeze({
  seriesType: "candles",
  priceScaleMode: "linear",
  gridVisible: true,
  favoriteTimeframes: Object.freeze<FavoriteTimeframe[]>(["15m", "60m", "1d", "intraday"])
});

export type BrowserPersistenceErrorHandler = (error: ChartError) => void;

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

function isPreferences(value: unknown): value is StoredWorkspacePreferences {
  const favoriteTimeframes = isRecord(value) ? value.favoriteTimeframes : undefined;
  return (
    isRecord(value) &&
    supportedSeriesTypes.includes(value.seriesType as SeriesType) &&
    supportedPriceScaleModes.includes(value.priceScaleMode as PriceScaleMode) &&
    typeof value.gridVisible === "boolean" &&
    (favoriteTimeframes === undefined || (
      Array.isArray(favoriteTimeframes) &&
      favoriteTimeframes.every((timeframe) =>
        favoriteTimeframeValues.includes(timeframe as FavoriteTimeframe)
      ) &&
      new Set(favoriteTimeframes).size === favoriteTimeframes.length
    ))
  );
}

function isIndicators(value: unknown): value is readonly IndicatorConfig[] {
  try {
    parseIndicators(value);
    return true;
  } catch {
    return false;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createBrowserPersistence(
  chartId: string,
  persistenceScopeId: string,
  dataContextId: string,
  storage: Storage,
  onError: BrowserPersistenceErrorHandler
): BrowserPersistence {
  const prefix = `simoncharts:workspace:v${schemaVersion}:${encodeURIComponent(chartId)}:${encodeURIComponent(persistenceScopeId)}`;
  const layoutKey = `${prefix}:layout`;
  const preferencesKey = `${prefix}:preferences`;
  const indicatorsKey = `${prefix}:indicators:v2`;
  const drawingPrefix = `${prefix}:drawings:${encodeURIComponent(dataContextId)}`;
  const drawingKey = (symbolId: string, adjustMode: AdjustMode) =>
    `${drawingPrefix}:${encodeURIComponent(symbolId)}:${adjustMode}`;

  const reportReadError = (): void =>
    onError(
      createChartError(
        "STORAGE_READ_FAILED",
        "storage",
        true,
        "Stored workspace state is invalid"
      )
    );
  const reportWriteError = (): void =>
    onError(
      createChartError(
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
    loadPreferences: () => {
      const stored = read<StoredWorkspacePreferences>(preferencesKey, defaultPreferences, isPreferences);
      return {
        ...stored,
        favoriteTimeframes: (stored.favoriteTimeframes ?? defaultPreferences.favoriteTimeframes)
          .slice(0, maxFavoriteTimeframes)
      };
    },
    savePreferences: (value) => write(preferencesKey, value),
    loadIndicators: () => parseIndicators(
      read(indicatorsKey, [] as readonly IndicatorConfig[], isIndicators)
    ),
    saveIndicators: (value) => write(indicatorsKey, value),
    loadDrawings(symbol, adjustMode) {
      const serialized = read(
        drawingKey(symbol.id, adjustMode),
        [] as readonly unknown[],
        Array.isArray
      );
      try {
        return toEngineDrawings(fromEngineDrawings(
          serialized.map((item) => deserializeDrawingObject(item))
        ));
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
