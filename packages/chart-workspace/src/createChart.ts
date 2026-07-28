import type {
  AdjustMode,
  ChartCrosshairEvent,
  ChartCrosshairListener,
  ChartCrosshairSnapshot,
  ChartEvent,
  ChartEventListener,
  ChartDrawing,
  ChartDrawingTool,
  ChartEntity,
  ChartEntityId,
  ChartEntityInput,
  ChartEntityKind,
  ChartExecution,
  ChartFeature,
  ChartIndicator,
  ChartIndicatorEntityId,
  ChartIndicatorInput,
  ChartInstance,
  ChartLayoutV2,
  ChartLocale,
  ChartMark,
  ChartOptions,
  ChartPriceScaleMode,
  ChartSeriesType,
  ChartState,
  ChartStateListener,
  ChartStudyApi,
  ChartSymbol,
  ChartTheme,
  ChartView,
  ChartVisibleRange,
  IntradayDayCount,
  Timeframe
} from "./contracts";
import { defaultChartFeatures } from "./contracts";
import { createChartController, type ChartController, type WorkspaceViewModel } from "./controller/chartController";
import { createCalculationCheckpointStore } from "./data/calculationCheckpointStore";
import { createDataCoordinator } from "./data/dataCoordinator";
import { createPagedSeriesStore } from "./data/pagedSeriesStore";
import { createSymbolSearchCoordinator } from "./data/symbolSearchCoordinator";
import { createChartError, type ChartError } from "./errors";
import { createBrowserPersistence, defaultLayoutState, defaultPreferences } from "./persistence/browserPersistence";
import {
  fromEngineDrawings,
  mergeIndicatorInputs,
  parseEntity,
  parseEntityId,
  parseEntityInput,
  parseEntityKind,
  parseIndicatorInput,
  parseDrawingTool,
  parseDrawings,
  parseIndicators,
  parseLayout,
  parseMarks,
  parsePriceScaleMode,
  parseSeriesType,
  parseVisibleRange,
  toEntityId,
  toEngineDrawings
} from "./programmableApi";
import {
  createChartEngineRuntime,
  type RuntimeCrosshairSnapshot
} from "./runtime/chartEngineRuntime";
import { createCheckpointedCalculationRuntime } from "./runtime/checkpointedCalculationRuntime";
import { createWorkspaceShell } from "./ui/workspaceShell";

const validFeatures = new Set<ChartFeature>([
  "symbol-search",
  "timeframes",
  "adjustment",
  "series-type",
  "price-scale",
  "indicators",
  "drawing-tools",
  "drawing-history",
  "settings",
  "bottom-panel",
  "executions"
]);
const drawingSurfaceFeatures: readonly ChartFeature[] = [
  "drawing-tools",
  "drawing-history",
  "bottom-panel"
];

function resolvedFeatures(features: unknown): ReadonlySet<ChartFeature> {
  return new Set(
    Array.isArray(features) && features.every((feature) => validFeatures.has(feature))
      ? features as readonly ChartFeature[]
      : defaultChartFeatures
  );
}

function resolvedTheme(theme: unknown): ChartTheme {
  return theme === "light" || theme === "dark" ? theme : "dark";
}

function resolvedLocale(locale: unknown): ChartLocale {
  return locale === "en-US" || locale === "zh-CN" ? locale : "zh-CN";
}

function validExecutionTime(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    Number.isFinite(new Date(value).getTime());
}

function validExecutions(executions: unknown): executions is readonly ChartExecution[] {
  return Array.isArray(executions) && executions.every((execution) => (
    typeof execution === "object" &&
    execution !== null &&
    typeof execution.id === "string" &&
    execution.id.trim().length > 0 &&
    validExecutionTime(execution.time) &&
    (
      (execution.firstTime === undefined && execution.lastTime === undefined) ||
      (
        validExecutionTime(execution.firstTime) &&
        validExecutionTime(execution.lastTime) &&
        execution.firstTime <= execution.lastTime &&
        execution.firstTime <= execution.time &&
        execution.time <= execution.lastTime
      )
    ) &&
    (execution.side === "buy" || execution.side === "sell") &&
    typeof execution.price === "number" && Number.isFinite(execution.price) && execution.price > 0 &&
    typeof execution.quantity === "number" && Number.isFinite(execution.quantity) && execution.quantity > 0 &&
    (execution.label === undefined || (typeof execution.label === "string" && execution.label.trim().length > 0)) &&
    (execution.amount === undefined || (typeof execution.amount === "number" && Number.isFinite(execution.amount))) &&
    (execution.fee === undefined || (typeof execution.fee === "number" && Number.isFinite(execution.fee))) &&
    (execution.tQuantity === undefined || (
      typeof execution.tQuantity === "number" &&
      Number.isFinite(execution.tQuantity) &&
      execution.tQuantity >= 0 &&
      execution.tQuantity <= execution.quantity
    ))
  ));
}

function validMarks(marks: unknown): marks is readonly ChartMark[] {
  try {
    parseMarks(marks);
    return true;
  } catch {
    return false;
  }
}

