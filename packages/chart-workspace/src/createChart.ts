import type {
  AdjustMode,
  ChartActionId,
  ChartCrosshairEvent,
  ChartCrosshairListener,
  ChartCrosshairSnapshot,
  ChartComparison,
  ChartCustomStudyId,
  ChartEvent,
  ChartEventListener,
  ChartDrawing,
  ChartDrawingGroup,
  ChartDrawingGroupId,
  ChartDrawingGroupMove,
  ChartDrawingGroupsApi,
  ChartDrawingTool,
  ChartDisplayMode,
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
  ChartLayoutV3,
  ChartLocale,
  ChartMark,
  ChartOptions,
  ChartPane,
  ChartPaneApi,
  ChartPaneId,
  ChartPaneLayout,
  ChartPriceRange,
  ChartPriceScaleApi,
  ChartPriceScaleMode,
  ChartReplaySpeed,
  ChartConfigurableSeriesType,
  ChartSeriesProperties,
  ChartSeriesType,
  ChartSeriesVisualOverrides,
  ChartSelectableEntityId,
  ChartState,
  ChartStateListener,
  ChartStudyApi,
  ChartStudyOutputVisualOverride,
  ChartSymbol,
  ChartTheme,
  ChartThemeOverrides,
  ChartTimeScaleApi,
  ChartView,
  ChartVisibleRange,
  IntradayDayCount,
  Timeframe
} from "./contracts";
import { defaultChartFeatures } from "./contracts";
import { createChartController, type ChartController, type WorkspaceViewModel } from "./controller/chartController";
import { createCalculationCheckpointStore } from "./data/calculationCheckpointStore";
import { parseChartSymbol } from "./data/chartSymbol";
import { createComparisonCoordinator } from "./data/comparisonCoordinator";
import { parseComparisons } from "./data/comparisons";
import { createDataCoordinator } from "./data/dataCoordinator";
import { createPagedSeriesStore } from "./data/pagedSeriesStore";
import { createSymbolSearchCoordinator } from "./data/symbolSearchCoordinator";
import { createChartError, type ChartError } from "./errors";
import { createBrowserPersistence, defaultLayoutState, defaultPreferences } from "./persistence/browserPersistence";
import {
  fromEngineDrawings,
  mergeIndicatorInputs,
  parseChartActionId,
  parseEntity,
  parseEntityId,
  parseEntityInput,
  parseEntityKind,
  parseIndicatorInput,
  parseDrawingTool,
  parseDrawings,
  parseDrawingGroupName,
  parseIndicators,
  parseLayout,
  parseMarks,
  parsePaneHeightRatio,
  parsePaneId,
  parsePanePriceRange,
  parsePriceScaleMode,
  parseSeriesProperties,
  parseSeriesVisualOverrides,
  parseSeriesType,
  parseStudyDefinitions,
  parseThemeOverrides,
  parseTimeScaleBars,
  parseTimeScaleCoordinate,
  parseTimeScaleSpacing,
  parseVisibleRange,
  resolveSeriesProperties,
  resolveSeriesVisualOverrides,
  studyDefinitionKey,
  paneIdForIndicator,
  toLayoutV3,
  toEntityId,
  toEngineDrawings,
  type StudyDefinitionCatalog
} from "./programmableApi";
import {
  createChartEngineRuntime,
  type RuntimeCrosshairSnapshot
} from "./runtime/chartEngineRuntime";
import { createCheckpointedCalculationRuntime } from "./runtime/checkpointedCalculationRuntime";
import { applyWorkspaceThemeOverrides } from "./runtime/workspaceTheme";
import { createWorkspaceShell } from "./ui/workspaceShell";

