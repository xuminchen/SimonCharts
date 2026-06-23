import { describe, expect, it } from "vitest";
import {
  createBandVisualRenderer,
  createHistogramVisualRenderer,
  createLineVisualRenderer,
  createMarkerVisualRenderer,
  createVisualLayer,
  defaultChartTheme,
  type CandleSeries,
  type ChartLayout,
  type IndicatorVisualOutput,
  type LayerRenderContext,
  type PanelArea,
  type RenderState,
  type ViewportState,
  type VisualRenderer,
  type VisualRendererRegistry
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

  clip(): void {
    this.record("clip");
  }

  fill(): void {
    this.record("fill", this.fillStyle, this.globalAlpha);
  }

  stroke(): void {
    this.record("stroke", this.strokeStyle, this.lineWidth);
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.record("fillRect", x, y, width, height, this.fillStyle);
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

  private record(name: string, ...args: unknown[]): void {
    this.calls.push({ name, args });
  }
}

function createSeries(): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: [
      { time: 1, open: 10, high: 12, low: 8, close: 11, volume: 100, turnover: 1100 },
      { time: 2, open: 11, high: 13, low: 9, close: 12, volume: 120, turnover: 1440 },
      { time: 3, open: 12, high: 14, low: 10, close: 13, volume: 90, turnover: 1170 },
      { time: 4, open: 13, high: 15, low: 11, close: 14, volume: 150, turnover: 2100 },
      { time: 5, open: 14, high: 16, low: 12, close: 15, volume: 130, turnover: 1950 }
    ]
  };
}

function createViewport(): ViewportState {
  return {
    visibleRange: { from: 0, to: 4 },
    candleWidth: 10,
    scrollOffset: 0,
    priceScaleMode: "linear"
  };
}

function createLayout(): ChartLayout {
  return {
    width: 160,
    height: 120,
    rightAxisWidth: 40,
    bottomAxisHeight: 20,
    plotArea: { x: 10, y: 5, width: 110, height: 90 },
    priceAxisArea: { x: 120, y: 5, width: 40, height: 90 },
    timeAxisArea: { x: 10, y: 95, width: 110, height: 20 }
  };
}

function createPanel(id = "main", kind: PanelArea["kind"] = "main"): PanelArea {
  return {
    id,
    kind,
    label: kind === "main" ? "Price" : "Indicator",
    plotArea: { x: 10, y: 5, width: 110, height: 90 },
    priceAxisArea: { x: 120, y: 5, width: 40, height: 90 }
  };
}

function createState(override: Partial<RenderState> = {}): RenderState {
  return {
    series: createSeries(),
    viewport: createViewport(),
    theme: defaultChartTheme,
    layout: createLayout(),
    panels: [createPanel()],
    ...override
  };
}

function createVisualContext(output: IndicatorVisualOutput, state = createState()) {
  return {
    context: new FakeCanvasContext() as unknown as CanvasRenderingContext2D,
    output,
    panel: state.panels?.[0] ?? createPanel(),
    state
  };
}

function createLayerContext(state = createState()): LayerRenderContext {
  return {
    context: new FakeCanvasContext() as unknown as CanvasRenderingContext2D,
    state
  };
}

function callsNamed(context: FakeCanvasContext, name: string): DrawCall[] {
  return context.calls.filter((call) => call.name === name);
}

function createRenderableOutput(type: IndicatorVisualOutput["type"]): IndicatorVisualOutput {
  if (type === "line") {
    return {
      type,
      id: "line",
      label: "Line",
      values: [
        { time: 1, value: 10 },
        { time: 2, value: 11 },
        { time: 3, value: 12 }
      ],
      color: "#123456",
      lineWidth: 5
    };
  }

  if (type === "histogram") {
    return {
      type,
      id: "histogram",
      label: "Histogram",
      values: [
        { time: 1, value: 3, color: "#abcdef" },
        { time: 2, value: -2 }
      ]
    };
  }

  if (type === "band") {
    return {
      type,
      id: "band",
      label: "Band",
      upper: [
        { time: 1, value: 13 },
        { time: 2, value: 14 }
      ],
      lower: [
        { time: 1, value: 9 },
        { time: 2, value: 10 }
      ],
      fill: "#fedcba"
    };
  }

  return {
    type,
    id: "marker",
    label: "Marker",
    marks: [{ id: "m1", time: 1, price: 10, color: "#ff00ff", metadata: { ignored: true } }]
  };
}

