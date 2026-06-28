import { describe, expect, it } from "vitest";
import {
  applyChartExtension,
  checkChartExtensionCompatibility,
  createChartExtension,
  createChartExtensionLifecycle,
  createChartExtensionRegistry,
  createDrawingRendererRegistry,
  createDrawingToolRegistry,
  createEngineCapabilityManifest,
  createFigureRendererRegistry,
  createSeriesRendererRegistry,
  createVisualRendererRegistry,
  getChartExtensionCapabilityRequirements,
  validateChartExtension,
  type ChartExtension,
  type ChartExtensionInstallValidationResult,
  type DrawingRenderer,
  type DrawingToolDefinition,
  type FigureRenderer,
  type SeriesRenderer,
  type VisualRenderer
} from "../index";

describe("chart extensions", () => {
  it("validates valid extensions without issues", () => {
    const extension = createChartExtension(
      { id: "acme.valid", label: "Valid", version: "1.0.0" },
      {
        seriesRenderers: [createSeriesRenderer()],
        visualRenderers: [createVisualRenderer()],
        drawingRenderers: [createDrawingRenderer("trendLine")],
        drawingTools: [createDrawingTool("trendLine")],
        figureRenderers: [createFigureRenderer()]
      }
    );

    expect(validateChartExtension(extension)).toEqual({
      valid: true,
      issues: []
    });
  });

  it("reports invalid manifest values without throwing", () => {
    const extension = {
      manifest: {
        id: "",
        label: " ",
        version: 1
      },
      contributions: {}
    } as unknown as ChartExtension;

    expect(() => validateChartExtension(extension)).not.toThrow();
    expect(validateChartExtension(extension)).toEqual({
      valid: false,
      issues: [
        {
          code: "manifest.id",
          path: "manifest.id",
          message: "Chart extension manifest id must be a non-empty string"
        },
        {
          code: "manifest.label",
          path: "manifest.label",
          message: "Chart extension manifest label must be a non-empty string"
        },
        {
          code: "manifest.version",
          path: "manifest.version",
          message: "Chart extension manifest version must be a non-empty string"
        }
      ]
    });
  });

  it("reports duplicate contribution keys in fixed contribution order", () => {
    const extension = createChartExtension(
      { id: "acme.duplicates", label: "Duplicates", version: "1.0.0" },
      {
        figureRenderers: [createFigureRenderer(), createFigureRenderer()],
        drawingTools: [createDrawingTool("trendLine"), createDrawingTool("trendLine")],
        drawingRenderers: [
          createDrawingRenderer("trendLine", "first"),
          createDrawingRenderer("trendLine", "second")
        ],
        visualRenderers: [createVisualRenderer(), createVisualRenderer()],
        seriesRenderers: [createSeriesRenderer(), createSeriesRenderer()]
      }
    );

    expect(validateChartExtension(extension).issues).toEqual([
      {
        code: "contribution.duplicate",
        path: "contributions.seriesRenderers[1].type",
        message: "Chart extension contribution type is duplicated: seriesRenderers line"
      },
      {
        code: "contribution.duplicate",
        path: "contributions.visualRenderers[1].type",
        message: "Chart extension contribution type is duplicated: visualRenderers line"
      },
      {
        code: "contribution.duplicate",
        path: "contributions.drawingRenderers[1].type",
        message: "Chart extension contribution type is duplicated: drawingRenderers trendLine"
      },
      {
        code: "contribution.duplicate",
        path: "contributions.drawingTools[1].type",
        message: "Chart extension contribution type is duplicated: drawingTools trendLine"
      },
      {
        code: "contribution.duplicate",
        path: "contributions.figureRenderers[1].type",
        message: "Chart extension contribution type is duplicated: figureRenderers marker"
      }
    ]);
  });

  it("reports invalid drawing renderer and tool types", () => {
    const extension = createChartExtension(
      { id: "acme.invalid-drawing", label: "Invalid Drawing", version: "1.0.0" },
      {
        drawingRenderers: [createDrawingRenderer("invalid" as DrawingRenderer["type"])],
        drawingTools: [createDrawingTool("also-invalid" as DrawingToolDefinition["type"])]
      }
    );

    expect(validateChartExtension(extension)).toEqual({
      valid: false,
      issues: [
        {
          code: "contribution.invalidDrawingType",
          path: "contributions.drawingRenderers[0].type",
          message: "Chart extension drawing contribution type is invalid: drawingRenderers invalid"
        },
        {
          code: "contribution.invalidDrawingType",
          path: "contributions.drawingTools[0].type",
          message: "Chart extension drawing contribution type is invalid: drawingTools also-invalid"
        }
      ]
    });
  });

  it("does not mutate extension inputs while validating", () => {
    const seriesRenderers = [createSeriesRenderer()];
    const visualRenderers = [createVisualRenderer()];
    const drawingRenderers = [createDrawingRenderer("trendLine")];
    const drawingTools = [createDrawingTool("trendLine")];
    const figureRenderers = [createFigureRenderer()];
    const manifest = {
      id: "acme.validate-input",
      label: "Validate Input",
      version: "1.0.0",
      capabilities: ["drawingTools"]
    };
    const extension: ChartExtension = {
      manifest,
      contributions: {
        seriesRenderers,
        visualRenderers,
        drawingRenderers,
        drawingTools,
        figureRenderers
      }
    };

    validateChartExtension(extension);

    expect(extension.manifest).toBe(manifest);
    expect(extension.manifest).toEqual({
      id: "acme.validate-input",
      label: "Validate Input",
      version: "1.0.0",
      capabilities: ["drawingTools"]
    });
    expect(extension.contributions.seriesRenderers).toBe(seriesRenderers);
    expect(extension.contributions.visualRenderers).toBe(visualRenderers);
    expect(extension.contributions.drawingRenderers).toBe(drawingRenderers);
    expect(extension.contributions.drawingTools).toBe(drawingTools);
    expect(extension.contributions.figureRenderers).toBe(figureRenderers);
    expect(drawingTools[0]?.defaultStyle.lineDash).toEqual([4, 2]);
  });

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

  it("derives capability requirements for all contribution groups in fixed order", () => {
    const extension = createChartExtension(
      { id: "acme.requirements", label: "Requirements", version: "1.0.0" },
      {
        figureRenderers: [createFigureRenderer()],
        drawingTools: [createDrawingTool()],
        drawingRenderers: [createDrawingRenderer()],
        visualRenderers: [createVisualRenderer()],
        seriesRenderers: [createSeriesRenderer()]
      }
    );

    expect(getChartExtensionCapabilityRequirements(extension)).toEqual({
      extensionContributionTypes: [
        "seriesRenderers",
        "visualRenderers",
        "drawingRenderers",
        "drawingTools",
        "figureRenderers"
      ]
    });
  });

  it("returns empty capability requirements for extensions without contributions", () => {
    expect(
      getChartExtensionCapabilityRequirements(
        createChartExtension({ id: "acme.empty", label: "Empty", version: "1.0.0" })
      )
    ).toEqual({});
    expect(
      getChartExtensionCapabilityRequirements(
        createChartExtension(
          { id: "acme.empty-arrays", label: "Empty Arrays", version: "1.0.0" },
          {
            seriesRenderers: [],
            visualRenderers: [],
            drawingRenderers: [],
            drawingTools: [],
            figureRenderers: []
          }
        )
      )
    ).toEqual({});
  });

  it("passes compatibility checks against the current engine manifest", () => {
    const extension = createChartExtension(
      { id: "acme.compatible", label: "Compatible", version: "1.0.0" },
      {
        seriesRenderers: [createSeriesRenderer()],
        visualRenderers: [createVisualRenderer()],
        drawingRenderers: [createDrawingRenderer()],
        drawingTools: [createDrawingTool()],
        figureRenderers: [createFigureRenderer()]
      }
    );

    expect(checkChartExtensionCompatibility(createEngineCapabilityManifest(), extension)).toEqual({
      compatible: true,
      missing: []
    });
  });

  it("reports missing extension contribution types from incompatible manifests", () => {
    const manifest = createEngineCapabilityManifest();
    const extension = createChartExtension(
      { id: "acme.future", label: "Future", version: "1.0.0" },
      { visualRenderers: [createVisualRenderer()] }
    );

    manifest.extensionContributionTypes = manifest.extensionContributionTypes.filter(
      (type) => type !== "visualRenderers"
    );

    expect(checkChartExtensionCompatibility(manifest, extension)).toEqual({
      compatible: false,
      missing: [
        {
          key: "extensionContributionTypes",
          values: ["visualRenderers"]
        }
      ]
    });
  });

  it("returns defensive capability requirement arrays", () => {
    const extension = createChartExtension(
      { id: "acme.defensive", label: "Defensive", version: "1.0.0" },
      { seriesRenderers: [createSeriesRenderer()] }
    );
    const requirements = getChartExtensionCapabilityRequirements(extension);

    (requirements.extensionContributionTypes as string[]).push("mutated");

    expect(getChartExtensionCapabilityRequirements(extension)).toEqual({
      extensionContributionTypes: ["seriesRenderers"]
    });
  });

  it("does not mutate extension inputs while deriving requirements or checking compatibility", () => {
    const seriesRenderers = [createSeriesRenderer()];
    const visualRenderers = [createVisualRenderer()];
    const drawingRenderers = [createDrawingRenderer()];
    const drawingTools = [createDrawingTool()];
    const figureRenderers = [createFigureRenderer()];
    const extension: ChartExtension = {
      manifest: {
        id: "acme.input",
        label: "Input",
        version: "1.0.0",
        capabilities: ["renderers"]
      },
      contributions: {
        seriesRenderers,
        visualRenderers,
        drawingRenderers,
        drawingTools,
        figureRenderers
      }
    };

    getChartExtensionCapabilityRequirements(extension);
    checkChartExtensionCompatibility(createEngineCapabilityManifest(), extension);

    expect(extension.manifest).toEqual({
      id: "acme.input",
      label: "Input",
      version: "1.0.0",
      capabilities: ["renderers"]
    });
    expect(extension.contributions.seriesRenderers).toBe(seriesRenderers);
    expect(extension.contributions.visualRenderers).toBe(visualRenderers);
    expect(extension.contributions.drawingRenderers).toBe(drawingRenderers);
    expect(extension.contributions.drawingTools).toBe(drawingTools);
    expect(extension.contributions.figureRenderers).toBe(figureRenderers);
    expect(drawingTools[0]?.defaultStyle.lineDash).toEqual([4, 2]);
  });

  it("validates install candidates without issues", () => {
    const lifecycle = createChartExtensionLifecycle({});
    const extension = createChartExtension(
      { id: "acme.install-valid", label: "Install Valid", version: "1.0.0" },
      {
        seriesRenderers: [createSeriesRenderer()],
        visualRenderers: [createVisualRenderer()],
        drawingRenderers: [createDrawingRenderer("trendLine")],
        drawingTools: [createDrawingTool("trendLine")],
        figureRenderers: [createFigureRenderer()]
      }
    );

    expect(lifecycle.validateInstall(extension)).toEqual({
      valid: true,
      issues: []
    });
  });

  it("includes structural install validation issues without throwing", () => {
    const lifecycle = createChartExtensionLifecycle({});
    const extension = {
      manifest: {
        id: "",
        label: "Bad",
        version: "1.0.0"
      },
      contributions: {
        drawingRenderers: [createDrawingRenderer("invalid" as DrawingRenderer["type"])]
      }
    } as ChartExtension;

    expect(() => lifecycle.validateInstall(extension)).not.toThrow();
    expect(lifecycle.validateInstall(extension)).toEqual(validateChartExtension(extension));
  });

  it("reports already-installed ids before contribution conflicts", () => {
    const lifecycle = createChartExtensionLifecycle({});
    const installed = createChartExtension(
      { id: "acme.same-id", label: "Same ID", version: "1.0.0" },
      { drawingRenderers: [createDrawingRenderer("acme.same-renderer", "installed")] }
    );
    const nextExtension = createChartExtension(
      { id: "acme.same-id", label: "Same ID Next", version: "1.0.0" },
      { drawingRenderers: [createDrawingRenderer("acme.same-renderer", "next")] }
    );

    lifecycle.install(installed);

    expect(lifecycle.validateInstall(nextExtension).issues).toEqual([
      {
        code: "install.alreadyInstalled",
        path: "manifest.id",
        message: "Chart extension is already installed: acme.same-id"
      },
      {
        code: "install.contributionConflict",
        path: "contributions.drawingRenderers[0].type",
        message: "Chart extension contribution is already installed: drawingRenderers acme.same-renderer by acme.same-id",
        ownerExtensionId: "acme.same-id"
      }
    ]);
  });

  it("reports contribution conflicts with owner ids in contribution order", () => {
    const lifecycle = createChartExtensionLifecycle({});
    const installed = createChartExtension(
      { id: "acme.owner", label: "Owner", version: "1.0.0" },
      {
        seriesRenderers: [createSeriesRenderer("bars"), createSeriesRenderer("line")],
        visualRenderers: [createVisualRenderer("histogram")],
        drawingRenderers: [createDrawingRenderer("trendLine")],
        drawingTools: [createDrawingTool("trendLine")],
        figureRenderers: [createFigureRenderer("marker")]
      }
    );
    const nextExtension = createChartExtension(
      { id: "acme.next", label: "Next", version: "1.0.0" },
      {
        figureRenderers: [createFigureRenderer("marker")],
        drawingTools: [createDrawingTool("trendLine")],
        drawingRenderers: [createDrawingRenderer("trendLine")],
        visualRenderers: [createVisualRenderer("histogram")],
        seriesRenderers: [createSeriesRenderer("line"), createSeriesRenderer("bars")]
      }
    );

    lifecycle.install(installed);

    expect(lifecycle.validateInstall(nextExtension).issues).toEqual([
      {
        code: "install.contributionConflict",
        path: "contributions.seriesRenderers[0].type",
        message: "Chart extension contribution is already installed: seriesRenderers line by acme.owner",
        ownerExtensionId: "acme.owner"
      },
      {
        code: "install.contributionConflict",
        path: "contributions.seriesRenderers[1].type",
        message: "Chart extension contribution is already installed: seriesRenderers bars by acme.owner",
        ownerExtensionId: "acme.owner"
      },
      {
        code: "install.contributionConflict",
        path: "contributions.visualRenderers[0].type",
        message: "Chart extension contribution is already installed: visualRenderers histogram by acme.owner",
        ownerExtensionId: "acme.owner"
      },
      {
        code: "install.contributionConflict",
        path: "contributions.drawingRenderers[0].type",
        message: "Chart extension contribution is already installed: drawingRenderers trendLine by acme.owner",
        ownerExtensionId: "acme.owner"
      },
      {
        code: "install.contributionConflict",
        path: "contributions.drawingTools[0].type",
        message: "Chart extension contribution is already installed: drawingTools trendLine by acme.owner",
        ownerExtensionId: "acme.owner"
      },
      {
        code: "install.contributionConflict",
        path: "contributions.figureRenderers[0].type",
        message: "Chart extension contribution is already installed: figureRenderers marker by acme.owner",
        ownerExtensionId: "acme.owner"
      }
    ]);
  });

  it("does not mutate lifecycle state, registries, or extension inputs while validating installs", () => {
    const drawingRenderers = createDrawingRendererRegistry();
    const drawingTools = createDrawingToolRegistry();
    const lifecycle = createChartExtensionLifecycle({ drawingRenderers, drawingTools });
    const installedRenderer = createDrawingRenderer("acme.persisted", "installed");
    const installed = createChartExtension(
      { id: "acme.installed", label: "Installed", version: "1.0.0" },
      {
        drawingRenderers: [installedRenderer],
        drawingTools: [createDrawingTool("acme.persisted")]
      }
    );
    const nextRenderer = createDrawingRenderer("acme.persisted", "next");
    const nextTool = createDrawingTool("acme.persisted");
    const nextExtension: ChartExtension = {
      manifest: {
        id: "acme.next",
        label: "Next",
        version: "1.0.0",
        capabilities: ["drawingTools"]
      },
      contributions: {
        drawingRenderers: [nextRenderer],
        drawingTools: [nextTool]
      }
    };

    lifecycle.install(installed);

    const stateBefore = lifecycle.getState();
    const installedBefore = lifecycle.listInstalled();
    const rendererBefore = drawingRenderers.require("acme.persisted");
    const toolBefore = drawingTools.require("acme.persisted");

    lifecycle.validateInstall(nextExtension);

    expect(lifecycle.getState()).toEqual(stateBefore);
    expect(lifecycle.listInstalled()).toEqual(installedBefore);
    expect(drawingRenderers.require("acme.persisted")).toBe(rendererBefore);
    expect(drawingTools.require("acme.persisted")).toBe(toolBefore);
    expect(lifecycle.isInstalled("acme.next")).toBe(false);
    expect(nextExtension.manifest).toEqual({
      id: "acme.next",
      label: "Next",
      version: "1.0.0",
      capabilities: ["drawingTools"]
    });
    expect(nextExtension.contributions.drawingRenderers?.[0]).toBe(nextRenderer);
    expect(nextExtension.contributions.drawingTools?.[0]).toBe(nextTool);
    expect(nextTool.defaultStyle.lineDash).toEqual([4, 2]);
  });

  it("installs and uninstalls local extension contributions through a lifecycle", () => {
    const builtInRenderer = createDrawingRenderer("acme.measurement-box", "built-in");
    const extensionRenderer = createDrawingRenderer("acme.measurement-box", "extension");
    const drawingRenderers = createDrawingRendererRegistry();
    const drawingTools = createDrawingToolRegistry();
    const lifecycle = createChartExtensionLifecycle({ drawingRenderers, drawingTools });
    const extension = createChartExtension(
      { id: "acme.lifecycle", label: "Lifecycle", version: "1.0.0" },
      {
        drawingRenderers: [extensionRenderer],
        drawingTools: [createDrawingTool("acme.measurement-box")]
      }
    );

    drawingRenderers.register(builtInRenderer);

    const result = lifecycle.install(extension);

    expect(result.installed.drawingRenderers).toBe(1);
    expect(result.installed.drawingTools).toBe(1);
    expect(lifecycle.isInstalled("acme.lifecycle")).toBe(true);
    expect(lifecycle.getState()).toEqual({
      installedExtensionIds: ["acme.lifecycle"],
      installedCount: 1
    });
    expect(drawingRenderers.require("acme.measurement-box")).toBe(extensionRenderer);
    expect(drawingTools.require("acme.measurement-box").label).toBe("Measurement Box");

    const uninstallResult = lifecycle.uninstall("acme.lifecycle");

    expect(uninstallResult).toEqual({
      extensionId: "acme.lifecycle",
      uninstalled: {
        seriesRenderers: 0,
        visualRenderers: 0,
        drawingRenderers: 1,
        drawingTools: 1,
        figureRenderers: 0
      }
    });
    expect(lifecycle.isInstalled("acme.lifecycle")).toBe(false);
    expect(drawingRenderers.require("acme.measurement-box")).toBe(builtInRenderer);
    expect(drawingTools.get("acme.measurement-box")).toBeUndefined();
  });

  it("rejects duplicate lifecycle installs and duplicate contribution keys", () => {
    const drawingRenderers = createDrawingRendererRegistry();
    const lifecycle = createChartExtensionLifecycle({ drawingRenderers });
    const first = createChartExtension(
      { id: "acme.first", label: "First", version: "1.0.0" },
      { drawingRenderers: [createDrawingRenderer("acme.measurement-box", "first")] }
    );
    const second = createChartExtension(
      { id: "acme.second", label: "Second", version: "1.0.0" },
      { drawingRenderers: [createDrawingRenderer("acme.measurement-box", "second")] }
    );
    const duplicatedContribution = createChartExtension(
      { id: "acme.duplicated", label: "Duplicated", version: "1.0.0" },
      {
        drawingRenderers: [
          createDrawingRenderer("acme.duplicate", "first"),
          createDrawingRenderer("acme.duplicate", "second")
        ]
      }
    );

    lifecycle.install(first);

    expect(lifecycle.validateInstall(first).issues.map((issue) => issue.code)).toEqual([
      "install.alreadyInstalled",
      "install.contributionConflict"
    ]);
    expect(lifecycle.validateInstall(second).issues).toEqual([
      {
        code: "install.contributionConflict",
        path: "contributions.drawingRenderers[0].type",
        message: "Chart extension contribution is already installed: drawingRenderers acme.measurement-box by acme.first",
        ownerExtensionId: "acme.first"
      }
    ]);
    expect(lifecycle.validateInstall(duplicatedContribution).issues).toEqual([
      {
        code: "contribution.duplicate",
        path: "contributions.drawingRenderers[1].type",
        message: "Chart extension contribution type is duplicated: drawingRenderers acme.duplicate"
      }
    ]);
    expect(() => lifecycle.install(first)).toThrow("Chart extension is already installed: acme.first");
    expect(() => lifecycle.install(second)).toThrow(
      "Chart extension contribution is already installed: drawingRenderers acme.measurement-box by acme.first"
    );
    expect(() => lifecycle.install(duplicatedContribution)).toThrow(
      "Chart extension contribution is duplicated: drawingRenderers acme.duplicate"
    );
  });

  it("returns cloned installed extension snapshots", () => {
    const lifecycle = createChartExtensionLifecycle({});
    const extension = createChartExtension(
      {
        id: "acme.snapshot",
        label: "Snapshot",
        version: "1.0.0",
        capabilities: ["drawingTools"]
      },
      { drawingTools: [createDrawingTool("acme.snapshot-tool")] }
    );

    lifecycle.install(extension);

    const installed = lifecycle.listInstalled();

    installed[0].manifest.capabilities?.push("mutated");
    installed[0].contributions.drawingTools?.[0]?.defaultStyle.lineDash?.push(99);

    expect(lifecycle.listInstalled()[0].manifest.capabilities).toEqual(["drawingTools"]);
    expect(lifecycle.listInstalled()[0].contributions.drawingTools?.[0]?.defaultStyle.lineDash).toEqual([
      4,
      2
    ]);
    expect(() => lifecycle.uninstall("missing")).toThrow("Chart extension is not installed: missing");
  });
});

