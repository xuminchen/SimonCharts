import {
  assertCandleSeries,
  calculateDefaultMovingAverages,
  createInteractionEngine,
  createChartEngine,
  createChartLayout,
  computeVisibleRange,
  createInitialViewport,
  createBandVisualRenderer,
  createHistogramVisualRenderer,
  createInteractionSession,
  createLineVisualRenderer,
  createMarkerVisualRenderer,
  createDefaultDrawingRendererRegistry,
  createDrawingEditor,
  createDrawingLayer,
  createPanelLayout,
  createRenderScheduler,
  createStaticLayers,
  createVisualLayer,
  createVisualRendererRegistry,
  defaultChartTheme,
  renderOverlay,
  fixtureDailyCandleSeries,
  renderStaticChart,
  resizeCanvas,
  supportedSeriesTypes
} from "@simoncharts/chart-engine";
import type {
  ChartCrosshairState,
  ChartLayout,
  ChartTheme,
  InteractionEngine,
  InteractionEvent,
  InteractionSessionEvent,
  LayerRenderContext,
  PanelArea,
  PanelDefinition,
  RenderInvalidation,
  DrawingEditorTool,
  DrawingObject,
  SeriesType,
  ThemeMode,
  ViewportState
} from "@simoncharts/chart-engine";
import { createDrawingToolbar } from "./drawingToolbar";
import { playgroundVisualOutputs } from "./fixtures/visualFixtures";
import { playgroundState } from "./playgroundState";
import "./styles.css";

declare global {
  interface Window {
    __SIMON_CHART_EVENTS__?: unknown[];
  }
}

assertCandleSeries(fixtureDailyCandleSeries);
window.__SIMON_CHART_EVENTS__ = [];
const chartEngine = createChartEngine({
  series: fixtureDailyCandleSeries,
  seriesType: playgroundState.seriesType
});

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Playground root element is missing");
}

const app = appElement;
const chartSurface = document.createElement("div");
const topControls = document.createElement("div");
const seriesTypeLabel = document.createElement("label");
const seriesTypeSelect = document.createElement("select");
const activeSeriesType = document.createElement("span");
const panelCount = document.createElement("span");
const visualOutputCount = document.createElement("span");
const toggleGridButton = document.createElement("button");
const gridState = document.createElement("span");
const invertPriceScaleButton = document.createElement("button");
const scaleState = document.createElement("span");
const themeModeLabel = document.createElement("label");
const themeModeSelect = document.createElement("select");
const themeState = document.createElement("span");
const cursorState = document.createElement("span");
const magnetState = document.createElement("span");
const lastKeyboardCommand = document.createElement("span");
const totalRenderCount = document.createElement("span");
const staticRenderCount = document.createElement("span");
const overlayRenderCount = document.createElement("span");
const lastInvalidationReason = document.createElement("span");
const canvas = document.createElement("canvas");
const overlayCanvas = document.createElement("canvas");
const resetButton = document.createElement("button");
let drawingToolbar: ReturnType<typeof createDrawingToolbar>;

