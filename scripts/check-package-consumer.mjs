import {
  calculateCoreIndicator,
  applyChartExtension,
  checkChartExtensionCompatibility,
  checkEngineCapabilityRequirements,
  createChartEngine,
  createEngineCapabilityManifest,
  createChartExtension,
  createChartExtensionLifecycle,
  createDrawingRendererRegistry,
  createDrawingEditor,
  createDrawingToolRegistry,
  beginDrawingHandleDrag,
  beginDrawingMoveDrag,
  beginDrawingSelectionBox,
  finishDrawingHandleDrag,
  finishDrawingMoveDrag,
  finishDrawingSelectionBox,
  getDrawingEditHandles,
  getDrawingHoverState,
  getChartExtensionCapabilityRequirements,
  getMagnetSnapState,
  createOhlcMagnetTargetsFromSeries,
  getDrawingPropertySchema,
  hitTestDrawing,
  hitTestDrawingAll,
  hitTestDrawingEditHandle,
  normalizeDrawingSelectionBounds,
  resizeDrawing,
  rotateDrawing,
  updateDrawingHandleDrag,
  updateDrawingMoveDrag,
  updateDrawingSelectionBox,
  validateChartExtension,
  deserializeDrawingObject,
  fixtureDailyCandleSeries,
  serializeDrawingObject
} from "@simoncharts/chart-engine";

const engine = createChartEngine({
  series: fixtureDailyCandleSeries,
  seriesType: "candles"
});
const engineCapabilities = createEngineCapabilityManifest();
const engineCompatibility = checkEngineCapabilityRequirements(engineCapabilities, {
  seriesTypes: ["candles", "line"],
  drawingTypes: ["trendLine"],
  coreIndicatorIds: ["MA", "MACD"],
  visualOutputTypes: ["line"],
  interactionCapabilities: ["hitTest", "magnetSnap"]
});

if (
  engineCapabilities.packageName !== "@simoncharts/chart-engine" ||
  engineCapabilities.seriesTypes.length !== 17 ||
  engineCapabilities.drawingTypes.length !== 63 ||
  engineCapabilities.coreIndicatorIds.length !== 16 ||
  engineCapabilities.drawingTools.length !== engineCapabilities.drawingTypes.length
) {
  throw new Error("Package consumer failed to read engine capability manifest");
}

if (!engineCompatibility.compatible || engineCompatibility.missing.length !== 0) {
  throw new Error("Package consumer failed to check engine capability requirements");
}

engine.setViewport({
  visibleRange: { from: 5, to: 25 },
  candleWidth: 8,
  scrollOffset: 0,
  priceScaleMode: "linear"
});

const drawing = deserializeDrawingObject(
  serializeDrawingObject({
    id: "host-drawing-1",
    type: "trendLine",
    anchors: [
      { x: 0, y: 0, time: fixtureDailyCandleSeries.candles[0].time, price: 10 },
      { x: 80, y: 80, time: fixtureDailyCandleSeries.candles[10].time, price: 20 }
    ]
  })
);

engine.setDrawings([drawing]);

const macd = calculateCoreIndicator("MACD", fixtureDailyCandleSeries);

if (engine.getState().viewport.visibleRange.from !== 5) {
  throw new Error("Package consumer failed to update viewport");
}

if (engine.getState().drawings.length !== 1) {
  throw new Error("Package consumer failed to round-trip drawings");
}

if (!macd.outputs.some((output) => output.panelId === "MACD")) {
  throw new Error("Package consumer failed to calculate MACD outputs");
}

const drawingEditor = createDrawingEditor({ drawings: [drawing] });
drawingEditor.executeCommand({ type: "selectDrawing", drawingId: "host-drawing-1" });
const drawingPropertySchema = getDrawingPropertySchema(drawing.type);

if (!drawingPropertySchema.properties.some((property) => property.id === "style.color")) {
  throw new Error("Package consumer failed to read drawing property schema");
}

