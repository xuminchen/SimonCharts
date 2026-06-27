import { describe, expect, it } from "vitest";
import {
  drawingTypes,
  getDrawingPropertyDefinitionsForDrawing,
  getDrawingPropertySchema,
  isFillDrawingType,
  isTextDrawingType,
  type DrawingPropertyDefinition
} from "../index";

describe("drawing property schema", () => {
  it("provides a schema for every built-in drawing type", () => {
    for (const type of drawingTypes) {
      const schema = getDrawingPropertySchema(type);

      expect(schema.type).toBe(type);
      expect(schema.properties.map((property) => property.id)).toEqual(
        expect.arrayContaining(["style.color", "style.lineWidth", "style.lineDash", "state.visible", "state.locked"])
      );
    }
  });

  it("adds text controls only for annotation drawing types", () => {
    expect(isTextDrawingType("text")).toBe(true);
    expect(isTextDrawingType("callout")).toBe(true);
    expect(isTextDrawingType("trendLine")).toBe(false);

    expect(propertyIds("text")).toEqual(
      expect.arrayContaining(["style.textColor", "style.fontSize", "content.text"])
    );
    expect(propertyIds("trendLine")).not.toContain("content.text");
  });

  it("adds fill controls for fill-capable drawing types", () => {
    expect(isFillDrawingType("rectangle")).toBe(true);
    expect(isFillDrawingType("longPosition")).toBe(true);
    expect(isFillDrawingType("trendLine")).toBe(false);

    expect(propertyIds("rectangle")).toContain("style.fill");
    expect(propertyIds("trendLine")).not.toContain("style.fill");
  });

  it("describes state properties as neutral editor commands", () => {
    const stateProperties = getDrawingPropertySchema("trendLine").properties.filter(
      (property) => property.scope === "state"
    );

    expect(stateProperties).toEqual([
      {
        id: "state.visible",
        label: "Visible",
        scope: "state",
        valueType: "boolean",
        stateKey: "visible",
        commandWhenTrue: "showSelected",
        commandWhenFalse: "hideSelected",
        defaultValue: true
      },
      {
        id: "state.locked",
        label: "Locked",
        scope: "state",
        valueType: "boolean",
        stateKey: "locked",
        commandWhenTrue: "lockSelected",
        commandWhenFalse: "unlockSelected",
        defaultValue: false
      }
    ]);
  });

  it("returns cloned property definitions", () => {
    const schema = getDrawingPropertySchema("trendLine");
    const dashProperty = schema.properties.find((property) => property.id === "style.lineDash");

    if (!dashProperty || dashProperty.scope !== "style") {
      throw new Error("Missing line dash property");
    }

    schema.properties.push({ ...schema.properties[0], id: "mutated" } as DrawingPropertyDefinition);
    dashProperty.options?.push({ label: "Mutated", value: "mutated" });

    const nextSchema = getDrawingPropertySchema("trendLine");

    expect(nextSchema.properties.map((property) => property.id)).not.toContain("mutated");
    expect(
      nextSchema.properties.find((property) => property.id === "style.lineDash")?.options
    ).toEqual([
      { label: "Solid", value: "solid" },
      { label: "Dashed", value: "dashed" },
      { label: "Dotted", value: "dotted" }
    ]);
  });

  it("returns schema definitions for drawing objects and custom drawing types", () => {
    const definitions = getDrawingPropertyDefinitionsForDrawing({
      id: "custom",
      type: "acme.measurement-box",
      anchors: [{ x: 1, y: 2 }]
    });

    expect(definitions.map((property) => property.id)).toEqual([
      "style.color",
      "style.lineWidth",
      "style.lineDash",
      "state.visible",
      "state.locked"
    ]);
  });
});

function propertyIds(type: Parameters<typeof getDrawingPropertySchema>[0]): string[] {
  return getDrawingPropertySchema(type).properties.map((property) => property.id);
}
