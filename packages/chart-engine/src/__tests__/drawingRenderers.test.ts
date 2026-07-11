import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingRendererRegistry,
  createDrawingLayer,
  createMainPanelPriceScale,
  defaultChartTheme,
  defaultChartTimeFormatter,
  type CandleSeries,
  type ChartLayout,
  type DrawingObject,
  type DrawingType,
  type LayerRenderContext,
  type RenderState,
  type ViewportState
} from "../index";

interface DrawCall {
  name: string;
  args: unknown[];
}

class FakeCanvasContext {
  calls: DrawCall[] = [];
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  font = "";
  private stack: Array<{ fillStyle: string; strokeStyle: string; lineWidth: number; font: string }> =
    [];

  beginPath(): void {
    this.record("beginPath");
  }

  moveTo(x: number, y: number): void {
    this.record("moveTo", x, y);
  }

  lineTo(x: number, y: number): void {
    this.record("lineTo", x, y);
  }

  closePath(): void {
    this.record("closePath");
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.record("rect", x, y, width, height);
  }

  fill(): void {
    this.record("fill", this.fillStyle);
  }

  stroke(): void {
    this.record("stroke", this.strokeStyle, this.lineWidth);
  }

  fillText(text: string, x: number, y: number): void {
    this.record("fillText", text, x, y, this.fillStyle, this.font);
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    this.record("arc", x, y, radius, startAngle, endAngle);
  }

  save(): void {
    this.stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      font: this.font
    });
    this.record("save");
  }

  restore(): void {
    const style = this.stack.pop();

    if (style) {
      this.fillStyle = style.fillStyle;
      this.strokeStyle = style.strokeStyle;
      this.lineWidth = style.lineWidth;
      this.font = style.font;
    }
    this.record("restore");
  }

  setLineDash(dash: number[]): void {
    this.record("setLineDash", dash);
  }

  translate(x: number, y: number): void {
    this.record("translate", x, y);
  }

  scale(x: number, y: number): void {
    this.record("scale", x, y);
  }

  private record(name: string, ...args: unknown[]): void {
    this.calls.push({ name, args });
  }
}

const defaultRenderedDrawingTypes = [
  "trendLine",
  "ray",
  "extendedLine",
  "horizontalLine",
  "verticalLine",
  "crossLine",
  "parallelChannel",
  "regressionChannel",
  "fibonacciRetracement",
  "fibonacciExtension",
  "text",
  "callout",
  "rectangle",
  "rotatedRectangle",
  "circle",
  "ellipse",
  "polygon",
  "path",
  "brush",
  "arrow",
  "longPosition",
  "shortPosition",
  "datePriceRange",
  "segment",
  "straightLine",
  "rayLine",
  "horizontalRayLine",
  "horizontalSegment",
  "horizontalStraightLine",
  "verticalRayLine",
  "verticalSegment",
  "verticalStraightLine",
  "priceLine",
  "priceChannelLine",
  "simpleAnnotation",
  "simpleTag",
  "triangle",
  "arc",
  "curve",
  "fibTrendBasedExtension",
  "fibTimeZone",
  "fibFan",
  "fibArc",
  "fibChannel",
  "fibWedge",
  "profitLossRange",
  "dateRange",
  "priceRange",
  "measure",
  "trendAngle",
  "gannFan",
  "gannBox",
  "gannSquare",
  "pitchfork",
  "schiffPitchfork",
  "modifiedSchiffPitchfork",
  "insidePitchfork",
  "elliottImpulseWave",
  "elliottCorrectionWave",
  "xabcdPattern",
  "cypherPattern",
  "headAndShouldersPattern",
  "forecastPath"
] satisfies DrawingType[];

