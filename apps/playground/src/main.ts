import {
  assertCandleSeries,
  calculateCoreIndicator,
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
  createMainPanelPriceScale,
  createDefaultDrawingRendererRegistry,
  createDrawingEditor,
  createDrawingLayer,
  drawingPointFromPointer,
  createPanelLayout,
  createRenderScheduler,
  createStaticLayers,
  createVisualLayer,
  createVisualRendererRegistry,
  beginDrawingHandleDrag,
  beginDrawingMoveDrag,
  beginDrawingSelectionBox,
  coreIndicatorDefinitions,
  createDrawingAnchorMagnetTargets,
  defaultChartTheme,
  defaultChartTimeFormatter,
  builtInDrawingToolDefinitions,
  createOhlcMagnetTargetsFromSeries,
  deserializeDrawingObject,
  finishDrawingHandleDrag,
  finishDrawingMoveDrag,
  finishDrawingSelectionBox,
  getDrawingHoverState,
  getDrawingSelectionBounds,
  getDrawingPropertyDefinitionsForDrawing,
  getMagnetSnapState,
  hitTestDrawing,
  hitTestDrawingEditHandle,
  renderOverlay,
  fixtureDailyCandleSeries,
  projectDrawingObject,
  renderStaticChart,
  resizeCanvas,
  serializeDrawingObject,
  updateDrawingMoveDrag,
  updateDrawingSelectionBox,
  updateDrawingHandleDrag,
  unprojectDrawingObject,
  supportedPriceScaleModes,
  supportedTimeframes,
  supportedSeriesTypes
} from "@simoncharts/chart-engine";
import type {
  CandleSeries,
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
  IndicatorVisualOutput,
  CoreIndicatorDefinition,
  CoreIndicatorId,
  DrawingEditor,
  DrawingEditorCommand,
  DrawingEditorPoint,
  DrawingEditorTool,
  DrawingCoordinateContext,
  DrawingHandleDragOperation,
  DrawingMoveDragOperation,
  DrawingObject,
  DrawingPropertyDefinition,
  DrawingSelectionBoxOperation,
  MagnetSnapTarget,
  PriceScaleMode,
  SeriesType,
  ThemeMode,
  Timeframe,
  PriceScale,
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

function loadPlaygroundSeries(timeframe: Timeframe): CandleSeries {
  return {
    ...fixtureDailyCandleSeries,
    timeframe,
    dataVersion: `${fixtureDailyCandleSeries.dataVersion}:${timeframe}`,
    candles: fixtureDailyCandleSeries.candles.map((candle) => ({ ...candle }))
  };
}

let activeSeries = loadPlaygroundSeries(playgroundState.timeframe);

assertCandleSeries(activeSeries);
window.__SIMON_CHART_EVENTS__ = [];
const chartEngine = createChartEngine({
  series: activeSeries,
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
const timeframeLabel = document.createElement("label");
const timeframeSelect = document.createElement("select");
const activeTimeframe = document.createElement("span");
const indicatorLabel = document.createElement("label");
const indicatorSelector = document.createElement("select");
const activeSeriesType = document.createElement("span");
const panelCount = document.createElement("span");
const visualOutputCount = document.createElement("span");
const zoomInButton = document.createElement("button");
const zoomOutButton = document.createElement("button");
const toggleGridButton = document.createElement("button");
const gridState = document.createElement("span");
const invertPriceScaleButton = document.createElement("button");
const scaleState = document.createElement("span");
const priceScaleModeLabel = document.createElement("label");
const priceScaleModeSelect = document.createElement("select");
const priceScaleModeState = document.createElement("span");
const viewportCandleWidthState = document.createElement("span");
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
const panelTitleLayer = document.createElement("div");
const resetButton = document.createElement("button");
const drawingWorkbench = document.createElement("div");
const drawingObjectManager = document.createElement("div");
const drawingPropertyPanel = document.createElement("div");
const drawingJsonExport = document.createElement("textarea");
const drawingJsonImport = document.createElement("textarea");
const drawingImportButton = document.createElement("button");
const drawingJsonImportStatus = document.createElement("div");
let drawingToolbar: ReturnType<typeof createDrawingToolbar>;
let drawingEditor: DrawingEditor;

chartSurface.className = "chart-surface";
topControls.className = "top-controls";
seriesTypeLabel.textContent = "Type";
seriesTypeSelect.dataset.testid = "series-type";
timeframeLabel.textContent = "Timeframe";
timeframeSelect.dataset.testid = "timeframe";
activeTimeframe.dataset.testid = "active-timeframe";
activeTimeframe.hidden = true;
activeTimeframe.textContent = chartEngine.getState().series.timeframe;
indicatorLabel.textContent = "Indicator";
indicatorSelector.dataset.testid = "indicator-selector";
activeSeriesType.dataset.testid = "active-series-type";
activeSeriesType.hidden = true;
activeSeriesType.textContent = chartEngine.getState().seriesType;
panelCount.className = "status-item";
panelCount.dataset.testid = "panel-count";
visualOutputCount.className = "status-item";
visualOutputCount.dataset.testid = "visual-output-count";
zoomInButton.type = "button";
zoomInButton.dataset.testid = "zoom-in";
zoomInButton.textContent = "+";
zoomOutButton.type = "button";
zoomOutButton.dataset.testid = "zoom-out";
zoomOutButton.textContent = "−";
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
priceScaleModeLabel.textContent = "Scale";
priceScaleModeSelect.dataset.testid = "price-scale-mode-control";
priceScaleModeState.className = "status-item diagnostics-item";
priceScaleModeState.dataset.testid = "price-scale-mode";
viewportCandleWidthState.className = "status-item diagnostics-item";
viewportCandleWidthState.dataset.testid = "viewport-candle-width";
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
panelTitleLayer.className = "panel-title-layer";
resetButton.type = "button";
resetButton.className = "reset-view";
resetButton.dataset.testid = "reset-view";
resetButton.textContent = "Reset";
drawingWorkbench.className = "drawing-workbench";
drawingObjectManager.className = "drawing-workbench-section";
drawingObjectManager.dataset.testid = "drawing-object-manager";
drawingPropertyPanel.className = "drawing-workbench-section";
drawingPropertyPanel.dataset.testid = "drawing-property-panel";
drawingJsonExport.className = "drawing-json";
drawingJsonExport.dataset.testid = "drawing-json-export";
drawingJsonExport.readOnly = true;
drawingJsonExport.spellcheck = false;
drawingJsonImport.className = "drawing-json";
drawingJsonImport.dataset.testid = "drawing-json-import";
drawingJsonImport.spellcheck = false;
drawingJsonImport.placeholder = "Paste drawing JSON";
drawingImportButton.type = "button";
drawingImportButton.dataset.testid = "drawing-json-import-apply";
drawingImportButton.textContent = "Import";
drawingJsonImportStatus.className = "drawing-import-status";
drawingJsonImportStatus.dataset.testid = "drawing-json-import-status";
drawingWorkbench.append(
  drawingObjectManager,
  drawingPropertyPanel,
  drawingJsonExport,
  drawingJsonImport,
  drawingImportButton,
  drawingJsonImportStatus
);

for (const type of supportedSeriesTypes) {
  const option = document.createElement("option");
  option.value = type;
  option.textContent = type;
  option.selected = type === playgroundState.seriesType;
  seriesTypeSelect.append(option);
}

for (const timeframe of supportedTimeframes) {
  const option = document.createElement("option");

  option.value = timeframe;
  option.textContent = timeframe;
  option.selected = timeframe === playgroundState.timeframe;
  timeframeSelect.append(option);
}

for (const mode of supportedPriceScaleModes) {
  const option = document.createElement("option");

  option.value = mode;
  option.textContent = mode;
  priceScaleModeSelect.append(option);
}

const fixtureIndicatorOption = document.createElement("option");
fixtureIndicatorOption.value = "";
fixtureIndicatorOption.textContent = "Fixture";
fixtureIndicatorOption.selected = true;
indicatorSelector.append(fixtureIndicatorOption);

for (const definition of coreIndicatorDefinitions) {
  const option = document.createElement("option");

  option.value = definition.id;
  option.textContent = definition.id;
  indicatorSelector.append(option);
}

seriesTypeLabel.append(seriesTypeSelect);
timeframeLabel.append(timeframeSelect);
indicatorLabel.append(indicatorSelector);
priceScaleModeLabel.append(priceScaleModeSelect);
themeModeLabel.append(themeModeSelect);
topControls.append(
  seriesTypeLabel,
  timeframeLabel,
  activeTimeframe,
  indicatorLabel,
  activeSeriesType,
  zoomInButton,
  zoomOutButton,
  toggleGridButton,
  gridState,
  invertPriceScaleButton,
  scaleState,
  priceScaleModeLabel,
  priceScaleModeState,
  viewportCandleWidthState,
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
const fixturePanelDefinitions: PanelDefinition[] = [
  { id: "main", kind: "main", label: "Main", heightRatio: 3 },
  { id: "sub", kind: "sub", label: "Sub", heightRatio: 1 }
];
const drawingMagnetRadius = 10;
drawingEditor = createPlaygroundDrawingEditor([]);
drawingToolbar = createDrawingToolbar({
  tools: builtInDrawingToolDefinitions,
  setTool(tool) {
    executeDrawingCommand({ type: "setTool", tool });
    drawingToolbar.setActiveTool(tool);
  },
  copySelected() {
    executeDrawingCommand({ type: "copySelected" });
  },
  pasteCopied() {
    executeDrawingCommand({ type: "pasteCopied", offset: { dx: 12, dy: 12 } });
  },
  duplicateSelected() {
    executeDrawingCommand({ type: "duplicateSelected", offset: { dx: 12, dy: 12 } });
  },
  bringSelectedForward() {
    executeDrawingCommand({ type: "bringSelectedForward" });
  },
  sendSelectedBackward() {
    executeDrawingCommand({ type: "sendSelectedBackward" });
  },
  deleteSelected() {
    executeDrawingCommand({ type: "deleteSelected" });
  },
  lockSelected() {
    executeDrawingCommand({ type: "lockSelected" });
  },
  unlockSelected() {
    executeDrawingCommand({ type: "unlockSelected" });
  },
  hideSelected() {
    executeDrawingCommand({ type: "hideSelected" });
  },
  showSelected() {
    executeDrawingCommand({ type: "showSelected" });
  },
  undo() {
    drawingEditor.undo();
    setDrawingHoverId(undefined);
    clearDrawingMagnetState();
    renderStatic();
  },
  redo() {
    drawingEditor.redo();
    setDrawingHoverId(undefined);
    clearDrawingMagnetState();
    renderStatic();
  }
});
drawingToolbar.setActiveTool("select");
drawingToolbar.setCapabilities(drawingEditor.getCapabilities());
chartSurface.replaceChildren(
  canvas,
  overlayCanvas,
  panelTitleLayer,
  topControls,
  drawingToolbar.element,
  drawingWorkbench,
  resetButton
);
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
let movingAverages = Object.values(calculateDefaultMovingAverages(activeSeries));
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
  },
  lineDashes: {
    grid: [1, 3]
  }
};
let viewport: ViewportState | undefined;
let priceScale: PriceScale | undefined;
let drawingCoordinateContext: DrawingCoordinateContext | undefined;
let crosshair: ChartCrosshairState | undefined;
let layout: ChartLayout | undefined;
let panels: PanelArea[] = [];
let interactionEngine: InteractionEngine | undefined;
let drawingHandleDragOperation: DrawingHandleDragOperation | undefined;
let drawingHandleDragPoint: { x: number; y: number } | undefined;
let drawingMoveDragOperation: DrawingMoveDragOperation | undefined;
let drawingMoveDragPoint: { x: number; y: number } | undefined;
let drawingSelectionBoxOperation: DrawingSelectionBoxOperation | undefined;
let drawingSelectionPreviewIds: string[] | undefined;
let drawingPreviewDrawings: DrawingObject[] | undefined;
let drawingHoveredDrawingId: string | undefined;
let lastKeyboardCommandText = "none";
let viewportCoversNextCrosshairClear = false;
let skipCurrentCrosshairRenderInvalidation = false;
let staticCanvasRenderCount = 0;
let overlayCanvasRenderCount = 0;
let activeIndicatorDefinition: CoreIndicatorDefinition | undefined;
let activeVisualOutputs: IndicatorVisualOutput[] = playgroundVisualOutputs;

function updateMainPriceScale(): void {
  if (!viewport) {
    throw new Error("Chart viewport is not ready");
  }

  priceScale = createMainPanelPriceScale(
    activeSeries,
    viewport.visibleRange,
    viewport.priceScaleMode,
    activeVisualOutputs,
    movingAverages
  );
  if (layout) {
    drawingCoordinateContext = {
      series: activeSeries,
      viewport,
      plotArea: getMainPanelLayout().plotArea,
      priceScale
    };
  }
  interactionEngine?.setPriceScale(priceScale);
}

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
    panels: getPlaygroundPanelDefinitions()
  });
  panelCount.textContent = `${panels.length} panels`;
  visualOutputCount.textContent = `${activeVisualOutputs.length} visuals`;
  syncPanelTitles();

  if (!viewport) {
    viewport = createInitialViewport(activeSeries.candles.length, layout.plotArea.width);
  } else if (layoutChanged) {
    const visibleRange = computeVisibleRange(
      viewport,
      activeSeries.candles.length,
      layout.plotArea.width
    );

    viewport = {
      ...viewport,
      scrollOffset: Math.max(0, activeSeries.candles.length - 1 - visibleRange.to),
      visibleRange
    };
  }
  if (!priceScale || layoutChanged) {
    updateMainPriceScale();
  }
  syncDrawingStatus();
  syncChartEngineDrawings();
  chartEngine.setViewport(viewport);
  if (layoutChanged) {
    syncEngineStatus();
  }

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

  renderOverlay(createRenderContext(context, getMainPanelLayout()));
  overlayCanvasRenderCount += 1;
}