if (!drawingEditor.getCapabilities().canCopy) {
  throw new Error("Package consumer failed to expose drawing editor capabilities");
}

drawingEditor.executeCommand({ type: "copySelected" });
drawingEditor.executeCommand({ type: "pasteCopied", offset: { dx: 4, dy: 6 } });
drawingEditor.executeCommand({ type: "updateSelectedMetadata", metadata: { fibonacciLevels: [0, 1] } });
drawingEditor.executeCommand({ type: "nudgeSelected", delta: { dx: 1, dy: 0 } });
drawingEditor.executeCommand({
  type: "resizeSelected",
  options: {
    handle: "bottomRight",
    fromBounds: { x: 0, y: 0, width: 80, height: 80 },
    toPoint: { x: 100, y: 100 }
  }
});
drawingEditor.executeCommand({
  type: "rotateSelected",
  options: { center: { x: 50, y: 50 }, angleRadians: Math.PI / 4 }
});

if (drawingEditor.getState().drawings.length !== 2) {
  throw new Error("Package consumer failed to execute drawing editor commands");
}

if (!drawingEditor.getState().drawings.some((item) => Array.isArray(item.metadata?.fibonacciLevels))) {
  throw new Error("Package consumer failed to execute drawing metadata commands");
}

if (drawingEditor.getSelectedEditHandles().length === 0 || getDrawingEditHandles(drawing).length === 0) {
  throw new Error("Package consumer failed to expose drawing edit handles");
}

drawingEditor.executeCommand({
  type: "selectDrawingsInBounds",
  bounds: normalizeDrawingSelectionBounds({ x: -1, y: -1 }, { x: 200, y: 200 })
});

if (drawingEditor.getState().selectedDrawingIds.length === 0) {
  throw new Error("Package consumer failed to select drawings in bounds");
}

const selectedHandles = drawingEditor.getSelectedEditHandles();
const hitHandle = hitTestDrawingEditHandle(selectedHandles, selectedHandles[0], { radius: 1 });
const handleDrag = hitHandle
  ? beginDrawingHandleDrag({
      handle: hitHandle,
      drawings: drawingEditor.getState().drawings,
      selectedDrawingIds: drawingEditor.getState().selectedDrawingIds,
      startPoint: hitHandle
    })
  : undefined;
const handlePreview = handleDrag
  ? updateDrawingHandleDrag(handleDrag, { x: hitHandle.x + 2, y: hitHandle.y + 2 })
  : undefined;
const handleCommand = handleDrag
  ? finishDrawingHandleDrag(handleDrag, { x: hitHandle.x + 2, y: hitHandle.y + 2 })
  : undefined;

if (!handlePreview || !handleCommand) {
  throw new Error("Package consumer failed to execute drawing handle drag flow");
}

drawingEditor.executeCommand(handleCommand);

const selectionBox = beginDrawingSelectionBox({
  drawings: drawingEditor.getState().drawings,
  startPoint: { x: -1, y: -1 },
  currentSelectedDrawingIds: drawingEditor.getState().selectedDrawingIds,
  additive: true
});
const selectionPreview = updateDrawingSelectionBox(selectionBox, { x: 200, y: 200 });
const selectionCommand = finishDrawingSelectionBox(selectionBox, { x: 200, y: 200 });

if (selectionPreview.selectedDrawingIds.length === 0 || selectionCommand.type !== "selectDrawingsInBounds") {
  throw new Error("Package consumer failed to execute drawing selection box flow");
}

drawingEditor.executeCommand(selectionCommand);

const moveDrag = beginDrawingMoveDrag({
  drawings: drawingEditor.getState().drawings,
  selectedDrawingIds: drawingEditor.getState().selectedDrawingIds,
  startPoint: { x: 0, y: 0 }
});
const movePreview = moveDrag ? updateDrawingMoveDrag(moveDrag, { x: 7, y: -3 }) : undefined;
const moveCommand = moveDrag ? finishDrawingMoveDrag(moveDrag, { x: 7, y: -3 }) : undefined;

