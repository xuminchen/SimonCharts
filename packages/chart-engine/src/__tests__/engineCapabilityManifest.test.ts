import { describe, expect, it } from "vitest";
import {
  builtInDrawingToolDefinitions,
  checkEngineApiVersionCompatibility,
  checkEngineCapabilityRequirements,
  coreIndicatorIds,
  createEngineCapabilityManifest,
  drawingTypes,
  engineApiVersion,
  supportedSeriesTypes
} from "../index";

describe("engine capability manifest", () => {
  it("declares package metadata and release channel", () => {
    const manifest = createEngineCapabilityManifest();

    expect(manifest.packageName).toBe("@simoncharts/chart-engine");
    expect(manifest.packageVersion).toBe("1.0.0-rc.0");
    expect(manifest.apiVersion).toBe(engineApiVersion);
    expect(manifest.releaseChannel).toBe("rc");
  });

  it("accepts exact API version requirements", () => {
    const manifest = createEngineCapabilityManifest();
    const result = checkEngineApiVersionCompatibility(manifest, {
      packageName: "@simoncharts/chart-engine",
      packageVersion: "1.0.0-rc.0",
      apiVersion: engineApiVersion,
      releaseChannel: "rc"
    });

    expect(result).toEqual({
      compatible: true,
      mismatches: []
    });
  });

  it("checks only provided API version requirement keys with exact strings", () => {
    const manifest = createEngineCapabilityManifest();
    const result = checkEngineApiVersionCompatibility(manifest, {
      packageVersion: ">=1.0.0-rc.0"
    });

    expect(result).toEqual({
      compatible: false,
      mismatches: [
        {
          key: "packageVersion",
          expected: ">=1.0.0-rc.0",
          actual: "1.0.0-rc.0"
        }
      ]
    });
  });

  it("reports API version mismatches in deterministic metadata order", () => {
    const manifest = createEngineCapabilityManifest();
    const result = checkEngineApiVersionCompatibility(manifest, {
      releaseChannel: "stable",
      apiVersion: "2.0.0",
      packageVersion: "1.0.0",
      packageName: "@simoncharts/future-chart-engine"
    });

    expect(result).toEqual({
      compatible: false,
      mismatches: [
        {
          key: "packageName",
          expected: "@simoncharts/future-chart-engine",
          actual: "@simoncharts/chart-engine"
        },
        {
          key: "packageVersion",
          expected: "1.0.0",
          actual: "1.0.0-rc.0"
        },
        {
          key: "apiVersion",
          expected: "2.0.0",
          actual: engineApiVersion
        },
        {
          key: "releaseChannel",
          expected: "stable",
          actual: "rc"
        }
      ]
    });
  });

  it("reports unknown future API version strings as mismatches", () => {
    const manifest = createEngineCapabilityManifest();

    expect(() =>
      checkEngineApiVersionCompatibility(manifest, {
        apiVersion: "2099.0.0-future.0",
        releaseChannel: "future"
      })
    ).not.toThrow();

    expect(
      checkEngineApiVersionCompatibility(manifest, {
        apiVersion: "2099.0.0-future.0",
        releaseChannel: "future"
      })
    ).toEqual({
      compatible: false,
      mismatches: [
        {
          key: "apiVersion",
          expected: "2099.0.0-future.0",
          actual: engineApiVersion
        },
        {
          key: "releaseChannel",
          expected: "future",
          actual: "rc"
        }
      ]
    });
  });

  it("aligns capability counts with engine constants", () => {
    const manifest = createEngineCapabilityManifest();

    expect(manifest.seriesTypes).toHaveLength(supportedSeriesTypes.length);
    expect(manifest.drawingTypes).toHaveLength(drawingTypes.length);
    expect(manifest.coreIndicatorIds).toHaveLength(coreIndicatorIds.length);
    expect(manifest.seriesTypes).toEqual([...supportedSeriesTypes]);
    expect(manifest.drawingTypes).toEqual([...drawingTypes]);
    expect(manifest.coreIndicatorIds).toEqual([...coreIndicatorIds]);
  });

  it("mirrors built-in drawing tool summaries", () => {
    const manifest = createEngineCapabilityManifest();

    expect(manifest.drawingTools).toEqual(
      builtInDrawingToolDefinitions.map((definition) => ({
        type: definition.type,
        label: definition.label,
        category: definition.category,
        totalStep: definition.totalStep,
        anchorCount: definition.anchorCount,
        drawingMode: definition.drawingMode,
        hotkeyId: definition.hotkeyId
      }))
    );
  });

  it("returns defensive array and object copies", () => {
    const manifest = createEngineCapabilityManifest();

    manifest.seriesTypes.push("line");
    manifest.drawingTypes.push("trendLine");
    manifest.coreIndicatorIds.push("MA");
    manifest.visualOutputTypes.push("line");
    manifest.drawingEditorCapabilities.push("createDrawing");
    manifest.interactionCapabilities.push("hitTest");
    manifest.extensionContributionTypes.push("seriesRenderers");
    manifest.drawingTools[0]!.label = "Changed";

    const nextManifest = createEngineCapabilityManifest();

    expect(nextManifest.seriesTypes).toEqual([...supportedSeriesTypes]);
    expect(nextManifest.drawingTypes).toEqual([...drawingTypes]);
    expect(nextManifest.coreIndicatorIds).toEqual([...coreIndicatorIds]);
    expect(nextManifest.visualOutputTypes).toEqual(["line", "histogram", "band", "marker"]);
    expect(nextManifest.drawingEditorCapabilities).toEqual([
      "createDrawing",
      "selectDrawing",
      "moveDrawing",
      "editAnchors",
      "deleteDrawing",
      "serializeDrawing"
    ]);
    expect(nextManifest.interactionCapabilities).toEqual([
      "hitTest",
      "hoverState",
      "magnetSnap",
      "selectionBox",
      "handleDrag",
      "moveDrag"
    ]);
    expect(nextManifest.extensionContributionTypes).toEqual([
      "seriesRenderers",
      "visualRenderers",
      "drawingRenderers",
      "drawingTools",
      "figureRenderers"
    ]);
    expect(nextManifest.drawingTools[0]).toMatchObject({
      type: builtInDrawingToolDefinitions[0]!.type,
      label: builtInDrawingToolDefinitions[0]!.label
    });
  });

  it("keeps stringified manifest free of host and business vocabulary", () => {
    const manifestText = JSON.stringify(createEngineCapabilityManifest());
    const manifestTokens = manifestText.toLowerCase().split(/[^a-z0-9]+/);
    const blockedWords = [
      "host",
      "tradingreviewsystem",
      "api",
      "apis",
      "store",
      "stores",
      "schema",
      "route",
      "routes",
      "review",
      "strategy",
      "watchlist",
      "ai",
      "auth",
      "account",
      "billing",
      "persistence",
      "product",
      "workflow",
      "workflows"
    ];

    for (const word of blockedWords) {
      expect(manifestTokens).not.toContain(word);
    }
  });

  it("accepts requirements derived from the current manifest", () => {
    const manifest = createEngineCapabilityManifest();
    const result = checkEngineCapabilityRequirements(manifest, {
      seriesTypes: manifest.seriesTypes,
      drawingTypes: manifest.drawingTypes,
      coreIndicatorIds: manifest.coreIndicatorIds,
      visualOutputTypes: manifest.visualOutputTypes,
      drawingEditorCapabilities: manifest.drawingEditorCapabilities,
      interactionCapabilities: manifest.interactionCapabilities,
      extensionContributionTypes: manifest.extensionContributionTypes
    });

    expect(result).toEqual({
      compatible: true,
      missing: []
    });
  });

  it("reports unknown future values as missing", () => {
    const manifest = createEngineCapabilityManifest();
    const result = checkEngineCapabilityRequirements(manifest, {
      seriesTypes: ["line", "futureSeries"],
      visualOutputTypes: ["futureVisual"]
    });

    expect(result).toEqual({
      compatible: false,
      missing: [
        {
          key: "seriesTypes",
          values: ["futureSeries"]
        },
        {
          key: "visualOutputTypes",
          values: ["futureVisual"]
        }
      ]
    });
  });

  it("returns multiple missing groups in deterministic requirement order", () => {
    const manifest = createEngineCapabilityManifest();
    const result = checkEngineCapabilityRequirements(manifest, {
      extensionContributionTypes: ["futureContribution"],
      seriesTypes: ["futureSeries"],
      drawingEditorCapabilities: ["futureEditor"],
      drawingTypes: ["futureDrawing"]
    });

    expect(result.missing.map((gap) => gap.key)).toEqual([
      "seriesTypes",
      "drawingTypes",
      "drawingEditorCapabilities",
      "extensionContributionTypes"
    ]);
  });

  it("preserves caller order for missing values", () => {
    const manifest = createEngineCapabilityManifest();
    const result = checkEngineCapabilityRequirements(manifest, {
      seriesTypes: ["futureSecond", "line", "futureFirst", "futureThird"]
    });

    expect(result.missing).toEqual([
      {
        key: "seriesTypes",
        values: ["futureSecond", "futureFirst", "futureThird"]
      }
    ]);
  });

  it("does not mutate manifest or requirement inputs", () => {
    const manifest = createEngineCapabilityManifest();
    const requirements = {
      seriesTypes: ["futureSeries", "line"],
      drawingTypes: ["futureDrawing"]
    } as const;
    const manifestSnapshot = JSON.stringify(manifest);
    const requirementsSnapshot = JSON.stringify(requirements);

    checkEngineCapabilityRequirements(manifest, requirements);

    expect(JSON.stringify(manifest)).toBe(manifestSnapshot);
    expect(JSON.stringify(requirements)).toBe(requirementsSnapshot);
  });

  it("keeps stringified requirement result free of host and business vocabulary", () => {
    const resultText = JSON.stringify(
      checkEngineCapabilityRequirements(createEngineCapabilityManifest(), {
        seriesTypes: ["futureSeries"],
        drawingTypes: ["futureDrawing"],
        coreIndicatorIds: ["futureIndicator"]
      })
    );
    const resultTokens = resultText.toLowerCase().split(/[^a-z0-9]+/);
    const blockedWords = [
      "host",
      "tradingreviewsystem",
      "api",
      "apis",
      "store",
      "stores",
      "schema",
      "route",
      "routes",
      "review",
      "strategy",
      "watchlist",
      "ai",
      "auth",
      "account",
      "billing",
      "persistence",
      "product",
      "workflow",
      "workflows"
    ];

    for (const word of blockedWords) {
      expect(resultTokens).not.toContain(word);
    }
  });
});