function createRenderContext(
  context: CanvasRenderingContext2D,
  renderLayout: ChartLayout = layout as ChartLayout
): LayerRenderContext {
  if (!layout || !viewport || !priceScale) {
    throw new Error("Chart layout is not ready");
  }

  return {
    context,
    state: {
      series: activeSeries,
      viewport,
      priceScale,
      formatTime: defaultChartTimeFormatter,
      theme: getActiveTheme(),
      layout: renderLayout,
      movingAverages,
      crosshair,
      seriesType: chartEngine.getState().seriesType,
      panels,
      visualOutputs: activeVisualOutputs,
      drawings: drawingPreviewDrawings ?? chartEngine.getState().drawings,
      selectedDrawingIds: drawingSelectionPreviewIds ?? drawingEditor.getState().selectedDrawingIds,
      hoveredDrawingId: drawingHoveredDrawingId
    }
  };
}

function syncChartEngineDrawings(): void {
  if (!drawingCoordinateContext) {
    return;
  }

  const editorState = drawingEditor.getState();
  const drawings = editorState.previewDrawing
    ? [...editorState.drawings, editorState.previewDrawing]
    : editorState.drawings;

  chartEngine.setDrawings(drawings);
}

function syncDrawingStatus(): void {
  const count = drawingEditor.getState().drawings.filter((drawing) => drawing.visible !== false).length;

  drawingToolbar.countElement.textContent = `${count} ${count === 1 ? "drawing" : "drawings"}`;
  drawingToolbar.setCapabilities(drawingEditor.getCapabilities());
  syncDrawingWorkbench();
}

