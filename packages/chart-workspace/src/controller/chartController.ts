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
  Candle,
  ChartComparison,
  ChartDataCapabilities,
  ChartDrawingGroup,
  ChartDrawingGroupId,
  ChartDrawingGroupMove,
  ChartMark,
  ChartReplaySpeed,
  ChartReplayState,
  ChartSeriesProperties,
  ChartSeriesVisualOverrides,
  ChartState,
  ChartSymbol,
  ChartView,
  ChartVisibleRange,
  IntradayDayCount,
  Timeframe
} from "../contracts";
import type {
  ComparisonDataSnapshot,
  ComparisonDataStatus
} from "../data/comparisonCoordinator";
import { parseComparisons } from "../data/comparisons";
import {
  parseIndicators,
  parseSeriesProperties,
  parseSeriesVisualOverrides,
  resolveSeriesProperties
} from "../programmableApi";
import {
  adjustModesForTimeframe,
  normalizeDataCapabilities,
  selectSupportedAdjustMode,
  selectSupportedTimeframe
} from "../data/capabilities";
import { cloneChartSymbol } from "../data/chartSymbol";
import type { DataCoordinator, DataCoordinatorEvent } from "../data/dataCoordinator";
import { materializeSeriesAroundTime } from "../data/materializedSeries";
import type { MaterializedSeries } from "../data/materializedSeries";
import {
  shanghaiTradingDayKey,
  type PagedSeriesStore,
  type SeriesSelection
} from "../data/pagedSeriesStore";
import type {
  SymbolSearchCoordinator,
  SymbolSearchCoordinatorEvent
} from "../data/symbolSearchCoordinator";
import {
  ChartDatafeedError,
  createChartError,
  type ChartError
} from "../errors";
import type {
  BottomPanelState,
  BrowserPersistence,
  DrawingPaletteState,
  FavoriteTimeframe
} from "../persistence/browserPersistence";
import { maxFavoriteTimeframes } from "../persistence/browserPersistence";
import type {
  ChartEngineRuntime,
  DataWindowSnapshot,
  MaterializationDemand
} from "../runtime/chartEngineRuntime";
import type { CalculationStatus } from "../runtime/checkpointedCalculationRuntime";
import type { IndicatorConfig } from "../runtime/indicatorRuntime";

const maxIntradayCandleCount = (days: IntradayDayCount): number => 1_440 * days;
const maxContinuousMaterializedCandleCount = 20_000;

export type WorkspaceStatus =
  | { type: "loading" }
  | { type: "ready" }
  | { type: "blocked"; error: ChartError }
  | { type: "readyWithWarning"; error: ChartError };

export interface WorkspaceSearchState {
  query: string;
  loading: boolean;
  results: readonly ChartSymbol[];
  error?: ChartError;
}

export interface WorkspaceComparisonStatus {
  readonly symbolId: string;
  readonly status: ComparisonDataStatus;
}

export interface WorkspaceViewModel {
  state: ChartState;
  status: WorkspaceStatus;
  intradayView: boolean;
  seriesType: SeriesType;
  seriesProperties: readonly ChartSeriesProperties[];
  seriesVisualOverrides: readonly ChartSeriesVisualOverrides[];
  favoriteTimeframes: readonly FavoriteTimeframe[];
  priceScaleMode: PriceScaleMode;
  indicators: readonly IndicatorConfig[];
  drawings: readonly DrawingObject[];
  drawingGroups: readonly ChartDrawingGroup[];
  marks: readonly ChartMark[];
  comparisons: readonly ChartComparison[];
  comparisonStatuses: readonly WorkspaceComparisonStatus[];
  selectedDrawingIds: readonly string[];
  bottomPanel: BottomPanelState;
  drawingPalette: DrawingPaletteState;
  dataWindow?: DataWindowSnapshot;
  canUndoDrawing: boolean;
  canRedoDrawing: boolean;
  gridVisible: boolean;
  executionsVisible: boolean;
  replay: ChartReplayState;
  calculationStatus: CalculationStatus;
  search: WorkspaceSearchState;
}

export interface WorkspaceUiActions {
  retry(): void;
  setSymbol(symbol: ChartSymbol): void;
  setTimeframe(timeframe: Timeframe): void;
  setView(view: ChartView): void;
  setIntradayDays(days: IntradayDayCount): void;
  setAdjustMode(adjustMode: AdjustMode): void;
  setIntradayView(enabled: boolean): void;
  searchSymbols(query: string): void;
  retrySearch(): void;
  loadMoreBefore(): void;
  retryHistory(): void;
  setSeriesType(type: SeriesType): void;
  setSeriesProperties(
    properties: ChartSeriesProperties | readonly ChartSeriesProperties[]
  ): void;
  setSeriesVisualOverrides(overrides: ChartSeriesVisualOverrides): void;
  setFavoriteTimeframe(timeframe: FavoriteTimeframe, favorite: boolean): boolean;
  setPriceScaleMode(mode: PriceScaleMode): void;
  setIndicators(configs: readonly IndicatorConfig[]): void;
  setDrawings(
    drawings: readonly DrawingObject[],
    selectedDrawingIds?: readonly string[],
    drawingGroups?: readonly ChartDrawingGroup[]
  ): void;
  createDrawingGroup(drawingIds: readonly string[], name?: string): ChartDrawingGroupId;
  setDrawingGroupName(id: ChartDrawingGroupId, name: string): void;
  setDrawingGroupMembers(id: ChartDrawingGroupId, drawingIds: readonly string[]): void;
  setDrawingGroupVisible(id: ChartDrawingGroupId, visible: boolean): void;
  setDrawingGroupLocked(id: ChartDrawingGroupId, locked: boolean): void;
  moveDrawingGroup(id: ChartDrawingGroupId, direction: ChartDrawingGroupMove): void;
  ungroupDrawingGroup(id: ChartDrawingGroupId): void;
  deleteDrawingGroupDrawings(id: ChartDrawingGroupId): void;
  setMarks(marks: readonly ChartMark[]): void;
  setComparisons(comparisons: readonly ChartComparison[]): void;
  setDrawingTool(tool: DrawingEditorTool): void;
  executeDrawingCommand(command: DrawingEditorCommand): void;
  undoDrawing(): void;
  redoDrawing(): void;
  setGridVisible(visible: boolean): void;
  setExecutionsVisible(visible: boolean): void;
  startReplay(time?: number): boolean;
  stepReplay(steps?: number): boolean;
  playReplay(): void;
  pauseReplay(): void;
  setReplaySpeed(speed: ChartReplaySpeed): void;
  stopReplay(): void;
  setBottomPanel(state: BottomPanelState): void;
  setDrawingPalette(state: DrawingPaletteState): void;
}

export interface ChartController extends WorkspaceUiActions {
  start(): void;
  deactivate(): void;
  getState(): Readonly<ChartState>;
  getVisibleRange(): Readonly<ChartVisibleRange> | undefined;
  shouldPublishVisibleRange(): boolean;
  getViewModel(): Readonly<WorkspaceViewModel>;
  setSymbol(symbol: ChartSymbol): void;
  setTimeframe(timeframe: Timeframe): void;
  setView(view: ChartView): void;
  setAdjustMode(adjustMode: AdjustMode): void;
  setSeriesConfiguration(
    type: SeriesType,
    properties: readonly ChartSeriesProperties[]
  ): void;
  prepareTimeScaleMutation(): boolean;
  setVisibleRange(range: ChartVisibleRange): void;
  resetToLatest(resetPriceScale?: boolean): void;
  retry(): void;
  handleDataEvent(event: DataCoordinatorEvent): void;
  handleSearchEvent(event: SymbolSearchCoordinatorEvent): void;
  handleStorageError(error: ChartError): void;
  handleViewportChanged(viewport: ViewportState): void;
  handleMaterializedBoundary(direction: "before" | "after", anchorTime?: number): void;
  handleMaterializationDemandChanged(demand: MaterializationDemand): void;
  handleCalculationStatus(status: CalculationStatus): void;
  handleDataWindow(snapshot: DataWindowSnapshot | undefined): void;
  handleComparisonData(snapshots: readonly ComparisonDataSnapshot[]): void;
  handleDrawingsChanged(
    drawings: readonly DrawingObject[],
    selectedDrawingIds?: readonly string[],
    drawingGroups?: readonly ChartDrawingGroup[]
  ): void;
  handleDrawingHistoryChanged(state: { canUndo: boolean; canRedo: boolean }): void;
  handleRenderError(error: unknown, calculationKind?: "indicator" | "series"): void;
  handleRenderRecovered(): void;
  destroy(): void;
}

export interface ChartControllerDependencies {
  chartId: string;
  drawingPersistenceEnabled: boolean;
  seriesTypePersistenceEnabled: boolean;
  executionsEnabled: boolean;
  initialSymbol: ChartSymbol;
  initialTimeframe?: Timeframe;
  initialAdjustMode?: AdjustMode;
  initialSeriesProperties?: readonly ChartSeriesProperties[];
  initialSeriesVisualOverrides?: readonly ChartSeriesVisualOverrides[];
  initialComparisons?: readonly ChartComparison[];
  getCapabilities(symbol: ChartSymbol, signal: AbortSignal): Promise<ChartDataCapabilities>;
  store: PagedSeriesStore;
  dataCoordinator: DataCoordinator;
  searchCoordinator: SymbolSearchCoordinator;
  persistence: BrowserPersistence;
  runtime: ChartEngineRuntime;
  parseIndicators?: (value: unknown) => IndicatorConfig[];
  onError?: (error: ChartError) => void;
  onDataLoaded?: (event: {
    readonly state: Readonly<ChartState>;
    readonly dataVersion: string;
    readonly phase: "initial" | "history";
  }) => void;
  onPresentationPending?: (state: Readonly<ChartState>) => void;
  onPresentationReady?: (state: Readonly<ChartState>) => void;
  onPresentationUnavailable?: (state: Readonly<ChartState>) => void;
  onViewModelChanged?: (viewModel: Readonly<WorkspaceViewModel>, revision: number) => void;
}

function cloneSymbol(symbol: ChartSymbol): ChartSymbol {
  return cloneChartSymbol(symbol);
}

function sameSymbol(left: ChartSymbol, right: ChartSymbol): boolean {
  return (
    left.id === right.id &&
    left.code === right.code &&
    left.name === right.name &&
    left.exchange === right.exchange &&
    left.kind === right.kind &&
    left.pricePrecision === right.pricePrecision
  );
}