function validSymbol(symbol: unknown): symbol is ChartSymbol {
  return (
    typeof symbol === "object" &&
    symbol !== null &&
    !Array.isArray(symbol) &&
    typeof (symbol as ChartSymbol).id === "string" &&
    (symbol as ChartSymbol).id.trim().length > 0 &&
    typeof (symbol as ChartSymbol).code === "string" &&
    (symbol as ChartSymbol).code.trim().length > 0 &&
    typeof (symbol as ChartSymbol).name === "string" &&
    (symbol as ChartSymbol).name.trim().length > 0 &&
    ["SSE", "SZSE", "BSE"].includes((symbol as ChartSymbol).exchange) &&
    ["stock", "index"].includes((symbol as ChartSymbol).kind)
  );
}

function validOptions(options: ChartOptions): boolean {
  const symbol = options?.initialSymbol;
  return (
    typeof options?.chartId === "string" &&
    options.chartId.trim().length > 0 &&
    typeof options?.persistenceScopeId === "string" &&
    options.persistenceScopeId.trim().length > 0 &&
    typeof options?.dataContextId === "string" &&
    options.dataContextId.trim().length > 0 &&
    (options.dataCutoffTime === undefined ||
      (typeof options.dataCutoffTime === "number" &&
        Number.isFinite(options.dataCutoffTime) &&
        options.dataCutoffTime > 0)) &&
    validSymbol(symbol) &&
    (options.features === undefined ||
      (Array.isArray(options.features) && options.features.every((feature) => validFeatures.has(feature)))) &&
    (options.theme === undefined || (["dark", "light"] as const).includes(options.theme)) &&
    (options.locale === undefined || (["zh-CN", "en-US"] as const).includes(options.locale)) &&
    (options.executions === undefined || validExecutions(options.executions)) &&
    (options.marks === undefined || validMarks(options.marks)) &&
    typeof options?.datafeed?.getCapabilities === "function" &&
    typeof options?.datafeed?.searchSymbols === "function" &&
    typeof options?.datafeed?.loadSeries === "function"
  );
}

function blockedViewModel(state: ChartState, error: ChartError): WorkspaceViewModel {
  return {
    state,
    status: { type: "blocked", error },
    intradayView: false,
    seriesType: defaultPreferences.seriesType,
    favoriteTimeframes: defaultPreferences.favoriteTimeframes,
    priceScaleMode: defaultPreferences.priceScaleMode,
    indicators: [],
    drawings: [],
    marks: [],
    selectedDrawingIds: [],
    bottomPanel: defaultLayoutState.bottomPanel,
    drawingPalette: defaultLayoutState.drawingPalette,
    canUndoDrawing: false,
    canRedoDrawing: false,
    gridVisible: true,
    executionsVisible: false,
    calculationStatus: { type: "idle" },
    search: { query: "", loading: false, results: [] }
  };
}

function layoutSnapshot(viewModel: Readonly<WorkspaceViewModel>): ChartLayoutV2 {
  return {
    schemaVersion: 2,
    seriesType: viewModel.seriesType,
    priceScaleMode: viewModel.priceScaleMode,
    indicators: structuredClone(viewModel.indicators),
    drawings: fromEngineDrawings(viewModel.drawings),
    gridVisible: viewModel.gridVisible
  };
}

function layoutSelectionKey(state: Readonly<ChartState>): string {
  return JSON.stringify([state.symbol.id, state.timeframe, state.adjustMode]);
}

function presentationKey(state: Readonly<ChartState>): string {
  return JSON.stringify([
    state.symbol.id,
    state.timeframe,
    state.adjustMode,
    state.view,
    state.view === "intraday" ? state.intradayDays : null
  ]);
}

function entitySnapshot(
  viewModel: Readonly<WorkspaceViewModel>,
  scope: readonly [chartId: string, persistenceScopeId: string, dataContextId: string]
): ChartEntity[] {
  const state = viewModel.state;
  const indicators = viewModel.indicators.map((value) => {
    const input = { kind: "indicator" as const, value: structuredClone(value) };
    return { id: toEntityId(input, state, scope), ...input };
  });
  const drawings = fromEngineDrawings(viewModel.drawings).map((value) => {
    const input = { kind: "drawing" as const, value };
    return { id: toEntityId(input, state, scope), ...input };
  });
  const marks = viewModel.marks.map((value) => {
    const input = { kind: "mark" as const, value: structuredClone(value) };
    return { id: toEntityId(input, state, scope), ...input };
  });
  return [...indicators, ...drawings, ...marks];
}

function requireReadyLayout(
  viewModel: Readonly<WorkspaceViewModel>,
  readySelectionKey: string | undefined
): void {
  if (
    readySelectionKey !== layoutSelectionKey(viewModel.state) ||
    (viewModel.status.type !== "ready" && viewModel.status.type !== "readyWithWarning")
  ) {
    throw new DOMException("Chart layout is unavailable until initial data is loaded", "InvalidStateError");
  }
}