function executeDrawingCommand(command: DrawingEditorCommand): void {
  drawingEditor.executeCommand(
    command.type === "dragAnchor"
      ? {
          ...command,
          point: drawingPointFromPointer(command.point, requireDrawingCoordinateContext())
        }
      : command
  );
  drawingToolbar.setActiveTool(drawingEditor.getState().activeTool);
  setDrawingHoverId(undefined);
  clearDrawingMagnetState();
  renderStatic();
}

function syncDrawingWorkbench(): void {
  syncDrawingObjectManager();
  syncDrawingPropertyPanel();
  syncDrawingJsonExport();
}

function syncDrawingObjectManager(): void {
  const items = drawingEditor.getObjectManagerItems();
  const handles = drawingEditor.getSelectedEditHandles();

  drawingObjectManager.replaceChildren(createWorkbenchTitle("Objects"));
  drawingObjectManager.append(createDrawingHandleSummary(handles.length));
  drawingObjectManager.append(createDrawingTransformControls());

  if (items.length === 0) {
    const empty = document.createElement("div");

    empty.className = "drawing-empty";
    empty.textContent = "No drawings";
    drawingObjectManager.append(empty);
    return;
  }

  for (const item of items) {
    const button = document.createElement("button");
    const flags = [
      item.selected ? "selected" : "",
      item.locked ? "locked" : "unlocked",
      item.visible ? "visible" : "hidden"
    ].filter(Boolean);

    button.type = "button";
    button.className = "drawing-object-row";
    button.dataset.drawingId = item.id;
    button.dataset.selected = String(item.selected);
    button.textContent = `${item.type} ${item.id} z${item.zIndex} ${flags.join(" ")}`;
    button.addEventListener("click", () => {
      drawingEditor.selectDrawing(item.id);
      renderStatic();
    });
    drawingObjectManager.append(button);
  }
}

function createDrawingHandleSummary(count: number): HTMLDivElement {
  const summary = document.createElement("div");

  summary.className = "drawing-property-summary";
  summary.dataset.testid = "drawing-handle-count";
  summary.textContent = `${count} handles`;

  return summary;
}

