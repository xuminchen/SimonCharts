import { describe, expect, it } from "vitest";
import {
  createDefaultSeriesRendererRegistry,
  createSeriesLayer,
  createSourceSeriesRenderModel,
  defaultChartTheme,
  type CandleSeries,
  type ChartLayout,
  type LayerRenderContext,
  type RenderState,
  type SeriesType,
  type ViewportState
} from "../index";

interface DrawCall {
  name: string;
  args: unknown[];
}

class FakeCanvasContext {
  calls: DrawCall[] = [];
  private styleStack: Array<{
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    globalAlpha: number;
  }> = [];

  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  globalAlpha = 1;

  beginPath(): void {
    this.record("beginPath");
  }

  moveTo(x: number, y: number): void {
    this.record("moveTo", x, y);
  }

  lineTo(x: number, y: number): void {
    this.record("lineTo", x, y);
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.record("rect", x, y, width, height);
  }

  fill(): void {
    this.record("fill");
  }

  stroke(): void {
    this.record("stroke");
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.record("fillRect", x, y, width, height);
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    this.record("arc", x, y, radius, startAngle, endAngle);
  }

  save(): void {
    this.styleStack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha
    });
    this.record("save");
  }

  restore(): void {
    const style = this.styleStack.pop();

    if (style) {
      this.fillStyle = style.fillStyle;
      this.strokeStyle = style.strokeStyle;
      this.lineWidth = style.lineWidth;
      this.globalAlpha = style.globalAlpha;
    }
    this.record("restore");
  }

  clip(): void {
    this.record("clip");
  }

  private record(name: string, ...args: unknown[]): void {
    this.calls.push({ name, args });
  }
}

const directTypes: SeriesType[] = [
  "bars",
  "candles",
  "hollowCandles",
  "volumeCandles",
  "line",
  "lineWithMarkers",
  "stepLine",
  "area",
  "hlcArea",
  "baseline",
  "columns",
  "highLow"
];

const syntheticTypes: SeriesType[] = ["heikinAshi", "renko", "lineBreak", "kagi", "pointAndFigure"];

function createSeries(): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: [
      { time: 1, open: 10, high: 14, low: 9, close: 13, volume: 100, turnover: 1300 },
      { time: 2, open: 13, high: 15, low: 11, close: 12, volume: 120, turnover: 1440 },
      { time: 3, open: 12, high: 16, low: 10, close: 15, volume: 90, turnover: 1350 }
    ]
  };
}

function createViewport(): ViewportState {
  return {
    visibleRange: { from: 0, to: 2 },
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

function createState(seriesType: SeriesType): RenderState {
  return {
    series: createSeries(),
    seriesType,
    viewport: createViewport(),
    theme: defaultChartTheme,
    layout: createLayout()
  };
}

function createRenderContext(seriesType: SeriesType): LayerRenderContext {
  return {
    context: new FakeCanvasContext() as unknown as CanvasRenderingContext2D,
    state: createState(seriesType)
  };
}

describe("series renderers", () => {
  it("registers default renderers in deterministic order", () => {
    expect(createDefaultSeriesRendererRegistry().list().map((renderer) => renderer.type)).toEqual(
      [
        "bars",
        "candles",
        "hollowCandles",
        "volumeCandles",
        "line",
        "lineWithMarkers",
        "stepLine",
        "area",
        "hlcArea",
        "baseline",
        "columns",
        "highLow",
        "heikinAshi",
        "renko",
        "lineBreak",
        "kagi",
        "pointAndFigure"
      ]
    );
  });

  it.each(directTypes)("renders %s without host data", (type) => {
    const registry = createDefaultSeriesRendererRegistry();
    const directContext = createRenderContext(type);
    const model = createSourceSeriesRenderModel(type, directContext.state.series);

    registry.require(type).render({
      ...directContext,
      model,
      layout: directContext.state.layout
    });

    expect((directContext.context as unknown as FakeCanvasContext).calls.length).toBeGreaterThan(0);

    const layerContext = createRenderContext(type);

    createSeriesLayer(registry).render(layerContext);

    expect((layerContext.context as unknown as FakeCanvasContext).calls.length).toBeGreaterThan(0);
  });

  it("restores the caller canvas styles after direct renderer drawing", () => {
    const registry = createDefaultSeriesRendererRegistry();
    const renderContext = createRenderContext("area");
    const fakeContext = renderContext.context as unknown as FakeCanvasContext;
    const model = createSourceSeriesRenderModel("area", renderContext.state.series);

    fakeContext.fillStyle = "original-fill";
    fakeContext.strokeStyle = "original-stroke";
    fakeContext.lineWidth = 9;
    fakeContext.globalAlpha = 0.25;

    registry.require("area").render({
      ...renderContext,
      model,
      layout: renderContext.state.layout
    });

    expect(fakeContext.fillStyle).toBe("original-fill");
    expect(fakeContext.strokeStyle).toBe("original-stroke");
    expect(fakeContext.lineWidth).toBe(9);
    expect(fakeContext.globalAlpha).toBe(0.25);
  });

  it("does not draw embedded volume bars for volumeCandles", () => {
    const registry = createDefaultSeriesRendererRegistry();
    const renderContext = createRenderContext("volumeCandles");
    const model = createSourceSeriesRenderModel("volumeCandles", renderContext.state.series);

    registry.require("volumeCandles").render({
      ...renderContext,
      model,
      layout: renderContext.state.layout
    });

    const fillRects = (renderContext.context as unknown as FakeCanvasContext).calls.filter(
      (call) => call.name === "fillRect"
    );

    expect(fillRects).toHaveLength(renderContext.state.series.candles.length);
  });

  it.each(syntheticTypes)("renders synthetic chart type %s through default registry", (type) => {
    const registry = createDefaultSeriesRendererRegistry();
    const layer = createSeriesLayer(registry);
    const context = createRenderContext(type);

    layer.render(context);

    expect((context.context as unknown as FakeCanvasContext).calls.length).toBeGreaterThan(0);
  });
});