chartSurface.className = "chart-surface";
topControls.className = "top-controls";
seriesTypeLabel.textContent = "Type";
seriesTypeSelect.dataset.testid = "series-type";
activeSeriesType.dataset.testid = "active-series-type";
activeSeriesType.hidden = true;
activeSeriesType.textContent = chartEngine.getState().seriesType;
panelCount.className = "status-item";
panelCount.dataset.testid = "panel-count";
visualOutputCount.className = "status-item";
visualOutputCount.dataset.testid = "visual-output-count";
toggleGridButton.type = "button";
toggleGridButton.dataset.testid = "toggle-grid";
toggleGridButton.textContent = "Grid";
gridState.className = "status-item";
gridState.dataset.testid = "grid-state";
invertPriceScaleButton.type = "button";
invertPriceScaleButton.dataset.testid = "invert-price-scale";
invertPriceScaleButton.textContent = "Invert";
scaleState.className = "status-item";
scaleState.dataset.testid = "scale-state";
themeModeLabel.textContent = "Theme";
themeModeSelect.dataset.testid = "theme-mode";
for (const mode of ["light", "dark"] as const) {
  const option = document.createElement("option");
  option.value = mode;
  option.textContent = mode;
  themeModeSelect.append(option);
}
themeState.className = "status-item";
themeState.dataset.testid = "theme-state";
for (const element of [
  cursorState,
  magnetState,
  lastKeyboardCommand,
  totalRenderCount,
  staticRenderCount,
  overlayRenderCount,
  lastInvalidationReason
]) {
  element.className = "status-item diagnostics-item";
}
cursorState.dataset.testid = "cursor-state";
magnetState.dataset.testid = "magnet-state";
lastKeyboardCommand.dataset.testid = "last-keyboard-command";
totalRenderCount.dataset.testid = "total-render-count";
staticRenderCount.dataset.testid = "static-render-count";
overlayRenderCount.dataset.testid = "overlay-render-count";
lastInvalidationReason.dataset.testid = "last-invalidation-reason";
canvas.dataset.testid = "chart-canvas";
canvas.setAttribute("aria-label", "SimonCharts static chart");
overlayCanvas.dataset.testid = "chart-overlay";
overlayCanvas.setAttribute("aria-label", "SimonCharts interaction overlay");
resetButton.type = "button";
resetButton.className = "reset-view";
resetButton.dataset.testid = "reset-view";
resetButton.textContent = "Reset";

for (const type of supportedSeriesTypes) {
  const option = document.createElement("option");
  option.value = type;
  option.textContent = type;
  option.selected = type === playgroundState.seriesType;
  seriesTypeSelect.append(option);
}

seriesTypeLabel.append(seriesTypeSelect);
themeModeLabel.append(themeModeSelect);
topControls.append(
  seriesTypeLabel,
  activeSeriesType,
  toggleGridButton,
  gridState,
  invertPriceScaleButton,
  scaleState,
  themeModeLabel,
  themeState,
  panelCount,
  visualOutputCount,
  cursorState,
  magnetState,
  lastKeyboardCommand,
  totalRenderCount,
  staticRenderCount,
  overlayRenderCount,
  lastInvalidationReason
);
const playgroundPanelDefinitions: PanelDefinition[] = [
  { id: "main", kind: "main", label: "Main", heightRatio: 3 },
  { id: "sub", kind: "sub", label: "Sub", heightRatio: 1 }
];
const drawingEditor = createDrawingEditor({
  drawings: [],
  onEvent(event) {
    window.__SIMON_CHART_EVENTS__?.push(event);
    syncDrawingStatus();
  }
});
drawingToolbar = createDrawingToolbar({
  setTool(tool) {
    drawingEditor.setTool(tool);
    drawingToolbar.setActiveTool(tool);
  },
  deleteSelected() {
    drawingEditor.deleteSelected();
    renderStatic();
  },
  lockSelected() {
    drawingEditor.lockSelected();
    renderStatic();
  },
  hideSelected() {
    drawingEditor.hideSelected();
    renderStatic();
  },
  undo() {
    drawingEditor.undo();
    renderStatic();
  },
  redo() {
    drawingEditor.redo();
    renderStatic();
  }
});
drawingToolbar.setActiveTool("select");
chartSurface.replaceChildren(canvas, overlayCanvas, topControls, drawingToolbar.element, resetButton);
app.replaceChildren(chartSurface);

