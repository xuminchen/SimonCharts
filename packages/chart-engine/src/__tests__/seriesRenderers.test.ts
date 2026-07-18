import { describe, expect, it } from "vitest";
import {
  createDefaultSeriesRendererRegistry,
  createSeriesLayer,
  createSeriesRendererRegistry,
  createSourceSeriesRenderModel,
  defaultChartTheme,
  defaultChartTimeFormatter,
  supportedSeriesTypes,
  type CandleSeries,
  type ChartLayout,
  type LayerRenderContext,
  type RenderState,
  type SeriesRenderer,
  type SeriesRenderModel,
  type SeriesType,
  type ViewportState
} from "../index";
import { createMainPanelPriceScale } from "../render/mainPriceScale";

interface DrawCall {
  name: string;
  args: unknown[];
}

class FakeCanvasContext {
  calls: DrawCall[] = [];
  strokeStyles: string[] = [];
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
    this.strokeStyles.push(this.strokeStyle);
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

function createViewport(
  priceScaleMode: ViewportState["priceScaleMode"] = "linear"
): ViewportState {
  return {
    visibleRange: { from: 0, to: 2 },
    candleWidth: 10,
    scrollOffset: 0,
    priceScaleMode
  };
}

function createLayout(): ChartLayout {
  return {
    width: 140,
    height: 100,
    leftAxisWidth: 0,
    rightAxisWidth: 40,
    bottomAxisHeight: 20,
    leftPriceAxisArea: { x: 0, y: 0, width: 0, height: 56 },
    plotArea: { x: 0, y: 0, width: 100, height: 56 },
    priceAxisArea: { x: 100, y: 0, width: 40, height: 56 },
    volumeArea: { x: 0, y: 64, width: 100, height: 16 },
    timeAxisArea: { x: 0, y: 80, width: 100, height: 20 }
  };
}

function createState(
  seriesType: SeriesType,
  priceScaleMode: ViewportState["priceScaleMode"] = "linear",
  series = createSeries()
): RenderState {
  const viewport = createViewport(priceScaleMode);

  return {
    series,
    seriesType,
    viewport,
    priceScale: createMainPanelPriceScale(
      series,
      viewport.visibleRange,
      viewport.priceScaleMode,
      [],
      []
    ),
    formatTime: defaultChartTimeFormatter,
    theme: defaultChartTheme,
    layout: createLayout()
  };
}

function createRenderContext(
  seriesType: SeriesType,
  priceScaleMode: ViewportState["priceScaleMode"] = "linear",
  series = createSeries()
): LayerRenderContext {
  return {
    context: new FakeCanvasContext() as unknown as CanvasRenderingContext2D,
    state: createState(seriesType, priceScaleMode, series)
  };
}

describe("series renderers", () => {
  it.each(
    supportedSeriesTypes.flatMap((seriesType) =>
      (["linear", "log", "percentage"] as const).map(
        (priceScaleMode) => [seriesType, priceScaleMode] as const
      )
    )
  )("renders %s with a shared %s scale", (seriesType, priceScaleMode) => {
    const registry = createDefaultSeriesRendererRegistry();
    const series: CandleSeries = {
      ...createSeries(),
      candles: createSeries().candles.map((candle, index) => ({
        ...candle,
        open: index + 0.1,
        high: index === 2 ? 100 : index + 1,
        low: index === 0 ? 0.01 : index + 0.05,
        close: index + 0.5
      }))
    };
    const context = createRenderContext(seriesType, priceScaleMode, series);

    createSeriesLayer(registry).render(context);

    const numericArguments = (context.context as unknown as FakeCanvasContext).calls.flatMap(
      (call) => call.args.filter((value): value is number => typeof value === "number")
    );

    expect(numericArguments.length).toBeGreaterThan(0);
    expect(numericArguments.every(Number.isFinite)).toBe(true);
  });

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

  it.each([
    [16, "bullishCandle"],
    [10, "bearishCandle"],
    [13, "text"]
  ] as const)("colors a percentage line from its last visible close (%s)", (close, color) => {
    const series = createSeries();
    series.candles[2] = { ...series.candles[2], close, high: Math.max(16, close), low: Math.min(10, close) };
    const renderContext = createRenderContext("line", "percentage", series);

    createSeriesLayer(createDefaultSeriesRendererRegistry()).render(renderContext);

    expect((renderContext.context as unknown as FakeCanvasContext).strokeStyles).toEqual([
      renderContext.state.theme.colors[color]
    ]);
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

  it("does not hit test synthetic renderers without layout geometry", () => {
    const registry = createDefaultSeriesRendererRegistry();
    const context = createRenderContext("heikinAshi");
    const model = createSourceSeriesRenderModel("heikinAshi", context.state.series);

    expect(registry.require("heikinAshi").hitTest(model, 10, 20)).toBeUndefined();
  });

  it.each(syntheticTypes)("routes transformed %s models into registered renderers", (type) => {
    const registry = createSeriesRendererRegistry();
    let capturedModel: SeriesRenderModel | undefined;
    const renderer: SeriesRenderer = {
      type,
      render(context) {
        capturedModel = context.model;
      },
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

    registry.register(renderer);

    createSeriesLayer(registry).render(createRenderContext(type));

    expect(capturedModel).toBeDefined();

    if (!capturedModel) {
      throw new Error("Expected synthetic model to be captured");
    }

    expect(capturedModel.type).toBe(type);
    expect(capturedModel.points.length).toBeGreaterThan(0);

    if (type === "renko" || type === "pointAndFigure") {
      for (const point of capturedModel.points) {
        expect(point.sourceRange).toBeDefined();
        expect(point.sourceIndex).toBe(point.sourceRange?.to);
      }
    } else {
      expect(capturedModel.points.every((point) => point.sourceIndex !== undefined)).toBe(true);
    }

    if (type === "heikinAshi") {
      expect(capturedModel.points[0]?.close).toBe(11.5);
      expect(capturedModel.points[0]?.close).not.toBe(createSeries().candles[0]?.close);
    }
  });

  it("uses a matching precomputed exact synthetic model", () => {
    const registry = createSeriesRendererRegistry();
    let capturedModel: SeriesRenderModel | undefined;
    const renderer: SeriesRenderer = {
      type: "heikinAshi",
      render(context) {
        capturedModel = context.model;
      },
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
    const context = createRenderContext("heikinAshi");
    const precomputed: SeriesRenderModel = {
      type: "heikinAshi",
      source: {
        ...context.state.series,
        candles: [context.state.series.candles[2]]
      },
      sourceIndexOffset: 2,
      points: [
        {
          time: context.state.series.candles[2].time,
          open: 700,
          high: 900,
          low: 600,
          close: 800,
          sourceIndex: 2
        }
      ]
    };

    registry.register(renderer);
    context.state.seriesModel = precomputed;

    createSeriesLayer(registry).render(context);

    expect(capturedModel).toBe(precomputed);
  });

  it.each(["type", "symbol", "timeframe", "adjustMode", "dataVersion"] as const)(
    "rejects a precomputed synthetic model with mismatched %s",
    (field) => {
      const registry = createSeriesRendererRegistry();
      let capturedModel: SeriesRenderModel | undefined;
      const renderer: SeriesRenderer = {
        type: "heikinAshi",
        render(context) {
          capturedModel = context.model;
        },
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
      const context = createRenderContext("heikinAshi");
      const precomputed: SeriesRenderModel = {
        type: field === "type" ? "renko" : "heikinAshi",
        source: {
          ...context.state.series,
          symbol: field === "symbol" ? "OTHER" : context.state.series.symbol,
          timeframe: field === "timeframe" ? "5m" : context.state.series.timeframe,
          adjustMode: field === "adjustMode" ? "backward" : context.state.series.adjustMode,
          dataVersion: field === "dataVersion" ? "other-version" : context.state.series.dataVersion,
          candles: [context.state.series.candles[2]]
        },
        sourceIndexOffset: 2,
        points: [
          {
            time: context.state.series.candles[2].time,
            close: 800,
            sourceIndex: 2
          }
        ]
      };

      registry.register(renderer);
      context.state.seriesModel = precomputed;

      createSeriesLayer(registry).render(context);

      expect(capturedModel).toBeDefined();
      expect(capturedModel).not.toBe(precomputed);
      expect(capturedModel?.type).toBe("heikinAshi");
      expect(capturedModel?.points).toHaveLength(context.state.series.candles.length);
    }
  );
});