describe("visual renderers", () => {
  it.each([
    ["line", createLineVisualRenderer(), "stroke"],
    ["histogram", createHistogramVisualRenderer(), "fillRect"],
    ["band", createBandVisualRenderer(), "fill"],
    ["marker", createMarkerVisualRenderer(), "arc"]
  ] as const)("renders %s output inside a clipped panel plot", (_type, renderer, drawCall) => {
    const renderContext = createVisualContext(createRenderableOutput(renderer.type));
    const fakeContext = renderContext.context as unknown as FakeCanvasContext;

    renderer.render(renderContext);

    expect(callsNamed(fakeContext, "save")).toHaveLength(1);
    expect(callsNamed(fakeContext, "rect")[0].args).toEqual([10, 5, 110, 90]);
    expect(callsNamed(fakeContext, "clip")).toHaveLength(1);
    expect(callsNamed(fakeContext, drawCall).length).toBeGreaterThan(0);
    expect(callsNamed(fakeContext, "restore")).toHaveLength(1);
  });

  it("restores caller canvas styles after rendering", () => {
    const renderContext = createVisualContext(createRenderableOutput("band"));
    const fakeContext = renderContext.context as unknown as FakeCanvasContext;

    fakeContext.fillStyle = "original-fill";
    fakeContext.strokeStyle = "original-stroke";
    fakeContext.lineWidth = 9;
    fakeContext.globalAlpha = 0.5;

    createBandVisualRenderer().render(renderContext);

    expect(fakeContext.fillStyle).toBe("original-fill");
    expect(fakeContext.strokeStyle).toBe("original-stroke");
    expect(fakeContext.lineWidth).toBe(9);
    expect(fakeContext.globalAlpha).toBe(0.5);
  });

  it("uses output style overrides and neutral theme defaults", () => {
    const lineContext = createVisualContext(createRenderableOutput("line"));
    const histogramContext = createVisualContext(createRenderableOutput("histogram"));
    const markerContext = createVisualContext(createRenderableOutput("marker"));

    createLineVisualRenderer().render(lineContext);
    createHistogramVisualRenderer().render(histogramContext);
    createMarkerVisualRenderer().render(markerContext);

    const lineStroke = callsNamed(lineContext.context as unknown as FakeCanvasContext, "stroke")[0];
    const histogramRects = callsNamed(
      histogramContext.context as unknown as FakeCanvasContext,
      "fillRect"
    );
    const markerFill = callsNamed(markerContext.context as unknown as FakeCanvasContext, "fill")[0];

    expect(lineStroke.args).toEqual(["#123456", 5]);
    expect(histogramRects[0].args[4]).toBe("#abcdef");
    expect(histogramRects[1].args[4]).toBe(defaultChartTheme.colors.volume);
    expect(markerFill.args[0]).toBe("#ff00ff");
  });

  it("breaks line paths at null values instead of connecting across gaps", () => {
    const output: IndicatorVisualOutput = {
      type: "line",
      id: "line",
      label: "Line",
      values: [
        { time: 1, value: 10 },
        { time: 2, value: null },
        { time: 3, value: 12 },
        { time: 4, value: 13 }
      ]
    };
    const renderContext = createVisualContext(output);
    const fakeContext = renderContext.context as unknown as FakeCanvasContext;

    createLineVisualRenderer().render(renderContext);

    expect(callsNamed(fakeContext, "moveTo")).toHaveLength(2);
    expect(callsNamed(fakeContext, "lineTo")).toHaveLength(1);
  });

  it("breaks band fills at null values instead of connecting across gaps", () => {
    const output: IndicatorVisualOutput = {
      type: "band",
      id: "band",
      label: "Band",
      upper: [
        { time: 1, value: 13 },
        { time: 2, value: 14 },
        { time: 3, value: null },
        { time: 4, value: 16 },
        { time: 5, value: 17 }
      ],
      lower: [
        { time: 1, value: 9 },
        { time: 2, value: 10 },
        { time: 3, value: 11 },
        { time: 4, value: 12 },
        { time: 5, value: 13 }
      ]
    };
    const renderContext = createVisualContext(output);
    const fakeContext = renderContext.context as unknown as FakeCanvasContext;

    createBandVisualRenderer().render(renderContext);

    expect(callsNamed(fakeContext, "fill")).toHaveLength(2);
  });

  it("returns autoscale ranges from finite values only", () => {
    expect(
      createLineVisualRenderer().getAutoscale({
        type: "line",
        id: "line",
        label: "Line",
        values: [
          { time: 1, value: null },
          { time: 2, value: Number.NaN },
          { time: 3, value: 4 },
          { time: 4, value: -2 }
        ]
      })
    ).toEqual({ min: -2, max: 4 });

    expect(
      createHistogramVisualRenderer().getAutoscale({
        type: "histogram",
        id: "histogram",
        label: "Histogram",
        values: [
          { time: 1, value: Number.POSITIVE_INFINITY },
          { time: 2, value: 5 },
          { time: 3, value: -3 }
        ]
      })
    ).toEqual({ min: -3, max: 5 });

    expect(
      createBandVisualRenderer().getAutoscale({
        type: "band",
        id: "band",
        label: "Band",
        upper: [
          { time: 1, value: null },
          { time: 2, value: 10 }
        ],
        lower: [
          { time: 1, value: -5 },
          { time: 2, value: Number.NaN }
        ]
      })
    ).toEqual({ min: -5, max: 10 });

    expect(
      createMarkerVisualRenderer().getAutoscale({
        type: "marker",
        id: "marker",
        label: "Marker",
        marks: [
          { id: "missing", time: 1 },
          { id: "low", time: 2, price: 8 },
          { id: "high", time: 3, price: 12 }
        ]
      })
    ).toEqual({ min: 8, max: 12 });
  });

  it("returns undefined autoscale ranges when no finite values exist", () => {
    expect(
      createLineVisualRenderer().getAutoscale({
        type: "line",
        id: "line",
        label: "Line",
        values: [
          { time: 1, value: null },
          { time: 2, value: Number.NaN }
        ]
      })
    ).toBeUndefined();
  });

  it("returns neutral tooltip rows from hit results", () => {
    expect(
      createLineVisualRenderer().getTooltipRows({
        outputId: "line",
        outputType: "line",
        time: 4,
        value: 12.345,
        distance: 0
      })
    ).toEqual([
      { label: "Time", value: "4" },
      { label: "Value", value: "12.35" }
    ]);

    expect(
      createMarkerVisualRenderer().getTooltipRows({
        outputId: "marker",
        outputType: "marker",
        time: 5,
        distance: 0
      })
    ).toEqual([{ label: "Time", value: "5" }]);
  });
});

