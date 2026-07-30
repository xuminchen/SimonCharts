import {
  beginDrawingHandleDrag,
  beginDrawingMoveDrag,
  chooseNearestVisualHit,
  createBandVisualRenderer,
  createChartEngine,
  createChartLayout,
  constrainViewportToWidth,
  createDefaultDrawingRendererRegistry,
  createDrawingEditor,
  createDrawingLayer,
  createHistogramVisualRenderer,
  createInitialViewport,
  createInteractionEngine,
  createInteractionSession,
  createLineVisualRenderer,
  createMainPanelPriceScale,
  createMarkerVisualRenderer,
  createPanelLayout,
  createPriceScaleFromBounds,
  createRenderScheduler,
  createStaticLayers,
  createVisualLayer,
  createVisualRendererRegistry,
  defaultChartTheme,
  defaultDrawingHotkeyBindings,
  drawingPointFromPointer,
  finishDrawingHandleDrag,
  finishDrawingMoveDrag,
  getDrawingCommandForHotkey,
  getDrawingHoverState,
  hitTestDrawing,
  hitTestDrawingEditHandle,
  indexToX,
  mergeVisualAutoscaleRanges,
  panViewportByPixels,
  priceToScaleValue,
  projectDrawingObject,
  renderOverlay,
  renderStaticChart,
  resizeCanvas,
  scaleValueToPrice,
  unprojectDrawingObject,
  updateDrawingHandleDrag,
  updateDrawingMoveDrag,
  xToIndex,
  zoomViewportAtIndex,
  type ChartCrosshairState,
  type DrawingEditor,
  type DrawingEditorCommand,
  type DrawingHandleDragOperation,
  type DrawingMoveDragOperation,
  type DrawingEditorTool,
  type DrawingObject,
  type IndicatorMarkerOutput,
  type IndicatorVisualOutput,
  type MovingAveragePoint,
  type PriceScale,
  type PriceScaleMode,
  type RenderMetrics,
  type SeriesRenderModel,
  type SeriesType,
  type StatefulSeriesTransformType,
  type TimeCoordinateMap,
  type VisualTooltipRow,
  type ViewportState
} from "@simoncharts/chart-engine";
import type {
  AdjustMode,
  Candle,
  ChartCrosshairStudyOutput,
  ChartExecution,
  ChartIndicator,
  ChartMark,
  ChartPane,
  ChartPaneId,
  ChartPaneLayout,
  ChartPriceRange,
  ChartSeriesProperties,
  ChartVisibleRange,
  Timeframe
} from "../contracts";
import type { MaterializedSeries } from "../data/materializedSeries";
import type { ComparisonDataSnapshot } from "../data/comparisonCoordinator";
import { shanghaiTradingDayKey } from "../data/pagedSeriesStore";
import type { CalculationStatus, CheckpointedCalculationRuntime } from "./checkpointedCalculationRuntime";
import {
  indicatorOutputPrefix,
  type IndicatorConfig
} from "./indicatorRuntime";
import {
  calculateFixedIntradayPercentExtent,
  calculateIntradayAverage,
  createIntradayTimeCoordinates
} from "./intradayPresentation";
import { formatShanghaiTime } from "./shanghaiTimeFormatter";
import { readWorkspaceChartTheme } from "./workspaceTheme";
import {
  createExecutionMarkerOutput,
  executionsFromMark,
  executionTooltipRows
} from "./executionMarks";
import { priceFormatter } from "./priceFormatter";
import {
  comparisonBaseValue,
  comparisonValueAtTime,
  createComparisonLineOutput
} from "./comparisonProjection";

export interface WorkspaceRuntimeMetrics extends RenderMetrics {
  maxMaterializedCandleCount: number;
}

export interface MaterializationDemand {
  readonly visibleCount: number;
  readonly overscanCount: number;
}

export interface DataWindowIndicatorRow { id: string; label: string; value: string; }
export interface DataWindowComparisonRow {
  readonly symbolId: string;
  readonly code: string;
  readonly name: string;
  readonly pricePrecision?: number;
  readonly label: string;
  readonly color?: string;
  readonly value: number | null;
  readonly changePercent: number | null;
  readonly dataVersion?: string;
}
export interface DataWindowIntradaySummary {
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly previousClose: number;
}
export interface DataWindowSnapshot {
  crosshair: ChartCrosshairState;
  candle: Readonly<Candle>;
  formattedTime: string;
  change: number;
  changePercent: number;
  indicatorRows: readonly DataWindowIndicatorRow[];
  comparisonRows?: readonly DataWindowComparisonRow[];
  pricePrecision?: number;
  intradaySummary?: DataWindowIntradaySummary;
}

interface RuntimeCrosshairStudyValues {
  readonly indicator: ChartIndicator;
  readonly title: string;
  readonly outputs: readonly ChartCrosshairStudyOutput[];
}

export interface RuntimeCrosshairSnapshot {
  readonly symbolId: string;
  readonly timeframe: Timeframe;
  readonly adjustMode: AdjustMode;
  readonly dataVersion: string;
  readonly crosshair: ChartCrosshairState;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly candle: Readonly<Candle>;
  readonly referencePrice: number | null;
  readonly change: number | null;
  readonly changePercent: number | null;
  readonly studies: readonly RuntimeCrosshairStudyValues[];
  readonly comparisons: readonly DataWindowComparisonRow[];
}

export interface ExecutionTooltipSnapshot {
  readonly markId: string;
  readonly x: number;
  readonly y: number;
  readonly title?: string;
  readonly rows: VisualTooltipRow[];
  readonly pinned: boolean;
}

export interface ChartEngineRuntime {
  setMaterializedSeries(input: MaterializedSeries, anchorTime?: number): void;
  getMaterializationDemand(): Readonly<MaterializationDemand>;
  getVisibleRange(): Readonly<ChartVisibleRange> | undefined;
  setVisibleRange(range: ChartVisibleRange): boolean;
  getBarSpacing(): number;
  setBarSpacing(spacing: number): void;
  getWidth(): number;
  timeToCoordinate(time: number): number | undefined;
  coordinateToTime(coordinate: number): number | undefined;
  scrollByBars(bars: number): void;
  zoomIn(): void;
  zoomOut(): void;
  fitContent(): void;
  resetToLatest(resetPriceScale?: boolean): void;
  clearCrosshair(): void;
  setSeriesType(type: SeriesType, properties?: ChartSeriesProperties): void;
  setIndicators(configs: readonly IndicatorConfig[]): void;
  setComparisonData(snapshots: readonly ComparisonDataSnapshot[]): void;
  setMarks(marks: readonly ChartMark[]): void;
  setExecutions(executions: readonly ChartExecution[]): void;
  setExecutionsVisible(visible: boolean): void;
  setPricePrecision(precision: number | undefined): void;
  setPriceScaleMode(mode: PriceScaleMode): void;
  getPanes(): readonly ChartPane[];
  getPaneLayouts(): readonly ChartPaneLayout[];
  setPaneHeightRatio(id: ChartPaneId, ratio: number): void;
  setPaneCollapsed(id: ChartPaneId, collapsed: boolean): void;
  movePane(id: ChartPaneId, index: number): void;
  setPaneAutoScale(id: ChartPaneId, enabled: boolean): void;
  setPaneVisibleRange(id: ChartPaneId, range: ChartPriceRange): void;
  setPaneInverted(id: ChartPaneId, inverted: boolean): void;
  validatePaneLayouts(
    panes: readonly ChartPaneLayout[],
    mainMode: PriceScaleMode
  ): void;
  applyPaneLayouts(panes: readonly ChartPaneLayout[]): void;
  setDrawings(drawings: readonly DrawingObject[], selectedDrawingIds?: readonly string[]): void;
  selectDrawings(ids: readonly string[]): void;
  setDrawingTool(tool: DrawingEditorTool): void;
  executeDrawingCommand(command: DrawingEditorCommand): void;
  undoDrawing(): void;
  redoDrawing(): void;
  setGridVisible(visible: boolean): void;
  refreshTheme(): void;
  cancelCalculations(): void;
  retryRender(): void;
  getMetrics(): WorkspaceRuntimeMetrics;
  destroy(): void;
}

export interface RuntimeResizeObserver { observe(target: Element): void; disconnect(): void; }
export interface ChartEngineRuntimeOptions {
  staticCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  themeRoot: HTMLElement;
  calculationRuntime: CheckpointedCalculationRuntime;
  pricePrecision?: number;
  studyTitleFor?: (config: Readonly<IndicatorConfig>) => string;
  paneIdFor?: (config: Readonly<IndicatorConfig>) => ChartPaneId | undefined;
  observer?: RuntimeResizeObserver;
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (id: number) => void;
  getComputedStyle?: (element: Element) => CSSStyleDeclaration;
  devicePixelRatio?: number;
  onViewportChanged?: (viewport: ViewportState) => void;
  onMaterializedBoundary?: (direction: "before" | "after", anchorTime?: number) => void;
  onMaterializationDemandChanged?: (demand: Readonly<MaterializationDemand>) => void;
  onVisibleRangeChanged?: (range: Readonly<ChartVisibleRange>) => void;
  onPaneLayoutChanged?: () => void;
  onCalculationStatusChanged?: (status: CalculationStatus) => void;
  onDataWindowChanged?: (snapshot: DataWindowSnapshot | undefined) => void;
  hasCrosshairListeners?: () => boolean;
  onCrosshairChanged?: (snapshot: RuntimeCrosshairSnapshot | undefined) => void;
  onExecutionTooltipChanged?: (snapshot: ExecutionTooltipSnapshot | undefined) => void;
  onExecutionClicked?: (executions: readonly ChartExecution[]) => void;
  onMarkClicked?: (mark: Readonly<ChartMark>) => void;
  onDrawingClicked?: (drawingId: string) => void;
  onStudyClicked?: (instanceId: string) => void;
  onBlankClicked?: () => void;
  onDrawingsChanged?: (drawings: readonly DrawingObject[], selectedDrawingIds: readonly string[]) => void;
  onDrawingHistoryChanged?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  onCalculationError?: (kind: "indicator" | "series", error: unknown) => void;
  onRenderError?: (error: unknown) => void;
  onRenderRecovered?: () => void;
}

function seriesTransformOptions(
  type: StatefulSeriesTransformType,
  properties: ChartSeriesProperties | undefined
): Readonly<Record<string, number>> {
  if (type === "renko") return { brickSize: properties?.type === type ? properties.brickSize : 1 };
  if (type === "lineBreak") return { lineCount: properties?.type === type ? properties.lineCount : 3 };
  if (type === "kagi") return {
    reversalAmount: properties?.type === type ? properties.reversalAmount : 2
  };
  if (type === "pointAndFigure") return properties?.type === type
    ? { boxSize: properties.boxSize, reversalBoxes: properties.reversalBoxes }
    : { boxSize: 1, reversalBoxes: 3 };
  return {};
}

const statefulTypes = new Set<SeriesType>(["heikinAshi", "renko", "lineBreak", "kagi", "pointAndFigure"]);

function isStatefulSeriesType(type: SeriesType): type is StatefulSeriesTransformType {
  return statefulTypes.has(type);
}

function summarizeLatestIntradayDay(
  input: MaterializedSeries
): DataWindowIntradaySummary | undefined {
  if (input.intradayDays === undefined || input.series.candles.length === 0) return undefined;
  const candles = input.series.candles;
  const latestDay = shanghaiTradingDayKey(candles.at(-1)!.time);
  let firstIndex = candles.length - 1;
  while (
    firstIndex > 0 &&
    shanghaiTradingDayKey(candles[firstIndex - 1]!.time) === latestDay
  ) firstIndex -= 1;
  const dayCandles = candles.slice(firstIndex);
  const first = dayCandles[0]!;
  const last = dayCandles.at(-1)!;
  return {
    open: first.open,
    high: Math.max(...dayCandles.map((candle) => candle.high)),
    low: Math.min(...dayCandles.map((candle) => candle.low)),
    close: last.close,
    previousClose: candles[firstIndex - 1]?.close ?? input.intradayScale?.previousClose ?? first.open
  };
}