function normalizeAdjustMode(symbol: ChartSymbol, requested?: AdjustMode): AdjustMode {
  return symbol.kind === "index" ? "none" : requested ?? "forward";
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function datafeedFailure(error: unknown, fallbackMessage: string) {
  return error instanceof ChartDatafeedError
    ? {
        message: error.message,
        recoverable: error.recoverable,
        context: { datafeedCode: error.code }
      }
    : { message: fallbackMessage, recoverable: true, context: {} };
}

function selectionOf(state: ChartState): SeriesSelection {
  return { symbol: cloneSymbol(state.symbol), timeframe: state.timeframe, adjustMode: state.adjustMode };
}

function sameSelection(left: Readonly<SeriesSelection> | undefined, right: Readonly<SeriesSelection>): boolean {
  return (
    left?.symbol.id === right.symbol.id &&
    left.timeframe === right.timeframe &&
    left.adjustMode === right.adjustMode
  );
}

function withoutDefaultSeriesProperties(
  properties: readonly ChartSeriesProperties[]
): ChartSeriesProperties[] {
  return properties.filter((property) =>
    JSON.stringify(property) !== JSON.stringify(resolveSeriesProperties(property.type, []))
  );
}

function withoutDefaultSeriesVisualOverrides(
  overrides: readonly ChartSeriesVisualOverrides[]
): ChartSeriesVisualOverrides[] {
  return overrides.filter((override) =>
    Object.keys(override).some((key) => key !== "type")
  );
}

function materializedThrough(
  input: Readonly<MaterializedSeries>,
  cursorTime: number
): MaterializedSeries {
  const candles = input.series.candles
    .filter((candle) => candle.time <= cursorTime)
    .map((candle) => ({ ...candle }));
  return {
    ...input,
    series: { ...input.series, candles },
    ...(candles.at(-1) === undefined ? {} : { sourceMaxTime: candles.at(-1)!.time }),
    hasKnownNewerPages:
      input.hasKnownNewerPages || candles.length < input.series.candles.length
  };
}

export function createChartController(
  dependencies: ChartControllerDependencies
): ChartController {
  const parseIndicatorConfigs = dependencies.parseIndicators ?? parseIndicators;
  const loadDrawingState = (symbol: ChartSymbol, adjustMode: AdjustMode) =>
    dependencies.drawingPersistenceEnabled
      ? dependencies.persistence.loadDrawingState(symbol, adjustMode)
      : { drawings: [], drawingGroups: [] };
  const preferences = dependencies.persistence.loadPreferences();
  const persistedSeriesType = preferences.seriesType;
  const persistedSeriesProperties = parseSeriesProperties(preferences.seriesProperties);
  const optionSeriesProperties = parseSeriesProperties(dependencies.initialSeriesProperties);
  const optionSeriesTypes = new Set(optionSeriesProperties.map((property) => property.type));
  const initialSeriesProperties = withoutDefaultSeriesProperties([
    ...(dependencies.seriesTypePersistenceEnabled
      ? persistedSeriesProperties.filter((property) => !optionSeriesTypes.has(property.type))
      : []),
    ...optionSeriesProperties
  ]);
  const persistedSeriesVisualOverrides = parseSeriesVisualOverrides(
    preferences.seriesVisualOverrides
  );
  const optionSeriesVisualOverrides = parseSeriesVisualOverrides(
    dependencies.initialSeriesVisualOverrides
  );
  const optionSeriesVisualOverrideTypes = new Set(
    optionSeriesVisualOverrides.map((override) => override.type)
  );
  const initialSeriesVisualOverrides = withoutDefaultSeriesVisualOverrides([
    ...(dependencies.seriesTypePersistenceEnabled
      ? persistedSeriesVisualOverrides.filter(
          (override) => !optionSeriesVisualOverrideTypes.has(override.type)
        )
      : []),
    ...optionSeriesVisualOverrides
  ]);
  const layout = dependencies.persistence.loadLayout();
  const initialComparisons = parseComparisons(
    dependencies.initialComparisons ?? [],
    dependencies.initialSymbol
  );
  let state: ChartState = {
    symbol: cloneSymbol(dependencies.initialSymbol),
    timeframe: dependencies.initialTimeframe ?? "1d",
    view: "timeframe",
    intradayDays: 1,
    adjustMode: normalizeAdjustMode(
      dependencies.initialSymbol,
      dependencies.initialAdjustMode ?? (dependencies.initialSymbol.kind === "stock" ? "forward" : "none")
    ),
    loading: true
  };
  const initialDrawingState = loadDrawingState(state.symbol, state.adjustMode);
  let viewModel: WorkspaceViewModel = {
    state,
    status: { type: "loading" },
    intradayView: false,
    seriesType: dependencies.seriesTypePersistenceEnabled ? persistedSeriesType : "candles",
    seriesProperties: initialSeriesProperties,
    seriesVisualOverrides: initialSeriesVisualOverrides,
    favoriteTimeframes: [...preferences.favoriteTimeframes.slice(0, maxFavoriteTimeframes)],
    priceScaleMode: initialComparisons.length === 0 ? preferences.priceScaleMode : "percentage",
    indicators: dependencies.persistence.loadIndicators(),
    drawings: initialDrawingState.drawings,
    drawingGroups: initialDrawingState.drawingGroups,
    marks: [],
    comparisons: initialComparisons,
    comparisonStatuses: initialComparisons.map((comparison) => ({
      symbolId: comparison.symbol.id,
      status: comparison.visible === false ? "hidden" : "loading"
    })),
    selectedDrawingIds: [],
    bottomPanel: layout.bottomPanel,
    drawingPalette: layout.drawingPalette,
    canUndoDrawing: false,
    canRedoDrawing: false,
    gridVisible: preferences.gridVisible,
    executionsVisible: dependencies.executionsEnabled,
    replay: { status: "inactive", speed: 1 },
    calculationStatus: { type: "idle" },
    search: { query: "", loading: false, results: [] }
  };
  let priceScaleBeforeComparisons =
    initialComparisons.length === 0 ? undefined : preferences.priceScaleMode;
  let timeframeSeriesType = viewModel.seriesType;
  const savePreferences = (): void => {
    const seriesProperties = dependencies.seriesTypePersistenceEnabled
      ? viewModel.seriesProperties
      : persistedSeriesProperties;
    const seriesVisualOverrides = dependencies.seriesTypePersistenceEnabled
      ? viewModel.seriesVisualOverrides
      : persistedSeriesVisualOverrides;
    dependencies.persistence.savePreferences({
      seriesType: dependencies.seriesTypePersistenceEnabled ? timeframeSeriesType : persistedSeriesType,
      favoriteTimeframes: viewModel.favoriteTimeframes,
      priceScaleMode: priceScaleBeforeComparisons ?? viewModel.priceScaleMode,
      gridVisible: viewModel.gridVisible,
      ...(seriesProperties.length === 0
        ? {}
        : { seriesProperties: structuredClone(seriesProperties) }),
      ...(seriesVisualOverrides.length === 0
        ? {}
        : { seriesVisualOverrides: structuredClone(seriesVisualOverrides) })
    });
  };
  const activeSeriesProperties = (type: SeriesType): ChartSeriesProperties | undefined =>
    type === "renko" || type === "lineBreak" || type === "kagi" || type === "pointAndFigure"
      ? resolveSeriesProperties(type, viewModel.seriesProperties)
      : undefined;
  const activeSeriesVisualOverrides = (
    type: SeriesType
  ): ChartSeriesVisualOverrides | undefined =>
    viewModel.seriesVisualOverrides.find((override) => override.type === type);
  const applySeriesConfiguration = (
    type: SeriesType,
    properties: readonly ChartSeriesProperties[]
  ): void => {
    const parsed = withoutDefaultSeriesProperties(parseSeriesProperties(properties));
    const previousType = viewModel.seriesType;
    const previousActive = activeSeriesProperties(previousType);
    const nextActive =
      type === "renko" || type === "lineBreak" || type === "kagi" || type === "pointAndFigure"
        ? resolveSeriesProperties(type, parsed)
        : undefined;
    if (
      type === previousType &&
      JSON.stringify(parsed) === JSON.stringify(viewModel.seriesProperties)
    ) return;
    if (state.view !== "intraday") timeframeSeriesType = type;
    viewModel = { ...viewModel, seriesType: type, seriesProperties: parsed };
    if (
      state.view !== "intraday" &&
      (type !== previousType || JSON.stringify(previousActive) !== JSON.stringify(nextActive))
    ) {
      dependencies.runtime.setSeriesType(type, nextActive);
      dependencies.runtime.setSeriesVisualOverrides(activeSeriesVisualOverrides(type));
    }
    if (dependencies.seriesTypePersistenceEnabled) savePreferences();
    publish();
  };
  let active = true;
  let runtimeDestroyed = false;
  let retryTarget: "capabilities" | "initial-data" | "render" | undefined;
  let statusBeforeRenderFailure: WorkspaceStatus | undefined;
  let failedHistoryCursor: string | null | undefined;
  let materializedAnchorTime: number | undefined;
  let currentMaterialized: MaterializedSeries | undefined;
  let boundaryMaterializing: Promise<boolean> | undefined;
  let materializationReloadCount = 0;
  let materializationIntentGeneration = 0;
  let requestedVisibleRange: ChartVisibleRange | undefined;
  let requestedVisibleRangeCommand = 0;
  let activeRangeCommand: number | undefined;
  const rangeRequestOwners = new Map<string | undefined, Set<number>>();
  let requestedLatestCommand: number | undefined;
  let requestedLatestResetPriceScale = true;
  let applyingRequestedVisibleRange = false;
  let applyingRequestedLatest = false;
  let rangeCommandGeneration = 0;
  let selectionRevision = 0;
  let requestedTimeframe: Timeframe | undefined;
  let requestedAdjustMode: AdjustMode | undefined;
  let requestedView: ChartView | undefined;
  let pendingDataLoads: Array<{
    readonly selection: SeriesSelection;
    readonly generation: number;
    readonly dataVersion: string;
    readonly phase: "initial" | "history";
    readonly cursor?: string;
  }> = [];
  let capabilityGeneration = 0;
  let capabilityController: AbortController | undefined;
  let viewModelRevision = 0;
  let replayTimer: ReturnType<typeof setTimeout> | undefined;
  let replaySessionGeneration = 0;
  let replayAdvanceTask: Promise<void> | undefined;
  let presentationIsPending = false;

  interface ReplayAdvanceTransaction {
    readonly session: number;
    readonly selectionRevision: number;
    readonly dataGeneration: number;
    readonly dataVersion: string | undefined;
    readonly selection: SeriesSelection;
    readonly materializationIntent: number;
    readonly originTime: number;
    readonly baseMaterialized: MaterializedSeries;
    readonly windowCandles: Map<number, Candle>;
    readonly availableRequestCursors: Array<string | undefined>;
    readonly consumedRequestCursors: Array<string | undefined>;
    readonly attemptedRequests: Set<string>;
    readonly exhaustedRequestCursors: Array<string | undefined>;
    traversedSteps: number;
    traversalTime: number;
    resolved?: {
      readonly requestedSteps: number;
      readonly targetTime: number;
      readonly terminal: boolean;
      readonly targetIndex?: number;
    };
    chunkRequestedSteps?: number;
    readonly chunkCandles: Map<number, Candle>;
    readonly chunkRequestCursors: Array<string | undefined>;
    trustedOriginIndex?: number;
    waitingForPage: boolean;
    waitingCursor?: string;
    requestedSteps: number;
    keepPlaying: boolean;
  }

  let replayAdvanceTransaction: ReplayAdvanceTransaction | undefined;

  const clearReplayTimer = (): void => {
    if (replayTimer === undefined) return;
    clearTimeout(replayTimer);
    replayTimer = undefined;
  };

  const deactivate = (): void => {
    if (!active) return;
    active = false;
    clearReplayTimer();
    replaySessionGeneration += 1;
    replayAdvanceTask = undefined;
    replayAdvanceTransaction = undefined;
    materializationIntentGeneration += 1;
    capabilityGeneration += 1;
    capabilityController?.abort();
    capabilityController = undefined;
    currentMaterialized = undefined;
    pendingDataLoads = [];
    boundaryMaterializing = undefined;
    rangeRequestOwners.clear();
    viewModel = {
      ...viewModel,
      drawings: [],
      drawingGroups: [],
      marks: [],
      selectedDrawingIds: [],
      dataWindow: undefined,
      replay: { status: "inactive", speed: viewModel.replay.speed },
      search: { ...viewModel.search, results: [] }
    };
    dependencies.dataCoordinator.destroy();
    dependencies.searchCoordinator.destroy();
  };

  const publish = (): void => {
    viewModel = { ...viewModel, state: { ...state, symbol: cloneSymbol(state.symbol) } };
    dependencies.onViewModelChanged?.(structuredClone(viewModel), ++viewModelRevision);
  };

  const markPresentationPending = (): void => {
    presentationIsPending = true;
    dependencies.onPresentationPending?.(structuredClone(state));
  };

  const markPresentationReady = (): void => {
    presentationIsPending = false;
    dependencies.onPresentationReady?.(structuredClone(state));
  };

  const replayPresentation = (
    input: MaterializedSeries
  ): MaterializedSeries =>
    viewModel.replay.status === "inactive"
      ? input
      : materializedThrough(input, viewModel.replay.cursorTime!);

  type ReplayAdvanceResolution =
    | {
      readonly type: "complete";
      readonly targetTime: number;
      readonly terminal: boolean;
      readonly targetIndex?: number;
      }
    | { readonly type: "reload"; readonly cursor: string | undefined }
    | { readonly type: "terminal" };

  type PreparedReplayWindow =
    | { readonly type: "ready"; readonly materialized: MaterializedSeries }
    | { readonly type: "reload"; readonly cursor: string | undefined }
    | { readonly type: "invalid" };

  const replayCandles = (): readonly Candle[] =>
    currentMaterialized?.series.candles ?? [];

  const hasRequestCursor = (
    cursors: readonly (string | undefined)[],
    cursor: string | undefined
  ): boolean => cursors.some((item) => item === cursor);

  const replayWindowLimit = (): number => {
    const demand = dependencies.runtime.getMaterializationDemand();
    return state.view === "intraday"
      ? Math.min(maxContinuousMaterializedCandleCount, maxIntradayCandleCount(state.intradayDays) + 1)
      : Math.min(
          maxContinuousMaterializedCandleCount,
          Math.max(1, demand.visibleCount + demand.overscanCount * 2)
        );
  };

  const markReplayCursorConsumed = (
    transaction: ReplayAdvanceTransaction,
    cursor: string | undefined
  ): void => {
    if (!hasRequestCursor(transaction.consumedRequestCursors, cursor)) {
      transaction.consumedRequestCursors.push(cursor);
    }
  };

  const captureReplayWindow = (
    transaction: ReplayAdvanceTransaction,
    anchorTime: number
  ): void => {
    for (const candle of transaction.baseMaterialized.series.candles) {
      transaction.windowCandles.set(candle.time, candle);
    }
    const baseMinTime = transaction.baseMaterialized.sourceMinTime;
    const baseMaxTime = transaction.baseMaterialized.sourceMaxTime;
    for (const descriptor of dependencies.store.listDescriptors()) {
      if (
        baseMinTime !== undefined &&
        baseMaxTime !== undefined &&
        descriptor.maxTime >= baseMinTime &&
        descriptor.minTime <= baseMaxTime &&
        !hasRequestCursor(transaction.availableRequestCursors, descriptor.requestCursor)
      ) transaction.availableRequestCursors.push(descriptor.requestCursor);
      if (descriptor.candles === undefined) continue;
      if (!hasRequestCursor(transaction.availableRequestCursors, descriptor.requestCursor)) {
        transaction.availableRequestCursors.push(descriptor.requestCursor);
      }
      for (const candle of descriptor.candles) {
        transaction.windowCandles.set(candle.time, candle);
      }
    }
    const limit = replayWindowLimit();
    if (transaction.windowCandles.size <= limit) return;
    const retained = [...transaction.windowCandles.values()]
      .sort((left, right) => {
        const distance = Math.abs(left.time - anchorTime) - Math.abs(right.time - anchorTime);
        return distance === 0 ? left.time - right.time : distance;
      })
      .slice(0, limit);
    transaction.windowCandles.clear();
    for (const candle of retained) transaction.windowCandles.set(candle.time, candle);
  };

  const createReplayAdvanceTransaction = (
    originTime: number,
    requestedSteps: number,
    keepPlaying: boolean,
    materializationIntent: number
  ): ReplayAdvanceTransaction => {
    const transaction: ReplayAdvanceTransaction = {
      session: replaySessionGeneration,
      selectionRevision,
      dataGeneration: dependencies.dataCoordinator.getGeneration(),
      dataVersion: dependencies.store.getSnapshot().dataVersion,
      selection: selectionOf(state),
      materializationIntent,
      originTime,
      baseMaterialized: currentMaterialized!,
      windowCandles: new Map(),
      availableRequestCursors: [],
      consumedRequestCursors: [],
      attemptedRequests: new Set(),
      exhaustedRequestCursors: [],
      traversedSteps: 0,
      traversalTime: originTime,
      chunkCandles: new Map(),
      chunkRequestCursors: [],
      waitingForPage: false,
      requestedSteps,
      keepPlaying
    };
    return transaction;
  };

  const completeReplayResolution = (
    transaction: ReplayAdvanceTransaction,
    targetTime: number,
    terminal: boolean,
    targetIndex?: number
  ): ReplayAdvanceResolution => {
    for (const candle of transaction.chunkCandles.values()) {
      transaction.windowCandles.set(candle.time, candle);
    }
    for (const cursor of transaction.chunkRequestCursors) {
      if (!hasRequestCursor(transaction.availableRequestCursors, cursor)) {
        transaction.availableRequestCursors.push(cursor);
      }
      markReplayCursorConsumed(transaction, cursor);
    }
    transaction.resolved = {
      requestedSteps: transaction.requestedSteps,
      targetTime,
      terminal,
      ...(targetIndex === undefined ? {} : { targetIndex })
    };
    return {
      type: "complete",
      targetTime,
      terminal,
      ...(targetIndex === undefined ? {} : { targetIndex })
    };
  };

  const descriptorCountsAreExact = (): boolean => {
    const descriptors = dependencies.store.listDescriptors();
    for (let index = 0; index + 1 < descriptors.length; index += 1) {
      if (descriptors[index + 1]!.maxTime > descriptors[index]!.minTime) return false;
    }
    return true;
  };

  const resolveReplayFromDescriptorCounts = (
    transaction: ReplayAdvanceTransaction
  ): ReplayAdvanceResolution => {
    const descriptors = dependencies.store.listDescriptors();
    if (transaction.trustedOriginIndex === undefined) {
      const originDescriptorIndex = descriptors.findIndex(
        (descriptor) =>
          transaction.originTime >= descriptor.minTime &&
          transaction.originTime <= descriptor.maxTime &&
          !descriptor.excludedOverlapTimes.includes(transaction.originTime)
      );
      const originDescriptor = descriptors[originDescriptorIndex];
      if (originDescriptor === undefined) return { type: "terminal" };
      const baseOwnerCandles = transaction.baseMaterialized.series.candles.filter(
        (candle) =>
          candle.time >= originDescriptor.minTime &&
          candle.time <= originDescriptor.maxTime &&
          !originDescriptor.excludedOverlapTimes.includes(candle.time)
      );
      const originCandles =
        originDescriptor.candles ??
        (baseOwnerCandles.length === originDescriptor.candleCount ? baseOwnerCandles : undefined);
      if (originCandles === undefined) {
        return { type: "reload", cursor: originDescriptor.requestCursor };
      }
      const localOriginIndex = originCandles.findIndex(
        (candle) => candle.time === transaction.originTime
      );
      if (localOriginIndex < 0) return { type: "terminal" };
      let originIndex = localOriginIndex;
      for (let index = descriptors.length - 1; index > originDescriptorIndex; index -= 1) {
        originIndex += descriptors[index]!.candleCount;
      }
      transaction.trustedOriginIndex = originIndex;
    }
    const totalCount = descriptors.reduce((total, descriptor) => total + descriptor.candleCount, 0);
    const originIndex = transaction.trustedOriginIndex;
    if (originIndex === undefined) return { type: "terminal" };
    if (originIndex >= totalCount - 1) return { type: "terminal" };
    const requestedIndex = originIndex + transaction.requestedSteps;
    const targetIndex = Math.min(requestedIndex, totalCount - 1);
    let offset = 0;
    for (const descriptor of [...descriptors].reverse()) {
      const end = offset + descriptor.candleCount;
      if (targetIndex < end) {
        if (descriptor.candles === undefined) {
          return { type: "reload", cursor: descriptor.requestCursor };
        }
        const candle = descriptor.candles[targetIndex - offset];
        markReplayCursorConsumed(transaction, descriptor.requestCursor);
        return candle === undefined
          ? { type: "terminal" }
          : completeReplayResolution(
              transaction,
              candle.time,
              targetIndex === totalCount - 1,
              targetIndex
            );
      }
      offset = end;
    }
    return { type: "terminal" };
  };

  const resetReplayChunk = (
    transaction: ReplayAdvanceTransaction,
    remainingSteps: number
  ): void => {
    transaction.chunkRequestedSteps = remainingSteps;
    transaction.chunkCandles.clear();
    transaction.chunkRequestCursors.splice(0);
  };

  const captureReplayChunkPage = (
    transaction: ReplayAdvanceTransaction,
    requestCursor: string | undefined,
    candles: readonly Candle[],
    limit: number
  ): void => {
    if (!hasRequestCursor(transaction.chunkRequestCursors, requestCursor)) {
      transaction.chunkRequestCursors.push(requestCursor);
    }
    for (const candle of candles) {
      if (candle.time > transaction.traversalTime) {
        transaction.chunkCandles.set(candle.time, candle);
      }
    }
    if (transaction.chunkCandles.size <= limit) return;
    const retained = [...transaction.chunkCandles.values()]
      .sort((left, right) => left.time - right.time)
      .slice(0, limit);
    transaction.chunkCandles.clear();
    for (const candle of retained) transaction.chunkCandles.set(candle.time, candle);
  };

  const resolveReplayAcrossOverlaps = (
    transaction: ReplayAdvanceTransaction,
    retainedOriginIndex: number
  ): ReplayAdvanceResolution => {
    const retained = transaction.baseMaterialized.series.candles;
    if (transaction.traversedSteps === 0 && transaction.traversalTime === transaction.originTime) {
      const knownAfterOrigin = retained.slice(retainedOriginIndex + 1);
      transaction.traversedSteps = knownAfterOrigin.length;
      transaction.traversalTime = knownAfterOrigin.at(-1)?.time ?? transaction.originTime;
    }
    while (true) {
      const remaining = transaction.requestedSteps - transaction.traversedSteps;
      if (remaining <= 0) {
        return completeReplayResolution(transaction, transaction.traversalTime, false);
      }
      if (transaction.chunkRequestedSteps !== remaining) {
        resetReplayChunk(transaction, remaining);
      }
      const limit = Math.min(remaining, maxContinuousMaterializedCandleCount);
      const descriptors = dependencies.store.listDescriptors();
      while (true) {
        const sorted = [...transaction.chunkCandles.values()]
          .sort((left, right) => left.time - right.time);
        const candidate = sorted[limit - 1];
        let next:
          | { readonly descriptor: (typeof descriptors)[number]; readonly index: number }
          | undefined;
        for (let index = descriptors.length - 1; index >= 0; index -= 1) {
          const descriptor = descriptors[index]!;
          if (
            descriptor.candleCount === 0 ||
            descriptor.maxTime <= transaction.traversalTime ||
            hasRequestCursor(transaction.exhaustedRequestCursors, descriptor.requestCursor) ||
            hasRequestCursor(transaction.chunkRequestCursors, descriptor.requestCursor) ||
            (candidate !== undefined && descriptor.minTime > candidate.time)
          ) continue;
          if (
            next === undefined ||
            descriptor.minTime < next.descriptor.minTime ||
            (descriptor.minTime === next.descriptor.minTime && index > next.index)
          ) next = { descriptor, index };
        }
        if (next === undefined) {
          if (sorted.length === 0) {
            return transaction.traversedSteps > 0
              ? completeReplayResolution(transaction, transaction.traversalTime, true)
              : { type: "terminal" };
          }
          if (remaining <= sorted.length) {
            const target = sorted[remaining - 1]!;
            const hasAfter =
              sorted.length > remaining ||
              descriptors.some((descriptor) => descriptor.maxTime > target.time);
            return completeReplayResolution(transaction, target.time, !hasAfter);
          }
          const tail = sorted.at(-1)!;
          transaction.traversedSteps += sorted.length;
          transaction.traversalTime = tail.time;
          for (const descriptor of descriptors) {
            if (
              descriptor.maxTime <= tail.time &&
              !hasRequestCursor(transaction.exhaustedRequestCursors, descriptor.requestCursor)
            ) transaction.exhaustedRequestCursors.push(descriptor.requestCursor);
          }
          resetReplayChunk(
            transaction,
            transaction.requestedSteps - transaction.traversedSteps
          );
          break;
        }
        if (next.descriptor.candles === undefined) {
          return { type: "reload", cursor: next.descriptor.requestCursor };
        }
        captureReplayChunkPage(
          transaction,
          next.descriptor.requestCursor,
          next.descriptor.candles,
          limit
        );
      }
    }
  };

  const resolveReplayAdvance = (
    transaction: ReplayAdvanceTransaction
  ): ReplayAdvanceResolution => {
    if (transaction.resolved?.requestedSteps === transaction.requestedSteps) {
      return {
        type: "complete",
        targetTime: transaction.resolved.targetTime,
        terminal: transaction.resolved.terminal,
        ...(transaction.resolved.targetIndex === undefined
          ? {}
          : { targetIndex: transaction.resolved.targetIndex })
      };
    }
    transaction.resolved = undefined;
    const retained = transaction.baseMaterialized.series.candles;
    const retainedOriginIndex = retained.findIndex(
      (candle) => candle.time === transaction.originTime
    );
    const retainedCandidate = retained[
      retainedOriginIndex + transaction.requestedSteps
    ];
    if (retainedOriginIndex >= 0 && retainedCandidate !== undefined) {
      const hasKnownAfter = retainedOriginIndex + transaction.requestedSteps + 1 < retained.length;
      const hasDescriptorAfter = dependencies.store.listDescriptors().some(
        (descriptor) => descriptor.candleCount > 0 && descriptor.maxTime > retainedCandidate.time
      );
      return completeReplayResolution(
        transaction,
        retainedCandidate.time,
        !hasKnownAfter && !hasDescriptorAfter
      );
    }
    if (retainedOriginIndex < 0) return { type: "terminal" };
    return descriptorCountsAreExact()
      ? resolveReplayFromDescriptorCounts(transaction)
      : resolveReplayAcrossOverlaps(transaction, retainedOriginIndex);
  };

  const prepareReplayWindow = (
    transaction: ReplayAdvanceTransaction,
    time: number
  ): PreparedReplayWindow => {
    if (
      currentMaterialized === transaction.baseMaterialized &&
      currentMaterialized?.series.candles.some((candle) => candle.time === time)
    ) {
      return { type: "ready", materialized: currentMaterialized };
    }
    captureReplayWindow(transaction, time);
    const demand = dependencies.runtime.getMaterializationDemand();
    const intradayDayCount = state.view === "intraday" ? state.intradayDays : undefined;
    const result = materializeSeriesAroundTime({
      store: dependencies.store,
      selection: transaction.selection,
      anchorTime: time,
      visibleCount: demand.visibleCount,
      overscanCount: demand.overscanCount,
      additionalCandles: [...transaction.windowCandles.values()],
      availableRequestCursors: transaction.availableRequestCursors,
      ...(intradayDayCount === undefined ? {} : {
        intradayDayCount,
        ...(state.capabilities?.intradayScale === undefined
          ? {}
          : { intradayScale: state.capabilities.intradayScale })
      })
    });
    const missingCursor = result.missingRequestCursors[0];
    if (result.missingRequestCursors.length > 0) {
      return { type: "reload", cursor: missingCursor };
    }
    return result.series.candles.some((candle) => candle.time === time)
      ? { type: "ready", materialized: result }
      : { type: "invalid" };
  };

  const commitReplayPresentation = (anchorTime?: number): boolean => {
    if (currentMaterialized === undefined) return false;
    const presentation = replayPresentation(currentMaterialized);
    if (presentation.series.candles.length === 0) return false;
    dependencies.runtime.setMaterializedSeries(presentation, anchorTime);
    return true;
  };

  const replayDataContextIsCurrent = (
    transaction: ReplayAdvanceTransaction
  ): boolean => {
    const snapshot = dependencies.store.getSnapshot();
    return (
      active &&
      transaction.materializationIntent === materializationIntentGeneration &&
      transaction.selectionRevision === selectionRevision &&
      transaction.dataGeneration === dependencies.dataCoordinator.getGeneration() &&
      transaction.dataVersion === snapshot.dataVersion &&
      sameSelection(selectionOf(state), transaction.selection) &&
      sameSelection(snapshot.selection, transaction.selection)
    );
  };

  const replayContextIsCurrent = (
    transaction: ReplayAdvanceTransaction
  ): boolean =>
    replayAdvanceTransaction === transaction &&
    transaction.session === replaySessionGeneration &&
    viewModel.replay.status !== "inactive" &&
    viewModel.replay.cursorTime === transaction.originTime &&
    replayDataContextIsCurrent(transaction);

  const clearReplayAdvanceTransaction = (
    transaction: ReplayAdvanceTransaction
  ): void => {
    if (replayAdvanceTransaction !== transaction) return;
    replayAdvanceTransaction = undefined;
    replayAdvanceTask = undefined;
  };

  const commitReplayAdvance = (
    transaction: ReplayAdvanceTransaction,
    resolution: Extract<ReplayAdvanceResolution, { type: "complete" }>,
    prepared: MaterializedSeries
  ): boolean => {
    if (!replayContextIsCurrent(transaction)) return false;
    const targetLocalIndex = prepared.series.candles.findIndex(
      (candle) => candle.time === resolution.targetTime
    );
    currentMaterialized =
      resolution.targetIndex === undefined || targetLocalIndex < 0
        ? prepared
        : {
            ...prepared,
            sourceIndexOffset: Math.max(0, resolution.targetIndex - targetLocalIndex)
          };
    materializedAnchorTime = resolution.targetTime;
    viewModel = {
      ...viewModel,
      replay: {
        status: transaction.keepPlaying && !resolution.terminal ? "playing" : "paused",
        speed: viewModel.replay.speed,
        cursorTime: resolution.targetTime
      }
    };
    return commitReplayPresentation(resolution.targetTime);
  };

  const restoreReplayReadiness = (transaction: ReplayAdvanceTransaction): void => {
    if (!replayDataContextIsCurrent(transaction)) return;
    markPresentationReady();
  };

  const pauseReplayAfterLoadFailure = (
    transaction: ReplayAdvanceTransaction
  ): void => {
    if (!replayContextIsCurrent(transaction)) return;
    const changed = viewModel.replay.status !== "paused";
    transaction.keepPlaying = false;
    clearReplayAdvanceTransaction(transaction);
    if (changed) {
      viewModel = {
        ...viewModel,
        replay: {
          status: "paused",
          speed: viewModel.replay.speed,
          cursorTime: transaction.originTime
        }
      };
    }
    restoreReplayReadiness(transaction);
    if (changed) publish();
  };

  const finalizeReplayAdvance = (
    transaction: ReplayAdvanceTransaction,
    keepPlaying: boolean
  ): void => {
    clearReplayAdvanceTransaction(transaction);
    if (presentationIsPending) markPresentationReady();
    publish();
    for (const cursor of transaction.consumedRequestCursors) {
      emitPendingDataLoads(
        transaction.selection,
        transaction.dataGeneration,
        { cursor }
      );
    }
    if (keepPlaying && viewModel.replay.status === "playing") scheduleReplay();
  };

  const runReplayAdvance = async (
    transaction: ReplayAdvanceTransaction,
    initialCursor: string | undefined
  ): Promise<void> => {
    let cursor = initialCursor;
    while (replayContextIsCurrent(transaction)) {
      const requestKey = JSON.stringify([
        transaction.requestedSteps,
        cursor,
        transaction.resolved?.targetTime,
        transaction.availableRequestCursors.length,
        transaction.traversalTime
      ]);
      if (transaction.attemptedRequests.has(requestKey)) {
        pauseReplayAfterLoadFailure(transaction);
        return;
      }
      transaction.attemptedRequests.add(requestKey);
      transaction.waitingForPage = true;
      transaction.waitingCursor = cursor;
      try {
        await dependencies.dataCoordinator.reloadPage(cursor);
      } catch {
        transaction.waitingForPage = false;
        pauseReplayAfterLoadFailure(transaction);
        return;
      }
      transaction.waitingForPage = false;
      if (!replayContextIsCurrent(transaction)) return;
      if (dependencies.store.getDescriptorForCursor(cursor)?.candles === undefined) {
        pauseReplayAfterLoadFailure(transaction);
        return;
      }
      markReplayCursorConsumed(transaction, cursor);
      const resolution = resolveReplayAdvance(transaction);
      if (resolution.type === "terminal") {
        pauseReplayAfterLoadFailure(transaction);
        return;
      }
      if (resolution.type === "reload") {
        cursor = resolution.cursor;
        continue;
      }
      const prepared = prepareReplayWindow(transaction, resolution.targetTime);
      if (prepared.type === "reload") {
        cursor = prepared.cursor;
        continue;
      }
      if (
        prepared.type === "invalid" ||
        resolution.targetTime === transaction.originTime ||
        !commitReplayAdvance(transaction, resolution, prepared.materialized)
      ) {
        pauseReplayAfterLoadFailure(transaction);
        return;
      }
      const keepPlaying = transaction.keepPlaying;
      finalizeReplayAdvance(transaction, keepPlaying);
      return;
    }
  };

  const requestReplayAdvance = (steps: number, keepPlaying: boolean): boolean => {
    if (viewModel.replay.status === "inactive") return false;
    if (replayAdvanceTransaction !== undefined) {
      const requestedSteps = replayAdvanceTransaction.requestedSteps + steps;
      if (!Number.isSafeInteger(requestedSteps)) return false;
      replayAdvanceTransaction.requestedSteps = requestedSteps;
      replayAdvanceTransaction.keepPlaying = keepPlaying;
      return true;
    }
    const transaction = createReplayAdvanceTransaction(
      viewModel.replay.cursorTime!,
      steps,
      keepPlaying,
      ++materializationIntentGeneration
    );
    replayAdvanceTransaction = transaction;
    const resolution = resolveReplayAdvance(transaction);
    if (resolution.type === "terminal") {
      clearReplayAdvanceTransaction(transaction);
      return false;
    }
    let cursor: string | undefined;
    if (resolution.type === "reload") {
      cursor = resolution.cursor;
    } else {
      const prepared = prepareReplayWindow(transaction, resolution.targetTime);
      if (prepared.type === "ready") {
        if (
          resolution.targetTime === transaction.originTime ||
          !commitReplayAdvance(transaction, resolution, prepared.materialized)
        ) {
          clearReplayAdvanceTransaction(transaction);
          return false;
        }
        finalizeReplayAdvance(transaction, false);
        return true;
      }
      if (prepared.type === "invalid") {
        clearReplayAdvanceTransaction(transaction);
        return false;
      }
      cursor = prepared.cursor;
    }
    markPresentationPending();
    const task = runReplayAdvance(transaction, cursor);
    replayAdvanceTask = task;
    void task.then(
      () => clearReplayAdvanceTransaction(transaction),
      () => {
        pauseReplayAfterLoadFailure(transaction);
        clearReplayAdvanceTransaction(transaction);
      }
    );
    return true;
  };

  const hasReplaySuccessor = (time: number): boolean => {
    if (currentMaterialized === undefined) return false;
    const probe = createReplayAdvanceTransaction(
      time,
      1,
      false,
      materializationIntentGeneration
    );
    const resolution = resolveReplayAdvance(probe);
    return resolution.type === "reload" ||
      (resolution.type === "complete" && resolution.targetTime !== time);
  };

  const scheduleReplay = (): void => {
    clearReplayTimer();
    if (!active || viewModel.replay.status !== "playing") return;
    replayTimer = setTimeout(() => {
      replayTimer = undefined;
      if (viewModel.status.type === "blocked") {
        viewModel = {
          ...viewModel,
          replay: {
            status: "paused",
            speed: viewModel.replay.speed,
            cursorTime: viewModel.replay.cursorTime!
          }
        };
        publish();
        return;
      }
      if (viewModel.calculationStatus.type !== "idle") {
        scheduleReplay();
        return;
      }
      if (!requestReplayAdvance(1, true)) {
        viewModel = {
          ...viewModel,
          replay: {
            status: "paused",
            speed: viewModel.replay.speed,
            cursorTime: viewModel.replay.cursorTime!
          }
        };
        publish();
        return;
      }
      if (replayAdvanceTask === undefined) scheduleReplay();
    }, 1_000 / viewModel.replay.speed);
  };

  const report = (error: ChartError, blocking: boolean): void => {
    if (!active) return;
    if (blocking && viewModel.replay.status !== "inactive") {
      clearReplayTimer();
      replaySessionGeneration += 1;
      replayAdvanceTask = undefined;
      replayAdvanceTransaction = undefined;
      viewModel = {
        ...viewModel,
        replay: {
          status: "paused",
          speed: viewModel.replay.speed,
          cursorTime: viewModel.replay.cursorTime!
        }
      };
    }
    const status: WorkspaceStatus = blocking
      ? { type: "blocked", error }
      : viewModel.status.type === "blocked"
        ? viewModel.status
        : { type: "readyWithWarning", error };
    viewModel = {
      ...viewModel,
      status
    };
    try {
      dependencies.onError?.(error);
    } catch {
      // Host error handlers are isolated from chart state transitions.
    }
    publish();
  };

  const needsIntradayHistory = (): boolean => {
    if (state.view !== "intraday") return false;
    const descriptors = dependencies.store.listDescriptors();
    if (descriptors.length === 0) return false;
    const knownTradingDays = new Set(
      descriptors.flatMap((descriptor) => descriptor.tradingDayKeys)
    );
    return knownTradingDays.size <= state.intradayDays && (descriptors.at(-1)?.hasMoreBefore ?? false);
  };

  const queueDataLoad = (
    event: Extract<
      DataCoordinatorEvent,
      { type: "initialPageAccepted" | "historyPageAccepted" }
    >
  ): boolean => {
    const currentSelection = selectionOf(state);
    if (
      event.generation !== dependencies.dataCoordinator.getGeneration() ||
      !sameSelection(event.selection, currentSelection)
    ) return false;
    pendingDataLoads.push({
      selection: event.selection,
      generation: event.generation,
      dataVersion: event.dataVersion,
      phase: event.type === "initialPageAccepted" ? "initial" : "history",
      ...(event.type === "historyPageAccepted" && event.cursor !== undefined
        ? { cursor: event.cursor }
        : {})
    });
    return true;
  };

  const emitPendingDataLoads = (
    expectedSelection: SeriesSelection,
    expectedGeneration: number,
    historyCursor?: { readonly cursor: string | undefined }
  ): void => {
    const ready = pendingDataLoads.filter(
      (item) =>
        item.generation === expectedGeneration &&
        sameSelection(item.selection, expectedSelection) &&
        (
          historyCursor === undefined ||
          (item.phase === "history" && item.cursor === historyCursor.cursor)
        )
    );
    pendingDataLoads = pendingDataLoads.filter((item) => !ready.includes(item));
    for (const item of ready) {
      dependencies.onDataLoaded?.({
        state: structuredClone(state),
        dataVersion: item.dataVersion,
        phase: item.phase
      });
    }
  };

  const materialize = async (anchorTime?: number): Promise<boolean> => {
    if (!active) return false;
    const expectedSelection = selectionOf(state);
    const expectedSelectionRevision = selectionRevision;
    const expectedDataGeneration = dependencies.dataCoordinator.getGeneration();
    if (!sameSelection(dependencies.store.getSnapshot().selection, expectedSelection)) return false;
    markPresentationPending();
    const materializationIntent = ++materializationIntentGeneration;
    const demand = dependencies.runtime.getMaterializationDemand();
    const requestedCandleCount = requestedVisibleRange === undefined
      ? 0
      : dependencies.store.getSnapshot().candles.filter(
          (candle) => candle.time >= requestedVisibleRange!.from && candle.time <= requestedVisibleRange!.to
        ).length;
    const visibleCount = Math.max(demand.visibleCount, requestedCandleCount);
    const intradayDayCount = state.view === "intraday" ? state.intradayDays : undefined;
    const intradayCandleLimit = intradayDayCount === undefined
      ? undefined
      : maxIntradayCandleCount(intradayDayCount);
    const targetCandleCount = intradayCandleLimit === undefined
      ? visibleCount + demand.overscanCount * 2
      : intradayCandleLimit + 1;
    if (targetCandleCount > maxContinuousMaterializedCandleCount) {
      dependencies.onPresentationUnavailable?.(structuredClone(state));
      report(
        createChartError(
          "INVALID_DATA",
          "history-data",
          false,
          "Requested materialized window exceeds the SDK safety limit",
          { candleCount: targetCandleCount }
        ),
        false
      );
      return false;
    }
    const transientCandles = new Map<number, Candle>();
    let transientReferenceCandle: Candle | undefined;
    const availableRequestCursors: Array<string | undefined> = [];
    const intradayWindow = (): {
      readonly selected: ReadonlySet<number>;
      readonly reference?: number;
    } => {
      if (intradayDayCount === undefined) return { selected: new Set() };
      const knownTradingDays = [...new Set(
        dependencies.store.listDescriptors().flatMap((descriptor) => descriptor.tradingDayKeys)
      )].sort((left, right) => left - right);
      const selectedDays = knownTradingDays.slice(-intradayDayCount);
      const firstIndex = selectedDays.length === 0
        ? -1
        : knownTradingDays.indexOf(selectedDays[0]);
      return {
        selected: new Set(selectedDays),
        ...(firstIndex <= 0 ? {} : { reference: knownTradingDays[firstIndex - 1] })
      };
    };
    const captureCandle = (candle: Candle): boolean => {
      if (transientCandles.has(candle.time)) {
        transientCandles.set(candle.time, candle);
        return true;
      }
      if (transientCandles.size < targetCandleCount) {
        transientCandles.set(candle.time, candle);
        return true;
      }
      if (intradayDayCount !== undefined) return false;
      const retained = transientCandles.values();
      let replace = retained.next().value as Candle;
      for (const item of retained) {
        if (
          (anchorTime === undefined && item.time < replace.time) ||
          (anchorTime !== undefined &&
            Math.abs(item.time - anchorTime) > Math.abs(replace.time - anchorTime))
        ) replace = item;
      }
      const candidateIsCloser = anchorTime === undefined
        ? candle.time > replace.time
        : Math.abs(candle.time - anchorTime) < Math.abs(replace.time - anchorTime);
      if (candidateIsCloser) {
        transientCandles.delete(replace.time);
        transientCandles.set(candle.time, candle);
      }
      return true;
    };
    const captureCandles = (candles: readonly Candle[]): boolean => {
      if (intradayDayCount === undefined) {
        return candles.every(captureCandle);
      }
      const window = intradayWindow();
      for (const candle of candles) {
        const day = shanghaiTradingDayKey(candle.time);
        if (window.selected.has(day) && !captureCandle(candle)) return false;
        if (
          day === window.reference &&
          (transientReferenceCandle === undefined || candle.time > transientReferenceCandle.time)
        ) transientReferenceCandle = candle;
      }
      return true;
    };
    const reportIntradayOverflow = (candleCount: number): false => {
      transientCandles.clear();
      transientReferenceCandle = undefined;
      dependencies.onPresentationUnavailable?.(structuredClone(state));
      report(
        createChartError(
          "INVALID_DATA",
          "history-data",
          false,
          "Intraday data exceeds the selected Shanghai natural-day safety limit",
          { candleCount, intradayDays: intradayDayCount }
        ),
        false
      );
      return false;
    };
    const captureResult = (captured: MaterializedSeries): boolean => {
      if (
        intradayCandleLimit !== undefined &&
        captured.series.candles.length > intradayCandleLimit
      ) return reportIntradayOverflow(captured.series.candles.length);
      if (!captureCandles(captured.series.candles)) return reportIntradayOverflow(targetCandleCount);

      const descriptors = dependencies.store.listDescriptors();
      const window = intradayWindow();
      for (const descriptor of descriptors) {
        if (descriptor.candles === undefined) continue;
        const contributes = intradayDayCount !== undefined
          ? descriptor.tradingDayKeys.some(
              (day) => window.selected.has(day) || day === window.reference
            )
          : captured.sourceMinTime !== undefined &&
            captured.sourceMaxTime !== undefined &&
            descriptor.maxTime >= captured.sourceMinTime &&
            descriptor.minTime <= captured.sourceMaxTime;
        if (
          contributes &&
          intradayDayCount !== undefined &&
          !captureCandles(descriptor.candles)
        ) return reportIntradayOverflow(targetCandleCount);
        if (
          contributes &&
          !availableRequestCursors.some((cursor) => cursor === descriptor.requestCursor)
        ) availableRequestCursors.push(descriptor.requestCursor);
      }
      return true;
    };
    const attemptedReloads: Array<string | undefined> = [];
    let result: MaterializedSeries;
    while (true) {
      result = materializeSeriesAroundTime({
        store: dependencies.store,
        selection: selectionOf(state),
        ...(anchorTime === undefined ? {} : { anchorTime }),
        visibleCount,
        overscanCount: demand.overscanCount,
        ...(intradayDayCount === undefined ? {} : {
          intradayDayCount,
          ...(state.capabilities?.intradayScale === undefined
            ? {}
            : { intradayScale: state.capabilities.intradayScale })
        }),
        additionalCandles: [
          ...transientCandles.values(),
          ...(transientReferenceCandle === undefined ? [] : [transientReferenceCandle])
        ],
        availableRequestCursors
      });
      if (!captureResult(result)) return false;
      if (result.missingRequestCursors.length === 0) break;
      let reloaded = false;
      for (const cursor of result.missingRequestCursors) {
        if (attemptedReloads.some((attempted) => attempted === cursor)) continue;
        attemptedReloads.push(cursor);
        materializationReloadCount += 1;
        try {
          await dependencies.dataCoordinator.reloadPage(cursor);
        } finally {
          materializationReloadCount -= 1;
        }
        if (
          !active ||
          materializationIntent !== materializationIntentGeneration ||
          expectedSelectionRevision !== selectionRevision ||
          expectedDataGeneration !== dependencies.dataCoordinator.getGeneration() ||
          !sameSelection(selectionOf(state), expectedSelection) ||
          !sameSelection(dependencies.store.getSnapshot().selection, expectedSelection)
        ) {
          transientCandles.clear();
          transientReferenceCandle = undefined;
          return false;
        }
        const descriptor = dependencies.store.getDescriptorForCursor(cursor);
        if (descriptor?.candles !== undefined) {
          reloaded = true;
          if (!availableRequestCursors.some((available) => available === cursor)) {
            availableRequestCursors.push(cursor);
          }
          if (!captureCandles(descriptor.candles)) return reportIntradayOverflow(targetCandleCount);
        }
      }
      if (!reloaded) {
        transientCandles.clear();
        transientReferenceCandle = undefined;
        dependencies.onPresentationUnavailable?.(structuredClone(state));
        return false;
      }
    }
    if (
      !active ||
      materializationIntent !== materializationIntentGeneration ||
      result.missingRequestCursors.length > 0 ||
      expectedSelectionRevision !== selectionRevision ||
      expectedDataGeneration !== dependencies.dataCoordinator.getGeneration() ||
      !sameSelection(selectionOf(state), expectedSelection) ||
      !sameSelection(dependencies.store.getSnapshot().selection, expectedSelection)
    ) {
      transientCandles.clear();
      transientReferenceCandle = undefined;
      return false;
    }
    currentMaterialized = result;
    if (!commitReplayPresentation(anchorTime)) return false;
    dependencies.runtime.setSeriesType(
      viewModel.seriesType,
      activeSeriesProperties(viewModel.seriesType)
    );
    dependencies.runtime.setSeriesVisualOverrides(
      activeSeriesVisualOverrides(viewModel.seriesType)
    );
    dependencies.runtime.setPriceScaleMode(viewModel.priceScaleMode);
    dependencies.runtime.setIndicators(viewModel.indicators);
    dependencies.runtime.setDrawings(
      viewModel.drawings,
      viewModel.selectedDrawingIds,
      viewModel.drawingGroups
    );
    dependencies.runtime.setGridVisible(viewModel.gridVisible);
    if (result.series.candles.length === 0) {
      transientCandles.clear();
      transientReferenceCandle = undefined;
      dependencies.onPresentationUnavailable?.(structuredClone(state));
      return false;
    }
    markPresentationReady();
    emitPendingDataLoads(expectedSelection, expectedDataGeneration);
    transientCandles.clear();
    transientReferenceCandle = undefined;
    return true;
  };

  const applyRequestedLatest = (): void => {
    const command = requestedLatestCommand;
    const resetPriceScale = requestedLatestResetPriceScale;
    if (
      command === undefined ||
      command !== rangeCommandGeneration ||
      state.loading ||
      currentMaterialized === undefined
    ) return;
    applyingRequestedLatest = true;
    try {
      dependencies.runtime.resetToLatest(resetPriceScale);
    } finally {
      applyingRequestedLatest = false;
      if (requestedLatestCommand === command) requestedLatestCommand = undefined;
    }
  };

  const cancelVisibleRangeCommand = (preserveLatest = false): void => {
    const hadLatestRequest = requestedLatestCommand !== undefined;
    rangeCommandGeneration += 1;
    requestedVisibleRange = undefined;
    activeRangeCommand = undefined;
    requestedLatestCommand = preserveLatest && hadLatestRequest
      ? rangeCommandGeneration
      : undefined;
  };

  const invalidateSelectionMaterialization = (preserveQueuedRange = false): void => {
    dependencies.runtime.cancelCalculations();
    selectionRevision += 1;
    materializationIntentGeneration += 1;
    if (!preserveQueuedRange) cancelVisibleRangeCommand();
    currentMaterialized = undefined;
    materializedAnchorTime = undefined;
    boundaryMaterializing = undefined;
    pendingDataLoads = [];
    viewModel = { ...viewModel, calculationStatus: { type: "idle" } };
  };

  const invalidateViewMaterialization = (): void => {
    dependencies.runtime.clearCrosshair();
    dependencies.runtime.cancelCalculations();
    selectionRevision += 1;
    materializationIntentGeneration += 1;
    currentMaterialized = undefined;
    materializedAnchorTime = undefined;
    boundaryMaterializing = undefined;
    viewModel = { ...viewModel, calculationStatus: { type: "idle" } };
  };

  const materializePartialIntradayAfterHistoryFailure = (): void => {
    if (!state.loading || state.view !== "intraday") return;
    const snapshot = dependencies.store.getSnapshot();
    if (!sameSelection(snapshot.selection, selectionOf(state)) || snapshot.candles.length === 0) return;
    state = { ...state, loading: false };
    void materialize().then((committed) => {
      if (committed) applyRequestedLatest();
    });
  };

  const failVisibleRange = (command: number, range: ChartVisibleRange): void => {
    if (!active || command !== rangeCommandGeneration) return;
    requestedVisibleRange = undefined;
    activeRangeCommand = undefined;
    dependencies.onPresentationUnavailable?.(structuredClone(state));
    report(
      createChartError(
        "NO_VALID_DATA",
        "history-data",
        false,
        "Requested visible range is outside available history",
        { from: range.from, to: range.to }
      ),
      false
    );
  };

  const awaitRangeRequest = async (
    command: number,
    cursor: string | undefined,
    request: () => Promise<void>
  ): Promise<void> => {
    const owners = rangeRequestOwners.get(cursor) ?? new Set<number>();
    owners.add(command);
    rangeRequestOwners.set(cursor, owners);
    try {
      await request();
    } finally {
      owners.delete(command);
      if (owners.size === 0) rangeRequestOwners.delete(cursor);
    }
  };

  const fulfillVisibleRange = async (
    range: ChartVisibleRange,
    command: number,
    requestedSelectionRevision: number,
    expectedSelection: SeriesSelection
  ): Promise<void> => {
    const seenStates = new Set<string>();
    while (
      active &&
      command === rangeCommandGeneration &&
      requestedSelectionRevision === selectionRevision &&
      sameSelection(selectionOf(state), expectedSelection)
    ) {
      const snapshot = dependencies.store.getSnapshot();
      if (!sameSelection(snapshot.selection, expectedSelection) || snapshot.descriptors.length === 0) return;
      const stateKey = snapshot.descriptors.map((descriptor) =>
        `${descriptor.requestCursor ?? "initial"}:${descriptor.beforeCursor ?? "end"}:${descriptor.candles === undefined ? 0 : 1}`
      ).join("|");
      if (seenStates.has(stateKey)) {
        failVisibleRange(command, range);
        return;
      }
      seenStates.add(stateKey);

      const knownMaxTime = Math.max(...snapshot.descriptors.map((descriptor) => descriptor.maxTime));
      if (range.to > knownMaxTime) {
        failVisibleRange(command, range);
        return;
      }

      const missing = snapshot.descriptors.find((descriptor) =>
        descriptor.candles === undefined &&
        descriptor.maxTime >= range.from &&
        descriptor.minTime <= range.to
      );
      if (missing !== undefined) {
        await awaitRangeRequest(
          command,
          missing.requestCursor,
          () => dependencies.dataCoordinator.reloadPage(missing.requestCursor)
        );
        continue;
      }

      const first = snapshot.candles[0]?.time;
      const last = snapshot.candles.at(-1)?.time;
      if (first !== undefined && last !== undefined && first <= range.from && last >= range.to) {
        const committed = await materialize(range.from + (range.to - range.from) / 2);
        if (
          !active ||
          command !== rangeCommandGeneration ||
          requestedSelectionRevision !== selectionRevision
        ) return;
        if (!committed) {
          failVisibleRange(command, range);
          return;
        }
        let applied = false;
        applyingRequestedVisibleRange = true;
        try {
          applied = dependencies.runtime.setVisibleRange(range);
        } finally {
          applyingRequestedVisibleRange = false;
        }
        if (!applied) {
          failVisibleRange(command, range);
          return;
        }
        requestedVisibleRange = undefined;
        activeRangeCommand = undefined;
        return;
      }

      const cursor = dependencies.store.getNextBeforeCursor();
      if (cursor === undefined) {
        failVisibleRange(command, range);
        return;
      }
      await awaitRangeRequest(
        command,
        cursor,
        () => dependencies.dataCoordinator.loadMoreBefore()
      );
    }
  };

  const startRequestedVisibleRange = (): void => {
    if (
      !active ||
      requestedVisibleRange === undefined ||
      activeRangeCommand === requestedVisibleRangeCommand
    ) return;
    const command = requestedVisibleRangeCommand;
    const range = { ...requestedVisibleRange };
    const requestedSelectionRevision = selectionRevision;
    const expectedSelection = selectionOf(state);
    activeRangeCommand = command;
    markPresentationPending();
    void fulfillVisibleRange(range, command, requestedSelectionRevision, expectedSelection).finally(() => {
      if (activeRangeCommand === command) activeRangeCommand = undefined;
    });
  };

  const beginSelection = (): void => {
    if (state.capabilities === undefined) return;
    dependencies.runtime.clearCrosshair();
    invalidateSelectionMaterialization(true);
    state = { ...state, loading: true };
    viewModel = { ...viewModel, status: { type: "loading" }, dataWindow: undefined };
    retryTarget = undefined;
    publish();
    void dependencies.dataCoordinator.start(selectionOf(state));
  };

  const beginCapabilities = async (
    symbol: ChartSymbol,
    preferredTimeframe: Timeframe,
    preferredAdjustMode: AdjustMode
  ): Promise<void> => {
    if (!active) return;
    const retainedDrawings = symbol.id === state.symbol.id
      ? viewModel.drawings
      : undefined;
    const retainedDrawingSelection = retainedDrawings === undefined
      ? []
      : viewModel.selectedDrawingIds;
    const retainedDrawingGroups = retainedDrawings === undefined
      ? []
      : viewModel.drawingGroups;
    const retainedAdjustMode = state.adjustMode;
    dependencies.runtime.clearCrosshair();
    const preferredView = state.view;
    requestedTimeframe = undefined;
    requestedAdjustMode = undefined;
    requestedView = undefined;
    invalidateSelectionMaterialization();
    capabilityGeneration += 1;
    const generation = capabilityGeneration;
    capabilityController?.abort();
    dependencies.dataCoordinator.cancel();
    const controller = new AbortController();
    capabilityController = controller;
    state = {
      symbol: cloneSymbol(symbol),
      timeframe: preferredTimeframe,
      view: preferredView,
      intradayDays: state.intradayDays,
      adjustMode: normalizeAdjustMode(symbol, preferredAdjustMode),
      loading: true
    };
    viewModel = {
      ...viewModel,
      status: { type: "loading" },
      dataWindow: undefined,
      drawings: retainedDrawings ?? [],
      drawingGroups: retainedDrawingGroups,
      selectedDrawingIds: retainedDrawingSelection
    };
    retryTarget = undefined;
    publish();
    if (!active || controller.signal.aborted || generation !== capabilityGeneration) return;

    try {
      const declared = await dependencies.getCapabilities(cloneSymbol(symbol), controller.signal);
      if (!active || controller.signal.aborted || generation !== capabilityGeneration) return;
      const capabilities = normalizeDataCapabilities(symbol, declared);
      if (capabilities === undefined) {
        state = { ...state, loading: false };
        report(
          createChartError(
            "INVALID_DATA",
            "initial-data",
            false,
            "Market data capabilities are invalid",
            { symbolId: symbol.id }
          ),
          true
        );
        return;
      }
      const desiredView = requestedView ?? preferredView;
      const desiredTimeframe = requestedTimeframe ?? preferredTimeframe;
      const timeframe = desiredView === "intraday" && capabilities.series.some(
        (item) => item.timeframe === "1m"
      )
        ? "1m"
        : selectSupportedTimeframe(capabilities, desiredTimeframe);
      const adjustMode = selectSupportedAdjustMode(
        symbol,
        capabilities,
        timeframe,
        requestedAdjustMode ?? preferredAdjustMode
      );
      if (timeframe !== state.timeframe || adjustMode !== state.adjustMode) {
        cancelVisibleRangeCommand(true);
      }
      const view = desiredView === "intraday" && timeframe === "1m"
        ? "intraday"
        : "timeframe";
      requestedTimeframe = undefined;
      requestedAdjustMode = undefined;
      requestedView = undefined;
      const keepDrawings =
        retainedDrawings !== undefined &&
        retainedAdjustMode === adjustMode;
      const drawingState = keepDrawings
        ? { drawings: retainedDrawings, drawingGroups: retainedDrawingGroups }
        : loadDrawingState(symbol, adjustMode);
      state = {
        symbol: cloneSymbol(symbol),
        timeframe,
        view,
        intradayDays: state.intradayDays,
        adjustMode,
        loading: true,
        capabilities
      };
      viewModel = {
        ...viewModel,
        intradayView: view === "intraday",
        seriesType: view === "intraday" ? "line" : timeframeSeriesType,
        drawings: drawingState.drawings,
        drawingGroups: drawingState.drawingGroups,
        selectedDrawingIds: keepDrawings ? retainedDrawingSelection : []
      };
      beginSelection();
    } catch (error) {
      if (!active || controller.signal.aborted || generation !== capabilityGeneration || isAbortError(error)) return;
      const failure = datafeedFailure(error, "Market data capabilities could not be loaded");
      retryTarget = failure.recoverable ? "capabilities" : undefined;
      state = { ...state, loading: false };
      report(
        createChartError(
          "INITIAL_DATA_FAILED",
          "initial-data",
          failure.recoverable,
          failure.message,
          { symbolId: symbol.id, ...failure.context }
        ),
        true
      );
    } finally {
      if (capabilityController === controller) capabilityController = undefined;
    }
  };

  const api: ChartController = {
    start() {
      if (!active) return;
      void beginCapabilities(state.symbol, state.timeframe, state.adjustMode);
    },
    deactivate,
    getState() {
      return structuredClone(state);
    },
    getVisibleRange() {
      return state.loading || currentMaterialized === undefined
        ? undefined
        : dependencies.runtime.getVisibleRange();
    },
    shouldPublishVisibleRange() {
      return active && !state.loading && (
        requestedVisibleRange === undefined || applyingRequestedVisibleRange
      ) && (
        requestedLatestCommand === undefined || applyingRequestedLatest
      );
    },
    getViewModel() {
      return structuredClone(viewModel);
    },
    setSymbol(symbol) {
      if (!active || sameSymbol(symbol, state.symbol)) return;
      api.stopReplay();
      if (viewModel.comparisons.some((comparison) => comparison.symbol.id === symbol.id)) {
        api.setComparisons(
          viewModel.comparisons.filter((comparison) => comparison.symbol.id !== symbol.id)
        );
      }
      if (symbol.id !== state.symbol.id) {
        dependencies.runtime.setExecutions([]);
        dependencies.runtime.setMarks([]);
        viewModel = { ...viewModel, marks: [] };
      }
      const preferredAdjust = normalizeAdjustMode(
        symbol,
        state.symbol.kind === "index" && symbol.kind === "stock" ? "forward" : state.adjustMode
      );
      void beginCapabilities(symbol, state.timeframe, preferredAdjust);
    },
    setTimeframe(timeframe) {
      if (!active) return;
      if (state.capabilities === undefined) {
        requestedTimeframe = timeframe;
        requestedView = "timeframe";
        state = { ...state, timeframe, view: "timeframe" };
        viewModel = {
          ...viewModel,
          intradayView: false,
          seriesType: timeframeSeriesType
        };
        publish();
        return;
      }
      if (!state.capabilities.series.some((item) => item.timeframe === timeframe)) return;
      if (timeframe === state.timeframe) {
        if (state.view === "intraday") api.setView("timeframe");
        return;
      }
      api.stopReplay();
      const adjustMode = selectSupportedAdjustMode(
        state.symbol,
        state.capabilities,
        timeframe,
        state.adjustMode
      );
      cancelVisibleRangeCommand();
      state = { ...state, timeframe, view: "timeframe", adjustMode };
      viewModel = { ...viewModel, intradayView: false, seriesType: timeframeSeriesType };
      if (adjustMode !== viewModel.state.adjustMode) {
        const drawingState = loadDrawingState(state.symbol, adjustMode);
        viewModel = {
          ...viewModel,
          drawings: drawingState.drawings,
          drawingGroups: drawingState.drawingGroups,
          selectedDrawingIds: []
        };
      }
      beginSelection();
    },
    setView(view) {
      if (!active) return;
      if (state.capabilities === undefined) {
        requestedView = view;
        if (view === "intraday") {
          if (state.view !== "intraday") timeframeSeriesType = viewModel.seriesType;
          requestedTimeframe = "1m";
          state = { ...state, timeframe: "1m", view };
          viewModel = { ...viewModel, intradayView: true, seriesType: "line" };
        } else {
          state = { ...state, view };
          viewModel = {
            ...viewModel,
            intradayView: false,
            seriesType: timeframeSeriesType
          };
        }
        publish();
        return;
      }
      requestedView = undefined;
      if (view === state.view) return;
      api.stopReplay();
      if (view === "intraday") {
        if (!state.capabilities?.series.some((item) => item.timeframe === "1m")) return;
        cancelVisibleRangeCommand();
        timeframeSeriesType = viewModel.seriesType;
        const adjustMode = selectSupportedAdjustMode(
          state.symbol,
          state.capabilities,
          "1m",
          state.adjustMode
        );
        state = { ...state, timeframe: "1m", view, adjustMode };
        viewModel = { ...viewModel, intradayView: true, seriesType: "line" };
        if (viewModel.state.timeframe !== "1m" || viewModel.state.adjustMode !== adjustMode) {
          beginSelection();
          return;
        }
        invalidateViewMaterialization();
        const snapshot = dependencies.store.getSnapshot();
        if (!sameSelection(snapshot.selection, selectionOf(state)) || snapshot.descriptors.length === 0) {
          publish();
          return;
        }
        if (needsIntradayHistory()) {
          state = { ...state, loading: true };
          viewModel = { ...viewModel, status: { type: "loading" } };
          publish();
          void dependencies.dataCoordinator.loadMoreBefore();
          return;
        }
        publish();
        void materialize();
        return;
      }

      cancelVisibleRangeCommand();
      const snapshot = dependencies.store.getSnapshot();
      const hasAcceptedPage =
        sameSelection(snapshot.selection, selectionOf(state)) && snapshot.descriptors.length > 0;
      state = {
        ...state,
        view: "timeframe",
        loading: hasAcceptedPage ? false : state.loading
      };
      viewModel = {
        ...viewModel,
        intradayView: false,
        seriesType: timeframeSeriesType,
        status: hasAcceptedPage ? { type: "ready" } : viewModel.status
      };
      invalidateViewMaterialization();
      publish();
      if (hasAcceptedPage) void materialize();
    },
    setIntradayView(enabled) {
      api.setView(enabled ? "intraday" : "timeframe");
    },
    setIntradayDays(days) {
      if (!active) return;
      if (state.view !== "intraday") {
        state = { ...state, intradayDays: days };
        api.setView("intraday");
        return;
      }
      if (days === state.intradayDays) return;
      api.stopReplay();
      cancelVisibleRangeCommand();
      state = { ...state, intradayDays: days };
      invalidateViewMaterialization();
      const snapshot = dependencies.store.getSnapshot();
      const hasAcceptedPage =
        sameSelection(snapshot.selection, selectionOf(state)) && snapshot.descriptors.length > 0;
      if (!hasAcceptedPage) {
        publish();
        return;
      }
      if (needsIntradayHistory()) {
        state = { ...state, loading: true };
        viewModel = { ...viewModel, status: { type: "loading" } };
        publish();
        void dependencies.dataCoordinator.loadMoreBefore();
        return;
      }
      state = { ...state, loading: false };
      viewModel = { ...viewModel, status: { type: "ready" } };
      publish();
      void materialize();
    },
    setAdjustMode(adjustMode) {
      if (!active) return;
      const normalized = normalizeAdjustMode(state.symbol, adjustMode);
      if (state.capabilities === undefined) {
        requestedAdjustMode = normalized;
        state = { ...state, adjustMode: normalized };
        publish();
        return;
      }
      if (
        normalized === state.adjustMode ||
        !adjustModesForTimeframe(state.capabilities, state.timeframe).includes(normalized)
      ) return;
      api.stopReplay();
      cancelVisibleRangeCommand();
      state = { ...state, adjustMode: normalized };
      const drawingState = loadDrawingState(state.symbol, normalized);
      viewModel = {
        ...viewModel,
        drawings: drawingState.drawings,
        drawingGroups: drawingState.drawingGroups,
        selectedDrawingIds: []
      };
      beginSelection();
    },
    setVisibleRange(range) {
      if (!active) return;
      api.stopReplay();
      if (state.view === "intraday") return;
      materializationIntentGeneration += 1;
      rangeCommandGeneration += 1;
      requestedLatestCommand = undefined;
      requestedVisibleRange = { ...range };
      requestedVisibleRangeCommand = rangeCommandGeneration;
      activeRangeCommand = undefined;
      startRequestedVisibleRange();
    },
    prepareTimeScaleMutation() {
      if (!active) return false;
      api.stopReplay();
      if (state.loading || state.view === "intraday" || currentMaterialized === undefined) {
        return false;
      }
      materializationIntentGeneration += 1;
      cancelVisibleRangeCommand();
      return true;
    },
    resetToLatest(resetPriceScale = true) {
      if (!active) return;
      api.stopReplay();
      materializationIntentGeneration += 1;
      const command = ++rangeCommandGeneration;
      requestedVisibleRange = undefined;
      activeRangeCommand = undefined;
      requestedLatestCommand = command;
      requestedLatestResetPriceScale = resetPriceScale;
      materializedAnchorTime = undefined;
      const snapshot = dependencies.store.getSnapshot();
      if (
        state.loading ||
        !sameSelection(snapshot.selection, selectionOf(state)) ||
        snapshot.descriptors.length === 0
      ) return;
      void materialize().then((committed) => {
        if (committed) applyRequestedLatest();
      });
    },
    retry() {
      if (!active) return;
      if (retryTarget === "capabilities") {
        void beginCapabilities(state.symbol, state.timeframe, state.adjustMode);
      }
      if (retryTarget === "initial-data") void dependencies.dataCoordinator.retryInitial();
      if (retryTarget === "render") {
        state = { ...state, loading: true };
        viewModel = { ...viewModel, state, status: { type: "loading" } };
        publish();
        dependencies.runtime.retryRender();
      }
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
        if (!queueDataLoad(event)) return;
        retryTarget = undefined;
        if (needsIntradayHistory()) {
          state = { ...state, loading: true };
          viewModel = { ...viewModel, status: { type: "loading" } };
          publish();
          void dependencies.dataCoordinator.loadMoreBefore();
          return;
        }
        state = { ...state, loading: false };
        viewModel = { ...viewModel, status: { type: "ready" } };
        publish();
        if (requestedVisibleRange !== undefined) {
          startRequestedVisibleRange();
          return;
        }
        void materialize(materializedAnchorTime).then((committed) => {
          if (!active || !committed) return;
          applyRequestedLatest();
          api.handleMaterializationDemandChanged(dependencies.runtime.getMaterializationDemand());
        });
        return;
      }
      if (event.type === "historyPageAccepted") {
        if (!queueDataLoad(event)) return;
        if (viewModel.replay.status !== "inactive") {
          failedHistoryCursor = undefined;
          return;
        }
        if (needsIntradayHistory()) {
          state = { ...state, loading: true };
          viewModel = { ...viewModel, status: { type: "loading" } };
          failedHistoryCursor = undefined;
          publish();
          void dependencies.dataCoordinator.loadMoreBefore();
          return;
        }
        state = { ...state, loading: false };
        viewModel = { ...viewModel, status: { type: "ready" } };
        failedHistoryCursor = undefined;
        publish();
        if (materializationReloadCount > 0) return;
        if (requestedVisibleRange !== undefined) {
          startRequestedVisibleRange();
          return;
        }
        void materialize(materializedAnchorTime).then((committed) => {
          if (!active || !committed) return;
          applyRequestedLatest();
          api.handleMaterializationDemandChanged(dependencies.runtime.getMaterializationDemand());
        });
        return;
      }
      if (event.type === "snapshotRefreshing") {
        pendingDataLoads = [];
        api.stopReplay();
        return;
      }
      if (event.type === "initialRequestFailed") {
        if (isAbortError(event.error)) return;
        if (requestedVisibleRange !== undefined) cancelVisibleRangeCommand();
        const failure = datafeedFailure(event.error, "Initial market data could not be loaded");
        const error = createChartError(
          "INITIAL_DATA_FAILED",
          "initial-data",
          failure.recoverable,
          failure.message,
          { symbolId: state.symbol.id, timeframe: state.timeframe, adjustMode: state.adjustMode, ...failure.context }
        );
        retryTarget = failure.recoverable ? "initial-data" : undefined;
        state = { ...state, loading: false };
        report(error, true);
        return;
      }
      if (event.type === "historyRequestFailed") {
        if (isAbortError(event.error)) return;
        const owners = rangeRequestOwners.get(event.cursor);
        if (owners !== undefined && !owners.has(rangeCommandGeneration)) return;
        const requestedRangeFailed = owners?.has(rangeCommandGeneration) === true;
        if (requestedRangeFailed) cancelVisibleRangeCommand();
        const failure = datafeedFailure(event.error, "Earlier market data could not be loaded");
        failedHistoryCursor = failure.recoverable ? event.cursor ?? null : undefined;
        materializePartialIntradayAfterHistoryFailure();
        if (requestedRangeFailed) {
          dependencies.onPresentationUnavailable?.(structuredClone(state));
        }
        report(
          createChartError(
            "HISTORY_DATA_FAILED",
            "history-data",
            failure.recoverable,
            failure.message,
            { symbolId: state.symbol.id, timeframe: state.timeframe, adjustMode: state.adjustMode, hasCursor: event.cursor !== undefined, ...failure.context }
          ),
          false
        );
        return;
      }
      const blocking = event.phase === "initial";
      const owners = blocking ? undefined : rangeRequestOwners.get(event.cursor);
      if (!blocking && owners !== undefined && !owners.has(rangeCommandGeneration)) return;
      const requestedRangeFailed = blocking
        ? requestedVisibleRange !== undefined
        : owners?.has(rangeCommandGeneration) === true;
      if (requestedRangeFailed) cancelVisibleRangeCommand();
      if (!blocking) materializePartialIntradayAfterHistoryFailure();
      if (!blocking && requestedRangeFailed) {
        dependencies.onPresentationUnavailable?.(structuredClone(state));
      }
      const code = event.code === "NO_VALID_DATA" ? "NO_VALID_DATA" : "INVALID_DATA";
      report(
        createChartError(
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
      if (!active || event.query !== viewModel.search.query) return;
      if (event.type === "results") {
        viewModel = {
          ...viewModel,
          search: { query: event.query, loading: false, results: event.symbols.map(cloneSymbol) }
        };
      } else if (!isAbortError(event.error)) {
        const failure = datafeedFailure(event.error, "Symbol search failed");
        const error = createChartError(
          "SYMBOL_SEARCH_FAILED",
          "search",
          failure.recoverable,
          failure.message,
          failure.context
        );
        viewModel = {
          ...viewModel,
          search: { ...viewModel.search, query: event.query, loading: false, error }
        };
        try {
          dependencies.onError?.(error);
        } catch {
          // Host error handlers are isolated from chart state.
        }
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
        Math.max(0, Math.floor((viewport.visibleRange.from + viewport.visibleRange.to) / 2))
      ]?.time;
    },
    handleMaterializedBoundary(direction, anchorTime) {
      if (!active || anchorTime === undefined || currentMaterialized === undefined) return;
      if (viewModel.intradayView || replayAdvanceTransaction !== undefined) return;
      materializedAnchorTime = anchorTime;
      const rematerialize =
        direction === "before"
          ? currentMaterialized.hasKnownOlderData
          : currentMaterialized.hasKnownNewerPages;
      if (rematerialize) {
        if (boundaryMaterializing !== undefined) return;
        const task = materialize(anchorTime);
        boundaryMaterializing = task;
        void task.finally(() => {
          if (boundaryMaterializing === task) boundaryMaterializing = undefined;
        });
        return;
      }
      if (direction === "before") void dependencies.dataCoordinator.loadMoreBefore();
    },
    handleMaterializationDemandChanged(demand) {
      if (
        !active ||
        currentMaterialized === undefined ||
        requestedVisibleRange !== undefined ||
        replayAdvanceTransaction !== undefined
      ) return;
      const required = demand.visibleCount + demand.overscanCount * 2;
      if (currentMaterialized.series.candles.length >= required) return;
      if (currentMaterialized.hasKnownOlderData || currentMaterialized.hasKnownNewerPages) {
        void materialize(materializedAnchorTime);
        return;
      }
      if (currentMaterialized.hasMoreBefore) void dependencies.dataCoordinator.loadMoreBefore();
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
    handleComparisonData(snapshots) {
      if (!active) return;
      viewModel = {
        ...viewModel,
        comparisonStatuses: snapshots.map((snapshot) => ({
          symbolId: snapshot.comparison.symbol.id,
          status: snapshot.status
        }))
      };
      dependencies.runtime.setComparisonData(snapshots);
      publish();
    },
    handleDrawingsChanged(
      drawings,
      selectedDrawingIds = [],
      drawingGroups = viewModel.drawingGroups
    ) {
      if (!active) return;
      viewModel = {
        ...viewModel,
        drawings: drawings.map((drawing) => structuredClone(drawing)),
        drawingGroups: structuredClone(drawingGroups),
        selectedDrawingIds: [...selectedDrawingIds]
      };
      if (dependencies.drawingPersistenceEnabled) {
        dependencies.persistence.saveDrawingState(state.symbol, state.adjustMode, {
          drawings: viewModel.drawings,
          drawingGroups: viewModel.drawingGroups
        });
      }
      publish();
    },
    handleDrawingHistoryChanged(history) {
      if (!active) return;
      viewModel = { ...viewModel, canUndoDrawing: history.canUndo, canRedoDrawing: history.canRedo };
      publish();
    },
    handleRenderError(error, calculationKind) {
      if (!active || isAbortError(error)) return;
      if (viewModel.status.type === "blocked" && retryTarget !== "render") return;
      const workspaceError = calculationKind === undefined
        ? createChartError(
            "RENDER_FAILED",
            "render",
            true,
            "The chart could not be rendered",
            { symbolId: state.symbol.id, timeframe: state.timeframe, adjustMode: state.adjustMode }
          )
        : createChartError(
            "CALCULATION_FAILED",
            "calculation",
            true,
            "The chart calculation could not be completed",
            {
              symbolId: state.symbol.id,
              timeframe: state.timeframe,
              adjustMode: state.adjustMode,
              calculationKind
            }
          );
      if (retryTarget !== "render" && viewModel.status.type !== "blocked") {
        statusBeforeRenderFailure = viewModel.status;
      }
      retryTarget = "render";
      report(workspaceError, true);
    },
    handleRenderRecovered() {
      if (!active || retryTarget !== "render") return;
      retryTarget = undefined;
      const status = statusBeforeRenderFailure?.type === "blocked"
        ? { type: "ready" as const }
        : statusBeforeRenderFailure ?? { type: "ready" as const };
      statusBeforeRenderFailure = undefined;
      state = { ...state, loading: status.type === "loading" };
      viewModel = { ...viewModel, state, status };
      publish();
      if (
        !state.loading &&
        currentMaterialized !== undefined &&
        currentMaterialized.series.candles.length > 0
      ) markPresentationReady();
    },
    searchSymbols(query) {
      if (!active) return;
      const normalized = query.trim();
      viewModel = {
        ...viewModel,
        search: {
          query: normalized,
          loading: normalized.length > 0,
          results: []
        }
      };
      publish();
      void dependencies.searchCoordinator.search(normalized);
    },
    retrySearch() {
      if (!active || viewModel.search.query.length === 0) return;
      api.searchSymbols(viewModel.search.query);
    },
    loadMoreBefore() {
      if (active) void dependencies.dataCoordinator.loadMoreBefore();
    },
    retryHistory() {
      if (active && failedHistoryCursor !== undefined) {
        void dependencies.dataCoordinator.reloadPage(failedHistoryCursor === null ? undefined : failedHistoryCursor);
      }
    },
    setSeriesType(type) {
      if (!active || state.view === "intraday" || type === viewModel.seriesType) return;
      applySeriesConfiguration(type, viewModel.seriesProperties);
    },
    setSeriesProperties(properties) {
      if (!active) return;
      if (Array.isArray(properties)) {
        applySeriesConfiguration(viewModel.seriesType, properties);
        return;
      }
      const parsed = parseSeriesProperties([properties])[0]!;
      const existingIndex = viewModel.seriesProperties.findIndex(
        (candidate) => candidate.type === parsed.type
      );
      applySeriesConfiguration(
        viewModel.seriesType,
        existingIndex < 0
          ? [...viewModel.seriesProperties, parsed]
          : viewModel.seriesProperties.map((candidate, index) =>
              index === existingIndex ? parsed : candidate
            )
      );
    },
    setSeriesVisualOverrides(overrides) {
      if (!active) return;
      const parsed = parseSeriesVisualOverrides([overrides])[0]!;
      const existingIndex = viewModel.seriesVisualOverrides.findIndex(
        (candidate) => candidate.type === parsed.type
      );
      const isDefault = Object.keys(parsed).every((key) => key === "type");
      const next = existingIndex < 0
        ? (isDefault ? viewModel.seriesVisualOverrides : [
            ...viewModel.seriesVisualOverrides,
            parsed
          ])
        : (isDefault
            ? viewModel.seriesVisualOverrides.filter((_, index) => index !== existingIndex)
            : viewModel.seriesVisualOverrides.map((candidate, index) =>
                index === existingIndex ? parsed : candidate
              ));
      if (JSON.stringify(next) === JSON.stringify(viewModel.seriesVisualOverrides)) return;
      viewModel = { ...viewModel, seriesVisualOverrides: next };
      if (parsed.type === viewModel.seriesType) {
        dependencies.runtime.setSeriesVisualOverrides(parsed);
      }
      if (dependencies.seriesTypePersistenceEnabled) savePreferences();
      publish();
    },
    setSeriesConfiguration(type, properties) {
      if (!active || (state.view === "intraday" && type !== "line")) return;
      applySeriesConfiguration(type, properties);
    },
    setFavoriteTimeframe(timeframe, favorite) {
      if (!active) return false;
      if (viewModel.favoriteTimeframes.includes(timeframe) === favorite) return true;
      if (favorite && viewModel.favoriteTimeframes.length >= maxFavoriteTimeframes) return false;
      viewModel = {
        ...viewModel,
        favoriteTimeframes: favorite
          ? [...viewModel.favoriteTimeframes, timeframe]
          : viewModel.favoriteTimeframes.filter((item) => item !== timeframe)
      };
      savePreferences();
      publish();
      return true;
    },
    setPriceScaleMode(mode) {
      if (
        !active ||
        mode === viewModel.priceScaleMode ||
        (viewModel.comparisons.length > 0 && mode !== "percentage")
      ) return;
      viewModel = { ...viewModel, priceScaleMode: mode };
      dependencies.runtime.setPriceScaleMode(mode);
      savePreferences();
      publish();
    },
    setComparisons(comparisons) {
      if (!active) return;
      const parsed = parseComparisons(comparisons, state.symbol);
      const hadComparisons = viewModel.comparisons.length > 0;
      const hasComparisons = parsed.length > 0;
      const previousPriceScaleMode = viewModel.priceScaleMode;
      let priceScaleMode = viewModel.priceScaleMode;
      if (!hadComparisons && hasComparisons) {
        priceScaleBeforeComparisons = priceScaleMode;
        priceScaleMode = "percentage";
      } else if (hadComparisons && !hasComparisons) {
        priceScaleMode = priceScaleBeforeComparisons ?? priceScaleMode;
        priceScaleBeforeComparisons = undefined;
      }
      viewModel = {
        ...viewModel,
        comparisons: parsed,
        comparisonStatuses: parsed.map((comparison) => ({
          symbolId: comparison.symbol.id,
          status: comparison.visible === false ? "hidden" : "loading"
        })),
        priceScaleMode
      };
      dependencies.runtime.setComparisonData([]);
      if (priceScaleMode !== previousPriceScaleMode) {
        dependencies.runtime.setPriceScaleMode(priceScaleMode);
      }
      savePreferences();
      publish();
    },
    setIndicators(configs) {
      if (!active) return;
      const indicators = parseIndicatorConfigs(configs);
      if (JSON.stringify(indicators) === JSON.stringify(viewModel.indicators)) return;
      viewModel = { ...viewModel, indicators };
      dependencies.runtime.setIndicators(viewModel.indicators);
      dependencies.persistence.saveIndicators(viewModel.indicators);
      publish();
    },
    setDrawings(drawings, selectedDrawingIds = [], drawingGroups = []) {
      if (!active) return;
      const drawingIds = new Set(
        drawings
          .filter((drawing) => drawing.interactive !== false)
          .map((drawing) => drawing.id)
      );
      const selection = [...new Set(selectedDrawingIds)]
        .filter((id) => drawingIds.has(id));
      viewModel = {
        ...viewModel,
        drawings: drawings.map((drawing) => structuredClone(drawing)),
        drawingGroups: structuredClone(drawingGroups),
        selectedDrawingIds: selection
      };
      dependencies.runtime.setDrawings(
        viewModel.drawings,
        selection,
        viewModel.drawingGroups
      );
      if (dependencies.drawingPersistenceEnabled) {
        dependencies.persistence.saveDrawingState(state.symbol, state.adjustMode, {
          drawings: viewModel.drawings,
          drawingGroups: viewModel.drawingGroups
        });
      }
      publish();
    },
    createDrawingGroup(drawingIds, name = `Group ${viewModel.drawingGroups.length + 1}`) {
      if (!active) {
        throw new DOMException("Drawing groups are unavailable", "InvalidStateError");
      }
      return dependencies.runtime.createDrawingGroup([...drawingIds], name) as ChartDrawingGroupId;
    },
    setDrawingGroupName(id, name) {
      if (active) dependencies.runtime.setDrawingGroupName(id, name);
    },
    setDrawingGroupMembers(id, drawingIds) {
      if (active) dependencies.runtime.setDrawingGroupMembers(id, [...drawingIds]);
    },
    setDrawingGroupVisible(id, visible) {
      if (active) dependencies.runtime.setDrawingGroupVisible(id, visible);
    },
    setDrawingGroupLocked(id, locked) {
      if (active) dependencies.runtime.setDrawingGroupLocked(id, locked);
    },
    moveDrawingGroup(id, direction) {
      if (active) dependencies.runtime.moveDrawingGroup(id, direction);
    },
    ungroupDrawingGroup(id) {
      if (active) dependencies.runtime.ungroupDrawingGroup(id);
    },
    deleteDrawingGroupDrawings(id) {
      if (active) dependencies.runtime.deleteDrawingGroupDrawings(id);
    },
    setMarks(marks) {
      if (!active) return;
      viewModel = { ...viewModel, marks: marks.map((mark) => ({ ...mark })) };
      dependencies.runtime.setMarks(viewModel.marks);
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
      savePreferences();
      publish();
    },
    setExecutionsVisible(visible) {
      if (!active || !dependencies.executionsEnabled || visible === viewModel.executionsVisible) return;
      viewModel = { ...viewModel, executionsVisible: visible };
      dependencies.runtime.setExecutionsVisible(visible);
      publish();
    },
    startReplay(time) {
      if (!active || state.loading || currentMaterialized === undefined) return false;
      const requested = time ?? dependencies.runtime.getVisibleRange()?.from;
      if (requested === undefined) return false;
      const candles = replayCandles();
      const index = candles.findIndex((candle) => candle.time === requested);
      if (index < 0 || !hasReplaySuccessor(requested)) return false;
      clearReplayTimer();
      cancelVisibleRangeCommand();
      replaySessionGeneration += 1;
      replayAdvanceTask = undefined;
      replayAdvanceTransaction = undefined;
      materializationIntentGeneration += 1;
      viewModel = {
        ...viewModel,
        replay: {
          status: "paused",
          speed: viewModel.replay.speed,
          cursorTime: requested
        }
      };
      if (!commitReplayPresentation(requested)) return false;
      if (presentationIsPending) markPresentationReady();
      publish();
      return true;
    },
    stepReplay(steps = 1) {
      if (!active || !Number.isSafeInteger(steps) || steps < 1) return false;
      clearReplayTimer();
      const wasPlaying = viewModel.replay.status === "playing";
      const cursorBefore = viewModel.replay.cursorTime;
      if (wasPlaying) {
        viewModel = {
          ...viewModel,
          replay: {
            status: "paused",
            speed: viewModel.replay.speed,
            cursorTime: viewModel.replay.cursorTime!
          }
        };
      }
      if (replayAdvanceTransaction !== undefined) {
        replayAdvanceTransaction.keepPlaying = false;
      }
      const advanced = requestReplayAdvance(steps, false);
      if (wasPlaying && viewModel.replay.cursorTime === cursorBefore) publish();
      return advanced;
    },
    playReplay() {
      if (
        !active ||
        viewModel.status.type === "blocked" ||
        viewModel.replay.status === "inactive"
      ) return;
      if (viewModel.replay.status === "playing") return;
      if (!hasReplaySuccessor(viewModel.replay.cursorTime!)) return;
      viewModel = {
        ...viewModel,
        replay: {
          status: "playing",
          speed: viewModel.replay.speed,
          cursorTime: viewModel.replay.cursorTime!
        }
      };
      publish();
      if (replayAdvanceTask === undefined) scheduleReplay();
      else if (replayAdvanceTransaction !== undefined) {
        replayAdvanceTransaction.keepPlaying = true;
      }
    },
    pauseReplay() {
      clearReplayTimer();
      if (!active || viewModel.replay.status !== "playing") return;
      if (replayAdvanceTransaction !== undefined) {
        replayAdvanceTransaction.keepPlaying = false;
      }
      viewModel = {
        ...viewModel,
        replay: {
          status: "paused",
          speed: viewModel.replay.speed,
          cursorTime: viewModel.replay.cursorTime!
        }
      };
      publish();
    },
    setReplaySpeed(speed) {
      if (!active || speed === viewModel.replay.speed) return;
      viewModel = { ...viewModel, replay: { ...viewModel.replay, speed } };
      publish();
      if (viewModel.replay.status === "playing" && replayAdvanceTask === undefined) {
        scheduleReplay();
      }
    },
    stopReplay() {
      clearReplayTimer();
      if (!active || viewModel.replay.status === "inactive") return;
      const cursorTime = viewModel.replay.cursorTime;
      replaySessionGeneration += 1;
      replayAdvanceTask = undefined;
      replayAdvanceTransaction = undefined;
      viewModel = {
        ...viewModel,
        replay: { status: "inactive", speed: viewModel.replay.speed }
      };
      const committed = commitReplayPresentation(cursorTime);
      if (committed && presentationIsPending) markPresentationReady();
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
      dependencies.store.clear();
      dependencies.runtime.destroy();
    }
  };

  dependencies.runtime.setSeriesType(
    viewModel.seriesType,
    activeSeriesProperties(viewModel.seriesType)
  );
  dependencies.runtime.setSeriesVisualOverrides(
    activeSeriesVisualOverrides(viewModel.seriesType)
  );
  dependencies.runtime.setPriceScaleMode(viewModel.priceScaleMode);
  dependencies.runtime.setIndicators(viewModel.indicators);
  dependencies.runtime.setComparisonData([]);
  dependencies.runtime.setDrawings(
    viewModel.drawings,
    viewModel.selectedDrawingIds,
    viewModel.drawingGroups
  );
  dependencies.runtime.setMarks(viewModel.marks);
  dependencies.runtime.setGridVisible(viewModel.gridVisible);
  dependencies.runtime.setExecutionsVisible(viewModel.executionsVisible);

  return api;
}
