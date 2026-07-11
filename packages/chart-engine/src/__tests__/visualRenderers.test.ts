import { describe, expect, it } from "vitest";
import {
  createBandVisualRenderer,
  createHistogramVisualRenderer,
  createLineVisualRenderer,
  createMarkerVisualRenderer,
  createVisualLayer,
  createVisualRendererRegistry,
  defaultChartTheme,
  defaultChartTimeFormatter,
  type CandleSeries,
  type ChartLayout,
  type IndicatorVisualOutput,
  type LayerRenderContext,
  type PanelArea,
  type RenderState,
  type VisualAutoscaleRange,
  type ViewportState,
  type VisualRenderer,
  type VisualRendererRegistry
} from "../index";
import { createMainPanelPriceScale } from "../render/mainPriceScale";

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
  const series = override.series ?? createSeries();
  const viewport = override.viewport ?? createViewport();
  const visualOutputs = override.visualOutputs ?? [];

  return {
    series,
    viewport,
    priceScale:
      override.priceScale ??
      createMainPanelPriceScale(
        series,
        viewport.visibleRange,
        viewport.priceScaleMode,
        visualOutputs
      ),
    formatTime: defaultChartTimeFormatter,
    theme: defaultChartTheme,
    layout: createLayout(),
    panels: [createPanel()],
    visualOutputs,
    ...override
  };
}

function createVisualContext(output: IndicatorVisualOutput, state = createState()) {
  return {
    context: new FakeCanvasContext() as unknown as CanvasRenderingContext2D,
    output,
    panel: state.panels?.[0] ?? createPanel(),
    valueScale: state.priceScale,
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
    expect(callsNamed(fakeContext, "fill")).toHaveLength(1);
  });

  it("draws a single visible line point", () => {
    const output: IndicatorVisualOutput = {
      type: "line",
      id: "line",
      label: "Line",
      values: [{ time: 1, value: 10 }]
    };
    const renderContext = createVisualContext(output);
    const fakeContext = renderContext.context as unknown as FakeCanvasContext;

    createLineVisualRenderer().render(renderContext);

    expect(callsNamed(fakeContext, "arc")).toHaveLength(1);
    expect(callsNamed(fakeContext, "fill")).toHaveLength(1);
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
    const formatting = {
      formatTime: (time: number, timeframe: CandleSeries["timeframe"]) =>
        `SH:${time}:${timeframe}`,
      timeframe: "1m" as const
    };

    expect(
      createLineVisualRenderer().getTooltipRows({
        outputId: "line",
        outputType: "line",
        time: 4,
        value: 12.345,
        distance: 0
      }, formatting)
    ).toEqual([
      { label: "Time", value: "SH:4:1m" },
      { label: "Value", value: "12.35" }
    ]);

    expect(
      createMarkerVisualRenderer().getTooltipRows({
        outputId: "marker",
        outputType: "marker",
        time: 5,
        distance: 0
      }, formatting)
    ).toEqual([{ label: "Time", value: "SH:5:1m" }]);
  });

  it.each([
    ["line", createLineVisualRenderer()],
    ["histogram", createHistogramVisualRenderer()],
    ["band", createBandVisualRenderer()],
    ["marker", createMarkerVisualRenderer()]
  ] as const)("returns a hit-test contribution for %s output", (_type, renderer) => {
    const output = createRenderableOutput(renderer.type);
    const renderContext = createVisualContext(output);

    const hit = renderer.hitTest(renderContext, 15, 50);

    expect(hit).toMatchObject({
      outputId: output.id,
      outputType: output.type
    });
    expect(hit?.distance).toBeGreaterThanOrEqual(0);
  });
});

