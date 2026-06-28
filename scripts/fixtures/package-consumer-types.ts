import {
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
  getChartExtensionCapabilityRequirements,
  getDrawingEditHandles,
  getDrawingHoverState,
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
  ChartExtension,
  ChartExtensionLifecycle,
  ChartExtensionInstallResult,
  ChartExtensionInstallValidationIssue,
  ChartExtensionInstallValidationIssueCode,
  ChartExtensionInstallValidationResult,
  ChartExtensionUninstallResult,
  ChartExtensionValidationIssue,
  ChartExtensionValidationIssueCode,
  ChartExtensionValidationResult,
  CustomDrawingType,
  DrawingEditorCapability,
  DrawingEditor,
  DrawingEditorCapabilities,
  DrawingEditorCommand,
  DrawingEditHandle,
  DrawingHandleDragOperation,
  DrawingHandleDragPreview,
  DrawingHoverCursor,
  DrawingHoverState,
  DrawingHoverStateOptions,
  DrawingHoverTarget,
  DrawingHitTestMatch,
  DrawingHitTestOptions,
  DrawingMoveDragCommand,
  DrawingMoveDragOperation,
  DrawingMoveDragPreview,
  MagnetSnapState,
  MagnetSnapStateOptions,
  MagnetPlotArea,
  MagnetPriceRange,
  OhlcMagnetTargetOptions,
  DrawingObject,
  DrawingPoint,
  DrawingResizeOptions,
  DrawingRotateOptions,
  DrawingSelectionBoxOperation,
  DrawingSelectionBoxPreview,
  EngineCapabilityCheckResult,
  EngineCapabilityManifest,
  EngineCapabilityRequirementGap,
  EngineCapabilityRequirementKey,
  EngineCapabilityRequirements,
  EngineDrawingToolCapability,
  ExtensionContributionType,
  DrawingParameterPropertyDefinition,
  DrawingPropertySchema,
  IndicatorVisualOutput,
  InteractionInput,
  LayerRenderContext,
  RenderFrameDiagnostic,
  RenderInvalidation,
  RenderScheduler,
  VisualRenderer,
  VisualRendererRegistry,
  InteractionCapability,
  VisualOutputType
} from "@simoncharts/chart-engine";

const series: CandleSeries = fixtureDailyCandleSeries;
const engine: ChartEngine = createChartEngine({ series, seriesType: "candles" });
const engineCapabilityManifest: EngineCapabilityManifest = createEngineCapabilityManifest();
const engineDrawingToolCapability: EngineDrawingToolCapability =
  engineCapabilityManifest.drawingTools[0];
const drawingEditorCapability: DrawingEditorCapability =
  engineCapabilityManifest.drawingEditorCapabilities[0];
const interactionCapability: InteractionCapability = engineCapabilityManifest.interactionCapabilities[0];
const extensionContributionType: ExtensionContributionType =
  engineCapabilityManifest.extensionContributionTypes[0];
const visualOutputType: VisualOutputType = engineCapabilityManifest.visualOutputTypes[0];
const engineCapabilityRequirementKey: EngineCapabilityRequirementKey = "seriesTypes";
const engineCapabilityRequirements: EngineCapabilityRequirements = {
  [engineCapabilityRequirementKey]: ["candles", "line"],
  drawingTypes: ["trendLine"]
};
const engineCapabilityCheckResult: EngineCapabilityCheckResult =
  checkEngineCapabilityRequirements(engineCapabilityManifest, engineCapabilityRequirements);
const engineCapabilityRequirementGap: EngineCapabilityRequirementGap = {
  key: "seriesTypes",
  values: ["futureSeries"]
};
const drawingEditor: DrawingEditor = createDrawingEditor({ drawings: [] });
const customDrawingType: CustomDrawingType = "consumer.measurement-box";
const drawingPropertySchema: DrawingPropertySchema = getDrawingPropertySchema("trendLine");

drawingEditor.executeCommand({ type: "setTool", tool: "trendLine" });
drawingEditor.executeCommand({ type: "cancelCreation" });

