import { describe, expect, it } from "vitest";
import {
  createBuiltInFigureRenderers,
  createFigureRendererRegistry,
  getFigureBounds,
  hitTestFigure,
  type FigureObject,
  type FigureRenderer,
  type FigureType
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

  it("computes circle bounds from center and radius", () => {
    expect(
      getFigureBounds({
        id: "circle-1",
        type: "circle",
        points: [
          { x: 10, y: 10 },
          { x: 13, y: 14 }
        ]
      })
    ).toEqual({ minX: 5, minY: 5, maxX: 15, maxY: 15 });
  });

  it("computes marker bounds from marker radius", () => {
    expect(
      getFigureBounds({
        id: "marker-1",
        type: "marker",
        points: [{ x: 4, y: 6 }],
        style: { lineWidth: 5 }
      })
    ).toEqual({ minX: -1, minY: 1, maxX: 9, maxY: 11 });
  });

  it("computes semantic bounds for ellipse and rect figures", () => {
    expect(
      getFigureBounds({
        id: "ellipse-1",
        type: "ellipse",
        points: [
          { x: 20, y: 30 },
          { x: 10, y: 5 }
        ]
      })
    ).toEqual({ minX: 10, minY: 5, maxX: 20, maxY: 30 });

    expect(
      getFigureBounds({
        id: "rect-1",
        type: "rect",
        points: [
          { x: 10, y: 20 },
          { x: 0, y: 5 }
        ]
      })
    ).toEqual({ minX: 0, minY: 5, maxX: 10, maxY: 20 });
  });

  it("keeps arc and curve bounds as deterministic point bounds", () => {
    expect(
      getFigureBounds({
        id: "arc-1",
        type: "arc",
        points: [
          { x: 5, y: 5 },
          { x: 10, y: 5 },
          { x: 5, y: 12 }
        ]
      })
    ).toEqual({ minX: 5, minY: 5, maxX: 10, maxY: 12 });

    expect(
      getFigureBounds({
        id: "curve-1",
        type: "curve",
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 10 },
          { x: 10, y: 0 }
        ]
      })
    ).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
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

  it("hit-tests circle fill and circumference", () => {
    const circle: FigureObject = {
      id: "circle-1",
      type: "circle",
      points: [
        { x: 10, y: 10 },
        { x: 15, y: 10 }
      ]
    };

    expect(hitTestFigure(circle, { x: 10, y: 14 }, 0)).toEqual({
      figureId: "circle-1",
      distance: 0
    });
    expect(hitTestFigure(circle, { x: 10, y: 16 }, 1)).toEqual({
      figureId: "circle-1",
      distance: 1
    });
  });

  it("hit-tests marker radius", () => {
    const marker: FigureObject = {
      id: "marker-1",
      type: "marker",
      points: [{ x: 0, y: 0 }],
      style: { lineWidth: 5 }
    };

    expect(hitTestFigure(marker, { x: 4, y: 0 }, 0)).toEqual({
      figureId: "marker-1",
      distance: 0
    });
    expect(hitTestFigure(marker, { x: 6, y: 0 }, 1)).toEqual({
      figureId: "marker-1",
      distance: 1
    });
  });

  it("hit-tests ellipse fill and sampled ellipse boundary", () => {
    const ellipse: FigureObject = {
      id: "ellipse-1",
      type: "ellipse",
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 10 }
      ]
    };

    expect(hitTestFigure(ellipse, { x: 10, y: 8 }, 0)).toEqual({
      figureId: "ellipse-1",
      distance: 0
    });
    expect(hitTestFigure(ellipse, { x: 21, y: 5 }, 1)).toEqual({
      figureId: "ellipse-1",
      distance: 1
    });
    expect(hitTestFigure(ellipse, { x: 19, y: 9.5 }, 1)).toBeUndefined();
  });

  it("hit-tests arc circumference with deterministic center radius angles", () => {
    const arc: FigureObject = {
      id: "arc-1",
      type: "arc",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ]
    };
    const hit = hitTestFigure(arc, { x: 7, y: 7 }, 0.2);

    expect(hit?.figureId).toBe("arc-1");
    expect(hit?.distance).toBeCloseTo(Math.abs(Math.hypot(7, 7) - 10));
  });

  it("hit-tests curve geometry using its control polyline approximation", () => {
    const curve: FigureObject = {
      id: "curve-1",
      type: "curve",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 10 },
        { x: 10, y: 0 }
      ]
    };

    expect(hitTestFigure(curve, { x: 5, y: 8 }, 1)).toEqual({
      figureId: "curve-1",
      distance: expect.closeTo(0.8944271909999159)
    });
  });

  it("renders semantic geometry for registered figure types", () => {
    const line = renderFigure({
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ]
    });
    expect(getCallArgs(line, "lineTo")).toEqual([[10, 0]]);

    const polyline = renderFigure({
      id: "polyline-1",
      type: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ]
    });
    expect(getCallArgs(polyline, "lineTo")).toEqual([
      [10, 0],
      [10, 10]
    ]);

    const rect = renderFigure({
      id: "rect-1",
      type: "rect",
      points: [
        { x: 10, y: 20 },
        { x: 0, y: 0 }
      ]
    });
    expect(getCallArgs(rect, "rect")).toEqual([[0, 0, 10, 20]]);
    expect(getCallNames(rect)).toEqual(expect.arrayContaining(["fill", "stroke"]));

    const circle = renderFigure({
      id: "circle-1",
      type: "circle",
      points: [
        { x: 5, y: 5 },
        { x: 10, y: 5 }
      ]
    });
    expect(getCallArgs(circle, "arc")).toEqual([[5, 5, 5, 0, Math.PI * 2]]);

    const ellipse = renderFigure({
      id: "ellipse-1",
      type: "ellipse",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 20 }
      ]
    });
    expect(getCallArgs(ellipse, "ellipse")).toEqual([[5, 10, 5, 10, 0, 0, Math.PI * 2]]);

    const arc = renderFigure({
      id: "arc-1",
      type: "arc",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ]
    });
    expect(getCallArgs(arc, "arc")).toEqual([[0, 0, 10, 0, Math.PI / 2]]);

    const curve = renderFigure({
      id: "curve-1",
      type: "curve",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 10 },
        { x: 10, y: 0 }
      ]
    });
    expect(getCallArgs(curve, "quadraticCurveTo")).toEqual([[5, 10, 10, 0]]);

    const marker = renderFigure({
      id: "marker-1",
      type: "marker",
      points: [{ x: 2, y: 3 }]
    });
    expect(getCallArgs(marker, "arc")).toEqual([[2, 3, 3, 0, Math.PI * 2]]);

    const arrow = renderFigure({
      id: "arrow-1",
      type: "arrow",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ]
    });
    expect(getCallNames(arrow).filter((name) => name === "beginPath")).toHaveLength(2);
    expect(getCallArgs(arrow, "lineTo").length).toBeGreaterThan(1);

    const text = renderFigure({
      id: "text-1",
      type: "text",
      points: [{ x: 3, y: 4 }],
      text: "Hello",
      style: { fontSize: 16, textColor: "#f00" }
    });
    expect(getCallArgs(text, "fillText")).toEqual([["Hello", 3, 4]]);
    expect(getCallNames(text)).not.toContain("stroke");

    const label = renderFigure({
      id: "label-1",
      type: "label",
      points: [{ x: 5, y: 6 }],
      text: "Label"
    });
    expect(getCallArgs(label, "fillText")).toEqual([["Label", 5, 6]]);
  });

  it.each(["polygon", "band", "rotatedRect"] as const)(
    "renders %s as a closed filled polygon",
    (type) => {
      const context = renderFigure({
        id: `${type}-1`,
        type,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ]
      });

      expect(getCallNames(context)).toEqual(expect.arrayContaining(["closePath", "fill", "stroke"]));
    }
  );

  it("restores the canvas context when rendering throws", () => {
    const renderer = requireBuiltInRenderer("line");
    const context = createFakeCanvasContext();
    context.stroke = () => {
      context.calls.push({ name: "stroke", args: [] });
      throw new Error("stroke failed");
    };

    expect(() =>
      renderer.render({
        context: context as unknown as CanvasRenderingContext2D,
        figure: {
          id: "line-1",
          type: "line",
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 }
          ]
        }
      })
    ).toThrow("stroke failed");
    expect(context.calls[context.calls.length - 1]).toEqual({ name: "restore", args: [] });
  });

  it("hit-tests closed shape edges and filled interiors", () => {
    const squarePoints = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];
    const polygon: FigureObject = {
      id: "polygon-1",
      type: "polygon",
      points: squarePoints
    };
    const band: FigureObject = {
      id: "band-1",
      type: "band",
      points: squarePoints
    };
    const rotatedRect: FigureObject = {
      id: "rotatedRect-1",
      type: "rotatedRect",
      points: squarePoints
    };
    const polyline: FigureObject = {
      id: "polyline-1",
      type: "polyline",
      points: squarePoints
    };
    const rect: FigureObject = {
      id: "rect-1",
      type: "rect",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]
    };

    expect(hitTestFigure(polygon, { x: 5, y: 5 }, 0)).toEqual({
      figureId: "polygon-1",
      distance: 0
    });
    expect(hitTestFigure(polygon, { x: -1, y: 5 }, 1.1)).toEqual({
      figureId: "polygon-1",
      distance: 1
    });
    expect(hitTestFigure(band, { x: -1, y: 5 }, 1.1)).toEqual({
      figureId: "band-1",
      distance: 1
    });
    expect(hitTestFigure(rotatedRect, { x: -1, y: 5 }, 1.1)).toEqual({
      figureId: "rotatedRect-1",
      distance: 1
    });
    expect(hitTestFigure(polyline, { x: -1, y: 5 }, 1.1)).toBeUndefined();
    expect(hitTestFigure(rect, { x: -1, y: 5 }, 1.1)).toEqual({
      figureId: "rect-1",
      distance: 1
    });
  });
});