const visualRendererRegistry = createVisualRendererRegistry();
visualRendererRegistry.register(createLineVisualRenderer());
visualRendererRegistry.register(createHistogramVisualRenderer());
visualRendererRegistry.register(createBandVisualRenderer());
visualRendererRegistry.register(createMarkerVisualRenderer());
const drawingRendererRegistry = createDefaultDrawingRendererRegistry();
const staticLayers = [
  ...createStaticLayers(),
  createVisualLayer(visualRendererRegistry),
  createDrawingLayer(drawingRendererRegistry)
];
const movingAverages = Object.values(calculateDefaultMovingAverages(fixtureDailyCandleSeries));
const darkChartTheme: ChartTheme = {
  ...defaultChartTheme,
  colors: {
    ...defaultChartTheme.colors,
    background: "#0f172a",
    grid: "#334155",
    text: "#e2e8f0",
    panelSeparator: "#475569",
    tooltip: {
      background: "#020617",
      text: "#f8fafc",
      border: "#475569"
    }
  }
};
let viewport: ViewportState | undefined;
let crosshair: ChartCrosshairState | undefined;
let layout: ChartLayout | undefined;
let panels: PanelArea[] = [];
let interactionEngine: InteractionEngine | undefined;
let drawingDragStart: { x: number; y: number } | undefined;
let lastKeyboardCommandText = "none";
let viewportCoversNextCrosshairClear = false;
let skipCurrentCrosshairRenderInvalidation = false;
let staticCanvasRenderCount = 0;
let overlayCanvasRenderCount = 0;

const interactionSession = createInteractionSession({
  onEvent(event) {
    handleInteractionSessionEvent(event);
  }
});

const renderScheduler = createRenderScheduler({
  requestFrame(callback) {
    return window.requestAnimationFrame(callback);
  },
  cancelFrame(frameId) {
    window.cancelAnimationFrame(frameId);
  },
  renderPass(pass, invalidation) {
    if (pass === "static") {
      renderStatic();
    }
    if (pass === "overlay") {
      renderOverlayCanvas();
    }
    queueMicrotask(() => syncRenderDiagnostics(invalidation));
  }
});

function syncLayout(): void {
  const width = Math.max(1, Math.floor(app.clientWidth));
  const height = Math.max(1, Math.floor(app.clientHeight));
  const nextLayout = createChartLayout(width, height);
  const layoutChanged = !layout || layout.width !== width || layout.height !== height;

  layout = nextLayout;
  panels = createPanelLayout({
    width: layout.width,
    height: layout.height,
    rightAxisWidth: layout.rightAxisWidth,
    bottomAxisHeight: layout.bottomAxisHeight,
    panels: playgroundPanelDefinitions
  });
  panelCount.textContent = `${panels.length} panels`;
  visualOutputCount.textContent = `${playgroundVisualOutputs.length} visuals`;
  syncDrawingStatus();

  if (!viewport) {
    viewport = createInitialViewport(fixtureDailyCandleSeries.candles.length, layout.plotArea.width);
  } else if (layoutChanged) {
    const visibleRange = computeVisibleRange(
      viewport,
      fixtureDailyCandleSeries.candles.length,
      layout.plotArea.width
    );

    viewport = {
      ...viewport,
      scrollOffset: Math.max(0, fixtureDailyCandleSeries.candles.length - 1 - visibleRange.to),
      visibleRange
    };
  }
  chartEngine.setViewport(viewport);

  if (layoutChanged || !interactionEngine) {
    crosshair = undefined;
    interactionEngine = createCurrentInteractionEngine();
  }
}

function renderStatic(): void {
  syncLayout();

  if (!layout || !viewport) {
    return;
  }

  const context = resizeCanvas(canvas, layout.width, layout.height, window.devicePixelRatio);
  const activeTheme = getActiveTheme();

  context.fillStyle = activeTheme.colors.background;
  context.fillRect(0, 0, layout.width, layout.height);

  renderStaticChart(createRenderContext(context, getMainPanelLayout()), getStaticLayers());
  staticCanvasRenderCount += 1;
}

function renderOverlayCanvas(): void {
  syncLayout();

  if (!layout || !viewport) {
    return;
  }

  const context = resizeCanvas(
    overlayCanvas,
    layout.width,
    layout.height,
    window.devicePixelRatio
  );

  renderOverlay(createRenderContext(context));
  overlayCanvasRenderCount += 1;
}