describe("visual layer", () => {
  it("shares one linear value scale across outputs in the same sub panel", () => {
    const valueScales: Parameters<VisualRenderer["render"]>[0]["valueScale"][] = [];
    const registry = createRangeProbeRegistry(
      {
        macd: { min: -5, max: 4 },
        signal: { min: -2, max: 3 }
      },
      (context) => {
        valueScales.push(context.valueScale);
      }
    );
    const visualOutputs: IndicatorVisualOutput[] = [
      { ...createRenderableOutput("histogram"), id: "macd", panelId: "macd" },
      { ...createRenderableOutput("line"), id: "signal", panelId: "macd" }
    ];
    const state = createState({
      visualOutputs,
      panels: [createPanel("main", "main"), createPanel("macd", "sub")]
    });

    createVisualLayer(registry).render(createLayerContext(state));

    expect(valueScales).toHaveLength(2);
    expect(valueScales[0]).toBe(valueScales[1]);
    expect(valueScales[0].mode).toBe("linear");
  });

  it.each(["log", "percentage"] as const)(
    "shares the main %s scale while keeping sub-panel values linear",
    (priceScaleMode) => {
      const captured: Array<{
        outputId: string;
        valueScale: Parameters<VisualRenderer["render"]>[0]["valueScale"];
      }> = [];
      const registry = createRangeProbeRegistry(
        {
          mainLine: { min: 8, max: 20 },
          macd: { min: -5, max: 4 }
        },
        (context) => {
          captured.push({ outputId: context.output.id, valueScale: context.valueScale });
        }
      );
      const viewport = { ...createViewport(), priceScaleMode };
      const visualOutputs: IndicatorVisualOutput[] = [
        { ...createRenderableOutput("line"), id: "mainLine", panelId: "main" },
        { ...createRenderableOutput("histogram"), id: "macd", panelId: "macd" }
      ];
      const state = createState({
        viewport,
        visualOutputs,
        panels: [createPanel("main", "main"), createPanel("macd", "sub")]
      });

      createVisualLayer(registry).render(createLayerContext(state));

      expect(captured[0].valueScale).toBe(state.priceScale);
      expect(captured[1].valueScale).not.toBe(state.priceScale);
      expect(captured[1].valueScale).toMatchObject({ mode: "linear", basePrice: 1 });
      expect(captured[1].valueScale.min).toBeLessThan(-5);
      expect(captured[1].valueScale.max).toBeGreaterThan(4);
    }
  );

  it.each(["linear", "log", "percentage"] as const)(
    "keeps BOLL output inside the main plot on the shared %s scale",
    (priceScaleMode) => {
      const registry = createVisualRendererRegistry();
      registry.register(createBandVisualRenderer());
      const viewport = { ...createViewport(), priceScaleMode };
      const visualOutputs: IndicatorVisualOutput[] = [
        {
          id: "boll",
          label: "BOLL",
          type: "band",
          panelId: "main",
          upper: [
            { time: 1, value: 30 },
            { time: 2, value: 28 }
          ],
          lower: [
            { time: 1, value: 5 },
            { time: 2, value: 6 }
          ]
        }
      ];
      const state = createState({ viewport, visualOutputs });
      const layerContext = createLayerContext(state);

      expect(() => createVisualLayer(registry).render(layerContext)).not.toThrow();

      const coordinates = (layerContext.context as unknown as FakeCanvasContext).calls
        .filter((call) => call.name === "moveTo" || call.name === "lineTo")
        .map((call) => Number(call.args[1]));

      expect(coordinates.length).toBeGreaterThan(0);
      expect(
        coordinates.every(
          (y) =>
            Number.isFinite(y) &&
            y >= state.layout.plotArea.y &&
            y <= state.layout.plotArea.y + state.layout.plotArea.height
        )
      ).toBe(true);
    }
  );

  it("skips non-positive main-panel points on a log scale", () => {
    const registry = createVisualRendererRegistry();
    registry.register(createLineVisualRenderer());
    const viewport = { ...createViewport(), priceScaleMode: "log" as const };
    const visualOutputs: IndicatorVisualOutput[] = [
      {
        id: "main-line",
        label: "Main line",
        type: "line",
        panelId: "main",
        values: [
          { time: 1, value: -1 },
          { time: 2, value: 12 }
        ]
      }
    ];
    const state = createState({ viewport, visualOutputs });
    const layerContext = createLayerContext(state);

    expect(() => createVisualLayer(registry).render(layerContext)).not.toThrow();
    expect(callsNamed(layerContext.context as unknown as FakeCanvasContext, "arc")).toHaveLength(1);
  });

  it.each([
    [
      "histogram",
      {
        id: "main-histogram",
        label: "Main histogram",
        type: "histogram",
        panelId: "main",
        values: [
          { time: 1, value: -1 },
          { time: 2, value: 12 }
        ]
      } satisfies IndicatorVisualOutput,
      "fillRect"
    ],
    [
      "marker",
      {
        id: "main-marker",
        label: "Main marker",
        type: "marker",
        panelId: "main",
        marks: [
          { id: "negative", time: 1, price: -1 },
          { id: "positive", time: 2, price: 12 }
        ]
      } satisfies IndicatorVisualOutput,
      "arc"
    ]
  ] as const)("skips non-positive main-panel %s points on a log scale", (type, output, drawCall) => {
    const registry = createVisualRendererRegistry();
    registry.register(
      type === "histogram" ? createHistogramVisualRenderer() : createMarkerVisualRenderer()
    );
    const viewport = { ...createViewport(), priceScaleMode: "log" as const };
    const state = createState({ viewport, visualOutputs: [output] });
    const layerContext = createLayerContext(state);

    expect(() => createVisualLayer(registry).render(layerContext)).not.toThrow();
    expect(callsNamed(layerContext.context as unknown as FakeCanvasContext, drawCall)).toHaveLength(1);
  });

  it.each(["log", "percentage"] as const)(
    "renders finite MACD geometry when the main scale is %s",
    (priceScaleMode) => {
      const registry = createVisualRendererRegistry();
      registry.register(createHistogramVisualRenderer());
      const viewport = { ...createViewport(), priceScaleMode };
      const visualOutputs: IndicatorVisualOutput[] = [
        {
          id: "macd",
          label: "MACD",
          type: "histogram",
          panelId: "macd",
          values: [
            { time: 1, value: -2 },
            { time: 2, value: 3 }
          ]
        }
      ];
      const state = createState({
        viewport,
        visualOutputs,
        panels: [createPanel("main", "main"), createPanel("macd", "sub")]
      });
      const layerContext = createLayerContext(state);

      expect(() => createVisualLayer(registry).render(layerContext)).not.toThrow();
      expect(
        callsNamed(layerContext.context as unknown as FakeCanvasContext, "fillRect").every((call) =>
          call.args.slice(0, 4).every((value) => Number.isFinite(value))
        )
      ).toBe(true);
    }
  );

  it("routes visual outputs through registry.require and panel ids", () => {
    const received: Array<{ type: IndicatorVisualOutput["type"]; panelId: string }> = [];
    const registry = createProbeRegistry((context) => {
      received.push({ type: context.output.type, panelId: context.panel.id });
    });
    const state = createState({
      panels: [createPanel("sub", "sub"), createPanel("main", "main")],
      visualOutputs: [
        { ...createRenderableOutput("line"), panelId: "main" },
        { ...createRenderableOutput("histogram"), panelId: "sub" }
      ]
    });

    createVisualLayer(registry).render(createLayerContext(state));

    expect(registry.requiredTypes).toEqual(["line", "histogram"]);
    expect(received).toEqual([
      { type: "line", panelId: "main" },
      { type: "histogram", panelId: "sub" }
    ]);
  });

  it("falls back to the main panel when no panel id is set", () => {
    const received: string[] = [];
    const registry = createProbeRegistry((context) => {
      received.push(context.panel.id);
    });
    const state = createState({
      panels: [createPanel("sub", "sub"), createPanel("main", "main")],
      visualOutputs: [createRenderableOutput("marker")]
    });

    createVisualLayer(registry).render(createLayerContext(state));

    expect(received).toEqual(["main"]);
  });

  it("skips hidden outputs and outputs routed to unknown panels", () => {
    const received: string[] = [];
    const registry = createProbeRegistry((context) => {
      received.push(context.output.id);
    });
    const state = createState({
      panels: [createPanel("main", "main")],
      visualOutputs: [
        { ...createRenderableOutput("line"), id: "hidden", visible: false },
        { ...createRenderableOutput("marker"), id: "missing-panel", panelId: "missing" }
      ]
    });

    createVisualLayer(registry).render(createLayerContext(state));

    expect(received).toEqual([]);
    expect(registry.requiredTypes).toEqual([]);
  });

  it("passes shared autoscale ranges per panel to visual renderers", () => {
    const rendered: Array<{
      outputId: string;
      panelId: string;
      valueRange: VisualAutoscaleRange | undefined;
    }> = [];
    const registry = createRangeProbeRegistry(
      {
        mainLine: { min: 10, max: 20 },
        mainBand: { min: -5, max: 30 },
        subHistogram: { min: 100, max: 110 }
      },
      (context) => {
        rendered.push({
          outputId: context.output.id,
          panelId: context.panel.id,
          valueRange: context.valueRange
        });
      }
    );
    const state = createState({
      panels: [createPanel("main", "main"), createPanel("sub", "sub")],
      visualOutputs: [
        { ...createRenderableOutput("line"), id: "mainLine", panelId: "main" },
        { ...createRenderableOutput("band"), id: "mainBand", panelId: "main" },
        { ...createRenderableOutput("histogram"), id: "subHistogram", panelId: "sub" }
      ]
    });

    createVisualLayer(registry).render(createLayerContext(state));

    expect(rendered).toEqual([
      { outputId: "mainLine", panelId: "main", valueRange: { min: -5, max: 30 } },
      { outputId: "mainBand", panelId: "main", valueRange: { min: -5, max: 30 } },
      { outputId: "subHistogram", panelId: "sub", valueRange: { min: 100, max: 110 } }
    ]);
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

function createRangeProbeRegistry(
  rangesByOutputId: Record<string, VisualAutoscaleRange | undefined>,
  render: VisualRenderer["render"]
): VisualRendererRegistry {
  return {
    register() {},
    get(type) {
      return createRangeProbeRenderer(type, rangesByOutputId, render);
    },
    require(type) {
      return createRangeProbeRenderer(type, rangesByOutputId, render);
    },
    list() {
      return [];
    }
  };
}

function createRangeProbeRenderer(
  type: IndicatorVisualOutput["type"],
  rangesByOutputId: Record<string, VisualAutoscaleRange | undefined>,
  render: VisualRenderer["render"]
): VisualRenderer {
  return {
    type,
    render,
    getAutoscale(output) {
      return rangesByOutputId[output.id];
    },
    hitTest() {
      return undefined;
    },
    getTooltipRows() {
      return [];
    }
  };
}
