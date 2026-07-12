import {
  createBandVisualRenderer,
  createChartEngine,
  createChartLayout,
  computeVisibleRange,
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
  drawingPointFromPointer,
  projectDrawingObject,
  renderOverlay,
  renderStaticChart,
  resizeCanvas,
  unprojectDrawingObject,
  type ChartCrosshairState,
  type DrawingEditor,
  type DrawingEditorCommand,
  type DrawingEditorTool,
  type DrawingObject,
  type IndicatorVisualOutput,
  type PriceScaleMode,
  type RenderMetrics,
  type SeriesRenderModel,
  type SeriesType,
  type StatefulSeriesTransformType,
  type ViewportState
} from "@simoncharts/chart-engine";
import type { Candle } from "../contracts";
import type { MaterializedSeries } from "../data/materializedSeries";
import type { CalculationStatus, CheckpointedCalculationRuntime } from "./checkpointedCalculationRuntime";
import type { IndicatorConfig } from "./indicatorRuntime";
import { formatShanghaiTime } from "./shanghaiTimeFormatter";
import { readWorkspaceChartTheme } from "./workspaceTheme";

export interface WorkspaceRuntimeMetrics extends RenderMetrics {
  maxMaterializedCandleCount: number;
}

export interface DataWindowIndicatorRow { id: string; label: string; value: string; }
export interface DataWindowSnapshot {
  crosshair: ChartCrosshairState;
  candle: Readonly<Candle>;
  formattedTime: string;
  change: number;
  changePercent: number;
  indicatorRows: readonly DataWindowIndicatorRow[];
}

export interface ChartEngineRuntime {
  setMaterializedSeries(input: MaterializedSeries, anchorTime?: number): void;
  setSeriesType(type: SeriesType): void;
  setIndicators(configs: readonly IndicatorConfig[]): void;
  setPriceScaleMode(mode: PriceScaleMode): void;
  setDrawings(drawings: readonly DrawingObject[]): void;
  setDrawingTool(tool: DrawingEditorTool): void;
  executeDrawingCommand(command: DrawingEditorCommand): void;
  undoDrawing(): void;
  redoDrawing(): void;
  setGridVisible(visible: boolean): void;
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
  onHistoryBoundary?: (anchorTime?: number) => void;
  onCalculationStatusChanged?: (status: CalculationStatus) => void;
  onDataWindowChanged?: (snapshot: DataWindowSnapshot | undefined) => void;
  onDrawingsChanged?: (drawings: readonly DrawingObject[], selectedDrawingIds: readonly string[]) => void;
  onDrawingHistoryChanged?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  onRenderError?: (error: unknown) => void;
}

const statefulTypes = new Set<SeriesType>(["heikinAshi", "renko", "lineBreak", "kagi", "pointAndFigure"]);

function isStatefulSeriesType(type: SeriesType): type is StatefulSeriesTransformType {
  return statefulTypes.has(type);
}