describe("drawing renderers", () => {
  it.each(defaultRenderedDrawingTypes)("renders %s from neutral JSON", (type) => {
    const registry = createDefaultDrawingRendererRegistry();
    const layer = createDrawingLayer(registry);
    const drawing: DrawingObject = {
      id: `${type}-1`,
      type,
      anchors: [
        { x: 10, y: 20 },
        { x: 80, y: 60 },
        { x: 120, y: 40 },
        { x: 140, y: 70 },
        { x: 160, y: 30 }
      ],
      text: "Label",
      visible: true,
      locked: false
    };
    const context = createLayerContext([drawing]);

    layer.render(context);

    expect((context.context as unknown as FakeCanvasContext).calls.length).toBeGreaterThan(0);
  });

  it("skips invisible drawings", () => {
    const registry = createDefaultDrawingRendererRegistry();
    const layer = createDrawingLayer(registry);
    const context = createLayerContext([
      {
        id: "hidden",
        type: "trendLine",
        anchors: [
          { x: 10, y: 20 },
          { x: 80, y: 60 }
        ],
        visible: false
      }
    ]);

    layer.render(context);

    expect((context.context as unknown as FakeCanvasContext).calls).toEqual([]);
  });

  it("renders selected drawing handles", () => {
    const registry = createDefaultDrawingRendererRegistry();
    const layer = createDrawingLayer(registry);
    const context = createLayerContext(
      [
        {
          id: "selected",
          type: "trendLine",
          anchors: [
            { x: 10, y: 20 },
            { x: 80, y: 60 }
          ]
        }
      ],
      { selectedDrawingIds: ["selected"] }
    );

    layer.render(context);

    expect(callsNamed(context.context as unknown as FakeCanvasContext, "arc").length).toBeGreaterThan(
      0
    );
  });

  it("uses drawing default stroke for unstyled figure-backed drawings", () => {
    const registry = createDefaultDrawingRendererRegistry();
    const layer = createDrawingLayer(registry);
    const context = createLayerContext([
      {
        id: "unstyled-segment",
        type: "segment",
        anchors: [
          { x: 10, y: 20 },
          { x: 80, y: 60 }
        ]
      }
    ]);

    layer.render(context);

    expect(callsNamed(context.context as unknown as FakeCanvasContext, "stroke")[0]?.args[0]).toBe(
      "#2563eb"
    );
  });

  it("registers all default-rendered drawing types in the default registry", () => {
    const registry = createDefaultDrawingRendererRegistry();

    expect(registry.list().map((renderer) => renderer.type)).toEqual(defaultRenderedDrawingTypes);
  });
});

function createLayerContext(
  drawings: DrawingObject[],
  override: Partial<RenderState> = {}
): LayerRenderContext {
  const series = override.series ?? createSeries();
  const viewport = override.viewport ?? createViewport();

  return {
    context: new FakeCanvasContext() as unknown as CanvasRenderingContext2D,
    state: {
      series,
      viewport,
      priceScale:
        override.priceScale ??
        createMainPanelPriceScale(
          series,
          viewport.visibleRange,
          viewport.priceScaleMode,
          override.visualOutputs ?? [],
          override.movingAverages ?? []
        ),
      formatTime: defaultChartTimeFormatter,
      theme: defaultChartTheme,
      layout: createLayout(),
      drawings,
      ...override
    }
  };
}

function createSeries(): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: [{ time: 1, open: 10, high: 12, low: 8, close: 11, volume: 100, turnover: 1100 }]
  };
}

function createViewport(): ViewportState {
  return {
    visibleRange: { from: 0, to: 0 },
    candleWidth: 10,
    scrollOffset: 0,
    priceScaleMode: "linear"
  };
}

function createLayout(): ChartLayout {
  return {
    width: 140,
    height: 100,
    rightAxisWidth: 40,
    bottomAxisHeight: 20,
    plotArea: { x: 0, y: 0, width: 100, height: 80 },
    priceAxisArea: { x: 100, y: 0, width: 40, height: 80 },
    timeAxisArea: { x: 0, y: 80, width: 100, height: 20 }
  };
}

function callsNamed(context: FakeCanvasContext, name: string): DrawCall[] {
  return context.calls.filter((call) => call.name === name);
}