function createDrawingTransformControls(): HTMLDivElement {
  const controls = document.createElement("div");
  const resizeButton = document.createElement("button");
  const rotateButton = document.createElement("button");
  const canTransform = drawingEditor.getCapabilities().hasEditableSelection;

  controls.className = "drawing-transform-controls";
  resizeButton.type = "button";
  resizeButton.dataset.testid = "resize-drawing";
  resizeButton.textContent = "Resize";
  resizeButton.disabled = !canTransform;
  resizeButton.addEventListener("click", () => {
    resizeSelectedDrawing();
  });

  rotateButton.type = "button";
  rotateButton.dataset.testid = "rotate-drawing";
  rotateButton.textContent = "Rotate";
  rotateButton.disabled = !canTransform;
  rotateButton.addEventListener("click", () => {
    rotateSelectedDrawing();
  });

  controls.append(resizeButton, rotateButton);

  return controls;
}

function resizeSelectedDrawing(): void {
  const bounds = getEditableSelectionBounds();

  if (!bounds) {
    return;
  }

  executeDrawingCommand({
    type: "resizeSelected",
    options: {
      handle: "bottomRight",
      fromBounds: bounds,
      toPoint: {
        x: bounds.x + bounds.width + 12,
        y: bounds.y + bounds.height + 12
      }
    }
  });
}

function rotateSelectedDrawing(): void {
  const bounds = getEditableSelectionBounds();

  if (!bounds) {
    return;
  }

  executeDrawingCommand({
    type: "rotateSelected",
    options: {
      center: {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2
      },
      angleRadians: Math.PI / 2
    }
  });
}

function getEditableSelectionBounds(): ReturnType<typeof getDrawingSelectionBounds> {
  const state = drawingEditor.getState();
  const selectedIds = new Set(state.selectedDrawingIds);

  return getDrawingSelectionBounds(
    state.drawings.filter((drawing) => selectedIds.has(drawing.id) && drawing.locked !== true)
  );
}

function syncDrawingPropertyPanel(): void {
  const state = drawingEditor.getState();
  const selected = state.drawings.filter((drawing) => state.selectedDrawingIds.includes(drawing.id));
  const capabilities = drawingEditor.getCapabilities();

  drawingPropertyPanel.replaceChildren(createWorkbenchTitle("Properties"));

  const selectedIds = document.createElement("div");

  selectedIds.className = "drawing-property-summary";
  selectedIds.textContent =
    selected.length === 0 ? "Selection: none" : `Selection: ${selected.map((drawing) => drawing.id).join(", ")}`;
  drawingPropertyPanel.append(selectedIds);

  if (selected.length === 0) {
    return;
  }

  for (const property of getDrawingPropertyDefinitionsForDrawing(selected[0])) {
    const control = createDrawingPropertyControl(property, selected[0], capabilities.hasEditableSelection);

    drawingPropertyPanel.append(createLabeledControl(property.label, control));
  }
}

function syncDrawingJsonExport(): void {
  const state = drawingEditor.getState();
  const payload = {
    schemaVersion: 1,
    drawings: state.drawings.map((drawing) =>
      serializeDrawingObject(
        unprojectDrawingObject(drawing, requireDrawingCoordinateContext())
      )
    ),
    selectedDrawingIds: state.selectedDrawingIds
  };

  drawingJsonExport.value = JSON.stringify(payload, null, 2);
}

function setDrawingImportStatus(message: string, kind: "error" | "success" | undefined): void {
  drawingJsonImportStatus.textContent = message;
  drawingJsonImportStatus.dataset.status = kind ?? "";
}

function createPlaygroundDrawingEditor(drawings: DrawingObject[]): DrawingEditor {
  return createDrawingEditor({
    drawings: drawings.map(normalizeInitialDrawingToDomain),
    coordinateAdapter: {
      toScreen(drawing) {
        return projectDrawingObject(drawing, requireDrawingCoordinateContext());
      },
      toDomain(drawing) {
        return unprojectDrawingObject(drawing, requireDrawingCoordinateContext());
      }
    },
    onEvent(event) {
      window.__SIMON_CHART_EVENTS__?.push(event);
      syncDrawingStatus();
    }
  });
}

function normalizeInitialDrawingToDomain(drawing: DrawingObject): DrawingObject {
  const domainDrawing = structuredClone(drawing);

  domainDrawing.anchors = drawing.anchors.map((anchor) => {
    if (Number.isFinite(anchor.x) && Number.isFinite(anchor.y)) {
      return unprojectDrawingObject(
        { ...drawing, anchors: [{ ...anchor }] },
        requireDrawingCoordinateContext()
      ).anchors[0];
    }

    return { time: anchor.time, price: anchor.price };
  });
  return domainDrawing;
}

function getPlaygroundPanelDefinitions(): PanelDefinition[] {
  if (!activeIndicatorDefinition) {
    return fixturePanelDefinitions;
  }

  if (activeIndicatorDefinition.panelId === "main") {
    return [{ id: "main", kind: "main", label: "Main", heightRatio: 1 }];
  }

  return [
    { id: "main", kind: "main", label: "Main", heightRatio: 3 },
    {
      id: activeIndicatorDefinition.panelId,
      kind: "sub",
      label: activeIndicatorDefinition.id,
      heightRatio: 1
    }
  ];
}

function syncPanelTitles(): void {
  panelTitleLayer.replaceChildren();

  for (const panel of panels) {
    const title = document.createElement("div");
    const yOffset =
      panel.plotArea.y === 0 ? Math.min(144, Math.max(8, panel.plotArea.height - 28)) : 8;

    title.className = "panel-title";
    title.dataset.testid = `panel-title-${panel.id}`;
    title.textContent = panel.label;
    title.style.left = `${panel.plotArea.x + 12}px`;
    title.style.top = `${panel.plotArea.y + yOffset}px`;
    panelTitleLayer.append(title);
  }
}

function createWorkbenchTitle(label: string): HTMLDivElement {
  const title = document.createElement("div");

  title.className = "drawing-workbench-title";
  title.textContent = label;

  return title;
}

function createLabeledControl(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement("label");
  const text = document.createElement("span");

  label.className = "drawing-property-control";
  text.textContent = labelText;
  label.append(text, control);

  return label;
}

