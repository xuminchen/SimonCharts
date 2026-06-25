import { describe, expect, it } from "vitest";
import {
  createBuiltInFigureRenderers,
  createFigureRendererRegistry,
  getFigureBounds,
  hitTestFigure,
  type FigureObject
} from "../index";

describe("figure primitives", () => {
  it("registers all built-in figure renderers", () => {
    const registry = createFigureRendererRegistry();

    for (const renderer of createBuiltInFigureRenderers()) {
      registry.register(renderer);
    }

    expect(registry.list().map((renderer) => renderer.type)).toEqual([
      "line",
      "polyline",
      "polygon",
      "rect",
      "rotatedRect",
      "circle",
      "ellipse",
      "arc",
      "curve",
      "text",
      "label",
      "arrow",
      "band",
      "marker"
    ]);
  });

  it("computes bounds for geometry figures", () => {
    const figure: FigureObject = {
      id: "line-1",
      type: "line",
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 60 }
      ]
    };

    expect(getFigureBounds(figure)).toEqual({ minX: 10, minY: 20, maxX: 40, maxY: 60 });
  });

  it("hit-tests line geometry by pixel distance", () => {
    const figure: FigureObject = {
      id: "line-1",
      type: "line",
      points: [
        { x: 10, y: 10 },
        { x: 50, y: 10 }
      ]
    };

    expect(hitTestFigure(figure, { x: 30, y: 13 }, 4)).toEqual({
      figureId: "line-1",
      distance: 3
    });
  });
});