export function createChartEngineRuntime(options: ChartEngineRuntimeOptions): ChartEngineRuntime {
  let destroyed = false;
  let materialized: MaterializedSeries | undefined;
  let renderRecoveryPending = false;
  let indicatorCalculationFailed = false;
  let failedSeriesCalculation: StatefulSeriesTransformType | undefined;
  let activeIndicatorGeneration: number | undefined;
  let activeSeriesGeneration: number | undefined;
  let indicatorCalculationController: AbortController | undefined;
  let seriesCalculationController: AbortController | undefined;
  let calculationRecoveryPending = false;
  let viewport = createInitialViewport(0, 1);
  let layout = createChartLayout(1, 1);
  let panels = createPanelLayout({
    width: 1,
    height: 1,
    rightAxisWidth: layout.rightAxisWidth,
    bottomAxisHeight: 0,
    panels: [{ id: "main", kind: "main", label: "Main", heightRatio: 3 }]
  });
  let paneOrder: ChartPaneId[] = ["main"];
  const paneLayouts = new Map<ChartPaneId, ChartPaneLayout>([[
    "main",
    {
      id: "main",
      heightRatio: 3,
      collapsed: false,
      priceScale: { autoScale: true, inverted: false }
    }
  ]]);
  let panelPriceScales = new Map<string, PriceScale>();
  let visualOutputs: IndicatorVisualOutput[] = [];
  let comparisonData: readonly ComparisonDataSnapshot[] = [];
  let markOutput: IndicatorMarkerOutput | undefined;
  let marks: readonly ChartMark[] = [];
  let executionOutput: IndicatorMarkerOutput | undefined;
  let executions: readonly ChartExecution[] = [];
  let executionsVisible = true;
  let executionTooltip: Omit<ExecutionTooltipSnapshot, "pinned"> | undefined;
  let executionTooltipPinned = false;
  let currentPricePrecision = options.pricePrecision;
  let formatPrice: ((price: number) => string) | undefined = priceFormatter(currentPricePrecision);
  let indicatorConfigs: readonly IndicatorConfig[] = [];
  let seriesModel: SeriesRenderModel | undefined;
  let activeSeriesProperties: ChartSeriesProperties | undefined;
  let crosshair: ChartCrosshairState | undefined;
  let crosshairPoint: { x: number; y: number } | undefined;
  let crosshairPane: { id: string; y: number } | undefined;
  let crosshairEventsSuspended = false;
  let resumeCrosshairEventsAfterFlush = false;
  let interactionEventPoint: { x: number; y: number } | undefined;
  let pendingCrosshairEvent:
    | { crosshair: ChartCrosshairState; point: { x: number; y: number } }
    | { crosshair: undefined }
    | undefined;
  let maxMaterializedCandleCount = 0;
  let indicatorGeneration = 0;
  let seriesGeneration = 0;
  let manualPriceScale: PriceScale | undefined;
  let drawingHandleDragOperation: DrawingHandleDragOperation | undefined;
  let drawingMoveDragOperation: DrawingMoveDragOperation | undefined;
  let hoveredDrawingId: string | undefined;
  let suppressDrawingState = false;
  let pendingClick:
    | {
        readonly pointerId: number;
        readonly start: { readonly x: number; readonly y: number };
        readonly kind: "drawing" | "study" | "blank" | "execution";
        readonly id?: string;
        readonly executions?: readonly ChartExecution[];
      }
    | undefined;
  let activePointerId: number | undefined;
  let priceAxisDrag: {
    pointerId: number;
    paneId: ChartPaneId;
    startY: number;
    scale: PriceScale;
    moved: boolean;
  } | undefined;
  let timeAxisDrag: { pointerId: number; startX: number; viewport: ViewportState } | undefined;
  let lastDataWindowIndex: number | undefined;
  let dataWindowVisible = false;
  let currentIntradaySummary: DataWindowIntradaySummary | undefined;
  let intradayAverage: MovingAveragePoint[] | undefined;
  let timeCoordinates: TimeCoordinateMap | undefined;
  let lastVisibleRangeKey = "";
  let lastMaterializationDemandKey = "";
  const emptySeries = { symbol: "", timeframe: "1d" as const, adjustMode: "none" as const, dataVersion: "", candles: [] };
  const chartEngine = createChartEngine({
    series: emptySeries,
    settings: { themeMode: "dark", candleColorScheme: "aShare" }
  });
  const session = createInteractionSession({
    onEvent(event) {
      if (event.type !== "cursorChanged") return;
      options.overlayCanvas.style.cursor = {
        default: "default",
        crosshair: "crosshair",
        grab: "grab",
        grabbing: "grabbing",
        drawing: "move",
        resize: "nwse-resize"
      }[event.cursor];
    }
  });
  let interaction: ReturnType<typeof createInteractionEngine> | undefined;
  let priceScale = createMainPanelPriceScale(emptySeries, viewport.visibleRange, "linear", [], []);
  const drawingRegistry = createDefaultDrawingRendererRegistry();
  const visualRegistry = createVisualRendererRegistry();
  visualRegistry.register(createLineVisualRenderer());
  visualRegistry.register(createHistogramVisualRenderer());
  visualRegistry.register(createBandVisualRenderer());
  visualRegistry.register(createMarkerVisualRenderer());
  let drawingEditor: DrawingEditor;

  const intradayLocked = (): boolean => materialized?.intradayDays !== undefined;
  const comparisonOutputs = (): IndicatorVisualOutput[] => {
    if (materialized === undefined) return [];
    return comparisonData
      .filter((snapshot) =>
        snapshot.status === "ready" &&
        snapshot.comparison.visible !== false
      )
      .map((snapshot) => createComparisonLineOutput({
        comparison: snapshot.comparison,
        mainCandles: materialized!.series.candles,
        comparisonCandles: snapshot.candles,
        visibleRange: viewport.visibleRange,
        ...(snapshot.previousClose === undefined
          ? {}
          : { previousClose: snapshot.previousClose })
      }));
  };
  const activeVisualOutputs = (): IndicatorVisualOutput[] => [
    ...visualOutputs,
    ...comparisonOutputs(),
    ...(markOutput === undefined ? [] : [markOutput]),
    ...(executionOutput === undefined ? [] : [executionOutput])
  ];

  const syncVisualOutputs = (): void => {
    chartEngine.setVisualOutputs(activeVisualOutputs());
  };

  const rebuildExecutionOutput = (): void => {
    executionOutput = materialized === undefined || !executionsVisible
      ? undefined
      : createExecutionMarkerOutput(executions, materialized.series.candles, materialized.series.timeframe);
    syncVisualOutputs();
  };

  const rebuildMarkOutput = (): void => {
    const candleTimes = new Set(materialized?.series.candles.map((candle) => candle.time) ?? []);
    const visibleMarks = marks.filter((mark) => candleTimes.has(mark.time));
    markOutput = visibleMarks.length === 0
      ? undefined
      : {
          id: "__host-marks",
          label: "Marks",
          type: "marker",
          panelId: "main",
          marks: visibleMarks.map((mark) => ({ ...mark }))
        };
    syncVisualOutputs();
  };

  const coordinateContext = () => ({
    series: chartEngine.getState().series,
    viewport,
    plotArea: layout.plotArea,
    priceScale,
    ...(timeCoordinates === undefined ? {} : { timeCoordinates })
  });
  const emitDrawingHistoryState = (): void => {
    const capabilities = drawingEditor.getCapabilities();
    options.onDrawingHistoryChanged?.({ canUndo: capabilities.canUndo, canRedo: capabilities.canRedo });
  };
  const emitDrawingState = (): void => {
    const state = drawingEditor.getState();
    options.onDrawingsChanged?.(
      state.drawings.map((drawing) => structuredClone(drawing)),
      state.selectedDrawingIds
    );
    emitDrawingHistoryState();
  };
  const createEditor = (drawings: readonly DrawingObject[]): DrawingEditor =>
    createDrawingEditor({
      drawings: drawings.map((drawing) => structuredClone(drawing)),
      coordinateAdapter: {
        toScreen: (drawing) => projectDrawingObject(drawing, coordinateContext()),
        toDomain: (drawing) => unprojectDrawingObject(drawing, coordinateContext())
      },
      onEvent: (event) => {
        if (
          event.type === "drawingCreated" ||
          event.type === "drawingUpdated" ||
          event.type === "drawingDeleted"
        ) refreshDrawingScale("drawingChanged");
        else syncDrawings();
        if (!suppressDrawingState) emitDrawingState();
      }
    });
  drawingEditor = createEditor([]);

  function getVisibleRange(): Readonly<ChartVisibleRange> | undefined {
    const candles = chartEngine.getState().series.candles;
    const from = candles[Math.max(0, viewport.visibleRange.from)]?.time;
    const to = candles[Math.min(candles.length - 1, viewport.visibleRange.to)]?.time;
    return from === undefined || to === undefined ? undefined : Object.freeze({ from, to });
  }

  function emitVisibleRange(): void {
    const range = getVisibleRange();
    if (range === undefined) {
      lastVisibleRangeKey = "";
      return;
    }
    const series = chartEngine.getState().series;
    const key = `${series.symbol}:${series.timeframe}:${range.from}:${range.to}`;
    if (key === lastVisibleRangeKey) return;
    lastVisibleRangeKey = key;
    options.onVisibleRangeChanged?.(range);
  }

  function getMaterializationDemand(): Readonly<MaterializationDemand> {
    const visibleCount = Math.max(
      1,
      viewport.visibleRange.to - viewport.visibleRange.from + 1
    );
    return Object.freeze({
      visibleCount,
      overscanCount: Math.max(100, Math.ceil((500 - visibleCount) / 2))
    });
  }

  function emitMaterializationDemand(): void {
    const demand = getMaterializationDemand();
    const key = `${demand.visibleCount}:${demand.overscanCount}`;
    if (key === lastMaterializationDemandKey) return;
    lastMaterializationDemandKey = key;
    options.onMaterializationDemandChanged?.(demand);
  }

  function syncDrawings(): void {
    const state = drawingEditor.getState();
    const drawings = state.previewDrawing ? [...state.drawings, state.previewDrawing] : state.drawings;
    chartEngine.setDrawings(drawings.map((drawing) => projectDrawingObject(drawing, coordinateContext())));
    scheduler.invalidate({ layers: ["drawings"], reason: "drawingsChanged" });
  }

  function drawingAutoscalePrices(
    mode: PriceScaleMode,
    percentageBasePrice?: number
  ): number[] {
    const state = drawingEditor.getState();
    const candles = chartEngine.getState().series.candles;
    const lastIndex = candles.length - 1;
    if (lastIndex < 0) return [];
    const from = Math.max(0, Math.min(lastIndex, viewport.visibleRange.from));
    const to = Math.max(from, Math.min(lastIndex, viewport.visibleRange.to));
    const visibleFrom = candles[from]!.time;
    const visibleTo = candles[to]!.time;

    return state.drawings.flatMap((drawing) => {
      if (
        drawing.affectsPriceScale !== true ||
        drawing.visible === false ||
        (drawing.type !== "datePriceRange" && drawing.type !== "priceRange")
      ) return [];
      const anchors = drawing.anchors.slice(0, 2);
      if (
        anchors.length !== 2 ||
        anchors.some((anchor) =>
          !Number.isFinite(anchor.time) ||
          !Number.isFinite(anchor.price) ||
          (mode === "log" && (anchor.price ?? 0) <= 0)
        )
      ) return [];
      const times = anchors.map((anchor) => anchor.time!);
      if (Math.max(...times) < visibleFrom || Math.min(...times) > visibleTo) return [];
      if (mode === "percentage" && percentageBasePrice !== undefined) {
        const referenced: PriceScale = {
          mode,
          basePrice: percentageBasePrice,
          min: 0,
          max: 1
        };
        const extent = Math.max(...anchors.map((anchor) =>
          Math.abs(priceToScaleValue(anchor.price!, referenced))
        ));
        if (!Number.isFinite(extent) || !Number.isFinite(extent * 2)) return [];
      }
      return anchors.map((anchor) => anchor.price!);
    });
  }

  function symmetricIntradayScale(
    automatic: PriceScale,
    previousClose: number
  ): PriceScale | undefined {
    const referenced: PriceScale = {
      mode: "percentage",
      basePrice: previousClose,
      min: 0,
      max: 1
    };
    const referencedMin = priceToScaleValue(
      scaleValueToPrice(automatic.min, automatic),
      referenced
    );
    const referencedMax = priceToScaleValue(
      scaleValueToPrice(automatic.max, automatic),
      referenced
    );
    const extent = Math.max(Math.abs(referencedMin), Math.abs(referencedMax));
    const candidate = {
      ...referenced,
      min: -extent,
      max: extent
    };
    if (
      !Number.isFinite(referencedMin) ||
      !Number.isFinite(referencedMax) ||
      !Number.isFinite(extent) ||
      !Number.isFinite(candidate.max - candidate.min) ||
      !Number.isFinite(scaleValueToPrice(candidate.min, candidate)) ||
      !Number.isFinite(scaleValueToPrice(candidate.max, candidate))
    ) return undefined;
    return candidate;
  }

  function separatePaneConfigs(
    configs: readonly IndicatorConfig[] = indicatorConfigs
  ): Array<{ id: ChartPaneId; config: IndicatorConfig }> {
    return configs.flatMap((config) => {
      const id = options.paneIdFor?.(config) ??
        visualOutputs.find((output) =>
          output.id.startsWith(indicatorOutputPrefix(config.instanceId)) &&
          output.panelId !== undefined &&
          output.panelId !== "main"
        )?.panelId as ChartPaneId | undefined;
      return id === undefined ? [] : [{ id, config }];
    });
  }

  function reconcilePaneLayouts(configs: readonly IndicatorConfig[]): boolean {
    const before = JSON.stringify(paneOrder);
    const separate = separatePaneConfigs(configs);
    const ids = new Set<ChartPaneId>(["main", ...separate.map(({ id }) => id)]);
    for (const id of paneLayouts.keys()) {
      if (!ids.has(id)) paneLayouts.delete(id);
    }
    paneOrder = [
      "main",
      ...paneOrder.filter((id) => id !== "main" && ids.has(id)),
      ...separate.map(({ id }) => id).filter((id) => !paneOrder.includes(id))
    ];
    for (const { id } of separate) {
      if (paneLayouts.has(id)) continue;
      paneLayouts.set(id, {
        id,
        heightRatio: 1,
        collapsed: false,
        priceScale: { autoScale: true, inverted: false }
      });
    }
    return before !== JSON.stringify(paneOrder);
  }

  function paneIsVisible(id: ChartPaneId): boolean {
    if (id === "main") return true;
    return separatePaneConfigs().find((candidate) => candidate.id === id)?.config.visible ?? false;
  }

  function paneTitle(id: ChartPaneId): string {
    if (id === "main") return "Main";
    const config = separatePaneConfigs().find((candidate) => candidate.id === id)?.config;
    return config === undefined ? id : options.studyTitleFor?.(config) ?? config.id;
  }

  function rawRange(scale: PriceScale): ChartPriceRange {
    if (!validPriceScale(scale)) throw new RangeError("Chart pane price scale is invalid");
    const from = scaleValueToPrice(scale.min, scale);
    const to = scaleValueToPrice(scale.max, scale);
    const range = { from: Math.min(from, to), to: Math.max(from, to) };
    if (
      !Number.isFinite(range.from) ||
      !Number.isFinite(range.to) ||
      !Number.isFinite(range.to - range.from) ||
      range.from >= range.to
    ) {
      throw new RangeError("Chart pane price range is invalid");
    }
    return range;
  }

  function validPriceScale(scale: PriceScale): boolean {
    return Number.isFinite(scale.basePrice) &&
      Number.isFinite(scale.min) &&
      Number.isFinite(scale.max) &&
      scale.min < scale.max &&
      Number.isFinite(scale.max - scale.min) &&
      (scale.mode === "linear" || scale.basePrice > 0) &&
      Number.isFinite(scaleValueToPrice(scale.min, scale)) &&
      Number.isFinite(scaleValueToPrice(scale.max, scale));
  }

  function scaleForRange(
    range: Readonly<ChartPriceRange>,
    mode: PriceScaleMode,
    basePrice: number,
    inverted: boolean
  ): PriceScale {
    const provisional: PriceScale = { mode, basePrice, min: 0, max: 1 };
    const scale = {
      ...provisional,
      min: priceToScaleValue(range.from, provisional),
      max: priceToScaleValue(range.to, provisional),
      inverted
    };
    if (!validPriceScale(scale)) throw new RangeError("Chart pane price range is invalid");
    return scale;
  }

  function validatePaneLayouts(
    nextPanes: readonly ChartPaneLayout[],
    mainMode: PriceScaleMode
  ): void {
    for (const pane of nextPanes) {
      if (pane.priceScale.autoScale) continue;
      scaleForRange(
        pane.priceScale.visibleRange!,
        pane.id === "main" ? mainMode : "linear",
        pane.id === "main" ? priceScale.basePrice : 1,
        pane.priceScale.inverted
      );
    }
  }

  function visibleVisualOutput(output: IndicatorVisualOutput): IndicatorVisualOutput {
    const candles = chartEngine.getState().series.candles;
    const from = Math.max(0, Math.min(candles.length - 1, viewport.visibleRange.from));
    const to = Math.max(from, Math.min(candles.length - 1, viewport.visibleRange.to));
    const fromTime = candles[from]?.time;
    const toTime = candles[to]?.time;
    const visibleTime = (time: number) =>
      fromTime !== undefined && toTime !== undefined && time >= fromTime && time <= toTime;
    if (output.type === "line") {
      return { ...output, values: output.values.filter((point) => visibleTime(point.time)) };
    }
    if (output.type === "histogram") {
      return { ...output, values: output.values.filter((point) => visibleTime(point.time)) };
    }
    if (output.type === "band") {
      return {
        ...output,
        upper: output.upper.filter((point) => visibleTime(point.time)),
        lower: output.lower.filter((point) => visibleTime(point.time))
      };
    }
    return {
      ...output,
      marks: output.marks.filter((mark) =>
        mark.index === undefined
          ? visibleTime(mark.time)
          : mark.index >= from && mark.index <= to
      )
    };
  }

  function automaticPanelScale(outputs: readonly IndicatorVisualOutput[]): PriceScale {
    const range = mergeVisualAutoscaleRanges(outputs.map((output) =>
      visualRegistry.require(output.type).getAutoscale(visibleVisualOutput(output))
    ));
    try {
      const scale = createPriceScaleFromBounds(range ?? { min: 0, max: 1 }, 1, "linear");
      return validPriceScale(scale)
        ? scale
        : createPriceScaleFromBounds({ min: 0, max: 1 }, 1, "linear");
    } catch {
      return createPriceScaleFromBounds({ min: 0, max: 1 }, 1, "linear");
    }
  }

  function buildLayout(width: number, height: number): {
    layout: typeof layout;
    panels: typeof panels;
  } {
    const intraday = intradayLocked();
    const defaultLayout = createChartLayout(width, height, { leftPriceAxis: intraday });
    const theme = currentTheme();
    const rawLabels = formatPrice === undefined
      ? []
      : [
          scaleValueToPrice(priceScale.min, priceScale),
          scaleValueToPrice(priceScale.max, priceScale),
          materialized?.series.candles.at(-1)?.close
        ]
          .filter((price): price is number => typeof price === "number" && Number.isFinite(price))
          .map(formatPrice);
    let rawAxisWidth = 64;
    if (rawLabels.length > 0) {
      let measuredWidths = rawLabels.map((label) => label.length * 7);
      try {
        const context = options.staticCanvas.getContext("2d");
        context?.save();
        if (context) {
          context.font = `${theme.typography.fontSize}px ${theme.typography.fontFamily}`;
          measuredWidths = rawLabels.map((label) => context.measureText(label).width);
        }
        context?.restore();
      } catch {
        // The render error boundary owns Canvas failures; label length remains a safe layout estimate.
      }
      rawAxisWidth = Math.max(
        64,
        Math.ceil(
          Math.max(...measuredWidths) + theme.spacing.axisPadding + 4
        )
      );
    }
    const desiredRightAxisWidth = intraday || viewport.priceScaleMode === "percentage"
      ? 64
      : rawAxisWidth;
    const rightAxisWidth = Math.min(desiredRightAxisWidth, Math.max(0, width));
    const leftAxisWidth = intraday
      ? Math.min(rawAxisWidth, Math.max(0, width - rightAxisWidth))
      : 0;
    const plotWidth = Math.max(0, width - leftAxisWidth - rightAxisWidth);
    const base = {
      ...defaultLayout,
      leftAxisWidth,
      rightAxisWidth,
      leftPriceAxisArea: { ...defaultLayout.leftPriceAxisArea, width: leftAxisWidth },
      plotArea: { ...defaultLayout.plotArea, x: leftAxisWidth, width: plotWidth },
      priceAxisArea: {
        ...defaultLayout.priceAxisArea,
        x: leftAxisWidth + plotWidth,
        width: rightAxisWidth
      },
      volumeArea: {
        ...defaultLayout.volumeArea,
        x: leftAxisWidth,
        width: plotWidth
      },
      timeAxisArea: {
        ...defaultLayout.timeAxisArea,
        x: leftAxisWidth,
        width: plotWidth
      }
    };
    const activeIds = paneOrder.filter((id) => {
      const pane = paneLayouts.get(id);
      return pane !== undefined && paneIsVisible(id) && !pane.collapsed;
    });
    const contentTop = base.plotArea.y;
    const contentHeight = Math.max(0, base.timeAxisArea.y - contentTop);
    const panelAreas = createPanelLayout({
      width: base.plotArea.width + base.rightAxisWidth,
      height: contentHeight,
      rightAxisWidth: base.rightAxisWidth,
      bottomAxisHeight: 0,
      panels: activeIds.map((id) => ({
        id,
        kind: id === "main" ? "main" as const : "sub" as const,
        label: paneTitle(id),
        heightRatio: paneLayouts.get(id)!.heightRatio
      }))
    }).map((panel) => ({
      ...panel,
      plotArea: {
        ...panel.plotArea,
        x: panel.plotArea.x + base.plotArea.x,
        y: panel.plotArea.y + contentTop
      },
      priceAxisArea: {
        ...panel.priceAxisArea,
        x: panel.priceAxisArea.x + base.plotArea.x,
        y: panel.priceAxisArea.y + contentTop
      }
    }));
    const mainGroup = panelAreas.find((panel) => panel.id === "main")!;
    const baseGap = Math.max(
      0,
      base.volumeArea.y - base.plotArea.y - base.plotArea.height
    );
    const volumeRatio = contentHeight === 0
      ? 0
      : base.volumeArea.height / contentHeight;
    const volumeHeight = Math.floor(mainGroup.plotArea.height * volumeRatio);
    const volumeGap = volumeHeight > 0
      ? Math.min(baseGap, Math.max(0, mainGroup.plotArea.height - volumeHeight - 1))
      : 0;
    const mainPlotHeight = Math.max(
      0,
      mainGroup.plotArea.height - volumeGap - volumeHeight
    );
    const mainPlotArea = { ...mainGroup.plotArea, height: mainPlotHeight };
    const mainAxisArea = { ...mainGroup.priceAxisArea, height: mainPlotHeight };
    const nextPanels = panelAreas.map((panel) => panel.id === "main"
      ? { ...panel, plotArea: mainPlotArea, priceAxisArea: mainAxisArea }
      : panel);
    return {
      layout: {
        ...base,
        leftPriceAxisArea: {
          ...base.leftPriceAxisArea,
          y: mainPlotArea.y,
          height: mainPlotArea.height
        },
        plotArea: mainPlotArea,
        priceAxisArea: mainAxisArea,
        volumeArea: {
          x: mainPlotArea.x,
          y: mainPlotArea.y + mainPlotArea.height + volumeGap,
          width: mainPlotArea.width,
          height: volumeHeight
        }
      },
      panels: nextPanels
    };
  }

  function currentTheme() {
    const style = options.getComputedStyle?.(options.themeRoot) ??
      (typeof getComputedStyle === "function" ? getComputedStyle(options.themeRoot) : undefined);
    return style === undefined
      ? defaultChartTheme
      : readWorkspaceChartTheme(options.themeRoot, style);
  }

  function syncLayout(): void {
    const width = Math.max(1, Math.floor(options.themeRoot.clientWidth || options.staticCanvas.clientWidth || 1));
    const height = Math.max(1, Math.floor(options.themeRoot.clientHeight || options.staticCanvas.clientHeight || 1));
    const next = buildLayout(width, height);
    const nextLayout = next.layout;
    const changed =
      nextLayout.width !== layout.width ||
      nextLayout.height !== layout.height ||
      nextLayout.plotArea.x !== layout.plotArea.x ||
      nextLayout.plotArea.width !== layout.plotArea.width ||
      nextLayout.plotArea.height !== layout.plotArea.height ||
      JSON.stringify(next.panels) !== JSON.stringify(panels);
    if (changed && activePointerId !== undefined) {
      cancelPointerInteraction("pointerCancel");
    }
    layout = nextLayout;
    panels = next.panels;
    const series = chartEngine.getState().series;
    if (changed) {
      timeCoordinates = materialized?.intradayDays === undefined
        ? undefined
        : createIntradayTimeCoordinates(materialized.series.candles, layout.plotArea.width);
      viewport = materialized !== undefined && intradayLocked()
        ? { ...initialViewportFor(materialized), priceScaleMode: viewport.priceScaleMode }
        : constrainViewportToWidth(viewport, series.candles.length, layout.plotArea.width);
      chartEngine.setViewport(viewport);
      const pointToRestore = crosshairPoint === undefined ? undefined : { ...crosshairPoint };
      rebuildInteraction();
      if (pointToRestore !== undefined) {
        crosshairPoint = pointToRestore;
        refreshCrosshairAtPoint();
      }
      options.onViewportChanged?.(viewport);
      emitVisibleRange();
      emitMaterializationDemand();
      if (!crosshair) emitDataWindow();
    }
  }

  function updatePriceScale(): void {
    const state = chartEngine.getState();
    const mainPane = paneLayouts.get("main")!;
    const intradayScale = materialized?.intradayScale;
    const outputs = activeVisualOutputs();
    let drawingPrices = drawingAutoscalePrices(
      intradayScale === undefined ? viewport.priceScaleMode : "percentage",
      intradayScale?.previousClose
    );
    const createAutomaticScale = (prices: readonly number[]) =>
      createMainPanelPriceScale(
        state.series,
        viewport.visibleRange,
        intradayScale === undefined ? viewport.priceScaleMode : "percentage",
        outputs,
        intradayAverage === undefined ? [] : [intradayAverage],
        prices,
        intradayScale?.previousClose
      );
    if (intradayScale !== undefined && intradayScale.priceLimitPercent === undefined) {
      let acceptedPrices: number[] = [];
      for (let index = 0; index < drawingPrices.length; index += 2) {
        const candidatePrices = [...acceptedPrices, ...drawingPrices.slice(index, index + 2)];
        if (
          symmetricIntradayScale(
            createAutomaticScale(candidatePrices),
            intradayScale.previousClose
          ) !== undefined
        ) acceptedPrices = candidatePrices;
      }
      drawingPrices = acceptedPrices;
    }
    const automatic = createAutomaticScale(drawingPrices);
    if (!mainPane.priceScale.autoScale && mainPane.priceScale.visibleRange !== undefined) {
      manualPriceScale = scaleForRange(
        mainPane.priceScale.visibleRange,
        automatic.mode,
        automatic.basePrice,
        mainPane.priceScale.inverted
      );
    }
    if (intradayScale === undefined) {
      priceScale = manualPriceScale ?? automatic;
    } else if (manualPriceScale !== undefined) {
      priceScale = manualPriceScale;
    } else if (intradayScale.priceLimitPercent !== undefined) {
      const comparisonPrices = outputs.flatMap((output) => {
        if (output.coordinateSpace !== "percentage" || output.type !== "line") return [];
        let minimum = Number.POSITIVE_INFINITY;
        let maximum = Number.NEGATIVE_INFINITY;
        for (const point of output.values) {
          if (point.value === null || !Number.isFinite(point.value)) continue;
          minimum = Math.min(minimum, point.value);
          maximum = Math.max(maximum, point.value);
        }
        if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return [];
        return [
          intradayScale.previousClose * (1 + minimum / 100),
          intradayScale.previousClose * (1 + maximum / 100)
        ];
      });
      const extent = calculateFixedIntradayPercentExtent(
        state.series.candles,
        intradayScale.previousClose,
        intradayScale.priceLimitPercent,
        [...drawingPrices, ...comparisonPrices]
      );
      priceScale = {
        mode: "percentage",
        basePrice: intradayScale.previousClose,
        min: -extent,
        max: extent
      };
    } else {
      priceScale =
        symmetricIntradayScale(automatic, intradayScale.previousClose) ??
        automatic;
    }
    priceScale = { ...priceScale, inverted: mainPane.priceScale.inverted };
    panelPriceScales = new Map([["main", priceScale]]);
    for (const id of paneOrder) {
      if (id === "main") continue;
      const pane = paneLayouts.get(id);
      if (pane === undefined) continue;
      const outputs = visualOutputs.filter((output) => (output.panelId ?? "main") === id);
      panelPriceScales.set(
        id,
        pane.priceScale.autoScale
          ? {
              ...automaticPanelScale(outputs),
              inverted: pane.priceScale.inverted
            }
          : scaleForRange(
              pane.priceScale.visibleRange!,
              "linear",
              1,
              pane.priceScale.inverted
            )
      );
    }
    interaction?.setPriceScale(priceScale);
    syncDrawings();
  }

  function refreshDrawingScale(reason: string): void {
    updatePriceScale();
    refreshCrosshairAtPoint();
    scheduler.invalidate({
      layers: ["axis", "series", "indicators", "visuals", "drawings", "crosshair"],
      reason
    });
  }

  function applyViewport(next: ViewportState, reason: string, replaceInteraction: boolean): void {
    viewport = materialized !== undefined && intradayLocked()
      ? { ...initialViewportFor(materialized), priceScaleMode: viewport.priceScaleMode }
      : next;
    chartEngine.setViewport(viewport);
    if (replaceInteraction) rebuildInteraction();
    else updatePriceScale();
    options.onViewportChanged?.(viewport);
    emitVisibleRange();
    emitMaterializationDemand();
    if (!crosshair) emitDataWindow();
    const candles = chartEngine.getState().series.candles;
    if (viewport.visibleRange.from <= 5) {
      options.onMaterializedBoundary?.(
        "before",
        candles[Math.max(0, Math.min(candles.length - 1, viewport.visibleRange.from))]?.time
      );
    }
    if (viewport.visibleRange.to >= candles.length - 6) {
      options.onMaterializedBoundary?.(
        "after",
        candles[Math.max(0, Math.min(candles.length - 1, viewport.visibleRange.to))]?.time
      );
    }
    scheduler.invalidate({
      layers: ["axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"],
      reason
    });
  }

  function queueCrosshairEvent(
    nextCrosshair: ChartCrosshairState | undefined,
    point?: { x: number; y: number }
  ): void {
    if (crosshairEventsSuspended) return;
    if (
      options.onCrosshairChanged === undefined ||
      (options.hasCrosshairListeners !== undefined && !options.hasCrosshairListeners())
    ) {
      pendingCrosshairEvent = undefined;
      return;
    }
    pendingCrosshairEvent = nextCrosshair === undefined
      ? { crosshair: undefined }
      : point === undefined
        ? undefined
        : { crosshair: { ...nextCrosshair }, point: { ...point } };
  }

  function previousCloseAt(index: number, candle: Readonly<Candle>): number {
    return materialized?.intradayScale?.previousClose
      ?? chartEngine.getState().series.candles[index - 1]?.close
      ?? candle.open;
  }

  function crosshairReferencePriceAt(index: number): number | undefined {
    if (materialized?.intradayDays !== undefined) {
      return materialized.intradayScale?.previousClose;
    }
    return chartEngine.getState().series.candles[index - 1]?.close;
  }

  function comparisonRowsAt(time: number): DataWindowComparisonRow[] {
    const mainCandles = chartEngine.getState().series.candles;
    return comparisonData
      .filter((snapshot) =>
        snapshot.status === "ready" &&
        snapshot.comparison.visible !== false
      )
      .map((snapshot) => {
        const input = {
          comparison: snapshot.comparison,
          mainCandles,
          comparisonCandles: snapshot.candles,
          visibleRange: viewport.visibleRange,
          ...(snapshot.previousClose === undefined
            ? {}
            : { previousClose: snapshot.previousClose })
        };
        const base = comparisonBaseValue(input);
        const raw = comparisonValueAtTime(snapshot.candles, time);
        const value =
          raw !== undefined && Number.isFinite(raw) && raw > 0 ? raw : null;
        return {
          symbolId: snapshot.comparison.symbol.id,
          code: snapshot.comparison.symbol.code,
          name: snapshot.comparison.symbol.name,
          ...(snapshot.comparison.symbol.pricePrecision === undefined
            ? {}
            : { pricePrecision: snapshot.comparison.symbol.pricePrecision }),
          label: `${snapshot.comparison.symbol.name} ${snapshot.comparison.symbol.code}`,
          ...(snapshot.comparison.color === undefined
            ? {}
            : { color: snapshot.comparison.color }),
          value,
          changePercent:
            value === null ||
            base === undefined ||
            !Number.isFinite(base) ||
            base <= 0
              ? null
              : (value / base - 1) * 100,
          ...(snapshot.dataVersion === undefined
            ? {}
            : { dataVersion: snapshot.dataVersion })
        };
      });
  }

  function buildCrosshairSnapshot(
    pending: Extract<NonNullable<typeof pendingCrosshairEvent>, { crosshair: ChartCrosshairState }>
  ): RuntimeCrosshairSnapshot | undefined {
    const candles = chartEngine.getState().series.candles;
    const candle = candles[pending.crosshair.index];
    if (
      materialized === undefined ||
      candle === undefined ||
      candle.time !== pending.crosshair.time
    ) return undefined;
    const valueAt = (points: readonly { time: number; value: number | null }[]): number | null => {
      const aligned = points[pending.crosshair.index];
      return (aligned?.time === candle.time
        ? aligned
        : points.find((point) => point.time === candle.time))?.value ?? null;
    };
    const studies = indicatorConfigs
      .filter((config) => config.visible)
      .map((config): RuntimeCrosshairStudyValues => {
        const prefix = indicatorOutputPrefix(config.instanceId);
        const outputs = visualOutputs
          .filter((output) => output.id.startsWith(prefix))
          .map((output): ChartCrosshairStudyOutput => {
            const id = output.id.slice(prefix.length);
            if (output.type === "band") {
              return {
                id,
                title: output.label,
                type: "band",
                upper: valueAt(output.upper),
                lower: valueAt(output.lower)
              };
            }
            if (output.type === "marker") {
              const aligned = output.marks[pending.crosshair.index];
              const mark = aligned?.time === candle.time
                ? aligned
                : output.marks.find((candidate) => candidate.time === candle.time);
              return {
                id,
                title: output.label,
                type: "marker",
                value: mark?.price ?? null
              };
            }
            return {
              id,
              title: output.label,
              type: output.type,
              value: valueAt(output.values)
            };
          });
        return {
          indicator: {
            ...config,
            params: { ...config.params }
          },
          title: `${options.studyTitleFor?.(config) ?? config.id} ${Object.values(config.params).join(",")}`.trim(),
          outputs
        };
      });
    const referencePrice = crosshairReferencePriceAt(pending.crosshair.index);
    const change = referencePrice === undefined ? null : candle.close - referencePrice;
    const comparisons = comparisonRowsAt(candle.time);
    return {
      symbolId: materialized.selection.symbol.id,
      timeframe: materialized.selection.timeframe,
      adjustMode: materialized.selection.adjustMode,
      dataVersion: materialized.series.dataVersion,
      crosshair: { ...pending.crosshair },
      offsetX: pending.point.x,
      offsetY: pending.point.y,
      candle: { ...candle },
      referencePrice: referencePrice ?? null,
      change,
      changePercent: referencePrice === undefined || referencePrice === 0
        ? null
        : ((candle.close - referencePrice) / referencePrice) * 100,
      studies,
      comparisons
    };
  }

  function flushCrosshairEvent(): void {
    const pending = pendingCrosshairEvent;
    pendingCrosshairEvent = undefined;
    if (
      pending === undefined ||
      options.onCrosshairChanged === undefined ||
      (options.hasCrosshairListeners !== undefined && !options.hasCrosshairListeners())
    ) {
      if (resumeCrosshairEventsAfterFlush) {
        resumeCrosshairEventsAfterFlush = false;
        crosshairEventsSuspended = false;
        queueCurrentCrosshairAfterResume();
      }
      return;
    }
    if (pending.crosshair === undefined) options.onCrosshairChanged(undefined);
    else {
      const snapshot = buildCrosshairSnapshot(pending);
      if (snapshot !== undefined) options.onCrosshairChanged(snapshot);
    }
    if (resumeCrosshairEventsAfterFlush) {
      resumeCrosshairEventsAfterFlush = false;
      crosshairEventsSuspended = false;
      queueCurrentCrosshairAfterResume();
    }
  }

  function queueCurrentCrosshairAfterResume(): void {
    if (crosshair === undefined || crosshairPoint === undefined) return;
    queueCrosshairEvent(crosshair, crosshairPoint);
    if (pendingCrosshairEvent?.crosshair !== undefined) {
      scheduler.invalidate({ layers: ["crosshair"], reason: "crosshairEventsResumed" });
    }
  }

  function clearCrosshairState(): boolean {
    crosshairPane = undefined;
    if (crosshair === undefined) return false;
    crosshair = undefined;
    crosshairPoint = undefined;
    queueCrosshairEvent(undefined);
    session.handleInput({ type: "crosshair", crosshair });
    chartEngine.setInteractionState(session.getState());
    return true;
  }

  function refreshCrosshairAtPoint(): void {
    if (crosshairPoint === undefined || interaction === undefined) return;
    const mapped = mapCrosshairPoint(crosshairPoint);
    crosshairPane = mapped.pane;
    interactionEventPoint = crosshairPoint;
    try {
      interaction.handlePointerMove(mapped.point);
    } finally {
      interactionEventPoint = undefined;
    }
  }

  function mapCrosshairPoint(point: { x: number; y: number }): {
    point: { x: number; y: number };
    pane?: { id: string; y: number };
  } {
    const panel = panels.find(({ plotArea }) =>
      point.x >= plotArea.x &&
      point.x <= plotArea.x + plotArea.width &&
      point.y >= plotArea.y &&
      point.y <= plotArea.y + plotArea.height
    );
    if (panel === undefined || panel.id === "main" || panel.plotArea.height <= 0) {
      return { point };
    }
    const relativeY = (point.y - panel.plotArea.y) / panel.plotArea.height;
    return {
      point: {
        x: point.x,
        y: layout.plotArea.y + relativeY * layout.plotArea.height
      },
      pane: { id: panel.id, y: point.y }
    };
  }

  function rebuildInteraction(): void {
    clearCrosshairState();
    updatePriceScale();
    const state = chartEngine.getState();
    interaction = createInteractionEngine({
      series: state.series,
      viewport,
      priceScale,
      width: layout.plotArea.width,
      plotLeft: layout.plotArea.x,
      plotTop: layout.plotArea.y,
      plotHeight: layout.plotArea.height,
      ...(timeCoordinates === undefined ? {} : { timeCoordinates }),
      onEvent(event) {
        if (event.type === "viewportChanged") {
          applyViewport(event.viewport, "viewportChanged", false);
          return;
        }
        const previousCrosshair = crosshair;
        crosshair = event.crosshair;
        if (crosshair === undefined) {
          crosshairPoint = undefined;
          if (previousCrosshair !== undefined) queueCrosshairEvent(undefined);
        } else {
          crosshairPoint = interactionEventPoint ?? crosshairPoint;
          queueCrosshairEvent(crosshair, crosshairPoint);
        }
        session.handleInput({ type: "crosshair", crosshair });
        chartEngine.setInteractionState(session.getState());
        emitDataWindow();
        scheduler.invalidate({ layers: ["crosshair", "tooltip"], reason: "crosshairMoved" });
      }
    });
  }

  function emitDataWindow(force = false): void {
    const candles = chartEngine.getState().series.candles;
    const fallbackIndex = viewport.visibleRange.to >= 0
      ? Math.min(candles.length - 1, viewport.visibleRange.to)
      : candles.length - 1;
    const index = crosshair && candles[crosshair.index] ? crosshair.index : fallbackIndex;
    const candle = candles[index];
    if (!candle) {
      lastDataWindowIndex = undefined;
      if (dataWindowVisible) options.onDataWindowChanged?.(undefined);
      dataWindowVisible = false;
      return;
    }
    if (!force && lastDataWindowIndex === index) return;
    const snapshotCrosshair = crosshair && crosshair.index === index
      ? crosshair
      : {
          index,
          time: candle.time,
          price: candle.close,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          turnover: candle.turnover
        };
    const previousClose = previousCloseAt(index, candle);
    const change = candle.close - previousClose;
    const indicatorRows = indicatorConfigs
      .filter((config) => config.visible)
      .map((config) => {
        const output = visualOutputs.find(
          (candidate) => candidate.id.startsWith(indicatorOutputPrefix(config.instanceId))
        );
        let value: number | null | undefined;
        if (output?.type === "line") value = output.values.find((point) => point.time === candle.time)?.value;
        else if (output?.type === "histogram") value = output.values.find((point) => point.time === candle.time)?.value;
        else if (output?.type === "band") value = output.upper.find((point) => point.time === candle.time)?.value;
        return {
          id: config.instanceId,
          label: `${options.studyTitleFor?.(config) ?? config.id} ${Object.values(config.params).join(",")}`,
          value: typeof value === "number" ? String(value) : "--"
        };
      });
    const comparisonRows = comparisonRowsAt(candle.time);
    options.onDataWindowChanged?.({
      crosshair: snapshotCrosshair,
      candle: { ...candle },
      formattedTime: formatShanghaiTime(candle.time, chartEngine.getState().series.timeframe),
      change,
      changePercent: previousClose === 0 ? 0 : (change / previousClose) * 100,
      indicatorRows,
      ...(comparisonRows.length === 0 ? {} : { comparisonRows }),
      ...(currentPricePrecision === undefined ? {} : { pricePrecision: currentPricePrecision }),
      ...(currentIntradaySummary === undefined
        ? {}
        : { intradaySummary: { ...currentIntradaySummary } })
    });
    lastDataWindowIndex = index;
    dataWindowVisible = true;
  }

  function render(pass: "static" | "dynamic" | "overlay"): void {
    if (destroyed || pass === "dynamic") return;
    try {
      if (pass === "static") syncLayout();
      const state = chartEngine.getState();
      const theme = currentTheme();
      const panels = createPanels();
      const outputs = activeVisualOutputs();
      const renderState = {
        series: state.series,
        seriesType: state.seriesType,
        ...(seriesModel === undefined ? {} : { seriesModel }),
        viewport,
        priceScale,
        formatTime: formatShanghaiTime,
        ...(formatPrice === undefined ? {} : { formatPrice }),
        theme,
        layout,
        panels,
        panelPriceScales,
        visualOutputs: outputs,
        drawings: state.drawings,
        selectedDrawingIds: drawingEditor.getState().selectedDrawingIds,
        hoveredDrawingId,
        crosshair,
        ...(crosshairPane === undefined ? {} : { crosshairPane }),
        ...(executionTooltip === undefined
          ? {}
          : { visualTooltip: options.onExecutionTooltipChanged === undefined
              ? executionTooltip
              : { x: executionTooltip.x, y: executionTooltip.y, rows: [] } }),
        ...(intradayAverage === undefined ? {} : { movingAverages: [intradayAverage] }),
        ...(timeCoordinates === undefined ? {} : { timeCoordinates }),
        locale: options.themeRoot.lang === "en-US" ? "en-US" as const : "zh-CN" as const,
        ...(materialized?.intradayDays === undefined
          ? {}
          : { intradayDays: materialized.intradayDays })
      };
      if (pass === "overlay") {
        options.onExecutionTooltipChanged?.(executionTooltip === undefined
          ? undefined
          : { ...executionTooltip, pinned: executionTooltipPinned });
        const context = resizeCanvas(options.overlayCanvas, layout.width, layout.height, options.devicePixelRatio ?? 1);
        renderOverlay({ context, state: renderState });
        flushCrosshairEvent();
      } else if (pass === "static") {
        const context = resizeCanvas(options.staticCanvas, layout.width, layout.height, options.devicePixelRatio ?? 1);
        const layers = createStaticLayers();
        if (state.settings.gridVisible === false) layers.splice(layers.findIndex((layer) => layer.id === "grid"), 1);
        layers.push(createVisualLayer(visualRegistry), createDrawingLayer(drawingRegistry));
        renderStaticChart({ context, state: renderState }, layers, { clear: true, paintBackground: true });
        if (
          renderRecoveryPending &&
          activeIndicatorGeneration !== indicatorGeneration &&
          activeSeriesGeneration !== seriesGeneration &&
          !indicatorCalculationFailed &&
          failedSeriesCalculation === undefined
        ) {
          renderRecoveryPending = false;
          options.onRenderRecovered?.();
        }
      }
    } catch (error) {
      if (pass === "overlay") {
        pendingCrosshairEvent = undefined;
        if (resumeCrosshairEventsAfterFlush) {
          resumeCrosshairEventsAfterFlush = false;
          crosshairEventsSuspended = false;
        }
      }
      options.onRenderError?.(error);
    }
  }

  function createPanels() {
    return panels;
  }

  function markerAt(output: IndicatorMarkerOutput | undefined, point: { x: number; y: number }) {
    if (output === undefined) return undefined;
    const state = chartEngine.getState();
    const theme = currentTheme();
    const panels = createPanels();
    const panel = panels.find((candidate) => candidate.id === "main");
    if (!panel) return undefined;
    const renderer = visualRegistry.require("marker");
    const hit = renderer.hitTest({
      output,
      panel,
      state: {
        series: state.series,
        viewport,
        priceScale,
        formatTime: formatShanghaiTime,
        theme,
        layout,
        panels,
        visualOutputs: activeVisualOutputs(),
        ...(timeCoordinates === undefined ? {} : { timeCoordinates })
      },
      valueScale: priceScale,
      valueRange: renderer.getAutoscale(output)
    }, point.x, point.y);
    return hit?.distance !== undefined && hit.distance <= 14
      ? output.marks.find((mark) => mark.id === hit.itemId)
      : undefined;
  }

  function studyAt(point: { x: number; y: number }): string | undefined {
    if (visualOutputs.length === 0) return undefined;
    const state = chartEngine.getState();
    const panels = createPanels();
    const theme = currentTheme();
    const panel = [...panels].reverse().find(({ plotArea }) =>
      point.x >= plotArea.x &&
      point.x <= plotArea.x + plotArea.width &&
      point.y >= plotArea.y &&
      point.y <= plotArea.y + plotArea.height
    );
    if (!panel) return undefined;
    const activeOutputs = visualOutputs.filter((output) =>
      output.visible !== false && (output.panelId ?? "main") === panel.id
    );
    const valueRange = mergeVisualAutoscaleRanges(activeOutputs.map((output) =>
      visualRegistry.require(output.type).getAutoscale(output)
    ));
    const hits = [...activeOutputs].reverse()
      .map((output) => {
        const renderer = visualRegistry.require(output.type);
        return renderer.hitTest({
          output,
          panel,
          state: {
            series: state.series,
            viewport,
            priceScale,
            formatTime: formatShanghaiTime,
            theme,
            layout,
            panels,
            visualOutputs: activeOutputs,
            ...(timeCoordinates === undefined ? {} : { timeCoordinates })
          },
          valueScale: panelPriceScales.get(panel.id) ??
            createPriceScaleFromBounds(valueRange ?? { min: 0, max: 1 }, 1, "linear"),
          valueRange
        }, point.x, point.y);
      });
    const hit = chooseNearestVisualHit(hits);
    if (!hit || hit.distance > 14) return undefined;
    return indicatorConfigs.find((config) =>
      hit.outputId.startsWith(indicatorOutputPrefix(config.instanceId))
    )?.instanceId;
  }

  function updateExecutionTooltip(
    point: { x: number; y: number },
    pinned = false
  ): readonly ChartExecution[] | undefined {
    const mark = markerAt(executionOutput, point);
    if (!mark) {
      if (!executionTooltipPinned) clearExecutionTooltip();
      return undefined;
    }
    executionTooltipPinned = pinned;
    executionTooltip = {
      markId: mark.id,
      x: point.x,
      y: point.y,
      ...(mark.label === undefined ? {} : { title: mark.label }),
      rows: executionTooltipRows(
        mark,
        options.themeRoot.lang === "en-US" ? "en-US" : "zh-CN",
        formatPrice
      )
    };
    scheduler.invalidate({ layers: ["tooltip"], reason: "executionTooltipChanged" });
    return executionsFromMark(mark);
  }

  function clearExecutionTooltip(): void {
    if (executionTooltip === undefined && !executionTooltipPinned) return;
    executionTooltip = undefined;
    executionTooltipPinned = false;
    scheduler.invalidate({ layers: ["tooltip"], reason: "executionTooltipClosed" });
  }

  function invalidateDrawingInteraction(reason: string): void {
    scheduler.invalidate({ layers: ["drawings", "crosshair", "tooltip"], reason });
  }

  function updateDrawingHover(point: { x: number; y: number }): void {
    const state = drawingEditor.getState();
    if (state.activeTool !== "select") {
      hoveredDrawingId = undefined;
      session.handleInput({ type: "cursor", cursor: "drawing" });
      return;
    }
    const projectedDrawings = state.drawings.map((drawing) => projectDrawingObject(drawing, coordinateContext()));
    const hover = getDrawingHoverState({
      drawings: projectedDrawings,
      point,
      handles: drawingEditor.getSelectedEditHandles(),
      registry: drawingRegistry,
      handleHitTestOptions: { radius: 10 }
    });
    if (hoveredDrawingId !== hover.hoveredDrawingId) {
      hoveredDrawingId = hover.hoveredDrawingId;
      invalidateDrawingInteraction("drawingHoverChanged");
    }
    session.handleInput({ type: "cursor", cursor: hover.cursor });
  }

  function handleDrawingPointerDown(point: { x: number; y: number }): boolean | string {
    const state = drawingEditor.getState();
    hoveredDrawingId = undefined;
    if (state.activeTool !== "select") {
      drawingEditor.pointerDown(drawingPointFromPointer(point, coordinateContext()));
      return true;
    }
    const handle = hitTestDrawingEditHandle(drawingEditor.getSelectedEditHandles(), point, { radius: 10 });
    if (handle) {
      drawingHandleDragOperation = beginDrawingHandleDrag({
        handle,
        drawings: state.drawings,
        selectedDrawingIds: state.selectedDrawingIds,
        startPoint: point
      });
      if (drawingHandleDragOperation) return handle.drawingId;
    }
    const projectedDrawings = state.drawings.map((drawing) => projectDrawingObject(drawing, coordinateContext()));
    const hit = hitTestDrawing(projectedDrawings, point, { registry: drawingRegistry })?.drawing;
    if (!hit) {
      return false;
    }
    if (!state.selectedDrawingIds.includes(hit.id)) drawingEditor.selectDrawing(hit.id);
    const selected = drawingEditor.getState();
    drawingMoveDragOperation = beginDrawingMoveDrag({
      drawings: selected.drawings.map((drawing) => projectDrawingObject(drawing, coordinateContext())),
      selectedDrawingIds: selected.selectedDrawingIds,
      startPoint: point
    });
    return hit.id;
  }

  function handleDrawingPointerMove(point: { x: number; y: number }): boolean {
    if (drawingEditor.getState().activeTool !== "select") {
      drawingEditor.pointerMove(drawingPointFromPointer(point, coordinateContext()));
      return true;
    }
    if (drawingHandleDragOperation) {
      const preview = updateDrawingHandleDrag(drawingHandleDragOperation, point);
      if (preview) chartEngine.setDrawings(preview.drawings);
      invalidateDrawingInteraction("drawingHandleDragPreview");
      return true;
    }
    if (drawingMoveDragOperation) {
      const preview = updateDrawingMoveDrag(drawingMoveDragOperation, point);
      if (preview) chartEngine.setDrawings(preview.drawings);
      invalidateDrawingInteraction("drawingMoveDragPreview");
      return true;
    }
    return false;
  }

  function handleDrawingPointerUp(point: { x: number; y: number }): boolean {
    if (drawingEditor.getState().activeTool !== "select") {
      drawingEditor.pointerUp(drawingPointFromPointer(point, coordinateContext()));
      return true;
    }
    if (drawingHandleDragOperation) {
      const command = finishDrawingHandleDrag(drawingHandleDragOperation, point);
      drawingHandleDragOperation = undefined;
      if (command) drawingEditor.executeCommand(command);
      else syncDrawings();
      return true;
    }
    if (drawingMoveDragOperation) {
      const command = finishDrawingMoveDrag(drawingMoveDragOperation, point);
      drawingMoveDragOperation = undefined;
      if (command) drawingEditor.executeCommand(command);
      else syncDrawings();
      return true;
    }
    return false;
  }

  function resetChartView(resetPriceScale = true): void {
    let paneScaleReset = false;
    if (resetPriceScale) {
      manualPriceScale = undefined;
      for (const [id, pane] of paneLayouts) {
        if (pane.priceScale.autoScale && pane.priceScale.visibleRange === undefined) continue;
        paneScaleReset = true;
        paneLayouts.set(id, {
          ...pane,
          priceScale: {
            autoScale: true,
            inverted: pane.priceScale.inverted
          }
        });
      }
    }
    const initial = materialized === undefined
      ? createInitialViewport(chartEngine.getState().series.candles.length, layout.plotArea.width)
      : initialViewportFor(materialized);
    applyViewport({
      ...initial,
      priceScaleMode: viewport.priceScaleMode
    }, "resetToLatest", true);
    if (paneScaleReset) options.onPaneLayoutChanged?.();
  }

  function fitContent(): void {
    if (intradayLocked()) return;
    const candles = chartEngine.getState().series.candles;
    if (candles.length === 0) return;
    applyViewport(constrainViewportToWidth({
      ...viewport,
      candleWidth: layout.plotArea.width / candles.length,
      scrollOffset: 0
    }, candles.length, layout.plotArea.width), "fitContent", true);
  }

  function zoomChart(deltaY: number): void {
    const candles = chartEngine.getState().series.candles;
    if (candles.length === 0) return;
    const anchor = Math.floor((viewport.visibleRange.from + viewport.visibleRange.to) / 2);
    applyViewport(
      zoomViewportAtIndex(viewport, anchor, deltaY, candles.length, layout.plotArea.width),
      "keyboardZoom",
      true
    );
  }

  function panChart(deltaX: number, reason: string): void {
    applyViewport(
      panViewportByPixels(viewport, deltaX, chartEngine.getState().series.candles.length),
      reason,
      true
    );
  }

  function cancelPointerInteraction(input: "pointerCancel" | "leave" | "blur"): void {
    pendingClick = undefined;
    drawingEditor.cancel();
    drawingHandleDragOperation = undefined;
    drawingMoveDragOperation = undefined;
    if (priceAxisDrag?.paneId === "main") manualPriceScale = undefined;
    priceAxisDrag = undefined;
    timeAxisDrag = undefined;
    hoveredDrawingId = undefined;
    if (activePointerId !== undefined) release(activePointerId);
    activePointerId = undefined;
    clearCrosshairState();
    session.handleInput({ type: input });
    chartEngine.setInteractionState(session.getState());
    emitDataWindow();
    syncDrawings();
    rebuildInteraction();
    invalidateDrawingInteraction(input);
  }

  function handleKeyboard(event: KeyboardEvent): boolean {
    const modifier = event.metaKey || event.ctrlKey;
    if (event.altKey && event.key.toLowerCase() === "r") {
      if (intradayLocked()) return true;
      resetChartView();
      return true;
    }
    if (modifier && event.key === "ArrowUp") {
      if (intradayLocked()) return true;
      zoomChart(-1);
      return true;
    }
    if (modifier && event.key === "ArrowDown") {
      if (intradayLocked()) return true;
      zoomChart(1);
      return true;
    }
    if (modifier && event.key.toLowerCase() === "z") {
      if (event.shiftKey) drawingEditor.redo();
      else drawingEditor.undo();
      refreshDrawingScale("drawingHistoryChanged");
      emitDrawingState();
      return true;
    }
    if (modifier && event.key.toLowerCase() === "y") {
      drawingEditor.redo();
      refreshDrawingScale("drawingHistoryChanged");
      emitDrawingState();
      return true;
    }
    const drawingState = drawingEditor.getState();
    if (!modifier && !event.altKey && drawingState.selectedDrawingIds.length > 0 && event.key.startsWith("Arrow")) {
      const step = event.shiftKey ? 10 : 1;
      const horizontal = step * viewport.candleWidth;
      const delta = event.key === "ArrowLeft" ? { dx: -horizontal, dy: 0 }
        : event.key === "ArrowRight" ? { dx: horizontal, dy: 0 }
          : event.key === "ArrowUp" ? { dx: 0, dy: -step }
            : { dx: 0, dy: step };
      drawingEditor.executeCommand({ type: "nudgeSelected", delta });
      return true;
    }
    if (!modifier && !event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      if (intradayLocked()) return true;
      panChart(event.key === "ArrowLeft" ? viewport.candleWidth : -viewport.candleWidth, "keyboardPan");
      return true;
    }
    if (!modifier && !event.altKey && (event.key === "+" || event.key === "=" || event.key === "-")) {
      if (intradayLocked()) return true;
      zoomChart(event.key === "-" ? 1 : -1);
      return true;
    }
    if (!modifier && !event.altKey && event.key === "0") {
      if (intradayLocked()) return true;
      resetChartView();
      return true;
    }
    const hotkey = `${modifier ? "Meta+" : ""}${event.key.length === 1 ? event.key.toLowerCase() : event.key}`;
    const command = getDrawingCommandForHotkey(defaultDrawingHotkeyBindings, hotkey);
    if (!command) return false;
    drawingEditor.executeCommand(command);
    return true;
  }

  function initialViewportFor(input: MaterializedSeries): ViewportState {
    const initial = {
      ...createInitialViewport(input.series.candles.length, layout.plotArea.width),
      priceScaleMode: viewport.priceScaleMode
    };
    if (input.intradayDays === undefined) {
      return constrainViewportToWidth(
        initial,
        input.series.candles.length,
        layout.plotArea.width
      );
    }
    if (input.series.candles.length === 0) return initial;
    return {
      ...initial,
      candleWidth: Math.max(0.05, layout.plotArea.width / input.series.candles.length),
      visibleRange: { from: 0, to: input.series.candles.length - 1 },
      scrollOffset: 0
    };
  }

  const requestFrame = options.requestFrame ?? ((callback: () => void) => requestAnimationFrame(callback));
  const cancelFrame = options.cancelFrame ?? ((id: number) => cancelAnimationFrame(id));
  const scheduler = createRenderScheduler({ requestFrame, cancelFrame, renderPass: (pass) => render(pass) });
  const listeners: Array<[string, EventListener, AddEventListenerOptions | boolean | undefined]> = [];
  const listen = (type: string, listener: EventListener, listenerOptions?: AddEventListenerOptions | boolean) => {
    options.overlayCanvas.addEventListener(type, listener, listenerOptions);
    listeners.push([type, listener, listenerOptions]);
  };
  const point = (event: PointerEvent | WheelEvent | MouseEvent) => {
    const rect = options.overlayCanvas.getBoundingClientRect?.();
    if (rect && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    return { x: event.offsetX ?? 0, y: event.offsetY ?? 0 };
  };
  const expectedLostPointerIds = new Set<number>();
  const isPrimaryActionPointer = (event: PointerEvent): boolean =>
    event.isPrimary !== false &&
    (typeof event.button !== "number" || event.button === 0);
  const priceAxisPaneAt = (p: { x: number; y: number }) => panels.find((panel) =>
    p.x >= panel.priceAxisArea.x &&
    p.x <= panel.priceAxisArea.x + panel.priceAxisArea.width &&
    p.y >= panel.priceAxisArea.y &&
    p.y <= panel.priceAxisArea.y + panel.priceAxisArea.height
  );
  const capture = (pointerId: number) => {
    activePointerId = pointerId;
    options.overlayCanvas.setPointerCapture?.(pointerId);
  };
  const release = (pointerId: number) => {
    if (!options.overlayCanvas.hasPointerCapture?.(pointerId)) return;
    expectedLostPointerIds.add(pointerId);
    options.overlayCanvas.releasePointerCapture(pointerId);
  };

  listen("pointerdown", ((raw: Event) => {
    const event = raw as PointerEvent;
    if (activePointerId !== undefined || !isPrimaryActionPointer(event)) return;
    const p = point(event);
    pendingClick = undefined;
    options.overlayCanvas.focus?.({ preventScroll: true });
    const executionHit = updateExecutionTooltip(p, true);
    if (executionHit) {
      pendingClick = {
        pointerId: event.pointerId,
        start: p,
        kind: "execution",
        executions: structuredClone(executionHit)
      };
      capture(event.pointerId);
      return;
    }
    const mark = markerAt(markOutput, p);
    if (mark) {
      options.onMarkClicked?.({
        id: mark.id,
        time: mark.time,
        price: mark.price!,
        ...(mark.label === undefined ? {} : { label: mark.label }),
        ...(mark.color === undefined ? {} : { color: mark.color })
      });
      return;
    }
    clearExecutionTooltip();
    const priceAxisPane = priceAxisPaneAt(p);
    if (intradayLocked() && (priceAxisPane !== undefined || p.y >= layout.timeAxisArea.y)) {
      return;
    }
    if (priceAxisPane !== undefined) {
      const paneScale = panelPriceScales.get(priceAxisPane.id);
      if (paneScale === undefined) return;
      capture(event.pointerId);
      priceAxisDrag = {
        pointerId: event.pointerId,
        paneId: priceAxisPane.id as ChartPaneId,
        startY: p.y,
        scale: { ...paneScale },
        moved: false
      };
      session.handleInput({ type: "pointerDown", point: p, mode: "resize" });
      return;
    }
    if (p.y >= layout.timeAxisArea.y) {
      capture(event.pointerId);
      timeAxisDrag = { pointerId: event.pointerId, startX: p.x, viewport: structuredClone(viewport) };
      session.handleInput({ type: "pointerDown", point: p, mode: "resize" });
      return;
    }
    const drawing = handleDrawingPointerDown(p);
    const studyId = drawing ? undefined : studyAt(p);
    pendingClick = typeof drawing === "string"
      ? { pointerId: event.pointerId, start: p, kind: "drawing", id: drawing }
      : drawing
        ? undefined
        : studyId === undefined
          ? { pointerId: event.pointerId, start: p, kind: "blank" }
          : { pointerId: event.pointerId, start: p, kind: "study", id: studyId };
    capture(event.pointerId);
    session.handleInput({ type: "pointerDown", point: p, mode: drawing ? "drawing" : "dragPan" });
    if (!drawing && !intradayLocked()) interaction?.handlePointerDown(p);
  }) as EventListener);

  listen("pointermove", ((raw: Event) => {
    const event = raw as PointerEvent;
    if (activePointerId !== undefined && event.pointerId !== activePointerId) return;
    const p = point(event);
    const pending = pendingClick;
    if (pending !== undefined && pending.pointerId === event.pointerId) {
      if (Math.hypot(p.x - pending.start.x, p.y - pending.start.y) <= 4) return;
      pendingClick = undefined;
    }
    if (activePointerId === undefined && !executionTooltipPinned && event.pointerType !== "touch") {
      updateExecutionTooltip(p);
    }
    session.handleInput(activePointerId === undefined
      ? { type: "pointerMove", point: p }
      : { type: "pointerDrag", point: p });
    if (priceAxisDrag !== undefined && priceAxisDrag.pointerId === event.pointerId) {
      if (Math.abs(p.y - priceAxisDrag.startY) <= 4) return;
      const span = priceAxisDrag.scale.max - priceAxisDrag.scale.min;
      const center = priceAxisDrag.scale.min + span / 2;
      const factor = Math.max(0.1, Math.min(10, Math.exp((p.y - priceAxisDrag.startY) / 160)));
      const nextScale = {
        ...priceAxisDrag.scale,
        min: center - span * factor / 2,
        max: center + span * factor / 2
      };
      if (!validPriceScale(nextScale)) return;
      priceAxisDrag.moved = true;
      panelPriceScales.set(priceAxisDrag.paneId, nextScale);
      if (priceAxisDrag.paneId === "main") {
        manualPriceScale = nextScale;
        priceScale = nextScale;
        interaction?.setPriceScale(priceScale);
        syncDrawings();
      }
      scheduler.invalidate({ layers: ["axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"], reason: "priceAxisScaled" });
      return;
    }
    if (timeAxisDrag !== undefined && timeAxisDrag.pointerId === event.pointerId) {
      const candleWidth = Math.max(
        2,
        Math.min(48, timeAxisDrag.viewport.candleWidth * Math.exp((p.x - timeAxisDrag.startX) / 160))
      );
      const next = { ...timeAxisDrag.viewport, candleWidth };
      applyViewport(
        constrainViewportToWidth(
          next,
          chartEngine.getState().series.candles.length,
          layout.plotArea.width
        ),
        "timeAxisScaled",
        true
      );
      return;
    }
    const mapped = mapCrosshairPoint(p);
    crosshairPane = mapped.pane;
    interactionEventPoint = p;
    try {
      interaction?.handlePointerMove(mapped.point);
    } finally {
      interactionEventPoint = undefined;
    }
    if (handleDrawingPointerMove(p)) return;
    updateDrawingHover(p);
  }) as EventListener);

  const finishPointer = (event: PointerEvent, canceled = false) => {
    if (activePointerId !== undefined && event.pointerId !== activePointerId) return;
    if (!canceled && !isPrimaryActionPointer(event)) return;
    const p = point(event);
    session.handleInput(canceled ? { type: "pointerCancel" } : { type: "pointerUp", point: p });
    release(event.pointerId);
    activePointerId = undefined;
    if (canceled) {
      cancelPointerInteraction("pointerCancel");
      return;
    }
    if (priceAxisDrag !== undefined && priceAxisDrag.pointerId === event.pointerId) {
      if (priceAxisDrag.moved) {
        const pane = paneLayouts.get(priceAxisDrag.paneId);
        const scale = panelPriceScales.get(priceAxisDrag.paneId);
        if (pane !== undefined && scale !== undefined) {
          paneLayouts.set(priceAxisDrag.paneId, {
            ...pane,
            priceScale: {
              autoScale: false,
              inverted: pane.priceScale.inverted,
              visibleRange: rawRange(scale)
            }
          });
          options.onPaneLayoutChanged?.();
        }
      }
      priceAxisDrag = undefined;
      session.handleInput({ type: "cursor", cursor: "crosshair" });
      return;
    }
    if (timeAxisDrag !== undefined && timeAxisDrag.pointerId === event.pointerId) {
      timeAxisDrag = undefined;
      session.handleInput({ type: "cursor", cursor: "crosshair" });
      return;
    }
    const pending = pendingClick;
    const click = pending !== undefined &&
      pending.pointerId === event.pointerId &&
      Math.hypot(p.x - pending.start.x, p.y - pending.start.y) <= 4
      ? pending
      : undefined;
    pendingClick = undefined;
    if (click?.kind === "execution") {
      options.onExecutionClicked?.(click.executions ?? []);
      return;
    }
    const finishPoint = click?.kind === "drawing" ? click.start : p;
    if (!handleDrawingPointerUp(finishPoint)) interaction?.handlePointerUp(finishPoint);
    if (click?.kind === "drawing") options.onDrawingClicked?.(click.id!);
    else if (click?.kind === "study") options.onStudyClicked?.(click.id!);
    else if (click?.kind === "blank") options.onBlankClicked?.();
  };
  listen("pointerup", ((event: Event) => finishPointer(event as PointerEvent)) as EventListener);
  listen("pointercancel", ((event: Event) => finishPointer(event as PointerEvent, true)) as EventListener);
  listen("lostpointercapture", ((raw: Event) => {
    const event = raw as PointerEvent;
    if (!expectedLostPointerIds.delete(event.pointerId)) finishPointer(event, true);
  }) as EventListener);
  listen("pointerleave", (() => {
    if (activePointerId === undefined) {
      if (!executionTooltipPinned) clearExecutionTooltip();
      cancelPointerInteraction("leave");
    }
  }) as EventListener);
  listen("blur", (() => cancelPointerInteraction("blur")) as EventListener);
  listen("wheel", ((raw: Event) => {
    const event = raw as WheelEvent;
    event.preventDefault?.();
    if (intradayLocked()) return;
    const p = point(event);
    session.handleInput({ type: "wheel", point: p, deltaY: event.deltaY });
    if (event.shiftKey) panChart(event.deltaX || event.deltaY, "shiftWheelPan");
    else interaction?.handleWheel({ x: p.x, deltaY: event.deltaY });
  }) as EventListener, { passive: false });
  listen("dblclick", ((raw: Event) => {
    const p = point(raw as MouseEvent);
    const pane = priceAxisPaneAt(p);
    if (pane !== undefined && !intradayLocked()) {
      const current = paneLayouts.get(pane.id as ChartPaneId);
      if (current === undefined) return;
      paneLayouts.set(pane.id as ChartPaneId, {
        ...current,
        priceScale: {
          autoScale: true,
          inverted: current.priceScale.inverted
        }
      });
      if (pane.id === "main") manualPriceScale = undefined;
      updatePriceScale();
      scheduler.invalidate({ layers: ["axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"], reason: "priceAxisReset" });
      options.onPaneLayoutChanged?.();
    } else if (p.y >= layout.timeAxisArea.y) {
      resetChartView();
    }
  }) as EventListener);
  listen("keydown", ((raw: Event) => {
    const event = raw as KeyboardEvent;
    if (!handleKeyboard(event)) return;
    event.preventDefault();
    session.handleInput({
      type: "keyboardDown",
      key: event.key,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    });
    chartEngine.setInteractionState(session.getState());
  }) as EventListener);
  listen("keyup", ((raw: Event) => {
    const event = raw as KeyboardEvent;
    session.handleInput({
      type: "keyboardUp",
      key: event.key,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    });
    chartEngine.setInteractionState(session.getState());
  }) as EventListener);

  const observer = options.observer ?? (typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => scheduler.invalidate({ layers: ["grid", "axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"], reason: "resize", layoutRequired: true })));
  observer?.observe(options.themeRoot);
  syncLayout();

  function scheduleCalculationRecovery(): void {
    if (
      destroyed ||
      activeIndicatorGeneration === indicatorGeneration ||
      activeSeriesGeneration === seriesGeneration ||
      !calculationRecoveryPending ||
      indicatorCalculationFailed ||
      failedSeriesCalculation !== undefined
    ) return;
    calculationRecoveryPending = false;
    renderRecoveryPending = true;
    scheduler.invalidate({
      layers: ["series", "indicators"],
      reason: "calculationRecovered"
    });
  }

  function publishSettledCalculationStatus(): void {
    if (destroyed) return;
    if (activeIndicatorGeneration !== undefined) {
      options.onCalculationStatusChanged?.({
        type: "calculating",
        kind: "indicator",
        id: indicatorConfigs[0]?.instanceId ?? "indicators",
        generation: activeIndicatorGeneration
      });
      return;
    }
    if (activeSeriesGeneration !== undefined) {
      options.onCalculationStatusChanged?.({
        type: "calculating",
        kind: "series",
        id: chartEngine.getState().seriesType,
        generation: activeSeriesGeneration
      });
      return;
    }
    options.onCalculationStatusChanged?.({ type: "idle" });
  }

  async function calculateIndicators(configs: readonly IndicatorConfig[], generation: number): Promise<void> {
    if (!materialized) return;
    indicatorCalculationController?.abort();
    const controller = new AbortController();
    indicatorCalculationController = controller;
    if (renderRecoveryPending) {
      renderRecoveryPending = false;
      calculationRecoveryPending = true;
    }
    activeIndicatorGeneration = generation;
    options.onCalculationStatusChanged?.({
      type: "calculating",
      kind: "indicator",
      id: configs[0]?.instanceId ?? "indicators",
      generation
    });
    try {
      const results = await options.calculationRuntime.calculateIndicators({ selection: materialized.selection, configs, targetTimes: new Set(materialized.series.candles.map((candle) => candle.time)), generation, signal: controller.signal });
      if (destroyed || generation !== indicatorGeneration) return;
      if (indicatorCalculationFailed) {
        indicatorCalculationFailed = false;
        calculationRecoveryPending = true;
      }
      if (pendingClick?.kind === "study") pendingClick = undefined;
      const visiblePaneIds = JSON.stringify(paneOrder.filter(paneIsVisible));
      visualOutputs = configs.flatMap((config) =>
        config.visible ? results.get(config.instanceId)?.outputs ?? [] : []
      );
      if (
        reconcilePaneLayouts(configs) ||
        visiblePaneIds !== JSON.stringify(paneOrder.filter(paneIsVisible))
      ) syncLayout();
      syncVisualOutputs();
      updatePriceScale();
      refreshCrosshairAtPoint();
      if (crosshair !== undefined && crosshairPoint !== undefined) {
        queueCrosshairEvent(crosshair, crosshairPoint);
      }
      lastDataWindowIndex = undefined;
      emitDataWindow(true);
      scheduler.invalidate({ layers: ["axis", "series", "indicators", "visuals", "crosshair"], reason: "indicatorsCalculated" });
    } catch (error) {
      if (
        !destroyed &&
        generation === indicatorGeneration &&
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        indicatorCalculationFailed = true;
        options.onCalculationError?.("indicator", error);
      }
    } finally {
      if (indicatorCalculationController === controller) indicatorCalculationController = undefined;
      if (activeIndicatorGeneration === generation) activeIndicatorGeneration = undefined;
      publishSettledCalculationStatus();
      scheduleCalculationRecovery();
    }
  }

  async function calculateSeries(
    type: StatefulSeriesTransformType,
    generation: number
  ): Promise<void> {
    if (!materialized) return;
    seriesCalculationController?.abort();
    const controller = new AbortController();
    seriesCalculationController = controller;
    if (renderRecoveryPending) {
      renderRecoveryPending = false;
      calculationRecoveryPending = true;
    }
    if (failedSeriesCalculation !== undefined) {
      failedSeriesCalculation = undefined;
      calculationRecoveryPending = true;
    }
    activeSeriesGeneration = generation;
    options.onCalculationStatusChanged?.({ type: "calculating", kind: "series", id: type, generation });
    try {
      const model = await options.calculationRuntime.calculateSeries({
        selection: materialized.selection,
        type,
        options: seriesTransformOptions(type, activeSeriesProperties),
        targetTimes: new Set(materialized.series.candles.map((candle) => candle.time)),
        generation,
        signal: controller.signal
      });
      if (destroyed || generation !== seriesGeneration) return;
      seriesModel = model;
      chartEngine.setSeriesType(type);
      scheduler.invalidate({ layers: ["series"], reason: "seriesCalculated" });
    } catch (error) {
      if (
        !destroyed &&
        generation === seriesGeneration &&
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        failedSeriesCalculation = type;
        options.onCalculationError?.("series", error);
      }
    } finally {
      if (seriesCalculationController === controller) seriesCalculationController = undefined;
      if (activeSeriesGeneration === generation) activeSeriesGeneration = undefined;
      publishSettledCalculationStatus();
      scheduleCalculationRecovery();
    }
  }

  function requirePane(id: ChartPaneId): ChartPaneLayout {
    const pane = paneLayouts.get(id);
    if (pane === undefined) {
      throw new DOMException("Chart pane was not found", "NotFoundError");
    }
    return pane;
  }

  function getPaneLayouts(): ChartPaneLayout[] {
    return paneOrder.map((id) => structuredClone(requirePane(id)));
  }

  function getPanes(): ChartPane[] {
    return paneOrder.map((id) => {
      const pane = requirePane(id);
      return {
        id,
        kind: id === "main" ? "main" : "study",
        title: paneTitle(id),
        ...(id === "main" ? {} : { studyInstanceId: id.slice("study:".length) }),
        visible: paneIsVisible(id),
        heightRatio: pane.heightRatio,
        collapsed: pane.collapsed,
        priceScale: {
          mode: id === "main"
            ? intradayLocked() ? "percentage" : viewport.priceScaleMode
            : "linear",
          autoScale: pane.priceScale.autoScale,
          inverted: pane.priceScale.inverted,
          ...(pane.priceScale.visibleRange === undefined
            ? {}
            : { visibleRange: { ...pane.priceScale.visibleRange } })
        }
      };
    });
  }

  function invalidatePane(reason: string, layoutRequired = false): void {
    syncLayout();
    updatePriceScale();
    refreshCrosshairAtPoint();
    scheduler.invalidate({
      layers: ["grid", "axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"],
      reason,
      layoutRequired
    });
    options.onPaneLayoutChanged?.();
  }

  function setPaneScale(
    id: ChartPaneId,
    scale: ChartPaneLayout["priceScale"],
    reason: string
  ): void {
    const pane = requirePane(id);
    const next = { ...pane, priceScale: structuredClone(scale) };
    validatePaneLayouts([next], viewport.priceScaleMode);
    if (activePointerId !== undefined) cancelPointerInteraction("pointerCancel");
    paneLayouts.set(id, next);
    if (id === "main") {
      manualPriceScale = scale.autoScale ? undefined : manualPriceScale;
    }
    invalidatePane(reason);
  }

  return {
    setMaterializedSeries(input, anchorTime) {
      if (destroyed) return;
      if (activePointerId !== undefined) cancelPointerInteraction("pointerCancel");
      pendingClick = undefined;
      const eventsWereSuspended = crosshairEventsSuspended;
      const previousMaterialized = materialized;
      const previousSeries = chartEngine.getState().series;
      const crosshairPointToRestore = crosshairPoint === undefined
        ? undefined
        : { ...crosshairPoint };
      const previousAnchorIndex = anchorTime === undefined
        ? -1
        : previousSeries.candles.findIndex((candle) => candle.time === anchorTime);
      const previousAnchorOffset = previousAnchorIndex - viewport.visibleRange.from;
      const sameSelection =
        previousMaterialized?.selection.symbol.id === input.selection.symbol.id &&
        previousMaterialized.selection.timeframe === input.selection.timeframe &&
        previousMaterialized.selection.adjustMode === input.selection.adjustMode;
      if (
        !sameSelection ||
        previousMaterialized?.intradayScale?.previousClose !== input.intradayScale?.previousClose ||
        previousMaterialized?.intradayScale?.priceLimitPercent !== input.intradayScale?.priceLimitPercent ||
        previousMaterialized?.intradayDays !== input.intradayDays
      ) {
        manualPriceScale = undefined;
        for (const [id, pane] of paneLayouts) {
          paneLayouts.set(id, {
            ...pane,
            priceScale: {
              autoScale: true,
              inverted: pane.priceScale.inverted
            }
          });
        }
      }
      clearCrosshairState();
      lastDataWindowIndex = undefined;
      visualOutputs = [];
      seriesModel = undefined;
      materialized = input;
      currentIntradaySummary = summarizeLatestIntradayDay(input);
      intradayAverage = input.intradayDays === undefined
        ? undefined
        : calculateIntradayAverage(input.series.candles);
      timeCoordinates = input.intradayDays === undefined
        ? undefined
        : createIntradayTimeCoordinates(input.series.candles, layout.plotArea.width);
      maxMaterializedCandleCount = Math.max(maxMaterializedCandleCount, input.series.candles.length);
      chartEngine.setSeries(input.series);
      clearExecutionTooltip();
      rebuildMarkOutput();
      rebuildExecutionOutput();
      const nextAnchorIndex = anchorTime === undefined
        ? -1
        : input.series.candles.findIndex((candle) => candle.time === anchorTime);
      if (
        input.intradayDays === undefined &&
        sameSelection &&
        previousAnchorIndex >= 0 &&
        nextAnchorIndex >= 0
      ) {
        const visibleCount = Math.min(
          input.series.candles.length,
          Math.max(1, viewport.visibleRange.to - viewport.visibleRange.from + 1)
        );
        const allCandlesVisible = visibleCount >= input.series.candles.length;
        const maximumFrom = input.series.candles.length - visibleCount;
        const from = allCandlesVisible
          ? 0
          : Math.min(maximumFrom, Math.max(0, nextAnchorIndex - previousAnchorOffset));
        const to = allCandlesVisible
          ? input.series.candles.length - 1
          : from + visibleCount - 1;
        viewport = {
          ...viewport,
          candleWidth: layout.plotArea.width / visibleCount,
          scrollOffset: Math.max(0, input.series.candles.length - 1 - to),
          visibleRange: { from, to }
        };
      } else {
        viewport = initialViewportFor(input);
      }
      chartEngine.setViewport(viewport);
      rebuildInteraction();
      if (sameSelection && crosshairPointToRestore !== undefined) {
        crosshairPoint = crosshairPointToRestore;
        refreshCrosshairAtPoint();
      }
      if (
        eventsWereSuspended &&
        pendingCrosshairEvent?.crosshair === undefined
      ) {
        resumeCrosshairEventsAfterFlush = true;
      } else {
        crosshairEventsSuspended = false;
      }
      options.onViewportChanged?.(viewport);
      emitVisibleRange();
      emitMaterializationDemand();
      emitDataWindow(true);
      scheduler.invalidate({ layers: ["grid", "axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"], reason: "seriesChanged", layoutRequired: true });
      if (indicatorConfigs.length > 0) {
        indicatorGeneration += 1;
        void calculateIndicators(indicatorConfigs, indicatorGeneration);
      }
      const activeType = chartEngine.getState().seriesType;
      if (isStatefulSeriesType(activeType)) this.setSeriesType(activeType);
    },
    getMaterializationDemand,
    getVisibleRange,
    getBarSpacing() {
      if (destroyed) return 0;
      return timeCoordinates?.barWidth ?? viewport.candleWidth;
    },
    setBarSpacing(spacing) {
      if (destroyed || intradayLocked() || !Number.isFinite(spacing) || spacing <= 0) return;
      const candles = chartEngine.getState().series.candles;
      if (candles.length === 0) return;
      applyViewport(constrainViewportToWidth({
        ...viewport,
        candleWidth: spacing
      }, candles.length, layout.plotArea.width), "barSpacingChanged", true);
    },
    getWidth() {
      return destroyed ? 0 : layout.plotArea.width;
    },
    timeToCoordinate(time) {
      if (destroyed || materialized === undefined || !Number.isFinite(time)) return undefined;
      const candles = chartEngine.getState().series.candles;
      const index = candles.findIndex((candle) => candle.time === time);
      if (
        index < Math.max(0, viewport.visibleRange.from) ||
        index > Math.min(candles.length - 1, viewport.visibleRange.to)
      ) return undefined;
      return indexToX(index, viewport, layout.plotArea.x, timeCoordinates) - layout.plotArea.x;
    },
    coordinateToTime(coordinate) {
      if (
        destroyed ||
        materialized === undefined ||
        !Number.isFinite(coordinate) ||
        coordinate < 0 ||
        coordinate > layout.plotArea.width
      ) return undefined;
      const candles = chartEngine.getState().series.candles;
      const index = xToIndex(
        coordinate + layout.plotArea.x,
        viewport,
        layout.plotArea.x,
        timeCoordinates
      );
      if (
        index < Math.max(0, viewport.visibleRange.from) ||
        index > Math.min(candles.length - 1, viewport.visibleRange.to)
      ) return undefined;
      return candles[index]?.time;
    },
    scrollByBars(bars) {
      if (destroyed || intradayLocked() || !Number.isSafeInteger(bars) || bars === 0) return;
      panChart(bars * viewport.candleWidth, "programmaticPan");
    },
    zoomIn() {
      if (destroyed || intradayLocked()) return;
      zoomChart(-1);
    },
    zoomOut() {
      if (destroyed || intradayLocked()) return;
      zoomChart(1);
    },
    fitContent,
    setVisibleRange(range) {
      if (
        destroyed ||
        intradayLocked() ||
        !Number.isFinite(range.from) ||
        !Number.isFinite(range.to) ||
        range.from > range.to
      ) return false;
      const candles = chartEngine.getState().series.candles;
      const from = candles.findIndex((candle) => candle.time >= range.from);
      let to = -1;
      for (let index = candles.length - 1; index >= 0; index -= 1) {
        if (candles[index]!.time <= range.to) {
          to = index;
          break;
        }
      }
      if (from < 0 || to < from) return false;
      const requestedVisibleCount = to - from + 1;
      viewport = constrainViewportToWidth({
        ...viewport,
        candleWidth: layout.plotArea.width / requestedVisibleCount,
        scrollOffset: candles.length - 1 - to,
        visibleRange: { from, to }
      }, candles.length, layout.plotArea.width);
      chartEngine.setViewport(viewport);
      rebuildInteraction();
      options.onViewportChanged?.(viewport);
      emitVisibleRange();
      emitMaterializationDemand();
      if (!crosshair) emitDataWindow();
      scheduler.invalidate({ layers: ["axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair"], reason: "visibleRangeChanged" });
      return true;
    },
    resetToLatest(resetPriceScale = true) {
      if (destroyed) return;
      resetChartView(resetPriceScale);
    },
    clearCrosshair() {
      if (destroyed) return;
      const cleared = clearCrosshairState();
      crosshairEventsSuspended = true;
      resumeCrosshairEventsAfterFlush = false;
      if (!cleared) return;
      emitDataWindow();
      rebuildInteraction();
      scheduler.invalidate({ layers: ["crosshair", "tooltip"], reason: "crosshairCleared" });
    },
    setSeriesType(type, properties) {
      if (destroyed) return;
      if (properties !== undefined && properties.type !== type) {
        throw new TypeError("Series properties must match the series type");
      }
      if (properties !== undefined) activeSeriesProperties = structuredClone(properties);
      else if (activeSeriesProperties?.type !== type) activeSeriesProperties = undefined;
      seriesCalculationController?.abort();
      seriesCalculationController = undefined;
      seriesGeneration += 1;
      const generation = seriesGeneration;
      if (!isStatefulSeriesType(type) || !materialized) {
        if (failedSeriesCalculation !== undefined) {
          failedSeriesCalculation = undefined;
          calculationRecoveryPending = true;
        }
        seriesModel = undefined;
        chartEngine.setSeriesType(type);
        scheduler.invalidate({ layers: ["series"], reason: "seriesTypeChanged" });
        scheduleCalculationRecovery();
        return;
      }
      void calculateSeries(type, generation);
    },
    setIndicators(configs) {
      if (destroyed) return;
      if (pendingClick?.kind === "study") pendingClick = undefined;
      const nextConfigs = configs.map((config) => structuredClone(config));
      const visiblePaneIds = JSON.stringify(paneOrder.filter(paneIsVisible));
      const paneSetChanged = reconcilePaneLayouts(nextConfigs);
      indicatorConfigs = nextConfigs;
      visualOutputs = [];
      syncVisualOutputs();
      if (
        paneSetChanged ||
        visiblePaneIds !== JSON.stringify(paneOrder.filter(paneIsVisible))
      ) {
        syncLayout();
      }
      updatePriceScale();
      refreshCrosshairAtPoint();
      if (crosshair !== undefined && crosshairPoint !== undefined) {
        queueCrosshairEvent(crosshair, crosshairPoint);
      }
      lastDataWindowIndex = undefined;
      emitDataWindow(true);
      scheduler.invalidate({
        layers: ["axis", "indicators", "visuals", "crosshair"],
        reason: "indicatorsChanged"
      });
      indicatorGeneration += 1;
      void calculateIndicators(indicatorConfigs, indicatorGeneration);
    },
    setComparisonData(snapshots) {
      if (destroyed) return;
      comparisonData = snapshots;
      syncVisualOutputs();
      updatePriceScale();
      refreshCrosshairAtPoint();
      if (crosshair !== undefined && crosshairPoint !== undefined) {
        queueCrosshairEvent(crosshair, crosshairPoint);
      }
      lastDataWindowIndex = undefined;
      emitDataWindow(true);
      scheduler.invalidate({
        layers: ["axis", "visuals", "crosshair"],
        reason: "comparisonsChanged"
      });
    },
    setMarks(nextMarks) { if (destroyed) return; marks = nextMarks.map((mark) => ({ ...mark })); rebuildMarkOutput(); updatePriceScale(); refreshCrosshairAtPoint(); scheduler.invalidate({ layers: ["axis", "visuals", "crosshair"], reason: "marksChanged" }); },
    setExecutions(nextExecutions) { if (destroyed) return; if (pendingClick?.kind === "execution") pendingClick = undefined; clearExecutionTooltip(); executions = nextExecutions.map((execution) => ({ ...execution })); rebuildExecutionOutput(); updatePriceScale(); refreshCrosshairAtPoint(); scheduler.invalidate({ layers: ["axis", "visuals", "crosshair", "tooltip"], reason: "executionsChanged" }); },
    setExecutionsVisible(visible) { if (destroyed || executionsVisible === visible) return; if (pendingClick?.kind === "execution") pendingClick = undefined; executionsVisible = visible; if (!visible) clearExecutionTooltip(); rebuildExecutionOutput(); updatePriceScale(); refreshCrosshairAtPoint(); scheduler.invalidate({ layers: ["axis", "visuals", "crosshair", "tooltip"], reason: "executionVisibilityChanged" }); },
    setPricePrecision(precision) {
      if (destroyed || currentPricePrecision === precision) return;
      currentPricePrecision = precision;
      formatPrice = priceFormatter(precision);
      lastDataWindowIndex = undefined;
      emitDataWindow(true);
      scheduler.invalidate({
        layers: ["grid", "axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"],
        reason: "pricePrecisionChanged",
        layoutRequired: true
      });
    },
    setPriceScaleMode(mode) {
      if (destroyed) return;
      if (viewport.priceScaleMode === mode) return;
      if (activePointerId !== undefined) cancelPointerInteraction("pointerCancel");
      manualPriceScale = undefined;
      const main = requirePane("main");
      paneLayouts.set("main", {
        ...main,
        priceScale: {
          autoScale: true,
          inverted: main.priceScale.inverted
        }
      });
      viewport = { ...viewport, priceScaleMode: mode };
      chartEngine.dispatch({ type: "setPriceScaleMode", mode });
      rebuildInteraction();
      scheduler.invalidate({ layers: ["axis", "series", "indicators", "visuals", "drawings", "crosshair"], reason: "priceScaleChanged" });
    },
    getPanes: () => structuredClone(getPanes()),
    getPaneLayouts: () => structuredClone(getPaneLayouts()),
    setPaneHeightRatio(id, ratio) {
      if (destroyed) return;
      if (activePointerId !== undefined) cancelPointerInteraction("pointerCancel");
      const pane = requirePane(id);
      paneLayouts.set(id, { ...pane, heightRatio: ratio });
      invalidatePane("paneHeightChanged", true);
    },
    setPaneCollapsed(id, collapsed) {
      if (destroyed) return;
      if (activePointerId !== undefined) cancelPointerInteraction("pointerCancel");
      const pane = requirePane(id);
      paneLayouts.set(id, { ...pane, collapsed });
      invalidatePane("paneCollapsedChanged", true);
    },
    movePane(id, index) {
      if (destroyed) return;
      if (activePointerId !== undefined) cancelPointerInteraction("pointerCancel");
      requirePane(id);
      paneOrder = paneOrder.filter((candidate) => candidate !== id);
      paneOrder.splice(index, 0, id);
      invalidatePane("paneOrderChanged", true);
    },
    setPaneAutoScale(id, enabled) {
      if (destroyed) return;
      if (activePointerId !== undefined) cancelPointerInteraction("pointerCancel");
      const pane = requirePane(id);
      if (enabled) {
        setPaneScale(id, {
          autoScale: true,
          inverted: pane.priceScale.inverted
        }, "paneAutoScaleChanged");
        return;
      }
      updatePriceScale();
      const scale = panelPriceScales.get(id);
      if (scale === undefined) {
        throw new DOMException("Chart pane price scale is unavailable", "InvalidStateError");
      }
      setPaneScale(id, {
        autoScale: false,
        inverted: pane.priceScale.inverted,
        visibleRange: rawRange(scale)
      }, "paneAutoScaleChanged");
    },
    setPaneVisibleRange(id, range) {
      if (destroyed) return;
      const pane = requirePane(id);
      setPaneScale(id, {
        autoScale: false,
        inverted: pane.priceScale.inverted,
        visibleRange: { ...range }
      }, "paneVisibleRangeChanged");
    },
    setPaneInverted(id, inverted) {
      if (destroyed) return;
      const pane = requirePane(id);
      setPaneScale(id, {
        ...pane.priceScale,
        inverted
      }, "paneInversionChanged");
    },
    validatePaneLayouts,
    applyPaneLayouts(nextPanes) {
      if (destroyed) return;
      validatePaneLayouts(nextPanes, viewport.priceScaleMode);
      if (activePointerId !== undefined) cancelPointerInteraction("pointerCancel");
      paneOrder = nextPanes.map((pane) => pane.id);
      paneLayouts.clear();
      for (const pane of nextPanes) {
        paneLayouts.set(pane.id, structuredClone(pane));
      }
      manualPriceScale = undefined;
      invalidatePane("paneLayoutImported", true);
    },
    setDrawings(drawings, selectedDrawingIds = []) {
      if (destroyed) return;
      if (pendingClick?.kind === "drawing") pendingClick = undefined;
      drawingHandleDragOperation = undefined;
      drawingMoveDragOperation = undefined;
      hoveredDrawingId = undefined;
      drawingEditor = createEditor(drawings);
      suppressDrawingState = true;
      try {
        drawingEditor.selectDrawings([...selectedDrawingIds]);
      } finally {
        suppressDrawingState = false;
      }
      refreshDrawingScale("drawingsReplaced");
      emitDrawingHistoryState();
    },
    selectDrawings(ids) {
      if (destroyed) return;
      drawingEditor.selectDrawings([...ids]);
    },
    setDrawingTool(tool) { if (destroyed) return; drawingEditor.setTool(tool); },
    executeDrawingCommand(command) { if (destroyed) return; drawingEditor.executeCommand(command); },
    undoDrawing() { if (destroyed) return; drawingEditor.undo(); refreshDrawingScale("drawingHistoryChanged"); emitDrawingState(); },
    redoDrawing() { if (destroyed) return; drawingEditor.redo(); refreshDrawingScale("drawingHistoryChanged"); emitDrawingState(); },
    setGridVisible(visible) { if (destroyed) return; if (chartEngine.getState().settings.gridVisible !== visible) { chartEngine.dispatch({ type: "toggleGrid" }); scheduler.invalidate({ layers: ["grid"], reason: "gridVisibilityChanged" }); } },
    refreshTheme() {
      if (destroyed) return;
      scheduler.invalidate({
        layers: ["grid", "axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"],
        reason: "themeChanged"
      });
    },
    cancelCalculations() {
      if (destroyed) return;
      indicatorCalculationController?.abort();
      seriesCalculationController?.abort();
      indicatorCalculationController = undefined;
      seriesCalculationController = undefined;
      indicatorGeneration += 1;
      seriesGeneration += 1;
      indicatorCalculationFailed = false;
      failedSeriesCalculation = undefined;
      calculationRecoveryPending = false;
      renderRecoveryPending = false;
    },
    retryRender() {
      if (destroyed) return;
      let retriedCalculation = false;
      if (indicatorCalculationFailed) {
        void calculateIndicators(indicatorConfigs, ++indicatorGeneration);
        retriedCalculation = true;
      }
      if (failedSeriesCalculation !== undefined) {
        const type = failedSeriesCalculation;
        void calculateSeries(type, ++seriesGeneration);
        retriedCalculation = true;
      }
      if (retriedCalculation || calculationRecoveryPending) return;
      renderRecoveryPending = true;
      scheduler.invalidate({ layers: ["grid", "axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"], reason: "retryRender", layoutRequired: true });
    },
    getMetrics() { return { ...scheduler.getState().metrics, maxMaterializedCandleCount }; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try {
        options.onExecutionTooltipChanged?.(undefined);
      } catch {
        // Destruction must release owned browser and data resources even if the host cleanup fails.
      }
      indicatorCalculationController?.abort();
      seriesCalculationController?.abort();
      indicatorCalculationController = undefined;
      seriesCalculationController = undefined;
      renderRecoveryPending = false;
      indicatorCalculationFailed = false;
      failedSeriesCalculation = undefined;
      calculationRecoveryPending = false;
      pendingCrosshairEvent = undefined;
      crosshairPoint = undefined;
      indicatorGeneration += 1;
      seriesGeneration += 1;
      for (const [type, listener, listenerOptions] of listeners) options.overlayCanvas.removeEventListener(type, listener, listenerOptions);
      observer?.disconnect();
      scheduler.destroy();
      session.destroy();
      materialized = undefined;
      visualOutputs = [];
      comparisonData = [];
      markOutput = undefined;
      marks = [];
      executionOutput = undefined;
      executions = [];
      indicatorConfigs = [];
      seriesModel = undefined;
      currentIntradaySummary = undefined;
      intradayAverage = undefined;
      timeCoordinates = undefined;
      pendingClick = undefined;
      interaction = undefined;
      drawingHandleDragOperation = undefined;
      drawingMoveDragOperation = undefined;
      drawingEditor = createEditor([]);
      chartEngine.setSeries(emptySeries);
      chartEngine.setVisualOutputs([]);
      chartEngine.setDrawings([]);
      chartEngine.destroy();
    }
  };
}