interface CanvasCall {
  name: string;
  args: unknown[];
}

interface FakeCanvasContext {
  calls: CanvasCall[];
  fillStyle: string;
  font: string;
  lineWidth: number;
  strokeStyle: string;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  beginPath(): void;
  closePath(): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number
  ): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  lineTo(x: number, y: number): void;
  moveTo(x: number, y: number): void;
  quadraticCurveTo(controlX: number, controlY: number, x: number, y: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  restore(): void;
  save(): void;
  scale(x: number, y: number): void;
  setLineDash(lineDash: number[]): void;
  stroke(): void;
  translate(x: number, y: number): void;
}

function renderFigure(figure: FigureObject): FakeCanvasContext {
  const renderer = requireBuiltInRenderer(figure.type);
  const context = createFakeCanvasContext();

  renderer.render({ context: context as unknown as CanvasRenderingContext2D, figure });

  return context;
}

function requireBuiltInRenderer(type: FigureType): FigureRenderer {
  const renderer = createBuiltInFigureRenderers().find((entry) => entry.type === type);

  if (!renderer) {
    throw new Error(`Missing built-in renderer: ${type}`);
  }

  return renderer;
}

function createFakeCanvasContext(): FakeCanvasContext {
  const calls: CanvasCall[] = [];
  const record = (name: string, ...args: unknown[]) => {
    calls.push({ name, args });
  };

  return {
    calls,
    fillStyle: "",
    font: "",
    lineWidth: 1,
    strokeStyle: "",
    arc(x, y, radius, startAngle, endAngle) {
      record("arc", x, y, radius, startAngle, endAngle);
    },
    beginPath() {
      record("beginPath");
    },
    closePath() {
      record("closePath");
    },
    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle) {
      record("ellipse", x, y, radiusX, radiusY, rotation, startAngle, endAngle);
    },
    fill() {
      record("fill");
    },
    fillText(text, x, y) {
      record("fillText", text, x, y);
    },
    lineTo(x, y) {
      record("lineTo", x, y);
    },
    moveTo(x, y) {
      record("moveTo", x, y);
    },
    quadraticCurveTo(controlX, controlY, x, y) {
      record("quadraticCurveTo", controlX, controlY, x, y);
    },
    rect(x, y, width, height) {
      record("rect", x, y, width, height);
    },
    restore() {
      record("restore");
    },
    save() {
      record("save");
    },
    scale(x, y) {
      record("scale", x, y);
    },
    setLineDash(lineDash) {
      record("setLineDash", [...lineDash]);
    },
    stroke() {
      record("stroke");
    },
    translate(x, y) {
      record("translate", x, y);
    }
  };
}

function getCallNames(context: FakeCanvasContext): string[] {
  return context.calls.map((call) => call.name);
}

function getCallArgs(context: FakeCanvasContext, name: string): unknown[][] {
  return context.calls.filter((call) => call.name === name).map((call) => call.args);
}