export function createChart(
  container: HTMLElement,
  options: ChartOptions
): ChartInstance {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("Chart container must be an HTMLElement");
  }

  const features = resolvedFeatures(options?.features);
  const shell = createWorkspaceShell({
    features,
    theme: resolvedTheme(options?.theme),
    locale: resolvedLocale(options?.locale)
  });
  container.append(shell.root);
  let destroyed = false;
  const stateListeners = new Set<ChartStateListener>();
  const eventListeners = new Set<ChartEventListener>();
  const crosshairListeners = new Set<ChartCrosshairListener>();
  let lastNotifiedState = "";
  let lastNotifiedLayout = "";
  let applyingLayout = false;
  let latestViewModelRevision = 0;
  let readySelectionKey: string | undefined;
  let materializedPresentationKey: string | undefined;
  let readyPresentationKey: string | undefined;
  let unavailablePresentationKey: string | undefined;
  const readinessWindow = container.ownerDocument.defaultView;
  let readinessFrameId: number | undefined;
  const cancelReadinessFrame = (): void => {
    if (readinessFrameId === undefined) return;
    readinessWindow?.cancelAnimationFrame(readinessFrameId);
    readinessFrameId = undefined;
  };
  const dataReadyWaiters = new Set<{
    readonly key: string;
    readonly resolve: (value: boolean) => void;
  }>();
  const settleDataReady = (predicate: (key: string) => boolean, value: boolean): void => {
    for (const waiter of [...dataReadyWaiters]) {
      if (!predicate(waiter.key)) continue;
      dataReadyWaiters.delete(waiter);
      waiter.resolve(value);
    }
  };
  let lastEntitySnapshot: Map<ChartEntityId, ChartEntity> | undefined;
  const entityScope = [
    options?.chartId ?? "",
    options?.persistenceScopeId ?? "",
    options?.dataContextId ?? ""
  ] as const;
  const eventQueue: ChartEvent[] = [];
  const crosshairEventQueue: ChartCrosshairEvent[] = [];
  let dispatchingEvents = false;
  let dispatchingCrosshairEvents = false;
  const emitEvents = (events: readonly ChartEvent[]): void => {
    eventQueue.push(...events);
    if (dispatchingEvents) return;
    dispatchingEvents = true;
    try {
      for (let index = 0; index < eventQueue.length && !destroyed; index += 1) {
        const event = eventQueue[index]!;
        for (const listener of [...eventListeners]) {
          if (destroyed) break;
          try {
            listener(structuredClone(event));
          } catch {
            // Host listeners are isolated from chart events.
          }
        }
      }
    } finally {
      eventQueue.length = 0;
      dispatchingEvents = false;
    }
  };
  const emitEvent = (event: ChartEvent): void => emitEvents([event]);
  const emitCrosshairEvent = (event: ChartCrosshairEvent): void => {
    crosshairEventQueue.push(event);
    if (dispatchingCrosshairEvents) return;
    dispatchingCrosshairEvents = true;
    try {
      for (let index = 0; index < crosshairEventQueue.length && !destroyed; index += 1) {
        const queued = crosshairEventQueue[index]!;
        for (const listener of [...crosshairListeners]) {
          if (destroyed) break;
          try {
            listener(structuredClone(queued));
          } catch {
            // Host listeners are isolated from chart events.
          }
        }
      }
    } finally {
      crosshairEventQueue.length = 0;
      dispatchingCrosshairEvents = false;
    }
  };
  const publicCrosshairSnapshot = (
    snapshot: RuntimeCrosshairSnapshot,
    activeController: ChartController
  ): ChartCrosshairSnapshot => {
    const state = activeController.getState();
    return {
      symbolId: snapshot.symbolId,
      timeframe: snapshot.timeframe,
      adjustMode: snapshot.adjustMode,
      dataVersion: snapshot.dataVersion,
      time: snapshot.crosshair.time,
      price: snapshot.crosshair.price,
      offsetX: snapshot.offsetX,
      offsetY: snapshot.offsetY,
      candle: { ...snapshot.candle },
      referencePrice: snapshot.referencePrice,
      change: snapshot.change,
      changePercent: snapshot.changePercent,
      studies: snapshot.studies.map((study) => ({
        entityId: toEntityId(
          { kind: "indicator", value: study.indicator },
          state,
          entityScope
        ) as ChartIndicatorEntityId,
        indicatorId: study.indicator.id,
        title: study.title,
        outputs: study.outputs.map((output) => ({ ...output }))
      }))
    };
  };
  const emitEntityChanges = (viewModel: Readonly<WorkspaceViewModel>): void => {
    if (applyingLayout) return;
    const nextEntities = entitySnapshot(viewModel, entityScope);
    const next = new Map(nextEntities.map((entity) => [entity.id, entity]));
    const previous = lastEntitySnapshot;
    lastEntitySnapshot = next;
    if (previous === undefined) return;
    const events: ChartEvent[] = [];
    for (const entity of previous.values()) {
      if (!next.has(entity.id)) events.push({ type: "entity-removed", entity });
    }
    for (const entity of nextEntities) {
      const before = previous.get(entity.id);
      if (before === undefined) {
        events.push({ type: "entity-created", entity });
      } else if (JSON.stringify(before) !== JSON.stringify(entity)) {
        events.push({ type: "entity-updated", entity });
      }
    }
    emitEvents(events);
  };
  const emitLayoutChanged = (viewModel: Readonly<WorkspaceViewModel>): void => {
    if (
      applyingLayout ||
      readySelectionKey !== layoutSelectionKey(viewModel.state) ||
      (viewModel.status.type !== "ready" && viewModel.status.type !== "readyWithWarning")
    ) return;
    const layout = layoutSnapshot(viewModel);
    const nextLayout = JSON.stringify(layout);
    if (nextLayout === lastNotifiedLayout) return;
    lastNotifiedLayout = nextLayout;
    emitEvent({ type: "layout-changed", layout });
  };

  if (!validOptions(options)) {
    const error = createChartError(
      "INVALID_CONFIGURATION",
      "configuration",
      false,
      "Chart configuration is invalid"
    );
    const state: ChartState = {
      symbol: { id: "invalid", code: "--", name: "Invalid configuration", exchange: "SSE", kind: "index" },
      timeframe: "1d",
      view: "timeframe",
      intradayDays: 1,
      adjustMode: "none",
      loading: false
    };
    shell.render(blockedViewModel(state, error));
    if (typeof options?.onError === "function") {
      try {
        options.onError(error);
      } catch {
        // Host error handlers are isolated from chart construction.
      }
    }
    const layout = layoutSnapshot(blockedViewModel(state, error));
    return Object.freeze({
      getState: () => structuredClone(state),
      getVisibleRange: () => undefined,
      getSeriesType: () => layout.seriesType,
      getPriceScaleMode: () => layout.priceScaleMode,
      getIndicators: () => [],
      getDrawings: () => [],
      getMarks: () => [],
      dataReady: () => Promise.resolve(false),
      createStudy: () => {
        throw new DOMException("Chart study API is unavailable", "InvalidStateError");
      },
      getStudyById: () => undefined,
      getStudyApi: () => undefined,
      getAllStudies: () => [],
      removeStudy: () => false,
      createEntity: () => {
        throw new DOMException("Chart entity API is unavailable", "InvalidStateError");
      },
      getEntity: () => undefined,
      getEntities: () => [],
      updateEntity: () => {
        throw new DOMException("Chart entity API is unavailable", "InvalidStateError");
      },
      removeEntity: () => false,
      exportLayout: () => structuredClone(layout),
      setSymbol: () => undefined,
      setTimeframe: () => undefined,
      setView: () => undefined,
      setIntradayDays: () => undefined,
      setAdjustMode: () => undefined,
      setSeriesType: () => undefined,
      setPriceScaleMode: () => undefined,
      setIndicators: () => undefined,
      setDrawings: () => undefined,
      setMarks: () => undefined,
      setDrawingTool: () => undefined,
      setGridVisible: () => undefined,
      undoDrawing: () => undefined,
      redoDrawing: () => undefined,
      importLayout: () => undefined,
      setExecutions: () => undefined,
      setExecutionsVisible: () => undefined,
      setVisibleRange: () => undefined,
      resetToLatest: () => undefined,
      retry: () => undefined,
      subscribe: () => () => undefined,
      subscribeEvents: () => () => undefined,
      subscribeCrosshair: () => () => undefined,
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        shell.destroy();
        shell.root.remove();
      }
    });
  }

  let controller: ChartController | undefined;
  const pendingStorageErrors: ChartError[] = [];
  const persistence = createBrowserPersistence(
    options.chartId,
    options.persistenceScopeId,
    options.dataContextId,
    localStorage,
    (error) => controller?.handleStorageError(error) ?? pendingStorageErrors.push(error)
  );
  const store = createPagedSeriesStore();
  const dataCoordinator = createDataCoordinator({
    dataSource: options.datafeed,
    dataCutoffTime: options.dataCutoffTime,
    store,
    onEvent: (event) => controller?.handleDataEvent(event)
  });
  const searchCoordinator = createSymbolSearchCoordinator({
    dataSource: options.datafeed,
    onEvent: (event) => controller?.handleSearchEvent(event)
  });
  const checkpointStore = createCalculationCheckpointStore();
  const calculationRuntime = createCheckpointedCalculationRuntime({
    store,
    checkpointStore,
    reloadPage: (cursor) => dataCoordinator.reloadPage(cursor)
  });
  const runtime = createChartEngineRuntime({
    staticCanvas: shell.staticCanvas,
    overlayCanvas: shell.overlayCanvas,
    themeRoot: shell.chartRegion,
    calculationRuntime,
    devicePixelRatio: window.devicePixelRatio,
    onViewportChanged: (viewport) => controller?.handleViewportChanged(viewport),
    onMaterializedBoundary: (direction, anchor) => controller?.handleMaterializedBoundary(direction, anchor),
    onMaterializationDemandChanged: (demand) => controller?.handleMaterializationDemandChanged(demand),
    onVisibleRangeChanged: (range) => {
      if (controller?.shouldPublishVisibleRange()) {
        emitEvent({ type: "visible-range", range });
      }
    },
    onMarkClicked: (mark) => emitEvent({ type: "mark-clicked", mark }),
    onCalculationStatusChanged: (status) => controller?.handleCalculationStatus(status),
    onDataWindowChanged: (snapshot) => shell.renderDataWindow(snapshot),
    hasCrosshairListeners: () => crosshairListeners.size > 0,
    onCrosshairChanged: (snapshot) => {
      if (controller === undefined) return;
      emitCrosshairEvent(snapshot === undefined
        ? { type: "crosshair-left" }
        : {
            type: "crosshair-moved",
            crosshair: publicCrosshairSnapshot(snapshot, controller)
          });
    },
    onExecutionTooltipChanged: (snapshot) => shell.renderExecutionTooltip(snapshot),
    onDrawingsChanged: (drawings, selectedDrawingIds) => controller?.handleDrawingsChanged(drawings, selectedDrawingIds),
    onDrawingHistoryChanged: (history) => controller?.handleDrawingHistoryChanged(history),
    onCalculationError: (kind, error) => controller?.handleRenderError(error, kind),
    onRenderError: (error) => controller?.handleRenderError(error),
    onRenderRecovered: () => controller?.handleRenderRecovered()
  });
  controller = createChartController({
    chartId: options.chartId,
    drawingPersistenceEnabled: drawingSurfaceFeatures.some((feature) => features.has(feature)),
    seriesTypePersistenceEnabled: features.has("series-type"),
    executionsEnabled: features.has("executions"),
    initialSymbol: options.initialSymbol,
    initialTimeframe: options.initialTimeframe,
    initialAdjustMode: options.initialAdjustMode,
    getCapabilities: (symbol, signal) => options.datafeed.getCapabilities(symbol, signal),
    store,
    dataCoordinator,
    searchCoordinator,
    persistence,
    runtime,
    onError: options.onError,
    onDataLoaded: (event) => {
      if (event.phase === "initial") {
        readySelectionKey = layoutSelectionKey(event.state);
      }
      emitEvent({ type: "data-loaded", ...event });
      if (event.phase === "initial") {
        emitLayoutChanged(controller!.getViewModel());
      }
    },
    onPresentationReady: (state) => {
      if (destroyed) return;
      const key = presentationKey(state);
      if (unavailablePresentationKey === key) unavailablePresentationKey = undefined;
      materializedPresentationKey = key;
      cancelReadinessFrame();
      const markReady = (): void => {
        readinessFrameId = undefined;
        if (destroyed || materializedPresentationKey !== key) return;
        const viewModel = controller!.getViewModel();
        if (
          presentationKey(viewModel.state) !== key ||
          viewModel.state.loading ||
          viewModel.status.type === "blocked"
        ) return;
        readyPresentationKey = key;
        unavailablePresentationKey = undefined;
        settleDataReady((candidate) => candidate === key, true);
      };
      if (readinessWindow === null) markReady();
      else readinessFrameId = readinessWindow.requestAnimationFrame(markReady);
    },
    onPresentationPending: (state) => {
      const key = presentationKey(state);
      if (unavailablePresentationKey === key) unavailablePresentationKey = undefined;
    },
    onPresentationUnavailable: (state) => {
      if (destroyed) return;
      const key = presentationKey(state);
      if (materializedPresentationKey === key || readyPresentationKey === key) return;
      unavailablePresentationKey = key;
      settleDataReady((candidate) => candidate === key, false);
    },
    onViewModelChanged: (viewModel, revision) => {
      latestViewModelRevision = revision;
      const currentPresentationKey = presentationKey(viewModel.state);
      if (
        materializedPresentationKey !== undefined &&
        materializedPresentationKey !== currentPresentationKey
      ) {
        materializedPresentationKey = undefined;
        cancelReadinessFrame();
      }
      if (
        readyPresentationKey !== undefined &&
        readyPresentationKey !== currentPresentationKey
      ) readyPresentationKey = undefined;
      if (
        unavailablePresentationKey !== undefined &&
        unavailablePresentationKey !== currentPresentationKey
      ) unavailablePresentationKey = undefined;
      settleDataReady((candidate) => candidate !== currentPresentationKey, false);
      if (viewModel.state.loading) {
        cancelReadinessFrame();
        if (materializedPresentationKey === currentPresentationKey) {
          materializedPresentationKey = undefined;
        }
        if (readyPresentationKey === currentPresentationKey) {
          readyPresentationKey = undefined;
        }
      }
      if (viewModel.status.type === "blocked") {
        cancelReadinessFrame();
        if (materializedPresentationKey === currentPresentationKey) {
          materializedPresentationKey = undefined;
        }
        if (readyPresentationKey === currentPresentationKey) {
          readyPresentationKey = undefined;
        }
        settleDataReady((candidate) => candidate === currentPresentationKey, false);
      }
      if (
        readySelectionKey !== undefined &&
        readySelectionKey !== layoutSelectionKey(viewModel.state)
      ) readySelectionKey = undefined;
      shell.render(viewModel);
      emitEntityChanges(viewModel);
      if (destroyed || latestViewModelRevision !== revision) return;
      emitLayoutChanged(viewModel);
      if (destroyed || latestViewModelRevision !== revision) return;
      const nextState = JSON.stringify(viewModel.state);
      if (nextState === lastNotifiedState) return;
      lastNotifiedState = nextState;
      for (const listener of [...stateListeners]) {
        try {
          listener(structuredClone(viewModel.state));
        } catch {
          // Host listeners are isolated from workspace state transitions.
        }
        if (destroyed || latestViewModelRevision !== revision) break;
      }
    }
  });
  const unbind = shell.bind(controller);
  lastNotifiedLayout = JSON.stringify(layoutSnapshot(controller.getViewModel()));
  controller.setMarks(parseMarks(options.marks ?? []));
  lastEntitySnapshot = new Map(
    entitySnapshot(controller.getViewModel(), entityScope).map((entity) => [entity.id, entity])
  );
  runtime.setExecutions(options.executions ?? []);
  shell.render(controller.getViewModel());
  for (const error of pendingStorageErrors) controller.handleStorageError(error);
  controller.start();

  const allocateStudyInstanceId = (): string => {
    const existing = new Set(controller!.getViewModel().indicators.map((indicator) => indicator.instanceId));
    let candidate: string;
    do candidate = `study-${crypto.randomUUID()}`;
    while (existing.has(candidate));
    return candidate;
  };
  const findStudy = (value: ChartIndicatorEntityId): ChartIndicator | undefined => {
    const id = parseEntityId(value);
    const entity = entitySnapshot(controller!.getViewModel(), entityScope)
      .find((candidate) => candidate.id === id && candidate.kind === "indicator");
    return entity?.kind === "indicator" ? entity.value : undefined;
  };
  const requireStudy = (value: ChartIndicatorEntityId): ChartIndicator => {
    if (destroyed) {
      throw new DOMException("Chart study API is unavailable", "InvalidStateError");
    }
    const study = findStudy(value);
    if (study === undefined) {
      throw new DOMException("Chart study was not found", "NotFoundError");
    }
    return study;
  };
  const updateStudy = (
    value: ChartIndicatorEntityId,
    update: (study: Readonly<ChartIndicator>) => ChartIndicator
  ): void => {
    const current = requireStudy(value);
    const next = update(current);
    const viewModel = controller!.getViewModel();
    controller!.setIndicators(parseIndicators(viewModel.indicators.map((candidate) =>
      candidate.instanceId === current.instanceId ? next : candidate
    )));
  };
  const removeStudy = (value: ChartIndicatorEntityId): boolean => {
    if (destroyed) return false;
    const current = findStudy(value);
    if (current === undefined) return false;
    const viewModel = controller!.getViewModel();
    controller!.setIndicators(parseIndicators(
      viewModel.indicators.filter(
        (candidate) => candidate.instanceId !== current.instanceId
      )
    ));
    return true;
  };
  const studyApi = (value: ChartIndicatorEntityId): ChartStudyApi | undefined => {
    if (destroyed || findStudy(value) === undefined) return undefined;
    return Object.freeze({
      entityId: value,
      getInputs: () => structuredClone(requireStudy(value).params),
      setInputs: (inputs: Readonly<Record<string, number>>) => {
        updateStudy(value, (current) => mergeIndicatorInputs(current, inputs));
      },
      isVisible: () => requireStudy(value).visible,
      setVisible: (visible: boolean) => {
        if (typeof visible !== "boolean") {
          throw new TypeError("Chart study visibility must be boolean");
        }
        updateStudy(value, (current) => ({ ...current, visible }));
      },
      remove: () => removeStudy(value)
    });
  };

  return Object.freeze({
    getState: () => controller!.getState(),
    getVisibleRange: () => controller!.getVisibleRange(),
    getSeriesType: () => controller!.getViewModel().seriesType,
    getPriceScaleMode: () => controller!.getViewModel().priceScaleMode,
    getIndicators: () => structuredClone(controller!.getViewModel().indicators),
    getDrawings: () => fromEngineDrawings(controller!.getViewModel().drawings),
    getMarks: () => structuredClone(controller!.getViewModel().marks),
    dataReady: () => {
      if (destroyed) return Promise.resolve(false);
      const viewModel = controller!.getViewModel();
      const key = presentationKey(viewModel.state);
      if (viewModel.status.type === "blocked") {
        return Promise.resolve(false);
      }
      if (unavailablePresentationKey === key) return Promise.resolve(false);
      if (readyPresentationKey === key) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        dataReadyWaiters.add({ key, resolve });
      });
    },
    createStudy: (value: ChartIndicatorInput) => {
      if (destroyed) {
        throw new DOMException("Chart study API is unavailable", "InvalidStateError");
      }
      const input = parseIndicatorInput(value);
      const viewModel = controller!.getViewModel();
      const indicator = parseIndicators([{
        ...input,
        instanceId: input.instanceId ?? allocateStudyInstanceId()
      }])[0]!;
      const entity = { kind: "indicator" as const, value: indicator };
      const id = toEntityId(entity, viewModel.state, entityScope) as ChartIndicatorEntityId;
      if (entitySnapshot(viewModel, entityScope).some((candidate) => candidate.id === id)) {
        throw new DOMException("Chart study already exists", "InvalidStateError");
      }
      controller!.setIndicators(parseIndicators([...viewModel.indicators, indicator]));
      return id;
    },
    getStudyById: (value: ChartIndicatorEntityId) => {
      const study = findStudy(value);
      return study === undefined ? undefined : structuredClone(study);
    },
    getStudyApi: (value: ChartIndicatorEntityId) => studyApi(value),
    getAllStudies: () => structuredClone(controller!.getViewModel().indicators),
    removeStudy: (value: ChartIndicatorEntityId) => removeStudy(value),
    createEntity: (value: ChartEntityInput) => {
      if (destroyed) {
        throw new DOMException("Chart entity API is unavailable", "InvalidStateError");
      }
      const entity = parseEntityInput(value);
      const viewModel = controller!.getViewModel();
      const id = toEntityId(entity, viewModel.state, entityScope);
      if (entitySnapshot(viewModel, entityScope).some((candidate) => candidate.id === id)) {
        throw new DOMException("Chart entity already exists", "InvalidStateError");
      }
      if (entity.kind === "indicator") {
        controller!.setIndicators(parseIndicators([...viewModel.indicators, entity.value]));
      } else if (entity.kind === "drawing") {
        requireReadyLayout(viewModel, readySelectionKey);
        controller!.setDrawings(toEngineDrawings(
          parseDrawings([...fromEngineDrawings(viewModel.drawings), entity.value])
        ));
      } else {
        controller!.setMarks(parseMarks([...viewModel.marks, entity.value]));
      }
      return id;
    },
    getEntity: (value: ChartEntityId) => {
      const id = parseEntityId(value);
      const entity = entitySnapshot(controller!.getViewModel(), entityScope)
        .find((candidate) => candidate.id === id);
      return entity === undefined ? undefined : structuredClone(entity);
    },
    getEntities: (kind?: ChartEntityKind) => {
      const parsedKind = kind === undefined ? undefined : parseEntityKind(kind);
      const entities = entitySnapshot(controller!.getViewModel(), entityScope);
      return structuredClone(
        parsedKind === undefined
          ? entities
          : entities.filter((entity) => entity.kind === parsedKind)
      );
    },
    updateEntity: (value: ChartEntity) => {
      if (destroyed) {
        throw new DOMException("Chart entity API is unavailable", "InvalidStateError");
      }
      const entity = parseEntity(value);
      const viewModel = controller!.getViewModel();
      const current = entitySnapshot(viewModel, entityScope)
        .find((candidate) => candidate.id === entity.id);
      if (current === undefined) {
        throw new DOMException("Chart entity was not found", "NotFoundError");
      }
      if (
        current.kind !== entity.kind ||
        entity.id !== toEntityId(entity, viewModel.state, entityScope)
      ) {
        throw new TypeError("Chart entity id does not match its kind, value, or current chart selection");
      }
      if (entity.kind === "indicator") {
        controller!.setIndicators(parseIndicators(viewModel.indicators.map((candidate) =>
          candidate.instanceId === entity.value.instanceId ? entity.value : candidate
        )));
      } else if (entity.kind === "drawing") {
        requireReadyLayout(viewModel, readySelectionKey);
        controller!.setDrawings(toEngineDrawings(parseDrawings(
          fromEngineDrawings(viewModel.drawings).map((candidate) =>
            candidate.id === current.value.id ? entity.value : candidate
          )
        )));
      } else {
        controller!.setMarks(parseMarks(viewModel.marks.map((candidate) =>
          candidate.id === current.value.id ? entity.value : candidate
        )));
      }
    },
    removeEntity: (value: ChartEntityId) => {
      if (destroyed) return false;
      const id = parseEntityId(value);
      const viewModel = controller!.getViewModel();
      const current = entitySnapshot(viewModel, entityScope)
        .find((candidate) => candidate.id === id);
      if (current === undefined) return false;
      if (current.kind === "indicator") {
        controller!.setIndicators(parseIndicators(
          viewModel.indicators.filter(
            (candidate) => candidate.instanceId !== current.value.instanceId
          )
        ));
      } else if (current.kind === "drawing") {
        requireReadyLayout(viewModel, readySelectionKey);
        controller!.setDrawings(toEngineDrawings(parseDrawings(
          fromEngineDrawings(viewModel.drawings)
            .filter((candidate) => candidate.id !== current.value.id)
        )));
      } else {
        controller!.setMarks(parseMarks(
          viewModel.marks.filter((candidate) => candidate.id !== current.value.id)
        ));
      }
      return true;
    },
    exportLayout: () => {
      const viewModel = controller!.getViewModel();
      requireReadyLayout(viewModel, readySelectionKey);
      return layoutSnapshot(viewModel);
    },
    setSymbol: (symbol: ChartSymbol) => {
      if (!validSymbol(symbol)) throw new TypeError("Chart symbol is invalid");
      controller!.setSymbol(structuredClone(symbol));
    },
    setTimeframe: (timeframe: Timeframe) => controller!.setTimeframe(timeframe),
    setView: (view: ChartView) => {
      if (view !== "intraday" && view !== "timeframe") {
        throw new TypeError("Chart view must be intraday or timeframe");
      }
      controller!.setView(view);
    },
    setIntradayDays: (days: IntradayDayCount) => {
      if (!Number.isInteger(days) || days < 1 || days > 9) {
        throw new RangeError("Intraday days must be an integer from 1 to 9");
      }
      controller!.setIntradayDays(days);
    },
    setAdjustMode: (adjustMode: AdjustMode) => controller!.setAdjustMode(adjustMode),
    setSeriesType: (type: ChartSeriesType) => {
      const parsed = parseSeriesType(type);
      if (controller!.getState().view === "intraday" && parsed !== "line") {
        throw new RangeError("Intraday view has a fixed line series type");
      }
      controller!.setSeriesType(parsed);
    },
    setPriceScaleMode: (mode: ChartPriceScaleMode) =>
      controller!.setPriceScaleMode(parsePriceScaleMode(mode)),
    setIndicators: (indicators: readonly ChartIndicator[]) =>
      controller!.setIndicators(parseIndicators(indicators)),
    setDrawings: (drawings: readonly ChartDrawing[]) => {
      const parsed = parseDrawings(drawings);
      requireReadyLayout(controller!.getViewModel(), readySelectionKey);
      controller!.setDrawings(toEngineDrawings(parsed));
    },
    setMarks: (marks: readonly ChartMark[]) => controller!.setMarks(parseMarks(marks)),
    setDrawingTool: (tool: ChartDrawingTool) => controller!.setDrawingTool(parseDrawingTool(tool)),
    setGridVisible: (visible: boolean) => {
      if (typeof visible !== "boolean") throw new TypeError("Grid visibility must be boolean");
      controller!.setGridVisible(visible);
    },
    undoDrawing: () => controller!.undoDrawing(),
    redoDrawing: () => controller!.redoDrawing(),
    importLayout: (value: unknown) => {
      const layout = parseLayout(value);
      requireReadyLayout(controller!.getViewModel(), readySelectionKey);
      if (controller!.getState().view === "intraday" && layout.seriesType !== "line") {
        throw new RangeError("Intraday view accepts only line-series layouts");
      }
      applyingLayout = true;
      try {
        controller!.setSeriesType(layout.seriesType);
        controller!.setPriceScaleMode(layout.priceScaleMode);
        controller!.setIndicators(layout.indicators);
        controller!.setDrawings(toEngineDrawings(layout.drawings));
        controller!.setGridVisible(layout.gridVisible);
      } finally {
        applyingLayout = false;
      }
      emitEntityChanges(controller!.getViewModel());
      const applied = layoutSnapshot(controller!.getViewModel());
      const nextLayout = JSON.stringify(applied);
      if (nextLayout !== lastNotifiedLayout) {
        lastNotifiedLayout = nextLayout;
        if (readySelectionKey === layoutSelectionKey(controller!.getState())) {
          emitEvent({ type: "layout-changed", layout: applied });
        }
      }
    },
    setExecutions: (executions: readonly ChartExecution[]) => {
      if (!validExecutions(executions)) throw new TypeError("Chart executions are invalid");
      runtime.setExecutions(executions);
    },
    setExecutionsVisible: (visible: boolean) => {
      if (typeof visible !== "boolean") throw new TypeError("Execution visibility must be boolean");
      controller!.setExecutionsVisible(visible);
    },
    setVisibleRange: (range: ChartVisibleRange) => {
      controller!.setVisibleRange(parseVisibleRange(range));
    },
    resetToLatest: () => controller!.resetToLatest(),
    retry: () => controller!.retry(),
    subscribe: (listener: ChartStateListener) => {
      if (typeof listener !== "function") throw new TypeError("Chart listener must be a function");
      if (destroyed) return () => undefined;
      stateListeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        stateListeners.delete(listener);
      };
    },
    subscribeEvents: (listener: ChartEventListener) => {
      if (typeof listener !== "function") throw new TypeError("Chart event listener must be a function");
      if (destroyed) return () => undefined;
      eventListeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        eventListeners.delete(listener);
      };
    },
    subscribeCrosshair: (listener: ChartCrosshairListener) => {
      if (typeof listener !== "function") throw new TypeError("Chart crosshair listener must be a function");
      if (destroyed) return () => undefined;
      crosshairListeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        crosshairListeners.delete(listener);
      };
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      controller!.deactivate();
      unbind();
      controller!.destroy();
      stateListeners.clear();
      eventListeners.clear();
      crosshairListeners.clear();
      settleDataReady(() => true, false);
      cancelReadinessFrame();
      materializedPresentationKey = undefined;
      readyPresentationKey = undefined;
      unavailablePresentationKey = undefined;
      lastEntitySnapshot = undefined;
      checkpointStore.clear();
      shell.destroy();
      shell.root.remove();
    }
  });
}