if (!movePreview || moveCommand?.type !== "dragSelected") {
  throw new Error("Package consumer failed to execute drawing move drag flow");
}

const movedPreviewDrawing = movePreview.drawings.find((item) => item.id === drawingEditor.getState().selectedDrawingIds[0]);
const originalMoveDrawing = drawingEditor
  .getState()
  .drawings.find((item) => item.id === drawingEditor.getState().selectedDrawingIds[0]);

if (
  !movedPreviewDrawing ||
  !originalMoveDrawing ||
  movedPreviewDrawing.anchors[0].x !== (originalMoveDrawing.anchors[0].x ?? 0) + 7 ||
  movedPreviewDrawing.anchors[0].y !== (originalMoveDrawing.anchors[0].y ?? 0) - 3
) {
  throw new Error("Package consumer failed to preview drawing move drag flow");
}

drawingEditor.executeCommand(moveCommand);

const committedMoveDrawing = drawingEditor.getState().drawings.find((item) => item.id === originalMoveDrawing.id);

if (
  !committedMoveDrawing ||
  committedMoveDrawing.anchors[0].x !== movedPreviewDrawing.anchors[0].x ||
  committedMoveDrawing.anchors[0].y !== movedPreviewDrawing.anchors[0].y
) {
  throw new Error("Package consumer failed to commit drawing move drag command");
}

const resizedDrawing = resizeDrawing(drawing, {
  handle: "bottomRight",
  fromBounds: { x: 0, y: 0, width: 80, height: 80 },
  toPoint: { x: 120, y: 120 }
});
const rotatedDrawing = rotateDrawing(resizedDrawing, {
  center: { x: 60, y: 60 },
  angleRadians: Math.PI / 2
});

if (!Number.isFinite(rotatedDrawing.anchors[0].x)) {
  throw new Error("Package consumer failed to execute drawing transforms");
}

if (!drawingEditor.getCapabilities().canUndo) {
  throw new Error("Package consumer failed to expose drawing editor undo capability");
}

const drawingRenderers = createDrawingRendererRegistry();
const drawingTools = createDrawingToolRegistry();
const extension = createChartExtension(
  { id: "consumer.extension", label: "Consumer Extension", version: "1.0.0" },
  {
    drawingRenderers: [
      {
        type: "consumer.measurement-box",
        render() {},
        hitTest(customDrawing) {
          return { drawingId: customDrawing.id, distance: 0 };
        }
      }
    ],
    drawingTools: [
      {
        type: "consumer.measurement-box",
        label: "Measurement Box",
        category: "measurement",
        totalStep: 3,
        anchorCount: 2,
        drawingMode: "step",
        defaultStyle: { color: "#2563eb", lineWidth: 2 },
        hotkeyId: "drawing.consumer.measurement-box"
      }
    ]
  }
);
const extensionRequirements = getChartExtensionCapabilityRequirements(extension);
const extensionCompatibility = checkChartExtensionCompatibility(engineCapabilities, extension);
const extensionValidation = validateChartExtension(extension);

if (
  extensionRequirements.extensionContributionTypes?.join(",") !== "drawingRenderers,drawingTools" ||
  !extensionCompatibility.compatible ||
  extensionCompatibility.missing.length !== 0
) {
  throw new Error("Package consumer failed to check chart extension compatibility");
}

if (!extensionValidation.valid || extensionValidation.issues.length !== 0) {
  throw new Error("Package consumer failed to validate chart extension");
}

const installResult = applyChartExtension(extension, { drawingRenderers, drawingTools });

if (installResult.installed.drawingRenderers !== 1 || installResult.installed.drawingTools !== 1) {
  throw new Error("Package consumer failed to install chart extension contributions");
}

