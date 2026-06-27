import type { DrawingRenderer, DrawingRendererRegistry } from "../drawing/drawingRegistry";
import type { DrawingToolDefinition } from "../drawing/drawingToolDefinitions";
import type { DrawingToolRegistry } from "../drawing/drawingToolRegistry";
import type { FigureRenderer } from "../figures/figureTypes";
import type { FigureRendererRegistry } from "../figures/figureRegistry";
import type { SeriesRenderer } from "../series/seriesTypes";
import type { SeriesRendererRegistry } from "../series/seriesRegistry";
import type { VisualRenderer } from "../visuals/visualTypes";
import type { VisualRendererRegistry } from "../visuals/visualRegistry";

export interface ChartExtensionManifest {
  id: string;
  label: string;
  version: string;
  description?: string;
  capabilities?: string[];
}

export interface ChartExtensionContributions {
  seriesRenderers?: SeriesRenderer[];
  visualRenderers?: VisualRenderer[];
  drawingRenderers?: DrawingRenderer[];
  drawingTools?: DrawingToolDefinition[];
  figureRenderers?: FigureRenderer[];
}

export interface ChartExtension {
  manifest: ChartExtensionManifest;
  contributions: ChartExtensionContributions;
}

export interface ChartExtensionInstallContext {
  seriesRenderers?: SeriesRendererRegistry;
  visualRenderers?: VisualRendererRegistry;
  drawingRenderers?: DrawingRendererRegistry;
  drawingTools?: DrawingToolRegistry;
  figureRenderers?: FigureRendererRegistry;
}

export interface ChartExtensionInstallResult {
  extensionId: string;
  installed: {
    seriesRenderers: number;
    visualRenderers: number;
    drawingRenderers: number;
    drawingTools: number;
    figureRenderers: number;
  };
}

export interface ChartExtensionRegistry {
  register(extension: ChartExtension): void;
  get(id: string): ChartExtension | undefined;
  require(id: string): ChartExtension;
  list(): ChartExtension[];
}

export function createChartExtension(
  manifest: ChartExtensionManifest,
  contributions: ChartExtensionContributions = {}
): ChartExtension {
  assertManifest(manifest);

  return {
    manifest: cloneManifest(manifest),
    contributions: cloneContributions(contributions)
  };
}

export function createChartExtensionRegistry(): ChartExtensionRegistry {
  const extensions = new Map<string, ChartExtension>();

  return {
    register(extension) {
      assertManifest(extension.manifest);

      if (extensions.has(extension.manifest.id)) {
        throw new Error(`Chart extension is already registered: ${extension.manifest.id}`);
      }

      extensions.set(extension.manifest.id, {
        manifest: cloneManifest(extension.manifest),
        contributions: cloneContributions(extension.contributions)
      });
    },
    get(id) {
      const extension = extensions.get(id);

      return extension ? cloneExtension(extension) : undefined;
    },
    require(id) {
      const extension = extensions.get(id);

      if (!extension) {
        throw new Error(`Chart extension is not registered: ${id}`);
      }

      return cloneExtension(extension);
    },
    list() {
      return [...extensions.values()].map(cloneExtension);
    }
  };
}

export function applyChartExtension(
  extension: ChartExtension,
  context: ChartExtensionInstallContext
): ChartExtensionInstallResult {
  assertManifest(extension.manifest);

  const contributions = extension.contributions;

  for (const renderer of contributions.seriesRenderers ?? []) {
    context.seriesRenderers?.register(renderer);
  }

  for (const renderer of contributions.visualRenderers ?? []) {
    context.visualRenderers?.register(renderer);
  }

  for (const renderer of contributions.drawingRenderers ?? []) {
    context.drawingRenderers?.register(renderer);
  }

  for (const definition of contributions.drawingTools ?? []) {
    context.drawingTools?.register(definition);
  }

  for (const renderer of contributions.figureRenderers ?? []) {
    context.figureRenderers?.register(renderer);
  }

  return {
    extensionId: extension.manifest.id,
    installed: {
      seriesRenderers: contributions.seriesRenderers?.length ?? 0,
      visualRenderers: contributions.visualRenderers?.length ?? 0,
      drawingRenderers: contributions.drawingRenderers?.length ?? 0,
      drawingTools: contributions.drawingTools?.length ?? 0,
      figureRenderers: contributions.figureRenderers?.length ?? 0
    }
  };
}

function assertManifest(manifest: ChartExtensionManifest): void {
  if (!isNonEmptyString(manifest.id)) {
    throw new Error("Chart extension id must be a non-empty string");
  }

  if (!isNonEmptyString(manifest.label)) {
    throw new Error("Chart extension label must be a non-empty string");
  }

  if (!isNonEmptyString(manifest.version)) {
    throw new Error("Chart extension version must be a non-empty string");
  }
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function cloneExtension(extension: ChartExtension): ChartExtension {
  return {
    manifest: cloneManifest(extension.manifest),
    contributions: cloneContributions(extension.contributions)
  };
}

function cloneManifest(manifest: ChartExtensionManifest): ChartExtensionManifest {
  return {
    ...manifest,
    capabilities: manifest.capabilities ? [...manifest.capabilities] : undefined
  };
}

function cloneContributions(contributions: ChartExtensionContributions): ChartExtensionContributions {
  return {
    seriesRenderers: contributions.seriesRenderers ? [...contributions.seriesRenderers] : undefined,
    visualRenderers: contributions.visualRenderers ? [...contributions.visualRenderers] : undefined,
    drawingRenderers: contributions.drawingRenderers ? [...contributions.drawingRenderers] : undefined,
    drawingTools: contributions.drawingTools ? contributions.drawingTools.map(cloneDrawingTool) : undefined,
    figureRenderers: contributions.figureRenderers ? [...contributions.figureRenderers] : undefined
  };
}

function cloneDrawingTool(definition: DrawingToolDefinition): DrawingToolDefinition {
  return {
    ...definition,
    defaultStyle: {
      ...definition.defaultStyle,
      lineDash: definition.defaultStyle.lineDash ? [...definition.defaultStyle.lineDash] : undefined
    }
  };
}