function createRenderContext(
  context: CanvasRenderingContext2D,
  renderLayout: ChartLayout = layout as ChartLayout
): LayerRenderContext {
  if (!layout || !viewport) {
    throw new Error("Chart layout is not ready");
  }

  return {
    context,
    state: {
      series: fixtureDailyCandleSeries,
      viewport,
      theme: getActiveTheme(),
      layout: renderLayout,
      movingAverages,
      crosshair,
      seriesType: chartEngine.getState().seriesType,
      panels,
      visualOutputs: playgroundVisualOutputs,
      drawings: drawingEditor.getState().drawings,
      selectedDrawingIds: drawingEditor.getState().selectedDrawingIds
    }
  };
}

function syncDrawingStatus(): void {
  const count = drawingEditor.getState().drawings.filter((drawing) => drawing.visible !== false).length;

  drawingToolbar.countElement.textContent = `${count} ${count === 1 ? "drawing" : "drawings"}`;
}

function syncEngineStatus(): void {
  const engineState = chartEngine.getState();

  gridState.textContent = engineState.settings.gridVisible ? "grid on" : "grid off";
  scaleState.textContent = engineState.invertedPriceScale ? "inverted" : "normal";
  themeModeSelect.value = engineState.settings.themeMode;
  themeState.textContent = engineState.settings.themeMode;
}

function getActiveTheme(): ChartTheme {
  return chartEngine.getState().settings.themeMode === "dark" ? darkChartTheme : defaultChartTheme;
}

function getStaticLayers(): typeof staticLayers {
  if (chartEngine.getState().settings.gridVisible) {
    return staticLayers;
  }

  return staticLayers.filter((layer) => layer.id !== "grid");
}

function getMainPanelLayout(): ChartLayout {
  if (!layout) {
    throw new Error("Chart layout is not ready");
  }

  const mainPanel = panels.find((panel) => panel.kind === "main") ?? panels[0];

  if (!mainPanel) {
    return layout;
  }

  return {
    ...layout,
    plotArea: mainPanel.plotArea,
    priceAxisArea: mainPanel.priceAxisArea
  };
}

function invalidateRender(invalidation: RenderInvalidation): void {
  renderScheduler.invalidate(invalidation);
  syncRenderDiagnostics(invalidation);
}

function handleInteractionSessionEvent(event: InteractionSessionEvent): void {
  window.__SIMON_CHART_EVENTS__?.push(event);

  if (event.type === "keyboardCommand") {
    lastKeyboardCommandText = event.command;
    chartEngine.dispatch({ type: event.command });
    invalidateRender({
      layers: ["axis", "series", "crosshair"],
      reason: "keyboardCommand",
      layoutRequired: true
    });
  }

  if (
    event.type === "pointerMoved" ||
    event.type === "pointerDragged" ||
    event.type === "pointerDragStarted" ||
    event.type === "pointerDragEnded" ||
    event.type === "wheelZoomed" ||
    event.type === "crosshairChanged" ||
    event.type === "tooltipChanged" ||
    event.type === "cursorChanged" ||
    event.type === "magnetTargetChanged"
  ) {
    if (!(event.type === "crosshairChanged" && skipCurrentCrosshairRenderInvalidation)) {
      invalidateRender({ layers: ["crosshair", "tooltip"], reason: event.type });
    }
  }

  chartEngine.setInteractionState(interactionSession.getState());
  syncInteractionDiagnostics();
}

function syncInteractionDiagnostics(): void {
  const state = interactionSession.getState();

  cursorState.textContent = state.cursor;
  magnetState.textContent = state.magnet.mode;
  lastKeyboardCommand.textContent = lastKeyboardCommandText;
}

function syncRenderDiagnostics(invalidation?: RenderInvalidation): void {
  const schedulerState = renderScheduler.getState();
  const metrics = schedulerState.metrics;
  const lastReason =
    invalidation?.reason ??
    metrics.lastInvalidationReasons[metrics.lastInvalidationReasons.length - 1] ??
    "none";

  totalRenderCount.textContent = String(metrics.totalRenderCount);
  staticRenderCount.textContent = String(staticCanvasRenderCount);
  overlayRenderCount.textContent = String(overlayCanvasRenderCount);
  lastInvalidationReason.textContent = lastReason;
  chartEngine.setRenderState(schedulerState);
}

