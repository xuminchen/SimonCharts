import {
  calculateCoreIndicator,
  applyChartExtension,
  createChartEngine,
  createChartExtension,
  createChartExtensionLifecycle,
  createDrawingRendererRegistry,
  createDrawingEditor,
  createDrawingToolRegistry,
  getDrawingPropertySchema,
  deserializeDrawingObject,
  fixtureDailyCandleSeries,
  serializeDrawingObject
} from "@simoncharts/chart-engine";

const engine = createChartEngine({
  series: fixtureDailyCandleSeries,
  seriesType: "candles"
});

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

if (drawingEditor.getState().drawings.length !== 2) {
  throw new Error("Package consumer failed to execute drawing editor commands");
}

if (!drawingEditor.getState().drawings.some((item) => Array.isArray(item.metadata?.fibonacciLevels))) {
  throw new Error("Package consumer failed to execute drawing metadata commands");
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
const installResult = applyChartExtension(extension, { drawingRenderers, drawingTools });

if (installResult.installed.drawingRenderers !== 1 || installResult.installed.drawingTools !== 1) {
  throw new Error("Package consumer failed to install chart extension contributions");
}

if (drawingTools.require("consumer.measurement-box").label !== "Measurement Box") {
  throw new Error("Package consumer failed to read installed custom drawing tool");
}

const lifecycleDrawingRenderers = createDrawingRendererRegistry();
const lifecycleDrawingTools = createDrawingToolRegistry();
const lifecycle = createChartExtensionLifecycle({
  drawingRenderers: lifecycleDrawingRenderers,
  drawingTools: lifecycleDrawingTools
});

lifecycle.install(extension);

if (!lifecycle.isInstalled("consumer.extension")) {
  throw new Error("Package consumer failed to install chart extension lifecycle");
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
