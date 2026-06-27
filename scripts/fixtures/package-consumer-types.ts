import {
  createChartEngine,
  createDrawingEditor,
  createRenderScheduler,
  createVisualRendererRegistry,
  defaultChartTheme,
  fixtureDailyCandleSeries,
  serializeChartLayoutSnapshot
} from "@simoncharts/chart-engine";
import type {
  CandleSeries,
  ChartEngine,
  ChartLayout,
  ChartLayoutSnapshot,
  DrawingEditor,
  DrawingEditorCapabilities,
  IndicatorVisualOutput,
  LayerRenderContext,
  RenderFrameDiagnostic,
  RenderInvalidation,
  RenderScheduler,
  VisualRenderer,
  VisualRendererRegistry
} from "@simoncharts/chart-engine";

const series: CandleSeries = fixtureDailyCandleSeries;
const engine: ChartEngine = createChartEngine({ series, seriesType: "candles" });
const drawingEditor: DrawingEditor = createDrawingEditor({ drawings: [] });

drawingEditor.executeCommand({ type: "setTool", tool: "trendLine" });
drawingEditor.executeCommand({ type: "cancelCreation" });

const capabilities: DrawingEditorCapabilities = drawingEditor.getCapabilities();

const invalidations: RenderInvalidation[] = [];
const scheduler: RenderScheduler = createRenderScheduler({
  requestFrame(callback) {
    callback();
    return 1;
  },
  renderPass(_pass, invalidation) {
    invalidations.push(invalidation);
  }
});

scheduler.invalidate({ layers: ["series"], reason: "type-consumer" });

const frame: RenderFrameDiagnostic = {
  frameId: 1,
  timestamp: 0,
  duration: 0,
  layers: ["series"],
  reasons: ["type-consumer"],
  layoutRequired: false,
  passes: [{ pass: "static", duration: 0, layers: ["series"] }]
};

const visualOutput: IndicatorVisualOutput = {
  id: "consumer-line",
  label: "Consumer Line",
  type: "line",
  values: [{ time: series.candles[0].time, value: series.candles[0].close }]
};

const renderer: VisualRenderer = {
  type: "line",
  render(_context) {},
  getAutoscale() {
    return { min: 0, max: 1 };
  },
  hitTest() {
    return undefined;
  },
  getTooltipRows() {
    return [];
  }
};

const visualRegistry: VisualRendererRegistry = createVisualRendererRegistry();
visualRegistry.register(renderer);

const layout: ChartLayout = {
  width: 800,
  height: 480,
  rightAxisWidth: 64,
  bottomAxisHeight: 28,
  plotArea: { x: 0, y: 0, width: 736, height: 452 },
  priceAxisArea: { x: 736, y: 0, width: 64, height: 452 },
  timeAxisArea: { x: 0, y: 452, width: 736, height: 28 }
};

const layerContext = {
  context: {} as CanvasRenderingContext2D,
  state: {
    series,
    viewport: engine.getState().viewport,
    theme: defaultChartTheme,
    layout,
    visualOutputs: [visualOutput]
  }
} satisfies LayerRenderContext;

const snapshot: ChartLayoutSnapshot = {
  viewport: engine.getState().viewport,
  drawings: drawingEditor.getState().drawings,
  indicatorIds: [visualOutput.id]
};

serializeChartLayoutSnapshot(snapshot);

void capabilities;
void frame;
void invalidations;
void layerContext;