function handleInteractionEvent(event: InteractionEvent): void {
  window.__SIMON_CHART_EVENTS__?.push(event);

  if (event.type === "viewportChanged") {
    viewport = event.viewport;
    chartEngine.setViewport(viewport);
    invalidateRender({
      layers: ["axis", "series", "volume", "indicators", "visuals", "drawings", "crosshair"],
      reason: "viewportChanged",
      layoutRequired: true
    });
    viewportCoversNextCrosshairClear = true;
    queueMicrotask(() => {
      viewportCoversNextCrosshairClear = false;
    });
    return;
  }

  crosshair = event.crosshair;
  skipCurrentCrosshairRenderInvalidation =
    viewportCoversNextCrosshairClear && crosshair === undefined;
  viewportCoversNextCrosshairClear = false;
  interactionSession.handleInput({ type: "crosshair", crosshair });
  skipCurrentCrosshairRenderInvalidation = false;
}

function createCurrentInteractionEngine(): InteractionEngine {
  if (!layout || !viewport) {
    throw new Error("Chart layout is not ready");
  }

  return createInteractionEngine({
    series: fixtureDailyCandleSeries,
    viewport,
    width: layout.plotArea.width,
    plotLeft: layout.plotArea.x,
    plotTop: layout.plotArea.y,
    plotHeight: layout.plotArea.height,
    onEvent: handleInteractionEvent
  });
}

function cancelPointerInteraction(): void {
  drawingDragStart = undefined;
  crosshair = undefined;
  if (layout && viewport) {
    interactionEngine = createCurrentInteractionEngine();
  }
}

function clearTransientInteraction(inputType: "leave" | "blur"): void {
  cancelPointerInteraction();
  lastKeyboardCommandText = "none";
  interactionSession.handleInput({ type: inputType });
  syncInteractionDiagnostics();
}

function getCanvasPoint(event: PointerEvent): { x: number; y: number } {
  const rect = overlayCanvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function getWheelPoint(event: WheelEvent): { x: number; y: number } {
  const rect = overlayCanvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

overlayCanvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const point = getWheelPoint(event);
    interactionSession.handleInput({
      type: "wheel",
      point,
      deltaY: event.deltaY
    });
    interactionEngine?.handleWheel({
      x: point.x,
      deltaY: event.deltaY
    });
  },
  { passive: false }
);

overlayCanvas.addEventListener("pointerdown", (event) => {
  overlayCanvas.setPointerCapture(event.pointerId);
  const point = getCanvasPoint(event);
  const handledDrawing = handleDrawingPointerDown(point);

  interactionSession.handleInput({
    type: "pointerDown",
    point,
    mode: handledDrawing ? "drawing" : "dragPan"
  });
  if (handledDrawing) {
    return;
  }
  interactionEngine?.handlePointerDown(point);
});

overlayCanvas.addEventListener("pointermove", (event) => {
  const point = getCanvasPoint(event);
  interactionSession.handleInput(
    interactionSession.getState().pointer.startPoint
      ? { type: "pointerDrag", point }
      : { type: "pointerMove", point }
  );
  if (handleDrawingPointerMove(event)) {
    return;
  }
  interactionEngine?.handlePointerMove(point);
});

const expectedLostPointerIds = new Set<number>();

function releasePointerCapture(pointerId: number): void {
  if (!overlayCanvas.hasPointerCapture(pointerId)) {
    return;
  }

  expectedLostPointerIds.add(pointerId);
  overlayCanvas.releasePointerCapture(pointerId);
}

function finishPointerInteraction(event: PointerEvent, canceled = false): void {
  const point = getCanvasPoint(event);

  interactionSession.handleInput(canceled ? { type: "pointerCancel" } : { type: "pointerUp", point });
  releasePointerCapture(event.pointerId);

  if (canceled) {
    cancelPointerInteraction();
    return;
  }

  if (handleDrawingPointerUp()) {
    return;
  }

  interactionEngine?.handlePointerUp(point);
}

