import { describe, expect, it } from "vitest";
import {
  builtInDrawingToolDefinitions,
  createDrawingToolRegistry,
  drawingTypes
} from "../index";

describe("drawing tool registry", () => {
  it("has one tool definition for every drawing type", () => {
    const registry = createDrawingToolRegistry();

    for (const definition of builtInDrawingToolDefinitions) {
      registry.register(definition);
    }

    expect(registry.list().map((definition) => definition.type)).toEqual([...drawingTypes]);
  });

  it("describes step count and anchor count without editor hard-coding", () => {
    const registry = createDrawingToolRegistry();

    for (const definition of builtInDrawingToolDefinitions) {
      registry.register(definition);
    }

    expect(registry.require("horizontalLine")).toMatchObject({
      type: "horizontalLine",
      totalStep: 2,
      anchorCount: 1,
      drawingMode: "step"
    });
    expect(registry.require("elliottImpulseWave")).toMatchObject({
      type: "elliottImpulseWave",
      totalStep: 6,
      anchorCount: 5,
      drawingMode: "step"
    });
  });

  it("gets and unregisters custom drawing tools by type", () => {
    const registry = createDrawingToolRegistry();
    const definition = {
      type: "acme.measurement-box" as const,
      label: "Measurement Box",
      category: "measurement" as const,
      totalStep: 3,
      anchorCount: 2,
      drawingMode: "step" as const,
      defaultStyle: { color: "#2563eb", lineWidth: 2 },
      hotkeyId: "drawing.acme.measurement-box"
    };

    registry.register(definition);

    expect(registry.get("acme.measurement-box")).toBe(definition);
    expect(registry.unregister("acme.measurement-box")).toBe(definition);
    expect(registry.get("acme.measurement-box")).toBeUndefined();
    expect(registry.unregister("acme.measurement-box")).toBeUndefined();
  });
});