function createDrawingPropertyControl(
  property: DrawingPropertyDefinition,
  drawing: DrawingObject,
  canEditSelected: boolean
): HTMLElement {
  if (property.scope === "content") {
    const input = document.createElement("input");

    input.type = "text";
    input.dataset.testid = "drawing-text";
    input.value = drawing.text ?? property.defaultValue ?? "";
    input.placeholder = property.label;
    input.disabled = !canEditSelected;
    input.addEventListener("change", () => {
      drawingEditor.executeCommand({ type: property.commandType, text: input.value });
      renderStatic();
    });

    return input;
  }

  if (property.scope === "state") {
    const input = document.createElement("input");

    input.type = "checkbox";
    input.dataset.testid = `drawing-state-${property.stateKey}`;
    input.checked = property.stateKey === "visible" ? drawing.visible !== false : drawing.locked === true;
    input.disabled = !canExecuteStateProperty(property, input.checked);
    input.addEventListener("change", () => {
      drawingEditor.executeCommand({
        type: input.checked ? property.commandWhenTrue : property.commandWhenFalse
      });
      renderStatic();
    });

    return input;
  }

  if (property.scope === "parameters") {
    const input = document.createElement("input");

    input.type = "text";
    input.dataset.testid = `drawing-parameter-${property.metadataKey}`;
    input.value = parameterValueToInput(drawing.metadata?.[property.metadataKey], property.defaultValue);
    input.placeholder = property.valueType === "numberList" ? "0, 0.5, 1" : property.label;
    input.disabled = !canEditSelected;
    input.addEventListener("change", () => {
      const value =
        property.valueType === "numberList" ? parseNumberList(input.value, property.defaultValue) : input.value;

      drawingEditor.executeCommand({
        type: property.commandType,
        metadata: { [property.metadataKey]: value }
      });
      renderStatic();
    });

    return input;
  }

  if (property.valueType === "lineDash") {
    const select = document.createElement("select");

    select.dataset.testid = "drawing-style-line";
    select.disabled = !canEditSelected;

    for (const option of property.options ?? []) {
      const element = document.createElement("option");

      element.value = option.value;
      element.textContent = option.label;
      element.selected = option.value === lineDashToOption(drawing.style?.lineDash);
      select.append(element);
    }

    select.addEventListener("change", () => {
      drawingEditor.executeCommand({
        type: property.commandType,
        style: { [property.styleKey]: optionToLineDash(select.value) }
      });
      renderStatic();
    });

    return select;
  }

  const input = document.createElement("input");

  input.dataset.testid = drawingStyleTestId(property.styleKey);
  input.disabled = !canEditSelected;

  if (property.valueType === "number") {
    input.type = "number";
    input.min = property.min === undefined ? "" : String(property.min);
    input.max = property.max === undefined ? "" : String(property.max);
    input.step = property.step === undefined ? "1" : String(property.step);
    input.value = String(drawing.style?.[property.styleKey] ?? property.defaultValue ?? "");
    input.addEventListener("change", () => {
      const value = Number(input.value);

      if (Number.isFinite(value)) {
        drawingEditor.executeCommand({
          type: property.commandType,
          style: { [property.styleKey]: value }
        });
        renderStatic();
      }
    });

    return input;
  }

  input.type = "color";
  input.value = normalizeHexColor(String(drawing.style?.[property.styleKey] ?? "")) ??
    normalizeHexColor(String(property.defaultValue ?? "")) ??
    "#2563eb";
  input.addEventListener("input", () => {
    drawingEditor.executeCommand({
      type: property.commandType,
      style: { [property.styleKey]: input.value }
    });
    renderStatic();
  });

  return input;
}

function canExecuteStateProperty(property: Extract<DrawingPropertyDefinition, { scope: "state" }>, current: boolean): boolean {
  const capabilities = drawingEditor.getCapabilities();
  const command = current ? property.commandWhenFalse : property.commandWhenTrue;

  switch (command) {
    case "hideSelected":
      return capabilities.canHide;
    case "showSelected":
      return capabilities.canShow;
    case "lockSelected":
      return capabilities.canLock;
    case "unlockSelected":
      return capabilities.canUnlock;
  }
}

function drawingStyleTestId(styleKey: string): string {
  switch (styleKey) {
    case "color":
      return "drawing-style-color";
    case "lineWidth":
      return "drawing-style-width";
    case "fill":
      return "drawing-style-fill";
    case "textColor":
      return "drawing-style-text-color";
    case "fontSize":
      return "drawing-style-font-size";
    default:
      return `drawing-style-${styleKey}`;
  }
}

function lineDashToOption(lineDash: number[] | undefined): string {
  if (!lineDash || lineDash.length === 0) {
    return "solid";
  }

  if (lineDash[0] === 2) {
    return "dotted";
  }

  return "dashed";
}

function optionToLineDash(value: string): number[] {
  if (value === "dashed") {
    return [6, 4];
  }

  if (value === "dotted") {
    return [2, 3];
  }

  return [];
}

function parameterValueToInput(value: unknown, defaultValue: string | number[] | undefined): string {
  if (Array.isArray(value)) {
    return value.filter((item): item is number => Number.isFinite(item)).join(", ");
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(defaultValue)) {
    return defaultValue.join(", ");
  }

  return defaultValue ?? "";
}

function parseNumberList(value: string, defaultValue: string | number[] | undefined): number[] {
  const numbers = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));

  if (numbers.length > 0) {
    return numbers;
  }

  return Array.isArray(defaultValue) ? defaultValue : [];
}

function normalizeHexColor(value: string | undefined): string | undefined {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
}

function parseDrawingImport(value: string): { drawings: DrawingObject[]; selectedDrawingIds: string[] } {
  const parsed = JSON.parse(value) as unknown;
  const payload = Array.isArray(parsed)
    ? { drawings: parsed, selectedDrawingIds: [] }
    : parsed;

  if (!isDrawingImportPayload(payload)) {
    throw new Error("Drawing import must be an array or an object with drawings");
  }

  return {
    drawings: payload.drawings.map(deserializeDrawingObject),
    selectedDrawingIds: (payload.selectedDrawingIds ?? []).filter(
      (id): id is string => typeof id === "string"
    )
  };
}