overlayCanvas.addEventListener("pointerup", finishPointerInteraction);
overlayCanvas.addEventListener("pointercancel", (event) => finishPointerInteraction(event, true));
overlayCanvas.addEventListener("lostpointercapture", (event) => {
  if (expectedLostPointerIds.delete(event.pointerId)) {
    return;
  }

  finishPointerInteraction(event, true);
});
overlayCanvas.addEventListener("pointerleave", () => {
  clearTransientInteraction("leave");
});

window.addEventListener("keydown", (event) => {
  if (isEditableTarget(event.target) || !isChartKeyboardCommand(event)) {
    return;
  }

  event.preventDefault();
  interactionSession.handleInput({
    type: "keyboardDown",
    key: event.key,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey
  });
});

window.addEventListener("keyup", (event) => {
  if (isEditableTarget(event.target) || !isChartKeyboardCommand(event)) {
    return;
  }

  event.preventDefault();
  interactionSession.handleInput({
    type: "keyboardUp",
    key: event.key,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey
  });
});
window.addEventListener("blur", () => {
  clearTransientInteraction("blur");
});

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function isChartKeyboardCommand(event: KeyboardEvent): boolean {
  return (
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    (event.key === "+" || event.key === "-" || event.key === "0")
  );
}

resetButton.addEventListener("click", () => {
  interactionEngine?.resetView();
});

seriesTypeSelect.addEventListener("change", () => {
  chartEngine.setSeriesType(seriesTypeSelect.value as SeriesType);
  playgroundState.seriesType = chartEngine.getState().seriesType;
  activeSeriesType.textContent = chartEngine.getState().seriesType;
  render();
});

toggleGridButton.addEventListener("click", () => {
  chartEngine.dispatch({ type: "toggleGrid" });
  syncEngineStatus();
  render();
});

invertPriceScaleButton.addEventListener("click", () => {
  chartEngine.dispatch({ type: "invertPriceScale" });
  syncEngineStatus();
  render();
});

themeModeSelect.addEventListener("change", () => {
  chartEngine.dispatch({
    type: "setThemeMode",
    themeMode: themeModeSelect.value as ThemeMode
  });
  syncEngineStatus();
  render();
});

function render(): void {
  renderStatic();
  renderOverlayCanvas();
}

function handleDrawingPointerDown(point: { x: number; y: number }): boolean {
  const editorState = drawingEditor.getState();

  if (editorState.activeTool !== "select") {
    drawingEditor.pointerDown(point);
    renderStatic();
    return true;
  }

  const hitDrawing = hitTestDrawing(point, editorState.drawings);

  if (!hitDrawing) {
    return false;
  }

  drawingEditor.selectDrawing(hitDrawing.id);
  drawingDragStart = point;
  renderStatic();
  return true;
}

function handleDrawingPointerMove(event: PointerEvent): boolean {
  if (!drawingDragStart) {
    return false;
  }

  const point = getCanvasPoint(event);

  drawingEditor.dragSelected({
    dx: point.x - drawingDragStart.x,
    dy: point.y - drawingDragStart.y
  });
  drawingDragStart = point;
  renderStatic();
  return true;
}

function handleDrawingPointerUp(): boolean {
  if (!drawingDragStart) {
    return false;
  }

  drawingDragStart = undefined;
  return true;
}

function hitTestDrawing(
  point: { x: number; y: number },
  drawings: DrawingObject[]
): DrawingObject | undefined {
  const hits = drawings
    .filter((drawing) => drawing.visible !== false)
    .map((drawing) => ({
      drawing,
      hit: drawingRendererRegistry.require(drawing.type).hitTest(drawing, point)
    }))
    .filter((result): result is { drawing: DrawingObject; hit: { drawingId: string; distance: number } } =>
      result.hit !== undefined
    )
    .sort((left, right) => left.hit.distance - right.hit.distance);

  return hits[0]?.drawing;
}

window.addEventListener("resize", render);
syncEngineStatus();
syncInteractionDiagnostics();
syncRenderDiagnostics();
requestAnimationFrame(() => {
  render();
  syncRenderDiagnostics();
});