const capabilities: DrawingEditorCapabilities = drawingEditor.getCapabilities();
const metadataCommand: DrawingEditorCommand = {
  type: "updateSelectedMetadata",
  metadata: { fibonacciLevels: [0, 1] }
};
const nudgeCommand: DrawingEditorCommand = { type: "nudgeSelected", delta: { dx: 1, dy: 0 } };
const resizeOptions: DrawingResizeOptions = {
  handle: "bottomRight",
  fromBounds: { x: 0, y: 0, width: 10, height: 10 },
  toPoint: { x: 20, y: 20 }
};
const rotateOptions: DrawingRotateOptions = {
  center: { x: 10, y: 10 },
  angleRadians: Math.PI / 2
};
const resizeCommand: DrawingEditorCommand = { type: "resizeSelected", options: resizeOptions };
const rotateCommand: DrawingEditorCommand = { type: "rotateSelected", options: rotateOptions };
const boundsCommand: DrawingEditorCommand = {
  type: "selectDrawingsInBounds",
  bounds: normalizeDrawingSelectionBounds({ x: 0, y: 0 }, { x: 100, y: 100 })
};
const editHandles: DrawingEditHandle[] = getDrawingEditHandles({
  id: "handles",
  type: "trendLine",
  anchors: [{ x: 1, y: 2 }, { x: 3, y: 4 }]
});
const hitHandle: DrawingEditHandle | undefined = hitTestDrawingEditHandle(
  editHandles,
  { x: 1, y: 2 },
  { kinds: ["anchor"], radius: 2 }
);
const handleDragOperation: DrawingHandleDragOperation | undefined = hitHandle
  ? beginDrawingHandleDrag({
      handle: hitHandle,
      drawings: [
        {
          id: "handles",
          type: "trendLine",
          anchors: [{ x: 1, y: 2 }, { x: 3, y: 4 }]
        }
      ],
      selectedDrawingIds: ["handles"],
      startPoint: hitHandle
    })
  : undefined;
const handleDragPreview: DrawingHandleDragPreview | undefined = handleDragOperation
  ? updateDrawingHandleDrag(handleDragOperation, { x: 5, y: 6 })
  : undefined;
const handleDragCommand: DrawingEditorCommand | undefined = handleDragOperation
  ? finishDrawingHandleDrag(handleDragOperation, { x: 5, y: 6 })
  : undefined;
const selectionBoxOperation: DrawingSelectionBoxOperation = beginDrawingSelectionBox({
  drawings: [
    {
      id: "selection-box",
      type: "rectangle",
      anchors: [{ x: 0, y: 0 }, { x: 10, y: 10 }]
    }
  ],
  startPoint: { x: -1, y: -1 },
  currentSelectedDrawingIds: [],
  additive: false
});
const selectionBoxPreview: DrawingSelectionBoxPreview = updateDrawingSelectionBox(
  selectionBoxOperation,
  { x: 20, y: 20 }
);
const selectionBoxCommand: DrawingEditorCommand = finishDrawingSelectionBox(selectionBoxOperation, {
  x: 20,
  y: 20
});
const moveDragOperation: DrawingMoveDragOperation | undefined = beginDrawingMoveDrag({
  drawings: [
    {
      id: "move-drag",
      type: "trendLine",
      anchors: [{ x: 0, y: 0 }, { x: 10, y: 10 }]
    }
  ],
  selectedDrawingIds: ["move-drag"],
  startPoint: { x: 0, y: 0 }
});
const moveDragPreview: DrawingMoveDragPreview | undefined = moveDragOperation
  ? updateDrawingMoveDrag(moveDragOperation, { x: 2, y: 3 })
  : undefined;
const moveDragCommand: DrawingMoveDragCommand | undefined = moveDragOperation
  ? finishDrawingMoveDrag(moveDragOperation, { x: 2, y: 3 })
  : undefined;
const transformedDrawing: DrawingObject = rotateDrawing(
  resizeDrawing(
    {
      id: "transform",
      type: "rectangle",
      anchors: [{ x: 0, y: 0 }, { x: 10, y: 10 }]
    },
    resizeOptions
  ),
  rotateOptions
);
const parameterProperty = drawingPropertySchema.properties.find(
  (property): property is DrawingParameterPropertyDefinition => property.scope === "parameters"
);

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