describe("visual layer", () => {
  it("routes visual outputs through registry.require and renders on the main panel", () => {
    const received: Array<{ type: IndicatorVisualOutput["type"]; panelId: string }> = [];
    const registry = createProbeRegistry((context) => {
      received.push({ type: context.output.type, panelId: context.panel.id });
    });
    const state = createState({
      panels: [createPanel("sub", "sub"), createPanel("main", "main")],
      visualOutputs: [createRenderableOutput("line"), createRenderableOutput("histogram")]
    });

    createVisualLayer(registry).render(createLayerContext(state));

    expect(registry.requiredTypes).toEqual(["line", "histogram"]);
    expect(received).toEqual([
      { type: "line", panelId: "main" },
      { type: "histogram", panelId: "main" }
    ]);
  });

  it("falls back to the first panel when no main panel is present", () => {
    const received: string[] = [];
    const registry = createProbeRegistry((context) => {
      received.push(context.panel.id);
    });
    const state = createState({
      panels: [createPanel("sub", "sub")],
      visualOutputs: [createRenderableOutput("marker")]
    });

    createVisualLayer(registry).render(createLayerContext(state));

    expect(received).toEqual(["sub"]);
  });
});

function createProbeRegistry(render: VisualRenderer["render"]): VisualRendererRegistry & {
  requiredTypes: IndicatorVisualOutput["type"][];
} {
  const requiredTypes: IndicatorVisualOutput["type"][] = [];
  const renderer: VisualRenderer = {
    type: "line",
    render,
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

  return {
    requiredTypes,
    register() {},
    get() {
      return renderer;
    },
    require(type) {
      requiredTypes.push(type);
      return renderer;
    },
    list() {
      return [renderer];
    }
  };
}
