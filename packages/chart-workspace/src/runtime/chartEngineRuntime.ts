import {
  beginDrawingHandleDrag,
  beginDrawingMoveDrag,
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
  createRenderScheduler,
  createStaticLayers,
  createVisualLayer,
  createVisualRendererRegistry,
  defaultDrawingHotkeyBindings,
  drawingPointFromPointer,
  finishDrawingHandleDrag,
  finishDrawingMoveDrag,
  getDrawingCommandForHotkey,
  getDrawingHoverState,
  hitTestDrawing,
  hitTestDrawingEditHandle,
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
  ChartVisibleRange,
  Timeframe
} from "../contracts";
import type { MaterializedSeries } from "../data/materializedSeries";
import { shanghaiTradingDayKey } from "../data/pagedSeriesStore";
import type { CalculationStatus, CheckpointedCalculationRuntime } from "./checkpointedCalculationRuntime";
import {
  indicatorOutputPrefix,
  indicatorPanelId,
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
  executionTooltipRows
} from "./executionMarks";

export interface WorkspaceRuntimeMetrics extends RenderMetrics {
  maxMaterializedCandleCount: number;
}

export interface MaterializationDemand {
  readonly visibleCount: number;
  readonly overscanCount: number;
}

export interface DataWindowIndicatorRow { id: string; label: string; value: string; }
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
  resetToLatest(): void;
  clearCrosshair(): void;
  setSeriesType(type: SeriesType): void;
  setIndicators(configs: readonly IndicatorConfig[]): void;
  setMarks(marks: readonly ChartMark[]): void;
  setExecutions(executions: readonly ChartExecution[]): void;
  setExecutionsVisible(visible: boolean): void;
  setPriceScaleMode(mode: PriceScaleMode): void;
  setDrawings(drawings: readonly DrawingObject[]): void;
  setDrawingTool(tool: DrawingEditorTool): void;
  executeDrawingCommand(command: DrawingEditorCommand): void;
  undoDrawing(): void;
  redoDrawing(): void;
  setGridVisible(visible: boolean): void;
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
  observer?: RuntimeResizeObserver;
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (id: number) => void;
  getComputedStyle?: (element: Element) => CSSStyleDeclaration;
  devicePixelRatio?: number;
  onViewportChanged?: (viewport: ViewportState) => void;
  onMaterializedBoundary?: (direction: "before" | "after", anchorTime?: number) => void;
  onMaterializationDemandChanged?: (demand: Readonly<MaterializationDemand>) => void;
  onVisibleRangeChanged?: (range: Readonly<ChartVisibleRange>) => void;
  onCalculationStatusChanged?: (status: CalculationStatus) => void;
  onDataWindowChanged?: (snapshot: DataWindowSnapshot | undefined) => void;
  hasCrosshairListeners?: () => boolean;
  onCrosshairChanged?: (snapshot: RuntimeCrosshairSnapshot | undefined) => void;
  onExecutionTooltipChanged?: (snapshot: ExecutionTooltipSnapshot | undefined) => void;
  onMarkClicked?: (mark: Readonly<ChartMark>) => void;
  onDrawingsChanged?: (drawings: readonly DrawingObject[], selectedDrawingIds: readonly string[]) => void;
  onDrawingHistoryChanged?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  onCalculationError?: (kind: "indicator" | "series", error: unknown) => void;
  onRenderError?: (error: unknown) => void;
  onRenderRecovered?: () => void;
}

