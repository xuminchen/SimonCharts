import { drawingTypes, type BuiltInDrawingType } from "../drawing/drawingTypes";
import {
  builtInDrawingToolDefinitions,
  type DrawingMode,
  type DrawingToolCategory
} from "../drawing/drawingToolDefinitions";
import { coreIndicatorIds, type CoreIndicatorId } from "../indicators/indicatorDefinitions";
import { supportedSeriesTypes, type SeriesType } from "../series/seriesTypes";
import type { VisualOutputType } from "../visuals/visualTypes";

export type { VisualOutputType } from "../visuals/visualTypes";

export type ExtensionContributionType =
  | "seriesRenderers"
  | "visualRenderers"
  | "drawingRenderers"
  | "drawingTools"
  | "figureRenderers";

export type DrawingEditorCapability =
  | "createDrawing"
  | "selectDrawing"
  | "moveDrawing"
  | "editAnchors"
  | "deleteDrawing"
  | "serializeDrawing";

export type InteractionCapability =
  | "hitTest"
  | "hoverState"
  | "magnetSnap"
  | "selectionBox"
  | "handleDrag"
  | "moveDrag";

export interface EngineDrawingToolCapability {
  type: BuiltInDrawingType;
  label: string;
  category: DrawingToolCategory;
  totalStep: number;
  anchorCount: number;
  drawingMode: DrawingMode;
  hotkeyId: string;
}

export interface EngineCapabilityManifest {
  packageName: "@simoncharts/chart-engine";
  packageVersion: "1.0.0-rc.0";
  releaseChannel: "rc";
  seriesTypes: SeriesType[];
  drawingTypes: BuiltInDrawingType[];
  drawingTools: EngineDrawingToolCapability[];
  coreIndicatorIds: CoreIndicatorId[];
  visualOutputTypes: VisualOutputType[];
  drawingEditorCapabilities: DrawingEditorCapability[];
  interactionCapabilities: InteractionCapability[];
  extensionContributionTypes: ExtensionContributionType[];
}

export type EngineCapabilityRequirementKey =
  | "seriesTypes"
  | "drawingTypes"
  | "coreIndicatorIds"
  | "visualOutputTypes"
  | "drawingEditorCapabilities"
  | "interactionCapabilities"
  | "extensionContributionTypes";

export type EngineCapabilityRequirements = Partial<
  Record<EngineCapabilityRequirementKey, readonly string[]>
>;

export interface EngineCapabilityRequirementGap {
  key: EngineCapabilityRequirementKey;
  values: string[];
}

export interface EngineCapabilityCheckResult {
  compatible: boolean;
  missing: EngineCapabilityRequirementGap[];
}

const requirementKeys: readonly EngineCapabilityRequirementKey[] = [
  "seriesTypes",
  "drawingTypes",
  "coreIndicatorIds",
  "visualOutputTypes",
  "drawingEditorCapabilities",
  "interactionCapabilities",
  "extensionContributionTypes"
];

const visualOutputTypes: VisualOutputType[] = ["line", "histogram", "band", "marker"];

const drawingEditorCapabilities: DrawingEditorCapability[] = [
  "createDrawing",
  "selectDrawing",
  "moveDrawing",
  "editAnchors",
  "deleteDrawing",
  "serializeDrawing"
];

const interactionCapabilities: InteractionCapability[] = [
  "hitTest",
  "hoverState",
  "magnetSnap",
  "selectionBox",
  "handleDrag",
  "moveDrag"
];

const extensionContributionTypes: ExtensionContributionType[] = [
  "seriesRenderers",
  "visualRenderers",
  "drawingRenderers",
  "drawingTools",
  "figureRenderers"
];

export function createEngineCapabilityManifest(): EngineCapabilityManifest {
  return {
    packageName: "@simoncharts/chart-engine",
    packageVersion: "1.0.0-rc.0",
    releaseChannel: "rc",
    seriesTypes: [...supportedSeriesTypes],
    drawingTypes: [...drawingTypes],
    drawingTools: builtInDrawingToolDefinitions.map((definition) => ({
      type: definition.type as BuiltInDrawingType,
      label: definition.label,
      category: definition.category,
      totalStep: definition.totalStep,
      anchorCount: definition.anchorCount,
      drawingMode: definition.drawingMode,
      hotkeyId: definition.hotkeyId
    })),
    coreIndicatorIds: [...coreIndicatorIds],
    visualOutputTypes: [...visualOutputTypes],
    drawingEditorCapabilities: [...drawingEditorCapabilities],
    interactionCapabilities: [...interactionCapabilities],
    extensionContributionTypes: [...extensionContributionTypes]
  };
}

export function checkEngineCapabilityRequirements(
  manifest: EngineCapabilityManifest,
  requirements: EngineCapabilityRequirements
): EngineCapabilityCheckResult {
  const missing: EngineCapabilityRequirementGap[] = [];

  for (const key of requirementKeys) {
    const requiredValues = requirements[key];

    if (requiredValues === undefined) {
      continue;
    }

    const availableValues = new Set<string>(manifest[key]);
    const missingValues = requiredValues.filter((value) => !availableValues.has(value));

    if (missingValues.length > 0) {
      missing.push({
        key,
        values: missingValues
      });
    }
  }

  return {
    compatible: missing.length === 0,
    missing
  };
}