const validFeatures = new Set<ChartFeature>([
  "symbol-search",
  "symbol-compare",
  "timeframes",
  "adjustment",
  "series-type",
  "price-scale",
  "indicators",
  "drawing-tools",
  "drawing-history",
  "settings",
  "bottom-panel",
  "data-table",
  "replay",
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

function parseDisplayMode(value: unknown): ChartDisplayMode {
  if (value !== "chart" && value !== "table") {
    throw new TypeError("Chart display mode must be chart or table");
  }
  return value;
}

function validExecutionTime(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    Number.isFinite(new Date(value).getTime());
}

const replaySpeeds = new Set<ChartReplaySpeed>([1, 2, 4, 8]);

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

function validSeriesProperties(properties: unknown): boolean {
  try {
    parseSeriesProperties(properties);
    return true;
  } catch {
    return false;
  }
}

function validSeriesVisualOverrides(overrides: unknown): boolean {
  try {
    parseSeriesVisualOverrides(overrides);
    return true;
  } catch {
    return false;
  }
}

function validSymbol(symbol: unknown): symbol is ChartSymbol {
  return parseChartSymbol(symbol) !== undefined;
}

function validComparisons(value: unknown, mainSymbol: Readonly<ChartSymbol>): boolean {
  try {
    parseComparisons(value, mainSymbol);
    return true;
  } catch {
    return false;
  }
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
    (options.comparisons === undefined || validComparisons(options.comparisons, symbol)) &&
    (options.marks === undefined || validMarks(options.marks)) &&
    validSeriesProperties(options.seriesProperties) &&
    validSeriesVisualOverrides(options.seriesVisualOverrides) &&
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
    seriesProperties: [],
    seriesVisualOverrides: [],
    favoriteTimeframes: defaultPreferences.favoriteTimeframes,
    priceScaleMode: defaultPreferences.priceScaleMode,
    indicators: [],
    drawings: [],
    drawingGroups: [],
    marks: [],
    comparisons: [],
    comparisonStatuses: [],
    selectedDrawingIds: [],
    bottomPanel: defaultLayoutState.bottomPanel,
    drawingPalette: defaultLayoutState.drawingPalette,
    canUndoDrawing: false,
    canRedoDrawing: false,
    gridVisible: true,
    executionsVisible: false,
    replay: { status: "inactive", speed: 1 },
    calculationStatus: { type: "idle" },
    search: { query: "", loading: false, results: [] }
  };
}

function layoutSnapshot(
  viewModel: Readonly<WorkspaceViewModel>,
  studyDefinitions: StudyDefinitionCatalog,
  panes?: readonly ChartPaneLayout[]
): ChartLayoutV3 {
  const layout = toLayoutV3({
    schemaVersion: 2,
    seriesType: viewModel.seriesType,
    ...(viewModel.seriesProperties.length === 0
      ? {}
      : { seriesProperties: structuredClone(viewModel.seriesProperties) }),
    priceScaleMode: viewModel.priceScaleMode,
    indicators: structuredClone(viewModel.indicators),
    drawings: fromEngineDrawings(viewModel.drawings),
    gridVisible: viewModel.gridVisible
  }, studyDefinitions);
  const configured = viewModel.seriesVisualOverrides.length === 0
    ? layout
    : {
        ...layout,
        seriesVisualOverrides: structuredClone(viewModel.seriesVisualOverrides)
      };
  const grouped = viewModel.drawingGroups.length === 0
    ? configured
    : {
        ...configured,
        drawingGroups: structuredClone(viewModel.drawingGroups)
      };
  return panes === undefined
    ? grouped
    : { ...grouped, panes: structuredClone(panes) };
}

function symbolKey(symbol: Readonly<ChartSymbol>) {
  return [
    symbol.id,
    symbol.code,
    symbol.name,
    symbol.exchange,
    symbol.kind,
    symbol.pricePrecision ?? null
  ] as const;
}

function layoutSelectionKey(state: Readonly<ChartState>): string {
  return JSON.stringify([...symbolKey(state.symbol), state.timeframe, state.adjustMode]);
}

function presentationKey(state: Readonly<ChartState>): string {
  return JSON.stringify([
    ...symbolKey(state.symbol),
    state.timeframe,
    state.adjustMode,
    state.view,
    state.view === "intraday" ? state.intradayDays : null
  ]);
}

function presentationReadinessKey(viewModel: Readonly<WorkspaceViewModel>): string {
  return JSON.stringify([
    presentationKey(viewModel.state),
    viewModel.replay.status === "inactive" ? null : viewModel.replay.cursorTime,
    viewModel.comparisons.map((comparison) => [
      ...symbolKey(comparison.symbol),
      comparison.color ?? null,
      comparison.visible ?? true
    ])
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

  let parsedStudyDefinitions: StudyDefinitionCatalog | undefined;
  let parsedThemeOverrides: ChartThemeOverrides | undefined;
  try {
    parsedStudyDefinitions = parseStudyDefinitions(options?.studyDefinitions);
    parsedThemeOverrides = parseThemeOverrides(options?.themeOverrides);
  } catch {
    parsedStudyDefinitions = undefined;
    parsedThemeOverrides = undefined;
  }
  const studyDefinitions = parsedStudyDefinitions ?? new Map();
  let theme = resolvedTheme(options?.theme);
  let themeOverrides = parsedThemeOverrides ?? {};
  const parseChartIndicators = (value: unknown) => parseIndicators(value, studyDefinitions);
  const parseChartIndicatorInput = (value: unknown) =>
    parseIndicatorInput(value, studyDefinitions);
  const mergeChartIndicatorInputs = (
    current: Readonly<ChartIndicator>,
    value: unknown
  ) => mergeIndicatorInputs(current, value, studyDefinitions);
  const parseChartSeriesVisualOverrides = (value: unknown) =>
    parseSeriesVisualOverrides(value);
  const parseChartEntityInput = (value: unknown) =>
    parseEntityInput(value, studyDefinitions);
  const parseChartEntity = (value: unknown) => parseEntity(value, studyDefinitions);
  const parseChartLayout = (value: unknown) =>
    toLayoutV3(parseLayout(value, studyDefinitions), studyDefinitions);
  const studyTitleFor = (config: Readonly<ChartIndicator>): string =>
    config.definitionVersion === undefined
      ? config.id
      : studyDefinitions.get(studyDefinitionKey(
          config.id as ChartCustomStudyId,
          config.definitionVersion
        ))?.title ??
        config.id;
  const features = resolvedFeatures(options?.features);
  const shell = createWorkspaceShell({
    features,
    theme,
    locale: resolvedLocale(options?.locale),
    studyTitleFor
  });
  applyWorkspaceThemeOverrides(shell.root, themeOverrides);
  container.append(shell.root);
  let destroyed = false;
  let displayMode: ChartDisplayMode = "chart";
  const stateListeners = new Set<ChartStateListener>();
  const eventListeners = new Set<ChartEventListener>();
  const crosshairListeners = new Set<ChartCrosshairListener>();
  let lastNotifiedState = "";
  let lastNotifiedReplay = JSON.stringify({ status: "inactive", speed: 1 });
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
      comparisons: snapshot.comparisons.map((comparison) => ({
        symbolId: comparison.symbolId,
        code: comparison.code,
        name: comparison.name,
        ...(comparison.color === undefined ? {} : { color: comparison.color }),
        value: comparison.value,
        changePercent: comparison.changePercent,
        ...(comparison.dataVersion === undefined
          ? {}
          : { dataVersion: comparison.dataVersion }),
        ...(comparison.pricePrecision === undefined
          ? {}
          : { pricePrecision: comparison.pricePrecision })
      })),
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
    const layout = layoutSnapshot(viewModel, studyDefinitions, runtime.getPaneLayouts());
    const nextLayout = JSON.stringify(layout);
    if (nextLayout === lastNotifiedLayout) return;
    lastNotifiedLayout = nextLayout;
    emitEvent({ type: "layout-changed", layout });
  };

  if (
    !validOptions(options) ||
    parsedStudyDefinitions === undefined ||
    parsedThemeOverrides === undefined
  ) {
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
    const layout = layoutSnapshot(blockedViewModel(state, error), studyDefinitions);
    const timeScale = Object.freeze<ChartTimeScaleApi>({
      getVisibleRange: () => undefined,
      setVisibleRange: (range) => {
        parseVisibleRange(range);
      },
      timeToCoordinate: (time) => {
        parseTimeScaleCoordinate(time, "Chart time scale time");
        return undefined;
      },
      coordinateToTime: (coordinate) => {
        parseTimeScaleCoordinate(coordinate, "Chart time scale coordinate");
        return undefined;
      },
      getBarSpacing: () => 0,
      setBarSpacing: (spacing) => {
        parseTimeScaleSpacing(spacing);
      },
      getWidth: () => 0,
      scrollByBars: (bars) => {
        parseTimeScaleBars(bars);
      },
      zoomIn: () => undefined,
      zoomOut: () => undefined,
      fitContent: () => undefined,
      reset: () => undefined
    });
    const drawingGroups = Object.freeze<ChartDrawingGroupsApi>({
      getAll: () => [],
      create: () => {
        throw new DOMException("Chart drawing groups API is unavailable", "InvalidStateError");
      },
      setName: () => {
        throw new DOMException("Chart drawing groups API is unavailable", "InvalidStateError");
      },
      setMembers: () => {
        throw new DOMException("Chart drawing groups API is unavailable", "InvalidStateError");
      },
      setVisible: () => {
        throw new DOMException("Chart drawing groups API is unavailable", "InvalidStateError");
      },
      setLocked: () => {
        throw new DOMException("Chart drawing groups API is unavailable", "InvalidStateError");
      },
      move: () => {
        throw new DOMException("Chart drawing groups API is unavailable", "InvalidStateError");
      },
      ungroup: () => {
        throw new DOMException("Chart drawing groups API is unavailable", "InvalidStateError");
      },
      deleteDrawings: () => {
        throw new DOMException("Chart drawing groups API is unavailable", "InvalidStateError");
      }
    });
    return Object.freeze({
      getState: () => structuredClone(state),
      getDisplayMode: () => displayMode,
      getTheme: () => theme,
      getThemeOverrides: () => structuredClone(themeOverrides),
      getVisibleRange: () => undefined,
      getTimeScale: () => timeScale,
      getSeriesType: () => layout.seriesType,
      getSeriesProperties: <T extends ChartConfigurableSeriesType>(type: T) =>
        resolveSeriesProperties(type, []),
      getSeriesVisualOverrides: <T extends ChartSeriesType>(type: T) =>
        resolveSeriesVisualOverrides(type, layout.seriesVisualOverrides),
      getPriceScaleMode: () => layout.priceScaleMode,
      getPanes: () => [],
      getPaneById: () => undefined,
      getPaneApi: () => undefined,
      getIndicators: () => [],
      getDrawings: () => [],
      getMarks: () => [],
      getComparisons: () => [],
      getReplayState: () => ({ status: "inactive" as const, speed: 1 as const }),
      dataReady: () => Promise.resolve(false),
      createStudy: () => {
        throw new DOMException("Chart study API is unavailable", "InvalidStateError");
      },
      getStudyById: () => undefined,
      getStudyApi: () => undefined,
      getAllStudies: () => [],
      getDrawingGroupsApi: () => drawingGroups,
      removeStudy: () => false,
      createEntity: () => {
        throw new DOMException("Chart entity API is unavailable", "InvalidStateError");
      },
      getEntity: () => undefined,
      getEntities: () => [],
      getSelection: () => [],
      setSelection: () => {
        throw new DOMException("Chart selection API is unavailable", "InvalidStateError");
      },
      clearSelection: () => undefined,
      updateEntity: () => {
        throw new DOMException("Chart entity API is unavailable", "InvalidStateError");
      },
      removeEntity: () => false,
      exportLayout: () => structuredClone(layout),
      setTheme: () => undefined,
      setDisplayMode: (value: ChartDisplayMode) => {
        const next = parseDisplayMode(value);
        if (destroyed || next === displayMode) return;
        displayMode = next;
        shell.setDisplayMode(next);
      },
      setThemeOverrides: () => undefined,
      setSymbol: () => undefined,
      setTimeframe: () => undefined,
      setView: () => undefined,
      setIntradayDays: () => undefined,
      setAdjustMode: () => undefined,
      setSeriesType: () => undefined,
      setSeriesProperties: () => undefined,
      setSeriesVisualOverrides: (value: ChartSeriesVisualOverrides) => {
        parseChartSeriesVisualOverrides([value]);
      },
      setPriceScaleMode: () => undefined,
      setIndicators: () => undefined,
      setDrawings: () => undefined,
      setMarks: () => undefined,
      setComparisons: () => undefined,
      setDrawingTool: () => undefined,
      setGridVisible: () => undefined,
      undoDrawing: () => undefined,
      redoDrawing: () => undefined,
      importLayout: () => undefined,
      setExecutions: () => undefined,
      setExecutionsVisible: () => undefined,
      setVisibleRange: () => undefined,
      executeActionById: (actionId: ChartActionId) => {
        parseChartActionId(actionId);
      },
      startReplay: () => false,
      stepReplay: () => false,
      playReplay: () => undefined,
      pauseReplay: () => undefined,
      setReplaySpeed: () => undefined,
      stopReplay: () => undefined,
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
  let selectedStudyId: ChartIndicatorEntityId | undefined;
  let lastSelectionKey = "[]";
  const selectionSnapshot = (
    viewModel: Readonly<WorkspaceViewModel>
  ): readonly ChartSelectableEntityId[] => {
    const entities = entitySnapshot(viewModel, entityScope);
    if (selectedStudyId !== undefined) {
      const study = entities.find(
        (entity) => entity.id === selectedStudyId && entity.kind === "indicator"
      );
      if (study) return [selectedStudyId];
      selectedStudyId = undefined;
    }
    const drawings = new Map(
      entities
        .filter((entity): entity is Extract<ChartEntity, { kind: "drawing" }> =>
          entity.kind === "drawing"
        )
        .map((entity) => [entity.value.id, entity.id as ChartSelectableEntityId])
    );
    return viewModel.selectedDrawingIds.flatMap((id) => {
      const entityId = drawings.get(id);
      return entityId === undefined ? [] : [entityId];
    });
  };
  const emitSelectionChanged = (viewModel: Readonly<WorkspaceViewModel>): void => {
    if (applyingLayout) return;
    const selection = selectionSnapshot(viewModel);
    const key = JSON.stringify(selection);
    if (key === lastSelectionKey) return;
    lastSelectionKey = key;
    emitEvent({ type: "selection-changed", selection });
  };
  const schedulePresentationReadiness = (
    materializedKey: string,
    readinessKey: string
  ): void => {
    cancelReadinessFrame();
    const markReady = (): void => {
      readinessFrameId = undefined;
      if (destroyed || materializedPresentationKey !== materializedKey) return;
      const viewModel = controller!.getViewModel();
      if (
        presentationKey(viewModel.state) !== materializedKey ||
        presentationReadinessKey(viewModel) !== readinessKey ||
        viewModel.state.loading ||
        viewModel.status.type === "blocked" ||
        viewModel.calculationStatus.type !== "idle"
      ) return;
      readyPresentationKey = readinessKey;
      unavailablePresentationKey = undefined;
      settleDataReady((candidate) => candidate === readinessKey, true);
    };
    if (readinessWindow === null) markReady();
    else readinessFrameId = readinessWindow.requestAnimationFrame(markReady);
  };
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
  const initialComparisons = parseComparisons(
    options.comparisons ?? [],
    options.initialSymbol
  );
  const comparisonCoordinator = createComparisonCoordinator({
    datafeed: options.datafeed,
    dataCutoffTime: options.dataCutoffTime,
    onChange: (snapshots) => controller?.handleComparisonData(snapshots)
  });
  let comparisonContextKey: string | undefined;
  let comparisonContextGeneration = 0;
  let comparisonRequestedRangeKey: string | undefined;
  let comparisonPreparationGeneration = 0;
  let comparisonContextTask = Promise.resolve(true);
  let comparisonRangeTask = Promise.resolve(true);
  const comparisonKey = (viewModel: Readonly<WorkspaceViewModel>): string =>
    JSON.stringify([
      ...symbolKey(viewModel.state.symbol),
      viewModel.state.timeframe,
      viewModel.state.adjustMode,
      viewModel.state.view === "intraday",
      viewModel.comparisons.map((comparison) => [
        ...symbolKey(comparison.symbol),
        comparison.color ?? null,
        comparison.visible ?? true
      ])
    ]);
  const syncComparisonContext = (
    viewModel: Readonly<WorkspaceViewModel>
  ): Promise<boolean> => {
    const key = comparisonKey(viewModel);
    if (key === comparisonContextKey) return comparisonContextTask;
    comparisonContextKey = key;
    comparisonRequestedRangeKey = undefined;
    const generation = ++comparisonContextGeneration;
    const context = {
      comparisons: viewModel.comparisons,
      mainSymbol: viewModel.state.symbol,
      timeframe: viewModel.state.timeframe,
      adjustMode: viewModel.state.adjustMode,
      intraday: viewModel.state.view === "intraday"
    } as const;
    comparisonContextTask = Promise.resolve()
      .then(() => comparisonCoordinator.setContext(context))
      .then((ready) =>
      !destroyed &&
      generation === comparisonContextGeneration &&
      comparisonContextKey === key &&
      ready
      )
      .catch(() => false);
    comparisonRangeTask = comparisonContextTask;
    return comparisonContextTask;
  };
  const ensureComparisonRange = (
    viewModel: Readonly<WorkspaceViewModel>,
    range: Readonly<ChartVisibleRange> | undefined
  ): Promise<boolean> => {
    const key = comparisonKey(viewModel);
    const generation = comparisonContextGeneration + (
      key === comparisonContextKey ? 0 : 1
    );
    const context = syncComparisonContext(viewModel);
    if (
      range === undefined ||
      viewModel.comparisons.every((comparison) => comparison.visible === false)
    ) return context;
    const rangeKey = JSON.stringify([range.from, range.to]);
    if (comparisonRequestedRangeKey === rangeKey) return comparisonRangeTask;
    comparisonRequestedRangeKey = rangeKey;
    comparisonRangeTask = context.then(async (ready) => {
      if (
        !ready ||
        destroyed ||
        generation !== comparisonContextGeneration ||
        comparisonContextKey !== key
      ) return false;
      const loaded = await comparisonCoordinator.ensureTimeRange(range);
      return (
        loaded &&
        !destroyed &&
        generation === comparisonContextGeneration &&
        comparisonContextKey === key
      );
    }).then((ready) => {
      if (
        !ready &&
        generation === comparisonContextGeneration &&
        comparisonContextKey === key &&
        comparisonRequestedRangeKey === rangeKey
      ) {
        comparisonRequestedRangeKey = undefined;
      }
      return ready;
    }).catch(() => {
      if (
        generation === comparisonContextGeneration &&
        comparisonContextKey === key &&
        comparisonRequestedRangeKey === rangeKey
      ) {
        comparisonRequestedRangeKey = undefined;
      }
      return false;
    });
    return comparisonRangeTask;
  };
  const preparePresentationReadiness = (
    viewModel: Readonly<WorkspaceViewModel>,
    range = controller?.getVisibleRange()
  ): void => {
    const materializedKey = presentationKey(viewModel.state);
    const readinessKey = presentationReadinessKey(viewModel);
    const preparation = ++comparisonPreparationGeneration;
    if (
      range !== undefined &&
      viewModel.comparisons.some((comparison) => comparison.visible !== false) &&
      readyPresentationKey === readinessKey
    ) {
      readyPresentationKey = undefined;
      cancelReadinessFrame();
    }
    void ensureComparisonRange(
      viewModel,
      range
    ).then((ready) => {
      if (
        destroyed ||
        controller === undefined ||
        preparation !== comparisonPreparationGeneration
      ) return;
      const current = controller.getViewModel();
      if (
        presentationKey(current.state) !== materializedKey ||
        presentationReadinessKey(current) !== readinessKey
      ) return;
      if (!ready) {
        unavailablePresentationKey = readinessKey;
        settleDataReady((candidate) => candidate === readinessKey, false);
        return;
      }
      if (unavailablePresentationKey === readinessKey) {
        unavailablePresentationKey = undefined;
      }
      if (materializedPresentationKey === materializedKey) {
        schedulePresentationReadiness(materializedKey, readinessKey);
      }
    });
  };
  const searchCoordinator = createSymbolSearchCoordinator({
    dataSource: options.datafeed,
    onEvent: (event) => controller?.handleSearchEvent(event)
  });
  const checkpointStore = createCalculationCheckpointStore();
  const calculationRuntime = createCheckpointedCalculationRuntime({
    store,
    checkpointStore,
    studyDefinitions,
    reloadPage: (cursor) => dataCoordinator.reloadPage(cursor)
  });
  let activePricePrecision = options.initialSymbol.pricePrecision;
  let renderCurrentDataTable = (): void => undefined;
  const runtime = createChartEngineRuntime({
    staticCanvas: shell.staticCanvas,
    overlayCanvas: shell.overlayCanvas,
    themeRoot: shell.chartRegion,
    calculationRuntime,
    ...(activePricePrecision === undefined ? {} : { pricePrecision: activePricePrecision }),
    studyTitleFor,
    paneIdFor: (config) => paneIdForIndicator(config, studyDefinitions),
    devicePixelRatio: window.devicePixelRatio,
    onViewportChanged: (viewport) => controller?.handleViewportChanged(viewport),
    onMaterializedBoundary: (direction, anchor) => controller?.handleMaterializedBoundary(direction, anchor),
    onMaterializationDemandChanged: (demand) => controller?.handleMaterializationDemandChanged(demand),
    onVisibleRangeChanged: (range) => {
      if (controller !== undefined) {
        preparePresentationReadiness(controller.getViewModel(), range);
      }
      if (controller?.shouldPublishVisibleRange()) {
        emitEvent({ type: "visible-range", range });
      }
    },
    onPaneLayoutChanged: () => {
      if (controller !== undefined) emitLayoutChanged(controller.getViewModel());
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
    onExecutionClicked: (executions) => emitEvent({ type: "execution-clicked", executions }),
    onDataTableChanged: () => renderCurrentDataTable(),
    onDrawingsChanged: (drawings, selectedDrawingIds, drawingGroups) => {
      if (selectedDrawingIds.length > 0) selectedStudyId = undefined;
      controller?.handleDrawingsChanged(drawings, selectedDrawingIds, drawingGroups);
    },
    onDrawingClicked: (drawingId) => {
      if (controller === undefined) return;
      const viewModel = controller.getViewModel();
      const entity = entitySnapshot(viewModel, entityScope).find(
        (candidate): candidate is Extract<ChartEntity, { kind: "drawing" }> & {
          id: `drawing:${string}`;
        } =>
          candidate.kind === "drawing" &&
          candidate.id.startsWith("drawing:") &&
          candidate.value.id === drawingId
      );
      if (entity && selectionSnapshot(viewModel).includes(entity.id)) {
        emitEvent({ type: "drawing-clicked", entity });
      }
    },
    onStudyClicked: (instanceId) => {
      if (controller === undefined) return;
      const entity = entitySnapshot(controller.getViewModel(), entityScope).find(
        (candidate): candidate is Extract<ChartEntity, { kind: "indicator" }> & {
          id: ChartIndicatorEntityId;
        } =>
          candidate.kind === "indicator" &&
          candidate.id.startsWith("indicator:") &&
          candidate.value.instanceId === instanceId
      );
      if (!entity) return;
      selectedStudyId = entity.id as ChartIndicatorEntityId;
      runtime.selectDrawings([]);
      emitSelectionChanged(controller.getViewModel());
      if (destroyed) return;
      const viewModel = controller.getViewModel();
      const current = entitySnapshot(viewModel, entityScope).find(
        (candidate): candidate is Extract<ChartEntity, { kind: "indicator" }> & {
          id: ChartIndicatorEntityId;
        } => candidate.kind === "indicator" && candidate.id === entity.id
      );
      if (current && selectionSnapshot(viewModel)[0] === current.id) {
        emitEvent({ type: "study-clicked", entity: current });
      }
    },
    onBlankClicked: () => {
      if (controller === undefined) return;
      selectedStudyId = undefined;
      runtime.selectDrawings([]);
      emitSelectionChanged(controller.getViewModel());
    },
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
    initialSeriesProperties: parseSeriesProperties(options.seriesProperties),
    initialSeriesVisualOverrides: parseChartSeriesVisualOverrides(
      options.seriesVisualOverrides
    ),
    initialComparisons,
    getCapabilities: (symbol, signal) => options.datafeed.getCapabilities(symbol, signal),
    store,
    dataCoordinator,
    searchCoordinator,
    persistence,
    runtime,
    parseIndicators: parseChartIndicators,
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
      const materializedKey = presentationKey(state);
      const viewModel = controller!.getViewModel();
      const readinessKey = presentationReadinessKey(viewModel);
      if (unavailablePresentationKey === readinessKey) {
        unavailablePresentationKey = undefined;
      }
      materializedPresentationKey = materializedKey;
      preparePresentationReadiness(viewModel);
    },
    onPresentationPending: (state) => {
      const materializedKey = presentationKey(state);
      const readinessKey = presentationReadinessKey(controller!.getViewModel());
      if (unavailablePresentationKey === readinessKey) unavailablePresentationKey = undefined;
      if (materializedPresentationKey === materializedKey) materializedPresentationKey = undefined;
      if (readyPresentationKey === readinessKey) readyPresentationKey = undefined;
      cancelReadinessFrame();
    },
    onPresentationUnavailable: (state) => {
      if (destroyed) return;
      const materializedKey = presentationKey(state);
      const readinessKey = presentationReadinessKey(controller!.getViewModel());
      if (
        materializedPresentationKey === materializedKey ||
        readyPresentationKey === readinessKey
      ) return;
      unavailablePresentationKey = readinessKey;
      settleDataReady((candidate) => candidate === readinessKey, false);
    },
    onViewModelChanged: (viewModel, revision) => {
      latestViewModelRevision = revision;
      const currentPresentationKey = presentationKey(viewModel.state);
      const currentReadinessKey = presentationReadinessKey(viewModel);
      void syncComparisonContext(viewModel);
      if (
        materializedPresentationKey !== undefined &&
        materializedPresentationKey !== currentPresentationKey
      ) {
        materializedPresentationKey = undefined;
        cancelReadinessFrame();
      }
      if (
        readyPresentationKey !== undefined &&
        readyPresentationKey !== currentReadinessKey
      ) readyPresentationKey = undefined;
      if (
        unavailablePresentationKey !== undefined &&
        unavailablePresentationKey !== currentReadinessKey
      ) unavailablePresentationKey = undefined;
      settleDataReady((candidate) => candidate !== currentReadinessKey, false);
      if (viewModel.state.loading) {
        cancelReadinessFrame();
        if (materializedPresentationKey === currentPresentationKey) {
          materializedPresentationKey = undefined;
        }
        if (readyPresentationKey === currentReadinessKey) {
          readyPresentationKey = undefined;
        }
      }
      if (viewModel.status.type === "blocked") {
        cancelReadinessFrame();
        if (materializedPresentationKey === currentPresentationKey) {
          materializedPresentationKey = undefined;
        }
        if (readyPresentationKey === currentReadinessKey) {
          readyPresentationKey = undefined;
        }
        settleDataReady((candidate) => candidate === currentReadinessKey, false);
      }
      if (
        viewModel.calculationStatus.type === "calculating" &&
        readyPresentationKey === currentReadinessKey
      ) {
        readyPresentationKey = undefined;
        cancelReadinessFrame();
      } else if (
        viewModel.calculationStatus.type === "idle" &&
        materializedPresentationKey === currentPresentationKey &&
        readyPresentationKey !== currentReadinessKey &&
        !viewModel.state.loading &&
        viewModel.status.type !== "blocked"
      ) {
        preparePresentationReadiness(viewModel);
      }
      if (
        readySelectionKey !== undefined &&
        readySelectionKey !== layoutSelectionKey(viewModel.state)
      ) readySelectionKey = undefined;
      if (activePricePrecision !== viewModel.state.symbol.pricePrecision) {
        activePricePrecision = viewModel.state.symbol.pricePrecision;
        runtime.setPricePrecision(activePricePrecision);
      }
      const nextReplay = JSON.stringify(viewModel.replay);
      if (nextReplay !== lastNotifiedReplay) {
        lastNotifiedReplay = nextReplay;
        emitEvent({ type: "replay-changed", replay: structuredClone(viewModel.replay) });
        if (destroyed || latestViewModelRevision !== revision) return;
      }
      renderCurrentDataTable();
      shell.render(viewModel);
      emitEntityChanges(viewModel);
      if (destroyed || latestViewModelRevision !== revision) return;
      emitSelectionChanged(viewModel);
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
  renderCurrentDataTable = (): void => {
    if (displayMode !== "table" || controller === undefined) return;
    const viewModel = controller.getViewModel();
    shell.renderDataTable(
      viewModel.status.type === "blocked"
        ? { status: "blocked", columns: [], rows: [] }
        : viewModel.state.loading ||
          viewModel.calculationStatus.type === "calculating"
          ? { status: "loading", columns: [], rows: [] }
        : runtime.getDataTableSnapshot()
    );
  };
  const setDisplayMode = (value: ChartDisplayMode): void => {
    const next = parseDisplayMode(value);
    if (destroyed || next === displayMode) return;
    displayMode = next;
    runtime.setDataTableActive(next === "table");
    if (next === "table") {
      runtime.clearTransientInteraction();
      renderCurrentDataTable();
    }
    shell.setDisplayMode(next);
    emitEvent({ type: "display-mode-changed", mode: next });
  };
  const unbind = shell.bind({ ...controller, setDisplayMode });
  lastNotifiedLayout = JSON.stringify(
    layoutSnapshot(controller.getViewModel(), studyDefinitions, runtime.getPaneLayouts())
  );
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
    controller!.setIndicators(parseChartIndicators(viewModel.indicators.map((candidate) =>
      candidate.instanceId === current.instanceId ? next : candidate
    )));
  };
  const removeStudy = (value: ChartIndicatorEntityId): boolean => {
    if (destroyed) return false;
    const current = findStudy(value);
    if (current === undefined) return false;
    const viewModel = controller!.getViewModel();
    controller!.setIndicators(parseChartIndicators(
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
        updateStudy(value, (current) => mergeChartIndicatorInputs(current, inputs));
      },
      isVisible: () => requireStudy(value).visible,
      setVisible: (visible: boolean) => {
        if (typeof visible !== "boolean") {
          throw new TypeError("Chart study visibility must be boolean");
        }
        updateStudy(value, (current) => ({ ...current, visible }));
      },
      getVisualOverrides: () =>
        structuredClone(requireStudy(value).visualOverrides ?? []),
      setVisualOverrides: (visualOverrides: readonly ChartStudyOutputVisualOverride[]) => {
        if (!Array.isArray(visualOverrides)) {
          throw new TypeError("Chart study visual overrides must be an array");
        }
        updateStudy(value, (current) => parseChartIndicators([{
          ...current,
          visualOverrides
        }])[0]!);
      },
      remove: () => removeStudy(value)
    });
  };
  const setSelection = (value: readonly ChartSelectableEntityId[]): void => {
    if (destroyed) {
      throw new DOMException("Chart selection API is unavailable", "InvalidStateError");
    }
    if (!Array.isArray(value)) {
      throw new TypeError("Chart selection must be an array");
    }
    const ids = [...new Set(value.map((candidate) => parseEntityId(candidate)))];
    const entities = entitySnapshot(controller!.getViewModel(), entityScope);
    const selected = ids.map((id) => {
      const entity = entities.find((candidate) => candidate.id === id);
      if (!entity) throw new DOMException("Chart selectable entity was not found", "NotFoundError");
      return entity;
    });
    if (
      selected.some((entity) => entity.kind === "mark") ||
      (selected.some((entity) => entity.kind === "indicator") && selected.length !== 1)
    ) {
      throw new TypeError("Chart selection accepts multiple drawings or one study");
    }
    if (selected.some(
      (entity) => entity.kind === "drawing" && entity.value.interactive === false
    )) {
      throw new TypeError("Non-interactive drawings cannot be selected");
    }
    const indicator = selected[0]?.kind === "indicator" ? selected[0] : undefined;
    selectedStudyId = indicator?.id as ChartIndicatorEntityId | undefined;
    runtime.selectDrawings(indicator
      ? []
      : selected
          .filter((entity): entity is Extract<ChartEntity, { kind: "drawing" }> =>
            entity.kind === "drawing"
          )
          .map((entity) => entity.value.id));
    emitSelectionChanged(controller!.getViewModel());
  };
  const requirePaneState = (id: ChartPaneId): ChartPane => {
    if (destroyed) {
      throw new DOMException("Chart pane API is unavailable", "InvalidStateError");
    }
    requireReadyLayout(controller!.getViewModel(), readySelectionKey);
    const pane = runtime.getPanes().find((candidate) => candidate.id === id);
    if (pane === undefined) {
      throw new DOMException("Chart pane was not found", "NotFoundError");
    }
    return pane;
  };
  const requireMutablePriceScale = (): void => {
    if (controller!.getState().view === "intraday") {
      throw new RangeError("Intraday view has a fixed price scale");
    }
  };
  const paneApi = (id: ChartPaneId): ChartPaneApi => {
    const priceScale: ChartPriceScaleApi = Object.freeze({
      paneId: id,
      getState: () => structuredClone(requirePaneState(id).priceScale),
      setMode: (mode: ChartPriceScaleMode) => {
        requireMutablePriceScale();
        const parsed = parsePriceScaleMode(mode);
        const pane = requirePaneState(id);
        if (id !== "main") {
          if (parsed !== "linear") {
            throw new RangeError("Study panes support only a linear price scale");
          }
          return;
        }
        if (pane.priceScale.mode !== parsed) controller!.setPriceScaleMode(parsed);
      },
      setAutoScale: (enabled: boolean) => {
        requireMutablePriceScale();
        if (typeof enabled !== "boolean") {
          throw new TypeError("Chart pane auto scale state must be boolean");
        }
        if (requirePaneState(id).priceScale.autoScale !== enabled) {
          runtime.setPaneAutoScale(id, enabled);
        }
      },
      setVisibleRange: (range: ChartPriceRange) => {
        requireMutablePriceScale();
        const parsed = parsePanePriceRange(range);
        const pane = requirePaneState(id);
        if (pane.priceScale.mode === "log" && parsed.from <= 0) {
          throw new RangeError("Chart logarithmic visible range must be positive");
        }
        runtime.setPaneVisibleRange(id, parsed);
      },
      setInverted: (inverted: boolean) => {
        requireMutablePriceScale();
        if (typeof inverted !== "boolean") {
          throw new TypeError("Chart pane inverted state must be boolean");
        }
        if (requirePaneState(id).priceScale.inverted !== inverted) {
          runtime.setPaneInverted(id, inverted);
        }
      }
    });
    return Object.freeze({
      id,
      getState: () => structuredClone(requirePaneState(id)),
      setHeightRatio: (ratio: number) => {
        const parsed = parsePaneHeightRatio(ratio);
        if (requirePaneState(id).heightRatio !== parsed) {
          runtime.setPaneHeightRatio(id, parsed);
        }
      },
      setCollapsed: (collapsed: boolean) => {
        if (typeof collapsed !== "boolean") {
          throw new TypeError("Chart pane collapsed state must be boolean");
        }
        if (id === "main" && collapsed) {
          throw new RangeError("Chart main pane cannot be collapsed");
        }
        if (requirePaneState(id).collapsed !== collapsed) {
          runtime.setPaneCollapsed(id, collapsed);
        }
      },
      moveTo: (index: number) => {
        requirePaneState(id);
        const panes = runtime.getPanes();
        if (!Number.isSafeInteger(index) || index < 0 || index >= panes.length) {
          throw new RangeError("Chart pane index is out of range");
        }
        if (id === "main" && index !== 0) {
          throw new RangeError("Chart main pane must remain first");
        }
        if (id !== "main" && index === 0) {
          throw new RangeError("Study panes cannot precede the main pane");
        }
        if (panes[index]?.id !== id) runtime.movePane(id, index);
      },
      getPriceScale: () => priceScale
    });
  };
  const timeScale = Object.freeze<ChartTimeScaleApi>({
    getVisibleRange: () => controller!.getVisibleRange(),
    setVisibleRange: (range) => controller!.setVisibleRange(parseVisibleRange(range)),
    timeToCoordinate: (time) => {
      const parsed = parseTimeScaleCoordinate(time, "Chart time scale time");
      return controller!.getVisibleRange() === undefined
        ? undefined
        : runtime.timeToCoordinate(parsed);
    },
    coordinateToTime: (coordinate) => {
      const parsed = parseTimeScaleCoordinate(coordinate, "Chart time scale coordinate");
      return controller!.getVisibleRange() === undefined
        ? undefined
        : runtime.coordinateToTime(parsed);
    },
    getBarSpacing: () => runtime.getBarSpacing(),
    setBarSpacing: (spacing) => {
      const parsed = parseTimeScaleSpacing(spacing);
      if (controller!.prepareTimeScaleMutation()) runtime.setBarSpacing(parsed);
    },
    getWidth: () => runtime.getWidth(),
    scrollByBars: (bars) => {
      const parsed = parseTimeScaleBars(bars);
      if (controller!.prepareTimeScaleMutation()) runtime.scrollByBars(parsed);
    },
    zoomIn: () => {
      if (controller!.prepareTimeScaleMutation()) runtime.zoomIn();
    },
    zoomOut: () => {
      if (controller!.prepareTimeScaleMutation()) runtime.zoomOut();
    },
    fitContent: () => {
      if (controller!.prepareTimeScaleMutation()) runtime.fitContent();
    },
    reset: () => controller!.resetToLatest(false)
  });
  const executeActionById = (value: ChartActionId): void => {
    const actionId = parseChartActionId(value);
    if (actionId === "chartReset") {
      for (const pane of runtime.getPanes()) {
        if (!pane.priceScale.autoScale) runtime.setPaneAutoScale(pane.id, true);
      }
      controller!.resetToLatest();
      return;
    }
    if (actionId === "timeScaleReset") {
      timeScale.reset();
      return;
    }
    timeScale[actionId]();
  };
  const parseDrawingGroupId = (value: ChartDrawingGroupId): ChartDrawingGroupId => {
    if (
      typeof value !== "string" ||
      !value.startsWith("drawing-group:") ||
      value.length === "drawing-group:".length
    ) {
      throw new TypeError("Chart drawing group id is invalid");
    }
    return value;
  };
  const parseDrawingGroupMembers = (
    value: readonly string[],
    minimum: number
  ): string[] => {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.some((id, index) =>
        !Object.hasOwn(value, index) || typeof id !== "string" || id.length === 0
      ) ||
      new Set(value).size !== value.length
    ) {
      throw new TypeError(
        `Chart drawing group must contain at least ${minimum} unique drawing${minimum === 1 ? "" : "s"}`
      );
    }
    return [...value];
  };
  const requireDrawingGroupsReady = (): Readonly<WorkspaceViewModel> => {
    if (destroyed) {
      throw new DOMException("Chart drawing groups API is unavailable", "InvalidStateError");
    }
    const viewModel = controller!.getViewModel();
    requireReadyLayout(viewModel, readySelectionKey);
    return viewModel;
  };
  const requireDrawingGroup = (
    value: ChartDrawingGroupId
  ): Readonly<ChartDrawingGroup> => {
    const id = parseDrawingGroupId(value);
    const group = requireDrawingGroupsReady().drawingGroups.find((item) => item.id === id);
    if (group === undefined) {
      throw new DOMException("Chart drawing group was not found", "NotFoundError");
    }
    return group;
  };
  const drawingGroupsApi = Object.freeze<ChartDrawingGroupsApi>({
    getAll: () => structuredClone(controller!.getViewModel().drawingGroups),
    create: (drawingIds, name) => {
      requireDrawingGroupsReady();
      const members = parseDrawingGroupMembers(drawingIds, 2);
      return controller!.createDrawingGroup(
        members,
        name === undefined ? undefined : parseDrawingGroupName(name)
      );
    },
    setName: (value, name) => {
      const group = requireDrawingGroup(value);
      const nextName = parseDrawingGroupName(name);
      if (group.name !== nextName) controller!.setDrawingGroupName(group.id, nextName);
    },
    setMembers: (value, drawingIds) => {
      const group = requireDrawingGroup(value);
      const members = parseDrawingGroupMembers(drawingIds, 1);
      controller!.setDrawingGroupMembers(group.id, members);
    },
    setVisible: (value, visible) => {
      const group = requireDrawingGroup(value);
      if (typeof visible !== "boolean") {
        throw new TypeError("Chart drawing group visibility must be boolean");
      }
      controller!.setDrawingGroupVisible(group.id, visible);
    },
    setLocked: (value, locked) => {
      const group = requireDrawingGroup(value);
      if (typeof locked !== "boolean") {
        throw new TypeError("Chart drawing group lock state must be boolean");
      }
      controller!.setDrawingGroupLocked(group.id, locked);
    },
    move: (value, direction) => {
      const group = requireDrawingGroup(value);
      if (!["forward", "backward", "front", "back"].includes(direction)) {
        throw new TypeError("Chart drawing group move direction is invalid");
      }
      controller!.moveDrawingGroup(group.id, direction as ChartDrawingGroupMove);
    },
    ungroup: (value) => {
      const group = requireDrawingGroup(value);
      controller!.ungroupDrawingGroup(group.id);
    },
    deleteDrawings: (value) => {
      const group = requireDrawingGroup(value);
      controller!.deleteDrawingGroupDrawings(group.id);
    }
  });

  return Object.freeze({
    getState: () => controller!.getState(),
    getDisplayMode: () => displayMode,
    getTheme: () => theme,
    getThemeOverrides: () => structuredClone(themeOverrides),
    getVisibleRange: () => controller!.getVisibleRange(),
    getTimeScale: () => timeScale,
    getSeriesType: () => controller!.getViewModel().seriesType,
    getSeriesProperties: <T extends ChartConfigurableSeriesType>(type: T) =>
      resolveSeriesProperties(type, controller!.getViewModel().seriesProperties),
    getSeriesVisualOverrides: <T extends ChartSeriesType>(type: T) =>
      resolveSeriesVisualOverrides(
        type,
        controller!.getViewModel().seriesVisualOverrides
      ),
    getPriceScaleMode: () => controller!.getViewModel().priceScaleMode,
    getPanes: () => {
      requireReadyLayout(controller!.getViewModel(), readySelectionKey);
      return structuredClone(runtime.getPanes());
    },
    getPaneById: (value: ChartPaneId) => {
      const id = parsePaneId(value);
      requireReadyLayout(controller!.getViewModel(), readySelectionKey);
      const pane = runtime.getPanes().find((candidate) => candidate.id === id);
      return pane === undefined ? undefined : structuredClone(pane);
    },
    getPaneApi: (value: ChartPaneId) => {
      const id = parsePaneId(value);
      requireReadyLayout(controller!.getViewModel(), readySelectionKey);
      return runtime.getPanes().some((candidate) => candidate.id === id)
        ? paneApi(id)
        : undefined;
    },
    getIndicators: () => structuredClone(controller!.getViewModel().indicators),
    getDrawings: () => fromEngineDrawings(controller!.getViewModel().drawings),
    getMarks: () => structuredClone(controller!.getViewModel().marks),
    getComparisons: () => structuredClone(controller!.getViewModel().comparisons),
    getReplayState: () => structuredClone(controller!.getViewModel().replay),
    dataReady: () => {
      if (destroyed) return Promise.resolve(false);
      const viewModel = controller!.getViewModel();
      const key = presentationReadinessKey(viewModel);
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
      const input = parseChartIndicatorInput(value);
      const viewModel = controller!.getViewModel();
      const indicator = parseChartIndicators([{
        ...input,
        instanceId: input.instanceId ?? allocateStudyInstanceId()
      }])[0]!;
      const entity = { kind: "indicator" as const, value: indicator };
      const id = toEntityId(entity, viewModel.state, entityScope) as ChartIndicatorEntityId;
      if (entitySnapshot(viewModel, entityScope).some((candidate) => candidate.id === id)) {
        throw new DOMException("Chart study already exists", "InvalidStateError");
      }
      controller!.setIndicators(parseChartIndicators([...viewModel.indicators, indicator]));
      return id;
    },
    getStudyById: (value: ChartIndicatorEntityId) => {
      const study = findStudy(value);
      return study === undefined ? undefined : structuredClone(study);
    },
    getStudyApi: (value: ChartIndicatorEntityId) => studyApi(value),
    getAllStudies: () => structuredClone(controller!.getViewModel().indicators),
    getDrawingGroupsApi: () => drawingGroupsApi,
    removeStudy: (value: ChartIndicatorEntityId) => removeStudy(value),
    createEntity: (value: ChartEntityInput) => {
      if (destroyed) {
        throw new DOMException("Chart entity API is unavailable", "InvalidStateError");
      }
      const entity = parseChartEntityInput(value);
      const viewModel = controller!.getViewModel();
      const id = toEntityId(entity, viewModel.state, entityScope);
      if (entitySnapshot(viewModel, entityScope).some((candidate) => candidate.id === id)) {
        throw new DOMException("Chart entity already exists", "InvalidStateError");
      }
      if (entity.kind === "indicator") {
        controller!.setIndicators(parseChartIndicators([...viewModel.indicators, entity.value]));
      } else if (entity.kind === "drawing") {
        requireReadyLayout(viewModel, readySelectionKey);
        controller!.setDrawings(
          toEngineDrawings(
            parseDrawings([...fromEngineDrawings(viewModel.drawings), entity.value])
          ),
          [],
          viewModel.drawingGroups
        );
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
    getSelection: () => structuredClone(selectionSnapshot(controller!.getViewModel())),
    setSelection,
    clearSelection: () => setSelection([]),
    updateEntity: (value: ChartEntity) => {
      if (destroyed) {
        throw new DOMException("Chart entity API is unavailable", "InvalidStateError");
      }
      const entity = parseChartEntity(value);
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
        if (
          current.kind !== "indicator" ||
          current.value.instanceId !== entity.value.instanceId ||
          current.value.id !== entity.value.id ||
          current.value.definitionVersion !== entity.value.definitionVersion
        ) {
          throw new TypeError("Chart study identity and definitionVersion are immutable");
        }
        controller!.setIndicators(parseChartIndicators(viewModel.indicators.map((candidate) =>
          candidate.instanceId === entity.value.instanceId ? entity.value : candidate
        )));
      } else if (entity.kind === "drawing") {
        requireReadyLayout(viewModel, readySelectionKey);
        controller!.setDrawings(
          toEngineDrawings(parseDrawings(
            fromEngineDrawings(viewModel.drawings).map((candidate) =>
              candidate.id === current.value.id ? entity.value : candidate
            )
          )),
          viewModel.selectedDrawingIds,
          viewModel.drawingGroups
        );
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
        controller!.setIndicators(parseChartIndicators(
          viewModel.indicators.filter(
            (candidate) => candidate.instanceId !== current.value.instanceId
          )
        ));
      } else if (current.kind === "drawing") {
        requireReadyLayout(viewModel, readySelectionKey);
        controller!.setDrawings(
          toEngineDrawings(parseDrawings(
            fromEngineDrawings(viewModel.drawings)
              .filter((candidate) => candidate.id !== current.value.id)
          )),
          viewModel.selectedDrawingIds.filter((id) => id !== current.value.id),
          viewModel.drawingGroups
            .map((group) => ({
              ...group,
              drawingIds: group.drawingIds.filter((id) => id !== current.value.id)
            }))
            .filter((group) => group.drawingIds.length > 0)
        );
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
      return layoutSnapshot(viewModel, studyDefinitions, runtime.getPaneLayouts());
    },
    setTheme: (value: ChartTheme) => {
      if (value !== "dark" && value !== "light") {
        throw new TypeError("Chart theme must be dark or light");
      }
      if (destroyed || value === theme) return;
      theme = value;
      shell.root.dataset.theme = value;
      runtime.refreshTheme();
    },
    setDisplayMode,
    setThemeOverrides: (value: ChartThemeOverrides) => {
      if (value === undefined) throw new TypeError("Chart theme overrides must be an object");
      const parsed = parseThemeOverrides(value);
      if (destroyed) return;
      themeOverrides = parsed;
      applyWorkspaceThemeOverrides(shell.root, parsed);
      runtime.refreshTheme();
    },
    setSymbol: (symbol: ChartSymbol) => {
      const parsed = parseChartSymbol(symbol);
      if (parsed === undefined) throw new TypeError("Chart symbol is invalid");
      controller!.setSymbol(parsed);
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
    setSeriesProperties: (properties: ChartSeriesProperties) => {
      const parsed = parseSeriesProperties([properties])[0]!;
      controller!.setSeriesProperties(parsed);
    },
    setSeriesVisualOverrides: (overrides: ChartSeriesVisualOverrides) => {
      const parsed = parseChartSeriesVisualOverrides([overrides])[0]!;
      controller!.setSeriesVisualOverrides(parsed);
    },
    setPriceScaleMode: (mode: ChartPriceScaleMode) =>
      controller!.setPriceScaleMode(parsePriceScaleMode(mode)),
    setIndicators: (indicators: readonly ChartIndicator[]) =>
      controller!.setIndicators(parseChartIndicators(indicators)),
    setDrawings: (drawings: readonly ChartDrawing[]) => {
      const parsed = parseDrawings(drawings);
      requireReadyLayout(controller!.getViewModel(), readySelectionKey);
      controller!.setDrawings(toEngineDrawings(parsed));
    },
    setMarks: (marks: readonly ChartMark[]) => controller!.setMarks(parseMarks(marks)),
    setComparisons: (comparisons: readonly ChartComparison[]) => {
      const parsed = parseComparisons(comparisons, controller!.getState().symbol);
      controller!.setComparisons(parsed);
    },
    setDrawingTool: (tool: ChartDrawingTool) => controller!.setDrawingTool(parseDrawingTool(tool)),
    setGridVisible: (visible: boolean) => {
      if (typeof visible !== "boolean") throw new TypeError("Grid visibility must be boolean");
      controller!.setGridVisible(visible);
    },
    undoDrawing: () => controller!.undoDrawing(),
    redoDrawing: () => controller!.redoDrawing(),
    importLayout: (value: unknown) => {
      const layout = parseChartLayout(value);
      requireReadyLayout(controller!.getViewModel(), readySelectionKey);
      if (controller!.getState().view === "intraday" && layout.seriesType !== "line") {
        throw new RangeError("Intraday view accepts only line-series layouts");
      }
      if (
        controller!.getState().view === "intraday" &&
        layout.panes.some((pane) =>
          !pane.priceScale.autoScale ||
          pane.priceScale.inverted ||
          pane.priceScale.visibleRange !== undefined
        )
      ) {
        throw new RangeError("Intraday view has a fixed price scale");
      }
      runtime.validatePaneLayouts(layout.panes, layout.priceScaleMode);
      applyingLayout = true;
      try {
        controller!.setSeriesConfiguration(
          layout.seriesType,
          layout.seriesProperties ?? []
        );
        for (const current of controller!.getViewModel().seriesVisualOverrides) {
          controller!.setSeriesVisualOverrides({ type: current.type });
        }
        for (const overrides of layout.seriesVisualOverrides ?? []) {
          controller!.setSeriesVisualOverrides(overrides);
        }
        controller!.setPriceScaleMode(layout.priceScaleMode);
        controller!.setIndicators(layout.indicators);
        runtime.applyPaneLayouts(layout.panes);
        controller!.setDrawings(
          toEngineDrawings(layout.drawings),
          [],
          layout.drawingGroups ?? []
        );
        controller!.setGridVisible(layout.gridVisible);
      } finally {
        applyingLayout = false;
      }
      emitEntityChanges(controller!.getViewModel());
      emitSelectionChanged(controller!.getViewModel());
      const applied = layoutSnapshot(
        controller!.getViewModel(),
        studyDefinitions,
        runtime.getPaneLayouts()
      );
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
    executeActionById,
    startReplay: (time: number) => {
      if (!validExecutionTime(time)) {
        throw new TypeError("Chart replay time must be a positive finite epoch");
      }
      requireReadyLayout(controller!.getViewModel(), readySelectionKey);
      return controller!.startReplay(time);
    },
    stepReplay: (steps = 1) => {
      if (!Number.isSafeInteger(steps) || steps < 1) {
        throw new RangeError("Chart replay steps must be a positive safe integer");
      }
      return controller!.stepReplay(steps);
    },
    playReplay: () => controller!.playReplay(),
    pauseReplay: () => controller!.pauseReplay(),
    setReplaySpeed: (speed: ChartReplaySpeed) => {
      if (!replaySpeeds.has(speed)) {
        throw new RangeError("Chart replay speed must be 1, 2, 4, or 8");
      }
      controller!.setReplaySpeed(speed);
    },
    stopReplay: () => controller!.stopReplay(),
    resetToLatest: () => controller!.resetToLatest(),
    retry: () => {
      controller!.retry();
      if (
        comparisonCoordinator.getSnapshots().some(
          (snapshot) => snapshot.status === "error"
        )
      ) {
        comparisonContextKey = undefined;
        comparisonRequestedRangeKey = undefined;
        const viewModel = controller!.getViewModel();
        const key = presentationReadinessKey(viewModel);
        if (readyPresentationKey === key) readyPresentationKey = undefined;
        if (unavailablePresentationKey === key) unavailablePresentationKey = undefined;
        preparePresentationReadiness(viewModel);
      }
    },
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
      comparisonContextGeneration += 1;
      comparisonPreparationGeneration += 1;
      comparisonCoordinator.destroy();
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