if (drawingTools.require("consumer.measurement-box").label !== "Measurement Box") {
  throw new Error("Package consumer failed to read installed custom drawing tool");
}

const customHitDrawing = deserializeDrawingObject(
  serializeDrawingObject({
    id: "custom-hit-drawing",
    type: "consumer.measurement-box",
    anchors: [{ x: 1, y: 2 }],
    metadata: { distance: 3 }
  })
);
const hitMatches = hitTestDrawingAll([customHitDrawing], { x: 1, y: 2 }, { registry: drawingRenderers });
const hitMatch = hitTestDrawing([customHitDrawing], { x: 1, y: 2 }, { registry: drawingRenderers });

if (hitMatches.length !== 1 || hitMatch?.drawing.id !== "custom-hit-drawing") {
  throw new Error("Package consumer failed to execute drawing body hit-test APIs");
}

const hoverState = getDrawingHoverState({
  drawings: [customHitDrawing],
  point: { x: 1, y: 2 },
  handles: [],
  registry: drawingRenderers
});

if (
  hoverState.target?.kind !== "body" ||
  hoverState.hoveredDrawingId !== "custom-hit-drawing" ||
  hoverState.cursor !== "drawing"
) {
  throw new Error("Package consumer failed to execute drawing hover intent API");
}

const magnetSnapState = getMagnetSnapState({
  point: { x: 10, y: 10 },
  targets: [{ type: "drawingAnchor", x: 11, y: 10, drawingId: "custom-hit-drawing", anchorIndex: 0 }],
  radius: 4
});

if (
  magnetSnapState.point.x !== 11 ||
  magnetSnapState.point.y !== 10 ||
  magnetSnapState.target?.type !== "drawingAnchor" ||
  magnetSnapState.magnet.mode !== "drawingAnchor"
) {
  throw new Error("Package consumer failed to execute drawing magnet snap state API");
}

const ohlcTargets = createOhlcMagnetTargetsFromSeries({
  series: fixtureDailyCandleSeries,
  viewport: engine.getState().viewport,
  plotArea: { x: 0, y: 0, width: 640, height: 320 }
});

if (
  ohlcTargets.length === 0 ||
  ohlcTargets[0].type !== "ohlc" ||
  typeof ohlcTargets[0].field !== "string" ||
  typeof ohlcTargets[0].dataIndex !== "number"
) {
  throw new Error("Package consumer failed to execute OHLC magnet target projection API");
}

const lifecycleDrawingRenderers = createDrawingRendererRegistry();
const lifecycleDrawingTools = createDrawingToolRegistry();
const lifecycle = createChartExtensionLifecycle({
  drawingRenderers: lifecycleDrawingRenderers,
  drawingTools: lifecycleDrawingTools
});

const lifecyclePreflight = lifecycle.validateInstall(extension);

if (!lifecyclePreflight.valid || lifecyclePreflight.issues.length !== 0) {
  throw new Error("Package consumer failed to validate chart extension lifecycle install");
}

lifecycle.install(extension);

if (!lifecycle.isInstalled("consumer.extension")) {
  throw new Error("Package consumer failed to install chart extension lifecycle");
}

const lifecycleDuplicatePreflight = lifecycle.validateInstall(extension);

if (
  lifecycleDuplicatePreflight.valid ||
  !lifecycleDuplicatePreflight.issues.some((issue) => issue.code === "install.alreadyInstalled")
) {
  throw new Error("Package consumer failed to diagnose duplicate chart extension lifecycle install");
}

lifecycle.uninstall("consumer.extension");

if (lifecycleDrawingTools.get("consumer.measurement-box")) {
  throw new Error("Package consumer failed to uninstall chart extension lifecycle");
}

deserializeDrawingObject(
  serializeDrawingObject({
    id: "custom-consumer-drawing",
    type: "consumer.measurement-box",
    anchors: [{ x: 1, y: 2 }]
  })
);

engine.destroy();
console.log("Package consumer smoke test passed.");