function isDrawingImportPayload(
  value: unknown
): value is { drawings: unknown[]; selectedDrawingIds?: string[] } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as { drawings?: unknown; selectedDrawingIds?: unknown };

  return (
    Array.isArray(payload.drawings) &&
    (payload.selectedDrawingIds === undefined || Array.isArray(payload.selectedDrawingIds))
  );
}

function syncEngineStatus(): void {
  const engineState = chartEngine.getState();

  timeframeSelect.value = engineState.series.timeframe;
  activeTimeframe.textContent = engineState.series.timeframe;
  gridState.textContent = engineState.settings.gridVisible ? "grid on" : "grid off";
  scaleState.textContent = engineState.invertedPriceScale ? "inverted" : "normal";
  priceScaleModeState.textContent = priceScale?.mode ?? engineState.viewport.priceScaleMode;
  priceScaleModeSelect.value = engineState.viewport.priceScaleMode;
  viewportCandleWidthState.textContent = String(engineState.viewport.candleWidth);
  themeModeSelect.value = engineState.settings.themeMode;
  themeState.textContent = engineState.settings.themeMode;
}

function syncViewportCommandState(): void {
  const nextViewport = chartEngine.getState().viewport;

  handleInteractionEvent({
    type: "viewportChanged",
    viewport: nextViewport,
    visibleRange: nextViewport.visibleRange
  });
  if (crosshair) {
    handleInteractionEvent({ type: "crosshairMoved", crosshair: undefined });
  }
  interactionEngine = createCurrentInteractionEngine();
  syncEngineStatus();
}

function setPlaygroundTimeframe(timeframe: Timeframe): void {
  const priceScaleMode = chartEngine.getState().viewport.priceScaleMode;

  cancelPointerInteraction();
  activeSeries = loadPlaygroundSeries(timeframe);
  assertCandleSeries(activeSeries);
  playgroundState.timeframe = timeframe;
  chartEngine.setSeries(activeSeries);
  movingAverages = Object.values(calculateDefaultMovingAverages(activeSeries));
  activeVisualOutputs = activeIndicatorDefinition
    ? calculateCoreIndicator(activeIndicatorDefinition.id, activeSeries).outputs
    : playgroundVisualOutputs;

  if (layout) {
    viewport = {
      ...createInitialViewport(activeSeries.candles.length, layout.plotArea.width),
      priceScaleMode
    };
    chartEngine.setViewport(viewport);
  }

  priceScale = undefined;
  drawingCoordinateContext = undefined;
  interactionEngine = undefined;
  crosshair = undefined;
  render();
  syncEngineStatus();
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
    syncViewportCommandState();
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
    updateMainPriceScale();
    chartEngine.setViewport(viewport);
    syncEngineStatus();
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
  if (!layout || !viewport || !priceScale) {
    throw new Error("Chart layout is not ready");
  }

  const mainPanelLayout = getMainPanelLayout();

  return createInteractionEngine({
    series: activeSeries,
    viewport,
    priceScale,
    width: mainPanelLayout.plotArea.width,
    plotLeft: mainPanelLayout.plotArea.x,
    plotTop: mainPanelLayout.plotArea.y,
    plotHeight: mainPanelLayout.plotArea.height,
    onEvent: handleInteractionEvent
  });
}

function setDrawingHoverId(nextId: string | undefined): boolean {
  if (drawingHoveredDrawingId === nextId) {
    return false;
  }

  drawingHoveredDrawingId = nextId;
  return true;
}

function renderDrawingHoverId(nextId: string | undefined): void {
  if (setDrawingHoverId(nextId)) {
    renderStatic();
  }
}

function updateDrawingHover(point: { x: number; y: number }): void {
  const editorState = drawingEditor.getState();

  if (editorState.activeTool !== "select") {
    renderDrawingHoverId(undefined);
    return;
  }

  const hover = getDrawingHoverState({
    drawings: editorState.drawings,
    point,
    handles: drawingEditor.getSelectedEditHandles(),
    registry: drawingRendererRegistry,
    handleHitTestOptions: { radius: 10 }
  });

  renderDrawingHoverId(hover.hoveredDrawingId);
  interactionSession.handleInput({ type: "cursor", cursor: hover.cursor });
}

function cancelPointerInteraction(): void {
  drawingEditor.cancel();
  drawingHandleDragOperation = undefined;
  drawingHandleDragPoint = undefined;
  drawingMoveDragOperation = undefined;
  drawingMoveDragPoint = undefined;
  drawingSelectionBoxOperation = undefined;
  drawingSelectionPreviewIds = undefined;
  drawingPreviewDrawings = undefined;
  setDrawingHoverId(undefined);
  crosshair = undefined;
  clearDrawingMagnetState();
  if (layout && viewport) {
    interactionEngine = createCurrentInteractionEngine();
  }
  renderStatic();
}

function clearTransientInteraction(inputType: "leave" | "blur"): void {
  cancelPointerInteraction();
  lastKeyboardCommandText = "none";
  interactionSession.handleInput({ type: inputType });
  syncInteractionDiagnostics();
}

function clearIndicatorInteractionState(): void {
  drawingHandleDragOperation = undefined;
  drawingHandleDragPoint = undefined;
  drawingMoveDragOperation = undefined;
  drawingMoveDragPoint = undefined;
  drawingSelectionBoxOperation = undefined;
  drawingSelectionPreviewIds = undefined;
  drawingPreviewDrawings = undefined;
  setDrawingHoverId(undefined);
  crosshair = undefined;
  interactionEngine = undefined;
  priceScale = undefined;
  lastKeyboardCommandText = "none";
  interactionSession.handleInput({ type: "leave" });
  renderStatic();
  syncInteractionDiagnostics();
}