function createSeriesRenderer(type: SeriesRenderer["type"] = "line"): SeriesRenderer {
  return {
    type,
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

function createVisualRenderer(type: VisualRenderer["type"] = "line"): VisualRenderer {
  return {
    type,
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

function createDrawingRenderer(
  type: DrawingRenderer["type"] = "acme.measurement-box",
  label = "renderer"
): DrawingRenderer {
  return {
    type,
    render() {},
    hitTest(drawing) {
      return { drawingId: `${label}:${drawing.id}`, distance: 0 };
    }
  };
}

function createDrawingTool(type: DrawingToolDefinition["type"] = "acme.measurement-box"): DrawingToolDefinition {
  return {
    type,
    label: "Measurement Box",
    category: "measurement",
    totalStep: 3,
    anchorCount: 2,
    drawingMode: "step",
    defaultStyle: { color: "#2563eb", lineWidth: 2, lineDash: [4, 2] },
    hotkeyId: "drawing.acme.measurement-box"
  };
}

function createFigureRenderer(type: FigureRenderer["type"] = "marker"): FigureRenderer {
  return {
    type,
    render() {}
  };
}

function _typeCheckExtension(_extension: ChartExtension): void {}
function _typeCheckInstallValidation(
  _result: ChartExtensionInstallValidationResult
): void {}