function defaultSeriesTransformOptions(type: StatefulSeriesTransformType): Readonly<Record<string, number>> {
  if (type === "renko") return { brickSize: 1 };
  if (type === "lineBreak") return { lineCount: 3 };
  if (type === "kagi") return { reversalAmount: 2 };
  if (type === "pointAndFigure") return { boxSize: 1, reversalBoxes: 3 };
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
  let visualOutputs: IndicatorVisualOutput[] = [];
  let markOutput: IndicatorMarkerOutput | undefined;
  let marks: readonly ChartMark[] = [];
  let executionOutput: IndicatorMarkerOutput | undefined;
  let executions: readonly ChartExecution[] = [];
  let executionsVisible = true;
  let executionTooltip: Omit<ExecutionTooltipSnapshot, "pinned"> | undefined;
  let executionTooltipPinned = false;
  let indicatorConfigs: readonly IndicatorConfig[] = [];
  let seriesModel: SeriesRenderModel | undefined;
  let crosshair: ChartCrosshairState | undefined;
  let crosshairPoint: { x: number; y: number } | undefined;
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
  let activePointerId: number | undefined;
  let priceAxisDrag: { pointerId: number; startY: number; scale: PriceScale } | undefined;
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
  const activeVisualOutputs = (): IndicatorVisualOutput[] => [
    ...visualOutputs,
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
        emitDrawingState();
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

  function syncLayout(): void {
    const width = Math.max(1, Math.floor(options.themeRoot.clientWidth || options.staticCanvas.clientWidth || 1));
    const height = Math.max(1, Math.floor(options.themeRoot.clientHeight || options.staticCanvas.clientHeight || 1));
    const nextLayout = createChartLayout(
      width,
      height,
      intradayLocked() ? { leftPriceAxis: true } : {}
    );
    const changed =
      nextLayout.width !== layout.width ||
      nextLayout.height !== layout.height ||
      nextLayout.plotArea.x !== layout.plotArea.x ||
      nextLayout.plotArea.width !== layout.plotArea.width ||
      nextLayout.plotArea.height !== layout.plotArea.height;
    layout = nextLayout;
    const series = chartEngine.getState().series;
    if (changed) {
      timeCoordinates = materialized?.intradayDays === undefined
        ? undefined
        : createIntradayTimeCoordinates(materialized.series.candles, layout.plotArea.width);
      viewport = materialized !== undefined && intradayLocked()
        ? { ...initialViewportFor(materialized), priceScaleMode: viewport.priceScaleMode }
        : constrainViewportToWidth(viewport, series.candles.length, layout.plotArea.width);
      chartEngine.setViewport(viewport);
      rebuildInteraction();
      options.onViewportChanged?.(viewport);
      emitVisibleRange();
      emitMaterializationDemand();
      if (!crosshair) emitDataWindow();
    }
  }

  function updatePriceScale(): void {
    const state = chartEngine.getState();
    const intradayScale = materialized?.intradayScale;
    let drawingPrices = drawingAutoscalePrices(
      intradayScale === undefined ? viewport.priceScaleMode : "percentage",
      intradayScale?.previousClose
    );
    const createAutomaticScale = (prices: readonly number[]) =>
      createMainPanelPriceScale(
        state.series,
        viewport.visibleRange,
        intradayScale === undefined ? viewport.priceScaleMode : "percentage",
        activeVisualOutputs(),
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
    if (intradayScale === undefined) {
      priceScale = manualPriceScale ?? automatic;
    } else if (manualPriceScale !== undefined) {
      priceScale = manualPriceScale;
    } else if (intradayScale.priceLimitPercent !== undefined) {
      const extent = calculateFixedIntradayPercentExtent(
        state.series.candles,
        intradayScale.previousClose,
        intradayScale.priceLimitPercent,
        drawingPrices
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
          title: `${config.id} ${Object.values(config.params).join(",")}`.trim(),
          outputs
        };
      });
    const referencePrice = crosshairReferencePriceAt(pending.crosshair.index);
    const change = referencePrice === undefined ? null : candle.close - referencePrice;
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
      studies
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
    interactionEventPoint = crosshairPoint;
    try {
      interaction.handlePointerMove(crosshairPoint);
    } finally {
      interactionEventPoint = undefined;
    }
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
          label: `${config.id} ${Object.values(config.params).join(",")}`,
          value: typeof value === "number" ? String(value) : "--"
        };
      });
    options.onDataWindowChanged?.({
      crosshair: snapshotCrosshair,
      candle: { ...candle },
      formattedTime: formatShanghaiTime(candle.time, chartEngine.getState().series.timeframe),
      change,
      changePercent: previousClose === 0 ? 0 : (change / previousClose) * 100,
      indicatorRows,
      ...(currentIntradaySummary === undefined
        ? {}
        : { intradaySummary: { ...currentIntradaySummary } })
    });
    lastDataWindowIndex = index;
    dataWindowVisible = true;
  }

  function render(pass: "static" | "dynamic" | "overlay"): void {
    if (destroyed) return;
    try {
      syncLayout();
      const state = chartEngine.getState();
      const theme = readWorkspaceChartTheme(options.themeRoot, options.getComputedStyle?.(options.themeRoot));
      const panels = createPanels();
      const outputs = activeVisualOutputs();
      const renderState = {
        series: state.series,
        seriesType: state.seriesType,
        ...(seriesModel === undefined ? {} : { seriesModel }),
        viewport,
        priceScale,
        formatTime: formatShanghaiTime,
        theme,
        layout,
        panels,
        visualOutputs: outputs,
        drawings: state.drawings,
        selectedDrawingIds: drawingEditor.getState().selectedDrawingIds,
        hoveredDrawingId,
        crosshair,
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
    const subPanelIds = [...new Set(visualOutputs.map((output) => output.panelId).filter((id): id is string => id !== undefined && id !== "main"))];
    return createPanelLayout({
        width: layout.width,
        height: layout.height,
        rightAxisWidth: layout.rightAxisWidth,
        bottomAxisHeight: layout.bottomAxisHeight,
        panels: [
          { id: "main", kind: "main", label: "Main", heightRatio: 3 },
          ...subPanelIds.map((id) => ({
            id,
            kind: "sub" as const,
            label: indicatorConfigs.find(
              (config) => indicatorPanelId(config.instanceId) === id
            )?.id ?? id,
            heightRatio: 1
          }))
        ]
      }).map((panel) => panel.id === "main"
        ? { ...panel, plotArea: { ...layout.plotArea }, priceAxisArea: { ...layout.priceAxisArea } }
        : panel);
  }

  function markerAt(output: IndicatorMarkerOutput | undefined, point: { x: number; y: number }) {
    if (output === undefined) return undefined;
    const state = chartEngine.getState();
    const theme = readWorkspaceChartTheme(options.themeRoot, options.getComputedStyle?.(options.themeRoot));
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

  function updateExecutionTooltip(point: { x: number; y: number }, pinned = false): boolean {
    const mark = markerAt(executionOutput, point);
    if (!mark) {
      if (!executionTooltipPinned) clearExecutionTooltip();
      return false;
    }
    executionTooltipPinned = pinned;
    executionTooltip = {
      markId: mark.id,
      x: point.x,
      y: point.y,
      ...(mark.label === undefined ? {} : { title: mark.label }),
      rows: executionTooltipRows(mark, options.themeRoot.lang === "en-US" ? "en-US" : "zh-CN")
    };
    scheduler.invalidate({ layers: ["tooltip"], reason: "executionTooltipChanged" });
    return true;
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

  function handleDrawingPointerDown(point: { x: number; y: number }): boolean {
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
      if (drawingHandleDragOperation) return true;
    }
    const projectedDrawings = state.drawings.map((drawing) => projectDrawingObject(drawing, coordinateContext()));
    const hit = hitTestDrawing(projectedDrawings, point, { registry: drawingRegistry })?.drawing;
    if (!hit) {
      if (state.selectedDrawingIds.length > 0) drawingEditor.selectDrawings([]);
      return false;
    }
    if (!state.selectedDrawingIds.includes(hit.id)) drawingEditor.selectDrawing(hit.id);
    const selected = drawingEditor.getState();
    drawingMoveDragOperation = beginDrawingMoveDrag({
      drawings: selected.drawings.map((drawing) => projectDrawingObject(drawing, coordinateContext())),
      selectedDrawingIds: selected.selectedDrawingIds,
      startPoint: point
    });
    return true;
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

  function resetChartView(): void {
    manualPriceScale = undefined;
    const initial = materialized === undefined
      ? createInitialViewport(chartEngine.getState().series.candles.length, layout.plotArea.width)
      : initialViewportFor(materialized);
    applyViewport({
      ...initial,
      priceScaleMode: viewport.priceScaleMode
    }, "resetToLatest", true);
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
    drawingEditor.cancel();
    drawingHandleDragOperation = undefined;
    drawingMoveDragOperation = undefined;
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
    const initial = createInitialViewport(input.series.candles.length, layout.plotArea.width);
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
    const p = point(event);
    options.overlayCanvas.focus?.({ preventScroll: true });
    if (updateExecutionTooltip(p, true)) return;
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
    if (intradayLocked() && (p.x >= layout.priceAxisArea.x || p.y >= layout.timeAxisArea.y)) {
      return;
    }
    if (p.x >= layout.priceAxisArea.x) {
      capture(event.pointerId);
      priceAxisDrag = { pointerId: event.pointerId, startY: p.y, scale: { ...priceScale } };
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
    if (!drawing && intradayLocked()) return;
    capture(event.pointerId);
    session.handleInput({ type: "pointerDown", point: p, mode: drawing ? "drawing" : "dragPan" });
    if (!drawing) interaction?.handlePointerDown(p);
  }) as EventListener);

  listen("pointermove", ((raw: Event) => {
    const event = raw as PointerEvent;
    if (activePointerId !== undefined && event.pointerId !== activePointerId) return;
    const p = point(event);
    if (activePointerId === undefined && !executionTooltipPinned && event.pointerType !== "touch") {
      updateExecutionTooltip(p);
    }
    session.handleInput(activePointerId === undefined
      ? { type: "pointerMove", point: p }
      : { type: "pointerDrag", point: p });
    if (priceAxisDrag !== undefined && priceAxisDrag.pointerId === event.pointerId) {
      const span = priceAxisDrag.scale.max - priceAxisDrag.scale.min;
      const center = (priceAxisDrag.scale.max + priceAxisDrag.scale.min) / 2;
      const factor = Math.max(0.1, Math.min(10, Math.exp((p.y - priceAxisDrag.startY) / 160)));
      manualPriceScale = {
        ...priceAxisDrag.scale,
        min: center - span * factor / 2,
        max: center + span * factor / 2
      };
      priceScale = manualPriceScale;
      interaction?.setPriceScale(priceScale);
      syncDrawings();
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
    interactionEventPoint = p;
    try {
      interaction?.handlePointerMove(p);
    } finally {
      interactionEventPoint = undefined;
    }
    if (handleDrawingPointerMove(p)) return;
    updateDrawingHover(p);
  }) as EventListener);

  const finishPointer = (event: PointerEvent, canceled = false) => {
    if (activePointerId !== undefined && event.pointerId !== activePointerId) return;
    const p = point(event);
    session.handleInput(canceled ? { type: "pointerCancel" } : { type: "pointerUp", point: p });
    release(event.pointerId);
    activePointerId = undefined;
    if (canceled) {
      cancelPointerInteraction("pointerCancel");
      return;
    }
    if (priceAxisDrag !== undefined && priceAxisDrag.pointerId === event.pointerId) {
      priceAxisDrag = undefined;
      session.handleInput({ type: "cursor", cursor: "crosshair" });
      return;
    }
    if (timeAxisDrag !== undefined && timeAxisDrag.pointerId === event.pointerId) {
      timeAxisDrag = undefined;
      session.handleInput({ type: "cursor", cursor: "crosshair" });
      return;
    }
    if (!handleDrawingPointerUp(p)) interaction?.handlePointerUp(p);
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
    if (p.x >= layout.priceAxisArea.x) {
      manualPriceScale = undefined;
      updatePriceScale();
      scheduler.invalidate({ layers: ["axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"], reason: "priceAxisReset" });
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
      visualOutputs = configs.flatMap((config) =>
        config.visible ? results.get(config.instanceId)?.outputs ?? [] : []
      );
      syncVisualOutputs();
      updatePriceScale();
      refreshCrosshairAtPoint();
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
      if (!destroyed && generation === indicatorGeneration) options.onCalculationStatusChanged?.({ type: "idle" });
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
        options: defaultSeriesTransformOptions(type),
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
      if (!destroyed && generation === seriesGeneration) {
        options.onCalculationStatusChanged?.({ type: "idle" });
      }
      scheduleCalculationRecovery();
    }
  }

  return {
    setMaterializedSeries(input, anchorTime) {
      if (destroyed) return;
      const eventsWereSuspended = crosshairEventsSuspended;
      const previousMaterialized = materialized;
      const previousSeries = chartEngine.getState().series;
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
      ) manualPriceScale = undefined;
      clearCrosshairState();
      lastDataWindowIndex = undefined;
      visualOutputs = [];
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
    resetToLatest() {
      if (destroyed) return;
      resetChartView();
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
    setSeriesType(type) {
      if (destroyed) return;
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
      indicatorConfigs = configs.map((config) => structuredClone(config));
      visualOutputs = [];
      syncVisualOutputs();
      updatePriceScale();
      refreshCrosshairAtPoint();
      lastDataWindowIndex = undefined;
      emitDataWindow(true);
      scheduler.invalidate({
        layers: ["axis", "indicators", "visuals", "crosshair"],
        reason: "indicatorsChanged"
      });
      indicatorGeneration += 1;
      void calculateIndicators(indicatorConfigs, indicatorGeneration);
    },
    setMarks(nextMarks) { if (destroyed) return; marks = nextMarks.map((mark) => ({ ...mark })); rebuildMarkOutput(); updatePriceScale(); refreshCrosshairAtPoint(); scheduler.invalidate({ layers: ["axis", "visuals", "crosshair"], reason: "marksChanged" }); },
    setExecutions(nextExecutions) { if (destroyed) return; clearExecutionTooltip(); executions = nextExecutions.map((execution) => ({ ...execution })); rebuildExecutionOutput(); updatePriceScale(); refreshCrosshairAtPoint(); scheduler.invalidate({ layers: ["axis", "visuals", "crosshair", "tooltip"], reason: "executionsChanged" }); },
    setExecutionsVisible(visible) { if (destroyed || executionsVisible === visible) return; executionsVisible = visible; if (!visible) clearExecutionTooltip(); rebuildExecutionOutput(); updatePriceScale(); refreshCrosshairAtPoint(); scheduler.invalidate({ layers: ["axis", "visuals", "crosshair", "tooltip"], reason: "executionVisibilityChanged" }); },
    setPriceScaleMode(mode) { if (destroyed) return; manualPriceScale = undefined; viewport = { ...viewport, priceScaleMode: mode }; chartEngine.dispatch({ type: "setPriceScaleMode", mode }); rebuildInteraction(); scheduler.invalidate({ layers: ["axis", "series", "indicators", "visuals", "drawings", "crosshair"], reason: "priceScaleChanged" }); },
    setDrawings(drawings) { if (destroyed) return; drawingHandleDragOperation = undefined; drawingMoveDragOperation = undefined; hoveredDrawingId = undefined; drawingEditor = createEditor(drawings); refreshDrawingScale("drawingsReplaced"); emitDrawingHistoryState(); },
    setDrawingTool(tool) { if (destroyed) return; drawingEditor.setTool(tool); },
    executeDrawingCommand(command) { if (destroyed) return; drawingEditor.executeCommand(command); },
    undoDrawing() { if (destroyed) return; drawingEditor.undo(); refreshDrawingScale("drawingHistoryChanged"); emitDrawingState(); },
    redoDrawing() { if (destroyed) return; drawingEditor.redo(); refreshDrawingScale("drawingHistoryChanged"); emitDrawingState(); },
    setGridVisible(visible) { if (destroyed) return; if (chartEngine.getState().settings.gridVisible !== visible) { chartEngine.dispatch({ type: "toggleGrid" }); scheduler.invalidate({ layers: ["grid"], reason: "gridVisibilityChanged" }); } },
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
      options.onExecutionTooltipChanged?.(undefined);
      indicatorCalculationController?.abort();
      seriesCalculationController?.abort();
      indicatorCalculationController = undefined;
      seriesCalculationController = undefined;
      destroyed = true;
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
      chartEngine.destroy();
    }
  };
}