const extension: ChartExtension = createChartExtension(
  { id: "consumer.extension", label: "Consumer Extension", version: "1.0.0" },
  {
    drawingRenderers: [
      {
        type: customDrawingType,
        render() {},
        hitTest(drawing) {
          return { drawingId: drawing.id, distance: 0 };
        }
      }
    ],
    drawingTools: [
      {
        type: customDrawingType,
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
const extensionInstallResult: ChartExtensionInstallResult = applyChartExtension(extension, {
  drawingRenderers: createDrawingRendererRegistry(),
  drawingTools: createDrawingToolRegistry()
});
const extensionRequirements: EngineCapabilityRequirements =
  getChartExtensionCapabilityRequirements(extension);
const extensionCompatibility: EngineCapabilityCheckResult =
  checkChartExtensionCompatibility(engineCapabilityManifest, extension);
const extensionValidationIssueCode: ChartExtensionValidationIssueCode = "manifest.id";
const extensionValidationIssue: ChartExtensionValidationIssue = {
  code: extensionValidationIssueCode,
  path: "manifest.id",
  message: "Example issue"
};
const extensionValidation: ChartExtensionValidationResult = validateChartExtension(extension);
const extensionLifecycle: ChartExtensionLifecycle = createChartExtensionLifecycle({
  drawingRenderers: createDrawingRendererRegistry(),
  drawingTools: createDrawingToolRegistry()
});
const lifecyclePreflight: ChartExtensionInstallValidationResult =
  extensionLifecycle.validateInstall(extension);
const lifecycleInstallValidationIssueCode: ChartExtensionInstallValidationIssueCode =
  "install.alreadyInstalled";
const lifecycleInstallValidationIssue: ChartExtensionInstallValidationIssue = {
  code: lifecycleInstallValidationIssueCode,
  path: "manifest.id",
  message: "Example install issue",
  ownerExtensionId: "consumer.extension"
};
const lifecycleInstallResult: ChartExtensionInstallResult = extensionLifecycle.install(extension);
const lifecycleDuplicatePreflight: ChartExtensionInstallValidationResult =
  extensionLifecycle.validateInstall(extension);
const lifecycleUninstallResult: ChartExtensionUninstallResult =
  extensionLifecycle.uninstall("consumer.extension");

const customDrawing: DrawingObject = {
  id: "consumer-custom-drawing",
  type: customDrawingType,
  anchors: [{ x: 1, y: 2 }]
};

const drawingHitTestPoint: DrawingPoint = { x: 1, y: 2 };
const drawingHitTestOptions: DrawingHitTestOptions = { registry: createDrawingRendererRegistry() };
drawingHitTestOptions.registry.register({
  type: customDrawingType,
  render() {},
  hitTest(drawing) {
    return { drawingId: drawing.id, distance: 0 };
  }
});
const drawingHitTestMatches: DrawingHitTestMatch[] = hitTestDrawingAll(
  [customDrawing],
  drawingHitTestPoint,
  drawingHitTestOptions
);
const drawingHitTestMatch: DrawingHitTestMatch | undefined = hitTestDrawing(
  [customDrawing],
  drawingHitTestPoint,
  drawingHitTestOptions
);
const drawingHoverTarget: DrawingHoverTarget = { kind: "body", drawingId: customDrawing.id };
const drawingHoverCursor: DrawingHoverCursor = "drawing";
const drawingHoverOptions: DrawingHoverStateOptions = {
  drawings: [customDrawing],
  point: drawingHitTestPoint,
  handles: [],
  registry: drawingHitTestOptions.registry,
  activeTarget: drawingHoverTarget
};
const drawingHoverState: DrawingHoverState = getDrawingHoverState(drawingHoverOptions);
const neutralCursorInput: InteractionInput = { type: "cursor", cursor: drawingHoverCursor };
const magnetSnapStateOptions: MagnetSnapStateOptions = {
  point: { x: 10, y: 10 },
  targets: [{ type: "ohlc", x: 10, y: 11, field: "close", dataIndex: 1 }],
  radius: 4
};
const magnetSnapState: MagnetSnapState = getMagnetSnapState(magnetSnapStateOptions);
const magnetPlotArea: MagnetPlotArea = { x: 0, y: 0, width: 640, height: 320 };
const magnetPriceRange: MagnetPriceRange = { min: 10, max: 30 };
const ohlcMagnetTargetOptions: OhlcMagnetTargetOptions = {
  series,
  viewport: engine.getState().viewport,
  plotArea: magnetPlotArea,
  priceRange: magnetPriceRange,
  fields: ["open", "high", "low", "close"]
};
const ohlcMagnetTargets = createOhlcMagnetTargetsFromSeries(ohlcMagnetTargetOptions);

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
  drawings: [...drawingEditor.getState().drawings, customDrawing],
  indicatorIds: [visualOutput.id]
};

serializeChartLayoutSnapshot(snapshot);

void capabilities;
void engineCapabilityManifest;
void engineDrawingToolCapability;
void drawingEditorCapability;
void interactionCapability;
void extensionContributionType;
void visualOutputType;
void engineCapabilityRequirementKey;
void engineCapabilityRequirements;
void engineCapabilityCheckResult;
void engineCapabilityRequirementGap;
void drawingPropertySchema;
void metadataCommand;
void nudgeCommand;
void resizeCommand;
void rotateCommand;
void boundsCommand;
void editHandles;
void hitHandle;
void handleDragOperation;
void handleDragPreview;
void handleDragCommand;
void selectionBoxOperation;
void selectionBoxPreview;
void selectionBoxCommand;
void moveDragOperation;
void moveDragPreview;
void moveDragCommand;
void transformedDrawing;
void parameterProperty;
void drawingHitTestMatches;
void drawingHitTestMatch;
void drawingHoverTarget;
void drawingHoverCursor;
void drawingHoverOptions;
void drawingHoverState;
void neutralCursorInput;
void magnetSnapStateOptions;
void magnetSnapState;
void magnetPlotArea;
void magnetPriceRange;
void ohlcMagnetTargetOptions;
void ohlcMagnetTargets;
void frame;
void invalidations;
void layerContext;
void extensionInstallResult;
void extensionRequirements;
void extensionCompatibility;
void extensionValidationIssueCode;
void extensionValidationIssue;
void extensionValidation;
void lifecyclePreflight;
void lifecycleInstallValidationIssueCode;
void lifecycleInstallValidationIssue;
void lifecycleInstallResult;
void lifecycleDuplicatePreflight;
void lifecycleUninstallResult;
