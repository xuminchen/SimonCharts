import type {
  DrawingEditorCommand,
  DrawingEditorTool,
  DrawingObject,
  PriceScaleMode,
  SeriesType,
  ViewportState
} from "@simoncharts/chart-engine";
import type {
  AdjustMode,
  ChartSymbol,
  ChartWorkspaceState,
  Timeframe
} from "../contracts";
import type { DataCoordinator, DataCoordinatorEvent } from "../data/dataCoordinator";
import { materializeSeriesAroundTime } from "../data/materializedSeries";
import type { MaterializedSeries } from "../data/materializedSeries";
import type { PagedSeriesStore, SeriesSelection } from "../data/pagedSeriesStore";
import type {
  SymbolSearchCoordinator,
  SymbolSearchCoordinatorEvent
} from "../data/symbolSearchCoordinator";
import { createWorkspaceError, type ChartWorkspaceError } from "../errors";
import type {
  BottomPanelState,
  BrowserPersistence,
  DrawingPaletteState
} from "../persistence/browserPersistence";
import type {
  ChartEngineRuntime,
  DataWindowSnapshot
} from "../runtime/chartEngineRuntime";
import type { CalculationStatus } from "../runtime/checkpointedCalculationRuntime";
import type { IndicatorConfig } from "../runtime/indicatorRuntime";

export type WorkspaceStatus =
  | { type: "loading" }
  | { type: "ready" }
  | { type: "blocked"; error: ChartWorkspaceError }
  | { type: "readyWithWarning"; error: ChartWorkspaceError };

export interface WorkspaceSearchState {
  query: string;
  loading: boolean;
  results: readonly ChartSymbol[];
  error?: ChartWorkspaceError;
}

export interface WorkspaceViewModel {
  state: ChartWorkspaceState;
  status: WorkspaceStatus;
  seriesType: SeriesType;
  priceScaleMode: PriceScaleMode;
  indicators: readonly IndicatorConfig[];
  drawings: readonly DrawingObject[];
  selectedDrawingIds: readonly string[];
  bottomPanel: BottomPanelState;
  drawingPalette: DrawingPaletteState;
  dataWindow?: DataWindowSnapshot;
  canUndoDrawing: boolean;
  canRedoDrawing: boolean;
  gridVisible: boolean;
  calculationStatus: CalculationStatus;
  search: WorkspaceSearchState;
}

export interface WorkspaceUiActions {
  retry(): void;
  setSymbol(symbol: ChartSymbol): void;
  setTimeframe(timeframe: Timeframe): void;
  setAdjustMode(adjustMode: AdjustMode): void;
  searchSymbols(query: string): void;
  retrySearch(): void;
  loadMoreBefore(): void;
  retryHistory(): void;
  setSeriesType(type: SeriesType): void;
  setPriceScaleMode(mode: PriceScaleMode): void;
  setIndicators(configs: readonly IndicatorConfig[]): void;
  setDrawingTool(tool: DrawingEditorTool): void;
  executeDrawingCommand(command: DrawingEditorCommand): void;
  undoDrawing(): void;
  redoDrawing(): void;
  setGridVisible(visible: boolean): void;
  setBottomPanel(state: BottomPanelState): void;
  setDrawingPalette(state: DrawingPaletteState): void;
}

export interface ChartWorkspaceController extends WorkspaceUiActions {
  start(): void;
  deactivate(): void;
  getState(): Readonly<ChartWorkspaceState>;
  getViewModel(): Readonly<WorkspaceViewModel>;
  setSymbol(symbol: ChartSymbol): void;
  setTimeframe(timeframe: Timeframe): void;
  setAdjustMode(adjustMode: AdjustMode): void;
  retry(): void;
  handleDataEvent(event: DataCoordinatorEvent): void;
  handleSearchEvent(event: SymbolSearchCoordinatorEvent): void;
  handleStorageError(error: ChartWorkspaceError): void;
  handleViewportChanged(viewport: ViewportState): void;
  handleHistoryBoundary(anchorTime?: number): void;
  handleCalculationStatus(status: CalculationStatus): void;
  handleDataWindow(snapshot: DataWindowSnapshot | undefined): void;
  handleDrawingsChanged(drawings: readonly DrawingObject[], selectedDrawingIds?: readonly string[]): void;
  handleDrawingHistoryChanged(state: { canUndo: boolean; canRedo: boolean }): void;
  handleRenderError(error: unknown): void;
  destroy(): void;
}

export interface ChartWorkspaceControllerDependencies {
  workspaceId: string;
  initialSymbol: ChartSymbol;
  initialTimeframe?: Timeframe;
  initialAdjustMode?: AdjustMode;
  store: PagedSeriesStore;
  dataCoordinator: DataCoordinator;
  searchCoordinator: SymbolSearchCoordinator;
  persistence: BrowserPersistence;
  runtime: ChartEngineRuntime;
  onError?: (error: ChartWorkspaceError) => void;
  onViewModelChanged?: (viewModel: Readonly<WorkspaceViewModel>) => void;
}