export function createChartEngineRuntime(options: ChartEngineRuntimeOptions): ChartEngineRuntime {
  let destroyed = false;
  let materialized: MaterializedSeries | undefined;
  let viewport = createInitialViewport(0, 1);
  let layout = createChartLayout(1, 1);
  let visualOutputs: IndicatorVisualOutput[] = [];
  let indicatorConfigs: readonly IndicatorConfig[] = [];
  let seriesModel: SeriesRenderModel | undefined;
  let crosshair: ChartCrosshairState | undefined;
  let maxMaterializedCandleCount = 0;
  let indicatorGeneration = 0;
  let seriesGeneration = 0;
  const emptySeries = { symbol: "", timeframe: "1d" as const, adjustMode: "none" as const, dataVersion: "", candles: [] };
  const chartEngine = createChartEngine({
    series: emptySeries,
    settings: { themeMode: "dark", candleColorScheme: "aShare" }
  });
  const session = createInteractionSession();
  let interaction: ReturnType<typeof createInteractionEngine> | undefined;
  let priceScale = createMainPanelPriceScale(emptySeries, viewport.visibleRange, "linear", [], []);
  const drawingRegistry = createDefaultDrawingRendererRegistry();
  const visualRegistry = createVisualRendererRegistry();
  visualRegistry.register(createLineVisualRenderer());
  visualRegistry.register(createHistogramVisualRenderer());
  visualRegistry.register(createBandVisualRenderer());
  visualRegistry.register(createMarkerVisualRenderer());
  let drawingEditor: DrawingEditor;

  const coordinateContext = () => ({
    series: chartEngine.getState().series,
    viewport,
    plotArea: layout.plotArea,
    priceScale
  });
  const emitDrawingState = (): void => {
    const state = drawingEditor.getState();
    options.onDrawingsChanged?.(
      state.drawings.map((drawing) => unprojectDrawingObject(drawing, coordinateContext())),
      state.selectedDrawingIds
    );
    const capabilities = drawingEditor.getCapabilities();
    options.onDrawingHistoryChanged?.({ canUndo: capabilities.canUndo, canRedo: capabilities.canRedo });
  };
  const createEditor = (drawings: readonly DrawingObject[]): DrawingEditor =>
    createDrawingEditor({
      drawings: drawings.map((drawing) => structuredClone(drawing)),
      coordinateAdapter: {
        toScreen: (drawing) => projectDrawingObject(drawing, coordinateContext()),
        toDomain: (drawing) => unprojectDrawingObject(drawing, coordinateContext())
      },
      onEvent: () => {
        syncDrawings();
        emitDrawingState();
      }
    });
  drawingEditor = createEditor([]);

  function syncDrawings(): void {
    const state = drawingEditor.getState();
    chartEngine.setDrawings(state.previewDrawing ? [...state.drawings, state.previewDrawing] : state.drawings);
    scheduler.invalidate({ layers: ["drawings"], reason: "drawingsChanged" });
  }

  function syncLayout(): void {
    const width = Math.max(1, Math.floor(options.themeRoot.clientWidth || options.staticCanvas.clientWidth || 1));
    const height = Math.max(1, Math.floor(options.themeRoot.clientHeight || options.staticCanvas.clientHeight || 1));
    const changed = width !== layout.width || height !== layout.height;
    layout = createChartLayout(width, height);
    const series = chartEngine.getState().series;
    if (changed) {
      viewport = {
        ...viewport,
        visibleRange: computeVisibleRange(viewport, series.candles.length, layout.plotArea.width)
      };
      chartEngine.setViewport(viewport);
      updateScaleAndInteraction();
    }
  }

  function updateScaleAndInteraction(): void {
    const state = chartEngine.getState();
    priceScale = createMainPanelPriceScale(state.series, viewport.visibleRange, viewport.priceScaleMode, visualOutputs, []);
    interaction = createInteractionEngine({
      series: state.series,
      viewport,
      priceScale,
      width: layout.plotArea.width,
      plotLeft: layout.plotArea.x,
      plotTop: layout.plotArea.y,
      plotHeight: layout.plotArea.height,
      onEvent(event) {
        if (event.type === "viewportChanged") {
          viewport = event.viewport;
          chartEngine.setViewport(viewport);
          updateScaleAndInteraction();
          options.onViewportChanged?.(viewport);
          if (viewport.visibleRange.from <= 5) options.onHistoryBoundary?.(chartEngine.getState().series.candles[viewport.visibleRange.from]?.time);
          scheduler.invalidate({ layers: ["axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair"], reason: "viewportChanged" });
          return;
        }
        crosshair = event.crosshair;
        session.handleInput({ type: "crosshair", crosshair });
        chartEngine.setInteractionState(session.getState());
        emitDataWindow();
        scheduler.invalidate({ layers: ["crosshair", "tooltip"], reason: "crosshairMoved" });
      }
    });
  }

  function emitDataWindow(): void {
    if (!crosshair) { options.onDataWindowChanged?.(undefined); return; }
    const candle = chartEngine.getState().series.candles[crosshair.index];
    if (!candle) { options.onDataWindowChanged?.(undefined); return; }
    const change = candle.close - candle.open;
    const indicatorRows = indicatorConfigs
      .filter((config) => config.visible)
      .map((config) => {
        const output = visualOutputs.find((candidate) => candidate.id === config.id);
        let value: number | null | undefined;
        if (output?.type === "line") value = output.values.find((point) => point.time === candle.time)?.value;
        else if (output?.type === "histogram") value = output.values.find((point) => point.time === candle.time)?.value;
        else if (output?.type === "band") value = output.upper.find((point) => point.time === candle.time)?.value;
        return { id: config.id, label: config.id, value: typeof value === "number" ? String(value) : "--" };
      });
    options.onDataWindowChanged?.({
      crosshair,
      candle: { ...candle },
      formattedTime: formatShanghaiTime(candle.time, chartEngine.getState().series.timeframe),
      change,
      changePercent: candle.open === 0 ? 0 : (change / candle.open) * 100,
      indicatorRows
    });
  }

  function render(pass: "static" | "dynamic" | "overlay"): void {
    if (destroyed) return;
    try {
      syncLayout();
      const state = chartEngine.getState();
      const theme = readWorkspaceChartTheme(options.themeRoot, options.getComputedStyle?.(options.themeRoot));
      const subPanelIds = [...new Set(visualOutputs.map((output) => output.panelId).filter((id): id is string => id !== undefined && id !== "main"))];
      const panels = createPanelLayout({
        width: layout.width,
        height: layout.height,
        rightAxisWidth: layout.rightAxisWidth,
        bottomAxisHeight: layout.bottomAxisHeight,
        panels: [
          { id: "main", kind: "main", label: "Main", heightRatio: 3 },
          ...subPanelIds.map((id) => ({ id, kind: "sub" as const, label: id, heightRatio: 1 }))
        ]
      });
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
        visualOutputs,
        drawings: state.drawings,
        selectedDrawingIds: drawingEditor.getState().selectedDrawingIds,
        crosshair
      };
      if (pass === "overlay") {
        const context = resizeCanvas(options.overlayCanvas, layout.width, layout.height, options.devicePixelRatio ?? 1);
        renderOverlay({ context, state: renderState });
      } else if (pass === "static") {
        const context = resizeCanvas(options.staticCanvas, layout.width, layout.height, options.devicePixelRatio ?? 1);
        const layers = createStaticLayers();
        if (state.settings.gridVisible === false) layers.splice(layers.findIndex((layer) => layer.id === "grid"), 1);
        layers.push(createVisualLayer(visualRegistry), createDrawingLayer(drawingRegistry));
        renderStaticChart({ context, state: renderState }, layers, { clear: true, paintBackground: true });
      }
    } catch (error) {
      options.onRenderError?.(error);
    }
  }

  const requestFrame = options.requestFrame ?? ((callback: () => void) => requestAnimationFrame(callback));
  const cancelFrame = options.cancelFrame ?? ((id: number) => cancelAnimationFrame(id));
  const scheduler = createRenderScheduler({ requestFrame, cancelFrame, renderPass: (pass) => render(pass) });
  const listeners: Array<[string, EventListener]> = [];
  const listen = (type: string, listener: EventListener) => {
    options.overlayCanvas.addEventListener(type, listener);
    listeners.push([type, listener]);
  };
  const point = (event: Event) => ({ x: (event as PointerEvent).offsetX, y: (event as PointerEvent).offsetY });
  listen("pointermove", ((event: Event) => {
    const p = point(event);
    session.handleInput({ type: "pointerMove", point: p });
    if (drawingEditor.getState().activeTool === "select") interaction?.handlePointerMove(p);
    else drawingEditor.pointerMove(drawingPointFromPointer(p, coordinateContext()));
  }) as EventListener);
  listen("pointerdown", ((event: Event) => {
    const p = point(event);
    session.handleInput({ type: "pointerDown", point: p, mode: drawingEditor.getState().activeTool === "select" ? "dragPan" : "drawing" });
    if (drawingEditor.getState().activeTool === "select") interaction?.handlePointerDown(p);
    else drawingEditor.pointerDown(drawingPointFromPointer(p, coordinateContext()));
  }) as EventListener);
  listen("pointerup", ((event: Event) => {
    const p = point(event);
    session.handleInput({ type: "pointerUp", point: p });
    if (drawingEditor.getState().activeTool === "select") interaction?.handlePointerUp(p);
    else drawingEditor.pointerUp(drawingPointFromPointer(p, coordinateContext()));
  }) as EventListener);
  listen("pointercancel", (() => { session.handleInput({ type: "pointerCancel" }); drawingEditor.cancel(); }) as EventListener);
  listen("wheel", ((event: Event) => { const wheel = event as WheelEvent; session.handleInput({ type: "wheel", point: { x: wheel.offsetX, y: wheel.offsetY }, deltaY: wheel.deltaY }); interaction?.handleWheel({ x: wheel.offsetX, deltaY: wheel.deltaY }); }) as EventListener);

  const observer = options.observer ?? (typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => scheduler.invalidate({ layers: ["grid", "axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"], reason: "resize", layoutRequired: true })));
  observer?.observe(options.themeRoot);
  syncLayout();

  async function calculateIndicators(configs: readonly IndicatorConfig[], generation: number): Promise<void> {
    if (!materialized) return;
    options.onCalculationStatusChanged?.({ type: "calculating", kind: "indicator", id: configs[0]?.id ?? "indicators", generation });
    try {
      const results = await options.calculationRuntime.calculateIndicators({ selection: materialized.selection, configs, targetTimes: new Set(materialized.series.candles.map((candle) => candle.time)), generation });
      if (destroyed || generation !== indicatorGeneration) return;
      visualOutputs = [...results.values()].flatMap((result) => result.outputs);
      chartEngine.setVisualOutputs(visualOutputs);
      updateScaleAndInteraction();
      scheduler.invalidate({ layers: ["axis", "series", "indicators", "visuals"], reason: "indicatorsCalculated" });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) options.onRenderError?.(error);
    } finally {
      if (!destroyed && generation === indicatorGeneration) options.onCalculationStatusChanged?.({ type: "idle" });
    }
  }

  return {
    setMaterializedSeries(input, anchorTime) {
      if (destroyed) return;
      materialized = input;
      maxMaterializedCandleCount = Math.max(maxMaterializedCandleCount, input.series.candles.length);
      chartEngine.setSeries(input.series);
      const next = createInitialViewport(input.series.candles.length, layout.plotArea.width);
      const anchorIndex = anchorTime === undefined ? -1 : input.series.candles.findIndex((candle) => candle.time === anchorTime);
      viewport = anchorIndex < 0 ? next : { ...next, scrollOffset: Math.max(0, input.series.candles.length - 1 - anchorIndex), visibleRange: { from: Math.max(0, anchorIndex - (next.visibleRange.to - next.visibleRange.from)), to: anchorIndex } };
      chartEngine.setViewport(viewport);
      updateScaleAndInteraction();
      scheduler.invalidate({ layers: ["grid", "axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"], reason: "seriesChanged", layoutRequired: true });
      if (indicatorConfigs.length > 0) {
        indicatorGeneration += 1;
        void calculateIndicators(indicatorConfigs, indicatorGeneration);
      }
      const activeType = chartEngine.getState().seriesType;
      if (isStatefulSeriesType(activeType)) this.setSeriesType(activeType);
    },
    setSeriesType(type) {
      if (destroyed) return;
      seriesGeneration += 1;
      const generation = seriesGeneration;
      if (!isStatefulSeriesType(type) || !materialized) {
        seriesModel = undefined;
        chartEngine.setSeriesType(type);
        scheduler.invalidate({ layers: ["series"], reason: "seriesTypeChanged" });
        return;
      }
      options.onCalculationStatusChanged?.({ type: "calculating", kind: "series", id: type, generation });
      void options.calculationRuntime.calculateSeries({ selection: materialized.selection, type, options: {}, targetTimes: new Set(materialized.series.candles.map((candle) => candle.time)), generation }).then((model) => {
        if (destroyed || generation !== seriesGeneration) return;
        seriesModel = model;
        chartEngine.setSeriesType(type);
        scheduler.invalidate({ layers: ["series"], reason: "seriesCalculated" });
        options.onCalculationStatusChanged?.({ type: "idle" });
      }, (error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) options.onRenderError?.(error);
        if (!destroyed && generation === seriesGeneration) options.onCalculationStatusChanged?.({ type: "idle" });
      });
    },
    setIndicators(configs) { if (destroyed) return; indicatorConfigs = configs.map((config) => structuredClone(config)); indicatorGeneration += 1; void calculateIndicators(indicatorConfigs, indicatorGeneration); },
    setPriceScaleMode(mode) { if (destroyed) return; viewport = { ...viewport, priceScaleMode: mode }; chartEngine.dispatch({ type: "setPriceScaleMode", mode }); updateScaleAndInteraction(); scheduler.invalidate({ layers: ["axis", "series", "indicators", "visuals", "drawings", "crosshair"], reason: "priceScaleChanged" }); },
    setDrawings(drawings) { if (destroyed) return; drawingEditor = createEditor(drawings); syncDrawings(); emitDrawingState(); },
    setDrawingTool(tool) { if (destroyed) return; drawingEditor.setTool(tool); },
    executeDrawingCommand(command) { if (destroyed) return; drawingEditor.executeCommand(command); },
    undoDrawing() { if (destroyed) return; drawingEditor.undo(); syncDrawings(); emitDrawingState(); },
    redoDrawing() { if (destroyed) return; drawingEditor.redo(); syncDrawings(); emitDrawingState(); },
    setGridVisible(visible) { if (destroyed) return; if (chartEngine.getState().settings.gridVisible !== visible) { chartEngine.dispatch({ type: "toggleGrid" }); scheduler.invalidate({ layers: ["grid"], reason: "gridVisibilityChanged" }); } },
    retryRender() { if (destroyed) return; scheduler.invalidate({ layers: ["grid", "axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair", "tooltip"], reason: "retryRender", layoutRequired: true }); },
    getMetrics() { return { ...scheduler.getState().metrics, maxMaterializedCandleCount }; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      indicatorGeneration += 1;
      seriesGeneration += 1;
      for (const [type, listener] of listeners) options.overlayCanvas.removeEventListener(type, listener);
      observer?.disconnect();
      scheduler.destroy();
      session.destroy();
      chartEngine.destroy();
    }
  };
}
