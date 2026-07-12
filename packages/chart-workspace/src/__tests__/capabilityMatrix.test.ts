import { describe, expect, it } from "vitest";
import { createEngineCapabilityManifest } from "@simoncharts/chart-engine";
import { createToolbarModel } from "../ui/topToolbar";

describe("workspace capability matrix", () => {
  it("derives every toolbar capability from the engine manifest", () => {
    const model = createToolbarModel(createEngineCapabilityManifest());
    expect(model.timeframes).toHaveLength(8);
    expect(model.seriesTypes).toHaveLength(17);
    expect(model.indicators).toHaveLength(16);
    expect(model.priceScaleModes).toEqual(["linear", "log", "percentage"]);
  });
});
