import { describe, expect, it } from "vitest";
import {
  builtInDrawingToolDefinitions,
  coreIndicatorIds,
  createEngineCapabilityManifest,
  drawingTypes,
  supportedSeriesTypes
} from "../index";

describe("engine capability manifest", () => {
  it("declares package metadata and release channel", () => {
    const manifest = createEngineCapabilityManifest();

    expect(manifest.packageName).toBe("@simoncharts/chart-engine");
    expect(manifest.packageVersion).toBe("1.0.0-rc.0");
    expect(manifest.releaseChannel).toBe("rc");
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
});