function cloneSymbol(symbol: ChartSymbol): ChartSymbol {
  return { ...symbol };
}

function normalizeAdjustMode(symbol: ChartSymbol, requested?: AdjustMode): AdjustMode {
  return symbol.kind === "index" ? "none" : requested ?? "forward";
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function selectionOf(state: ChartWorkspaceState): SeriesSelection {
  return { symbol: cloneSymbol(state.symbol), timeframe: state.timeframe, adjustMode: state.adjustMode };
}

export function createChartWorkspaceController(
  dependencies: ChartWorkspaceControllerDependencies
): ChartWorkspaceController {
  const preferences = dependencies.persistence.loadPreferences();
  const layout = dependencies.persistence.loadLayout();
  let state: ChartWorkspaceState = {
    symbol: cloneSymbol(dependencies.initialSymbol),
    timeframe: dependencies.initialTimeframe ?? "1d",
    adjustMode: normalizeAdjustMode(
      dependencies.initialSymbol,
      dependencies.initialAdjustMode ?? (dependencies.initialSymbol.kind === "stock" ? "forward" : "none")
    ),
    loading: true
  };
  let viewModel: WorkspaceViewModel = {
    state,
    status: { type: "loading" },
    seriesType: preferences.seriesType,
    priceScaleMode: preferences.priceScaleMode,
    indicators: dependencies.persistence.loadIndicators(),
    drawings: dependencies.persistence.loadDrawings(state.symbol, state.adjustMode),
    selectedDrawingIds: [],
    bottomPanel: layout.bottomPanel,
    drawingPalette: layout.drawingPalette,
    canUndoDrawing: false,
    canRedoDrawing: false,
    gridVisible: preferences.gridVisible,
    calculationStatus: { type: "idle" },
    search: { query: "", loading: false, results: [] }
  };
  let active = true;
  let runtimeDestroyed = false;
  let retryTarget: "initial-data" | "render" | undefined;
  let failedHistoryCursor: string | undefined;
  let materializedAnchorTime: number | undefined;
  let currentMaterialized: MaterializedSeries | undefined;

  const deactivate = (): void => {
    if (!active) return;
    active = false;
    dependencies.dataCoordinator.destroy();
    dependencies.searchCoordinator.destroy();
  };

  const publish = (): void => {
    viewModel = { ...viewModel, state: { ...state, symbol: cloneSymbol(state.symbol) } };
    dependencies.onViewModelChanged?.(structuredClone(viewModel));
  };

  const report = (error: ChartWorkspaceError, blocking: boolean): void => {
    if (!active) return;
    const status: WorkspaceStatus = blocking
      ? { type: "blocked", error }
      : viewModel.status.type === "blocked"
        ? viewModel.status
        : { type: "readyWithWarning", error };
    viewModel = {
      ...viewModel,
      status
    };
    dependencies.onError?.(error);
    publish();
  };

  const materialize = async (anchorTime?: number): Promise<void> => {
    if (!active) return;
    let result = materializeSeriesAroundTime({
      store: dependencies.store,
      selection: selectionOf(state),
      ...(anchorTime === undefined ? {} : { anchorTime }),
      visibleCount: 300,
      overscanCount: 100
    });
    for (const cursor of result.missingRequestCursors) {
      await dependencies.dataCoordinator.reloadPage(cursor);
      if (!active) return;
    }
    if (result.missingRequestCursors.length > 0) {
      result = materializeSeriesAroundTime({
        store: dependencies.store,
        selection: selectionOf(state),
        ...(anchorTime === undefined ? {} : { anchorTime }),
        visibleCount: 300,
        overscanCount: 100
      });
    }
    if (!active || result.missingRequestCursors.length > 0) return;
    currentMaterialized = result;
    dependencies.runtime.setMaterializedSeries(result, anchorTime);
    dependencies.runtime.setSeriesType(viewModel.seriesType);
    dependencies.runtime.setPriceScaleMode(viewModel.priceScaleMode);
    dependencies.runtime.setIndicators(viewModel.indicators);
    dependencies.runtime.setDrawings(viewModel.drawings);
    dependencies.runtime.setGridVisible(viewModel.gridVisible);
  };

  const beginSelection = (): void => {
    state = { ...state, loading: true };
    viewModel = { ...viewModel, status: { type: "loading" }, dataWindow: undefined };
    retryTarget = undefined;
    publish();
    void dependencies.dataCoordinator.start(selectionOf(state));
  };

  const api: ChartWorkspaceController = {
    start() {
      if (!active) return;
      beginSelection();
    },
    deactivate,
    getState() {
      return structuredClone(state);
    },
    getViewModel() {
      return structuredClone(viewModel);
    },
    setSymbol(symbol) {
      if (!active || symbol.id === state.symbol.id) return;
      const nextAdjust = normalizeAdjustMode(
        symbol,
        state.symbol.kind === "index" && symbol.kind === "stock" ? "forward" : state.adjustMode
      );
      state = { ...state, symbol: cloneSymbol(symbol), adjustMode: nextAdjust };
      viewModel = {
        ...viewModel,
        drawings: dependencies.persistence.loadDrawings(symbol, nextAdjust),
        selectedDrawingIds: []
      };
      beginSelection();
    },
    setTimeframe(timeframe) {
      if (!active || timeframe === state.timeframe) return;
      state = { ...state, timeframe };
      beginSelection();
    },
    setAdjustMode(adjustMode) {
      if (!active) return;
      const normalized = normalizeAdjustMode(state.symbol, adjustMode);
      if (normalized === state.adjustMode) return;
      state = { ...state, adjustMode: normalized };
      viewModel = {
        ...viewModel,
        drawings: dependencies.persistence.loadDrawings(state.symbol, normalized),
        selectedDrawingIds: []
      };
      beginSelection();
    },
    retry() {
      if (!active) return;
      if (retryTarget === "initial-data") void dependencies.dataCoordinator.retryInitial();
      if (retryTarget === "render") dependencies.runtime.retryRender();
    },
    handleDataEvent(event) {
      if (!active) return;
      if (event.type === "loadingInitial") {
        state = { ...state, loading: true };
        viewModel = { ...viewModel, status: { type: "loading" } };
        publish();
        return;
      }
      if (event.type === "initialPageAccepted") {
        state = { ...state, loading: false };
        viewModel = { ...viewModel, status: { type: "ready" } };
        retryTarget = undefined;
        publish();
        void materialize(materializedAnchorTime);
        return;
      }
      if (event.type === "historyPageAccepted") {
        viewModel = { ...viewModel, status: { type: "ready" } };
        failedHistoryCursor = undefined;
        publish();
        void materialize(materializedAnchorTime);
        return;
      }
      if (event.type === "snapshotRefreshing") return;
      if (event.type === "initialRequestFailed") {
        if (isAbortError(event.error)) return;
        const error = createWorkspaceError(
          "INITIAL_DATA_FAILED",
          "initial-data",
          true,
          "Initial market data could not be loaded",
          { symbolId: state.symbol.id, timeframe: state.timeframe, adjustMode: state.adjustMode }
        );
        retryTarget = "initial-data";
        state = { ...state, loading: false };
        report(error, true);
        return;
      }
      if (event.type === "historyRequestFailed") {
        if (isAbortError(event.error)) return;
        failedHistoryCursor = event.cursor;
        report(
          createWorkspaceError(
            "HISTORY_DATA_FAILED",
            "history-data",
            true,
            "Earlier market data could not be loaded",
            { symbolId: state.symbol.id, timeframe: state.timeframe, adjustMode: state.adjustMode, hasCursor: true }
          ),
          false
        );
        return;
      }
      const blocking = event.phase === "initial";
      const code = event.code === "NO_VALID_DATA" ? "NO_VALID_DATA" : "INVALID_DATA";
      report(
        createWorkspaceError(
          code,
          blocking ? "initial-data" : "history-data",
          false,
          blocking ? "Initial market data is invalid" : "Earlier market data is invalid",
          { symbolId: state.symbol.id, timeframe: state.timeframe, adjustMode: state.adjustMode }
        ),
        blocking
      );
    },
    handleSearchEvent(event) {
      if (!active) return;
      if (event.type === "results") {
        viewModel = {
          ...viewModel,
          search: { query: event.query, loading: false, results: event.symbols.map(cloneSymbol) }
        };
      } else if (!isAbortError(event.error)) {
        const error = createWorkspaceError(
          "SYMBOL_SEARCH_FAILED",
          "search",
          true,
          "Symbol search failed"
        );
        viewModel = {
          ...viewModel,
          search: { ...viewModel.search, query: event.query, loading: false, error }
        };
        dependencies.onError?.(error);
      }
      publish();
    },
    handleStorageError(error) {
      if (!active) return;
      report(error, false);
    },
    handleViewportChanged(viewport) {
      if (!active) return;
      materializedAnchorTime = currentMaterialized?.series.candles[
        Math.max(0, viewport.visibleRange.from)
      ]?.time;
    },
    handleHistoryBoundary(anchorTime) {
      if (!active) return;
      materializedAnchorTime = anchorTime;
      void dependencies.dataCoordinator.loadMoreBefore();
    },
    handleCalculationStatus(status) {
      if (!active) return;
      viewModel = { ...viewModel, calculationStatus: status };
      publish();
    },
    handleDataWindow(snapshot) {
      if (!active) return;
      viewModel = { ...viewModel, ...(snapshot === undefined ? { dataWindow: undefined } : { dataWindow: snapshot }) };
      publish();
    },
    handleDrawingsChanged(drawings, selectedDrawingIds = []) {
      if (!active) return;
      viewModel = {
        ...viewModel,
        drawings: drawings.map((drawing) => structuredClone(drawing)),
        selectedDrawingIds: [...selectedDrawingIds]
      };
      dependencies.persistence.saveDrawings(state.symbol, state.adjustMode, viewModel.drawings);
      publish();
    },
    handleDrawingHistoryChanged(history) {
      if (!active) return;
      viewModel = { ...viewModel, canUndoDrawing: history.canUndo, canRedoDrawing: history.canRedo };
      publish();
    },
    handleRenderError(error) {
      if (!active || isAbortError(error)) return;
      const workspaceError = createWorkspaceError(
        "RENDER_FAILED",
        "render",
        true,
        "The chart could not be rendered",
        { symbolId: state.symbol.id, timeframe: state.timeframe, adjustMode: state.adjustMode }
      );
      retryTarget = "render";
      report(workspaceError, true);
    },
    searchSymbols(query) {
      if (!active) return;
      viewModel = { ...viewModel, search: { query, loading: true, results: [] } };
      publish();
      void dependencies.searchCoordinator.search(query);
    },
    retrySearch() {
      if (!active || viewModel.search.query.length === 0) return;
      api.searchSymbols(viewModel.search.query);
    },
    loadMoreBefore() {
      if (active) void dependencies.dataCoordinator.loadMoreBefore();
    },
    retryHistory() {
      if (active && failedHistoryCursor !== undefined) void dependencies.dataCoordinator.reloadPage(failedHistoryCursor);
    },
    setSeriesType(type) {
      if (!active || type === viewModel.seriesType) return;
      viewModel = { ...viewModel, seriesType: type };
      dependencies.runtime.setSeriesType(type);
      dependencies.persistence.savePreferences({ seriesType: type, priceScaleMode: viewModel.priceScaleMode, gridVisible: viewModel.gridVisible });
      publish();
    },
    setPriceScaleMode(mode) {
      if (!active || mode === viewModel.priceScaleMode) return;
      viewModel = { ...viewModel, priceScaleMode: mode };
      dependencies.runtime.setPriceScaleMode(mode);
      dependencies.persistence.savePreferences({ seriesType: viewModel.seriesType, priceScaleMode: mode, gridVisible: viewModel.gridVisible });
      publish();
    },
    setIndicators(configs) {
      if (!active) return;
      viewModel = { ...viewModel, indicators: configs.map((config) => structuredClone(config)) };
      dependencies.runtime.setIndicators(viewModel.indicators);
      dependencies.persistence.saveIndicators(viewModel.indicators);
      publish();
    },
    setDrawingTool(tool) { if (active) dependencies.runtime.setDrawingTool(tool); },
    executeDrawingCommand(command) { if (active) dependencies.runtime.executeDrawingCommand(command); },
    undoDrawing() { if (active) dependencies.runtime.undoDrawing(); },
    redoDrawing() { if (active) dependencies.runtime.redoDrawing(); },
    setGridVisible(visible) {
      if (!active || visible === viewModel.gridVisible) return;
      viewModel = { ...viewModel, gridVisible: visible };
      dependencies.runtime.setGridVisible(visible);
      dependencies.persistence.savePreferences({ seriesType: viewModel.seriesType, priceScaleMode: viewModel.priceScaleMode, gridVisible: visible });
      publish();
    },
    setBottomPanel(bottomPanel) {
      if (!active) return;
      viewModel = { ...viewModel, bottomPanel: structuredClone(bottomPanel) };
      dependencies.persistence.saveLayout({ bottomPanel: viewModel.bottomPanel, drawingPalette: viewModel.drawingPalette });
      publish();
    },
    setDrawingPalette(drawingPalette) {
      if (!active) return;
      viewModel = { ...viewModel, drawingPalette: structuredClone(drawingPalette) };
      dependencies.persistence.saveLayout({ bottomPanel: viewModel.bottomPanel, drawingPalette: viewModel.drawingPalette });
      publish();
    },
    destroy() {
      deactivate();
      if (runtimeDestroyed) return;
      runtimeDestroyed = true;
      dependencies.runtime.destroy();
    }
  };

  dependencies.runtime.setSeriesType(viewModel.seriesType);
  dependencies.runtime.setPriceScaleMode(viewModel.priceScaleMode);
  dependencies.runtime.setIndicators(viewModel.indicators);
  dependencies.runtime.setDrawings(viewModel.drawings);
  dependencies.runtime.setGridVisible(viewModel.gridVisible);

  return api;
}
