import { describe, expect, it } from "vitest";
import {
  applyChartExtension,
  createChartExtension,
  createChartExtensionRegistry,
  createDrawingRendererRegistry,
  createDrawingToolRegistry,
  createFigureRendererRegistry,
  createSeriesRendererRegistry,
  createVisualRendererRegistry,
  type ChartExtension,
  type DrawingRenderer,
  type DrawingToolDefinition,
  type FigureRenderer,
  type SeriesRenderer,
  type VisualRenderer
} from "../index";

describe("chart extensions", () => {
  it("installs renderer and drawing tool contributions into existing registries", () => {
    const extension = createChartExtension(
      {
        id: "acme.extension-pack",
        label: "ACME Extension Pack",
        version: "1.0.0",
        capabilities: ["drawingTools", "renderers"]
      },
      {
        seriesRenderers: [createSeriesRenderer()],
        visualRenderers: [createVisualRenderer()],
        drawingRenderers: [createDrawingRenderer()],
        drawingTools: [createDrawingTool()],
        figureRenderers: [createFigureRenderer()]
      }
    );
    const seriesRenderers = createSeriesRendererRegistry();
    const visualRenderers = createVisualRendererRegistry();
    const drawingRenderers = createDrawingRendererRegistry();
    const drawingTools = createDrawingToolRegistry();
    const figureRenderers = createFigureRendererRegistry();

    const result = applyChartExtension(extension, {
      seriesRenderers,
      visualRenderers,
      drawingRenderers,
      drawingTools,
      figureRenderers
    });

    expect(result).toEqual({
      extensionId: "acme.extension-pack",
      installed: {
        seriesRenderers: 1,
        visualRenderers: 1,
        drawingRenderers: 1,
        drawingTools: 1,
        figureRenderers: 1
      }
    });
    expect(seriesRenderers.require("line")).toBe(extension.contributions.seriesRenderers?.[0]);
    expect(visualRenderers.require("line")).toBe(extension.contributions.visualRenderers?.[0]);
    expect(drawingRenderers.require("acme.measurement-box")).toBe(extension.contributions.drawingRenderers?.[0]);
    expect(drawingTools.require("acme.measurement-box")).toMatchObject({
      type: "acme.measurement-box",
      label: "Measurement Box"
    });
    expect(figureRenderers.require("marker")).toBe(extension.contributions.figureRenderers?.[0]);
  });

  it("registers extensions deterministically and rejects duplicate extension ids", () => {
    const registry = createChartExtensionRegistry();
    const first = createChartExtension({ id: "acme.first", label: "First", version: "1.0.0" });
    const second = createChartExtension({ id: "acme.second", label: "Second", version: "1.0.0" });

    registry.register(first);
    registry.register(second);

    expect(registry.list().map((extension) => extension.manifest.id)).toEqual([
      "acme.first",
      "acme.second"
    ]);
    expect(registry.get("missing")).toBeUndefined();
    expect(registry.require("acme.first").manifest.label).toBe("First");
    expect(() => registry.register(first)).toThrow("Chart extension is already registered: acme.first");
    expect(() => registry.require("missing")).toThrow("Chart extension is not registered: missing");
  });

  it("returns cloned extension manifests and drawing tool definitions", () => {
    const registry = createChartExtensionRegistry();
    const extension = createChartExtension(
      {
        id: "acme.clone",
        label: "Clone",
        version: "1.0.0",
        capabilities: ["drawingTools"]
      },
      { drawingTools: [createDrawingTool()] }
    );

    registry.register(extension);

    const stored = registry.require("acme.clone");

    stored.manifest.capabilities?.push("mutated");
    stored.contributions.drawingTools?.[0]?.defaultStyle.lineDash?.push(99);

    expect(registry.require("acme.clone").manifest.capabilities).toEqual(["drawingTools"]);
    expect(registry.require("acme.clone").contributions.drawingTools?.[0]?.defaultStyle.lineDash).toEqual([
      4,
      2
    ]);
  });

  it("rejects invalid extension manifests", () => {
    expect(() =>
      createChartExtension({ id: "", label: "Bad", version: "1.0.0" })
    ).toThrow("Chart extension id must be a non-empty string");
    expect(() =>
      createChartExtension({ id: "acme.bad", label: "", version: "1.0.0" })
    ).toThrow("Chart extension label must be a non-empty string");
    expect(() =>
      createChartExtension({ id: "acme.bad", label: "Bad", version: "" })
    ).toThrow("Chart extension version must be a non-empty string");
  });
});

function createSeriesRenderer(): SeriesRenderer {
  return {
    type: "line",
    render() {},
    getAutoscale() {
      return undefined;
    },
    hitTest() {
      return undefined;
    },
    getTooltipRows() {
      return [];
    }
  };
}

function createVisualRenderer(): VisualRenderer {
  return {
    type: "line",
    render() {},
    getAutoscale() {
      return undefined;
    },
    hitTest() {
      return undefined;
    },
    getTooltipRows() {
      return [];
    }
  };
}

function createDrawingRenderer(): DrawingRenderer {
  return {
    type: "acme.measurement-box",
    render() {},
    hitTest(drawing) {
      return { drawingId: drawing.id, distance: 0 };
    }
  };
}

function createDrawingTool(): DrawingToolDefinition {
  return {
    type: "acme.measurement-box",
    label: "Measurement Box",
    category: "measurement",
    totalStep: 3,
    anchorCount: 2,
    drawingMode: "step",
    defaultStyle: { color: "#2563eb", lineWidth: 2, lineDash: [4, 2] },
    hotkeyId: "drawing.acme.measurement-box"
  };
}

function createFigureRenderer(): FigureRenderer {
  return {
    type: "marker",
    render() {}
  };
}

function _typeCheckExtension(_extension: ChartExtension): void {}