function getCanvasPoint(event: PointerEvent): { x: number; y: number } {
  const rect = overlayCanvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function requireDrawingCoordinateContext(): DrawingCoordinateContext {
  if (!drawingCoordinateContext) {
    throw new Error("Drawing coordinate context is not ready");
  }

  return drawingCoordinateContext;
}

function getWheelPoint(event: WheelEvent): { x: number; y: number } {
  const rect = overlayCanvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function getDrawingMagnetTargets(exclude?: {
  drawingId: string;
  anchorIndex: number;
}): MagnetSnapTarget[] {
  const drawingTargets = createDrawingAnchorMagnetTargets(
    drawingEditor.getState().drawings
  );
  const filteredDrawingTargets = exclude
    ? drawingTargets.filter(
        (target) =>
          target.drawingId !== exclude.drawingId || target.anchorIndex !== exclude.anchorIndex
      )
    : drawingTargets;
  const ohlcTargets =
    layout && viewport && priceScale
      ? createOhlcMagnetTargetsFromSeries({
          series: activeSeries,
          viewport,
          plotArea: getMainPanelLayout().plotArea,
          priceScale
        })
      : [];

  return [...ohlcTargets, ...filteredDrawingTargets];
}

function getDrawingSnapPoint(
  point: { x: number; y: number },
  exclude?: { drawingId: string; anchorIndex: number }
): { x: number; y: number } {
  const snap = getMagnetSnapState({
    point,
    targets: getDrawingMagnetTargets(exclude),
    radius: drawingMagnetRadius
  });

  interactionSession.handleInput({ type: "magnet", magnet: snap.magnet });
  return snap.point;
}

function getDrawingEditorPoint(point: { x: number; y: number }): DrawingEditorPoint {
  return drawingPointFromPointer(getDrawingSnapPoint(point), requireDrawingCoordinateContext());
}

function getDrawingHandleDragPoint(
  operation: DrawingHandleDragOperation,
  point: { x: number; y: number }
): { x: number; y: number } {
  if (operation.kind !== "anchor" || operation.handle.anchorIndex === undefined) {
    return point;
  }

  return getDrawingSnapPoint(point, {
    drawingId: operation.handle.drawingId,
    anchorIndex: operation.handle.anchorIndex
  });
}

function clearDrawingMagnetState(): void {
  interactionSession.handleInput({ type: "magnet", magnet: { mode: "off" } });
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
  const handledDrawing = handleDrawingPointerDown(point, { additiveSelection: event.shiftKey });

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
  updateDrawingHover(point);
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

  if (handleDrawingPointerUp(point)) {
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
  if (isEditableTarget(event.target)) {
    return;
  }

  if (handleDrawingKeyboardCommand(event)) {
    return;
  }

  if (!isChartKeyboardCommand(event)) {
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

function handleDrawingKeyboardCommand(event: KeyboardEvent): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey || !isDrawingNudgeKey(event.key)) {
    return false;
  }

  if (!drawingEditor.getCapabilities().canNudge) {
    return false;
  }

  event.preventDefault();
  const step = event.shiftKey ? 10 : 1;

  executeDrawingCommand({ type: "nudgeSelected", delta: getNudgeDelta(event.key, step) });
  return true;
}

function isDrawingNudgeKey(key: string): boolean {
  return key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";
}

function getNudgeDelta(key: string, step: number): { dx: number; dy: number } {
  const horizontalStep = step * (viewport?.candleWidth ?? 1);

  switch (key) {
    case "ArrowLeft":
      return { dx: -horizontalStep, dy: 0 };
    case "ArrowRight":
      return { dx: horizontalStep, dy: 0 };
    case "ArrowUp":
      return { dx: 0, dy: -step };
    default:
      return { dx: 0, dy: step };
  }
}

zoomInButton.addEventListener("click", () => {
  chartEngine.dispatch({ type: "zoomIn" });
  syncViewportCommandState();
});

zoomOutButton.addEventListener("click", () => {
  chartEngine.dispatch({ type: "zoomOut" });
  syncViewportCommandState();
});

resetButton.addEventListener("click", () => {
  chartEngine.dispatch({ type: "resetZoom" });
  syncViewportCommandState();
});

timeframeSelect.addEventListener("change", () => {
  setPlaygroundTimeframe(timeframeSelect.value as Timeframe);
});

priceScaleModeSelect.addEventListener("change", () => {
  chartEngine.dispatch({
    type: "setPriceScaleMode",
    mode: priceScaleModeSelect.value as PriceScaleMode
  });
  syncViewportCommandState();
});

seriesTypeSelect.addEventListener("change", () => {
  chartEngine.setSeriesType(seriesTypeSelect.value as SeriesType);
  playgroundState.seriesType = chartEngine.getState().seriesType;
  activeSeriesType.textContent = chartEngine.getState().seriesType;
  render();
});

indicatorSelector.addEventListener("change", () => {
  const indicatorId = indicatorSelector.value as CoreIndicatorId | "";

  if (!indicatorId) {
    activeIndicatorDefinition = undefined;
    activeVisualOutputs = playgroundVisualOutputs;
    clearIndicatorInteractionState();
    render();
    return;
  }

  activeIndicatorDefinition = coreIndicatorDefinitions.find(
    (definition) => definition.id === indicatorId
  );
  activeVisualOutputs = calculateCoreIndicator(indicatorId, activeSeries).outputs;
  clearIndicatorInteractionState();
  render();
});

toggleGridButton.addEventListener("click", () => {
  chartEngine.dispatch({ type: "toggleGrid" });
  syncEngineStatus();
  render();
});

invertPriceScaleButton.addEventListener("click", () => {
  chartEngine.invertPriceScale();
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

drawingImportButton.addEventListener("click", () => {
  clearDrawingMagnetState();

  try {
    const nextState = parseDrawingImport(drawingJsonImport.value);

    drawingEditor = createPlaygroundDrawingEditor(nextState.drawings);
    drawingEditor.selectDrawings(nextState.selectedDrawingIds);
    drawingToolbar.setActiveTool("select");
    setDrawingHoverId(undefined);
    syncDrawingStatus();
    setDrawingImportStatus(
      `Imported ${nextState.drawings.length} ${nextState.drawings.length === 1 ? "drawing" : "drawings"}`,
      "success"
    );
    renderStatic();
  } catch {
    setDrawingImportStatus("Invalid drawing JSON", "error");
  }
});

function render(): void {
  renderStatic();
  renderOverlayCanvas();
}

function handleDrawingPointerDown(
  point: { x: number; y: number },
  options: { additiveSelection?: boolean } = {}
): boolean {
  const editorState = drawingEditor.getState();
  const clearedHover = setDrawingHoverId(undefined);

  if (editorState.activeTool !== "select") {
    drawingEditor.pointerDown(getDrawingEditorPoint(point));
    renderStatic();
    return true;
  }

  const hitHandle = hitTestDrawingEditHandle(drawingEditor.getSelectedEditHandles(), point, {
    radius: 10
  });

  if (hitHandle) {
    const operation = beginDrawingHandleDrag({
      handle: hitHandle,
      drawings: editorState.drawings,
      selectedDrawingIds: editorState.selectedDrawingIds,
      startPoint: point
    });

    if (operation) {
      drawingHandleDragOperation = operation;
      drawingHandleDragPoint = point;
      drawingPreviewDrawings = undefined;
      renderStatic();
      return true;
    }
  }

  const hitDrawing = hitTestDrawing(editorState.drawings, point, {
    registry: drawingRendererRegistry
  })?.drawing;

  if (!hitDrawing) {
    if (options.additiveSelection) {
      drawingSelectionBoxOperation = beginDrawingSelectionBox({
        drawings: editorState.drawings,
        startPoint: point,
        currentSelectedDrawingIds: editorState.selectedDrawingIds,
        additive: true
      });
      drawingSelectionPreviewIds = editorState.selectedDrawingIds;
      renderStatic();
      return true;
    }

    if (clearedHover) {
      renderStatic();
    }
    return false;
  }

  if (!editorState.selectedDrawingIds.includes(hitDrawing.id)) {
    drawingEditor.selectDrawing(hitDrawing.id);
  }
  const selectedState = drawingEditor.getState();
  const operation = beginDrawingMoveDrag({
    drawings: selectedState.drawings,
    selectedDrawingIds: selectedState.selectedDrawingIds,
    startPoint: point
  });

  drawingMoveDragOperation = operation;
  drawingMoveDragPoint = point;
  drawingPreviewDrawings = undefined;
  renderStatic();
  return true;
}

function handleDrawingPointerMove(event: PointerEvent): boolean {
  const point = getCanvasPoint(event);
  const editorState = drawingEditor.getState();

  if (editorState.activeTool !== "select") {
    drawingEditor.pointerMove(getDrawingEditorPoint(point));
    renderStatic();
    return true;
  }

  if (drawingHandleDragOperation) {
    const dragPoint = getDrawingHandleDragPoint(drawingHandleDragOperation, point);
    const preview = updateDrawingHandleDrag(drawingHandleDragOperation, dragPoint);

    drawingHandleDragPoint = dragPoint;
    drawingPreviewDrawings = preview?.drawings;
    setDrawingHoverId(undefined);
    renderStatic();
    return true;
  }

  if (drawingMoveDragPoint) {
    const preview = drawingMoveDragOperation
      ? updateDrawingMoveDrag(drawingMoveDragOperation, point)
      : undefined;

    drawingMoveDragPoint = point;
    drawingPreviewDrawings = preview?.drawings;
    setDrawingHoverId(undefined);
    renderStatic();
    return true;
  }

  if (drawingSelectionBoxOperation) {
    const preview = updateDrawingSelectionBox(drawingSelectionBoxOperation, point);

    drawingSelectionPreviewIds = preview.selectedDrawingIds;
    setDrawingHoverId(undefined);
    renderStatic();
    return true;
  }

  return false;
}

function handleDrawingPointerUp(point: { x: number; y: number }): boolean {
  if (drawingEditor.getState().activeTool !== "select") {
    drawingEditor.pointerUp(getDrawingEditorPoint(point));
    renderStatic();
    return true;
  }

  if (drawingHandleDragOperation) {
    return finishDrawingHandlePointerDrag(point);
  }

  if (drawingMoveDragPoint) {
    return finishDrawingMovePointerDrag(point);
  }

  if (drawingSelectionBoxOperation) {
    return finishDrawingSelectionBoxPointerDrag(point);
  }

  return false;
}

function finishDrawingHandlePointerDrag(point: { x: number; y: number }): boolean {
  if (!drawingHandleDragOperation) {
    return false;
  }

  const operation = drawingHandleDragOperation;
  const finalPoint = getDrawingHandleDragPoint(operation, drawingHandleDragPoint ?? point);
  const command = finishDrawingHandleDrag(operation, finalPoint);

  drawingHandleDragOperation = undefined;
  drawingHandleDragPoint = undefined;
  drawingPreviewDrawings = undefined;

  if (!command) {
    clearDrawingMagnetState();
    renderStatic();
    return true;
  }

  executeDrawingCommand(command);

  return true;
}

function finishDrawingMovePointerDrag(point: { x: number; y: number }): boolean {
  if (!drawingMoveDragPoint) {
    return false;
  }

  const operation = drawingMoveDragOperation;
  const command = operation ? finishDrawingMoveDrag(operation, point) : undefined;

  drawingMoveDragOperation = undefined;
  drawingMoveDragPoint = undefined;
  drawingPreviewDrawings = undefined;

  if (!command) {
    clearDrawingMagnetState();
    renderStatic();
    return true;
  }

  executeDrawingCommand(command);

  return true;
}

function finishDrawingSelectionBoxPointerDrag(point: { x: number; y: number }): boolean {
  if (!drawingSelectionBoxOperation) {
    return false;
  }

  const operation = drawingSelectionBoxOperation;
  const command = finishDrawingSelectionBox(operation, point);

  drawingSelectionBoxOperation = undefined;
  drawingSelectionPreviewIds = undefined;
  executeDrawingCommand(command);

  return true;
}

window.addEventListener("resize", render);
syncEngineStatus();
syncInteractionDiagnostics();
syncRenderDiagnostics();
requestAnimationFrame(() => {
  render();
  syncRenderDiagnostics();
});
