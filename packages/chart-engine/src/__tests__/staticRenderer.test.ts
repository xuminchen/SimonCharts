import { describe, expect, it } from "vitest";
import {
  createAxisLayer,
  createCandlestickLayer,
  createGridLayer,
  createMovingAverageLayer,
  createStaticLayers,
  createVolumeLayer,
  defaultChartTimeFormatter,
  priceToY,
  renderStaticChart
} from "../index";
import { createMainPanelPriceScale } from "../render/mainPriceScale";
import type {
  CandleSeries,
  ChartLayer,
  ChartLayout,
  IndicatorVisualOutput,
  LayerRenderContext,
  RenderState,
  ViewportState
} from "../index";

interface DrawCall {
  name: string;
  args: unknown[];
}

class FakeCanvasContext {
  calls: DrawCall[] = [];
  fillRectStyles: string[] = [];

  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  font = "";
  textAlign = "start";
  textBaseline = "alphabetic";

  beginPath(): void {
    this.record("beginPath");
  }

  moveTo(x: number, y: number): void {
    this.record("moveTo", x, y);
  }

  lineTo(x: number, y: number): void {
    this.record("lineTo", x, y);
  }

  stroke(): void {
    this.record("stroke");
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.fillRectStyles.push(this.fillStyle);
    this.record("fillRect", x, y, width, height);
  }

  fillText(text: string, x: number, y: number): void {
    this.record("fillText", text, x, y);
  }

  save(): void {
    this.record("save");
  }

  restore(): void {
    this.record("restore");
  }

  setLineDash(dash: number[]): void {
    this.record("setLineDash", [...dash]);
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.record("rect", x, y, width, height);
  }

  clip(): void {
    this.record("clip");
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    this.record("clearRect", x, y, width, height);
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
      { time: 1, open: 10, high: 14, low: 9, close: 13, volume: 100, turnover: 1300 },
      { time: 2, open: 13, high: 15, low: 11, close: 12, volume: 120, turnover: 1440 },
      { time: 3, open: 12, high: 16, low: 10, close: 15, volume: 90, turnover: 1350 },
      { time: 4, open: 15, high: 17, low: 14, close: 16, volume: 150, turnover: 2400 },
      { time: 5, open: 16, high: 18, low: 13, close: 14, volume: 110, turnover: 1540 },
      { time: 6, open: 14, high: 19, low: 12, close: 18, volume: 130, turnover: 2340 }
    ]
  };
}

function createViewport(visibleRange = { from: 1, to: 3 }): ViewportState {
  return {
    visibleRange,
    candleWidth: 10,
    scrollOffset: 0,
    priceScaleMode: "linear"
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

function createState(override: Partial<RenderState> = {}): RenderState {
  const series = override.series ?? createSeries();
  const viewport = override.viewport ?? createViewport();
  const visualOutputs = override.visualOutputs ?? [];
  const movingAverages = override.movingAverages ?? [];

  return {
    series,
    viewport,
    priceScale:
      override.priceScale ??
      createMainPanelPriceScale(
        series,
        viewport.visibleRange,
        viewport.priceScaleMode,
        visualOutputs,
        movingAverages
      ),
    formatTime: defaultChartTimeFormatter,
    theme: {
      colors: {
        background: "#ffffff",
        grid: "#e5e7eb",
        text: "#111827",
        bullishCandle: "#16a34a",
        bearishCandle: "#dc2626",
        volume: "#94a3b8",
        crosshair: "#64748b",
        panelSeparator: "#cbd5e1",
        selectedDrawing: "#2563eb",
        hoveredDrawing: "#0f766e",
        markerDefault: "#f59e0b",
        tooltip: {
          background: "#111827",
          text: "#f9fafb",
          border: "#374151"
        },
        maLines: ["#2563eb", "#d97706"]
      },
      typography: {
        fontFamily: "system-ui",
        fontSize: 12
      },
      spacing: {
        axisPadding: 8,
        panelGap: 16
      },
      lineWidths: {
        grid: 1,
        candleWick: 1,
        crosshair: 1,
        indicator: 2
      },
      lineDashes: {
        grid: []
      }
    },
    layout: createLayout(),
    visualOutputs,
    ...override
  };
}

function createRenderContext(state = createState()): LayerRenderContext {
  return {
    context: new FakeCanvasContext() as unknown as CanvasRenderingContext2D,
    state
  };
}

function callsNamed(context: LayerRenderContext, name: string): DrawCall[] {
  return (context.context as unknown as FakeCanvasContext).calls.filter((call) => call.name === name);
}

describe("static renderer", () => {
  it.each(["linear", "log", "percentage"] as const)(
    "merges visible main-panel visual bounds into the %s price scale",
    (priceScaleMode) => {
      const series = createSeries();
      const visibleRange = { from: 1, to: 3 };
      const visualOutputs: IndicatorVisualOutput[] = [
        {
          id: "boll",
          label: "BOLL",
          type: "band",
          panelId: "main",
          upper: [
            { time: 2, value: 30 },
            { time: 6, value: 300 }
          ],
          lower: [
            { time: 2, value: 5 },
            { time: 6, value: 0.5 }
          ]
        },
        {
          id: "macd",
          label: "MACD",
          type: "histogram",
          panelId: "macd",
          values: [{ time: 2, value: -500 }]
        }
      ];

      const scale = createMainPanelPriceScale(
        series,
        visibleRange,
        priceScaleMode,
        visualOutputs,
        []
      );

      expect(priceToY(30, scale, 0, 80)).toBeGreaterThanOrEqual(0);
      expect(priceToY(30, scale, 0, 80)).toBeLessThanOrEqual(80);
      expect(priceToY(5, scale, 0, 80)).toBeGreaterThanOrEqual(0);
      expect(priceToY(5, scale, 0, 80)).toBeLessThanOrEqual(80);
      expect(priceToY(300, scale, 0, 80)).toBeLessThan(0);
    }
  );

  it("ignores non-positive main-panel visual values in log mode", () => {
    const series = createSeries();
    const visualOutputs: IndicatorVisualOutput[] = [
      {
        id: "ma",
        label: "MA",
        type: "line",
        panelId: "main",
        values: [
          { time: 2, value: -1 },
          { time: 3, value: 20 }
        ]
      }
    ];

    expect(() =>
      createMainPanelPriceScale(series, { from: 1, to: 3 }, "log", visualOutputs, [])
    ).not.toThrow();
  });

  it.each(
    (["linear", "log", "percentage"] as const).flatMap((priceScaleMode) => [
      [priceScaleMode, Number.NaN] as const,
      [priceScaleMode, Number.POSITIVE_INFINITY] as const
    ])
  )(
    "resolves marker time on the shared %s scale when index is %s",
    (priceScaleMode, invalidIndex) => {
      const series: CandleSeries = {
        ...createSeries(),
        candles: [
          { time: 1, open: 50, high: 51, low: 49, close: 50, volume: 1, turnover: 50 },
          { time: 2, open: 10, high: 11, low: 9, close: 10, volume: 1, turnover: 10 },
          { time: 3, open: 50, high: 51, low: 49, close: 50, volume: 1, turnover: 50 }
        ]
      };
      const visibleRange = { from: 1, to: 1 };
      const baselineScale = createMainPanelPriceScale(
        series,
        visibleRange,
        priceScaleMode,
        [],
        []
      );
      const offscreenScale = createMainPanelPriceScale(
        series,
        visibleRange,
        priceScaleMode,
        [
          {
            id: "offscreen-marker",
            label: "Offscreen marker",
            type: "marker",
            panelId: "main",
            marks: [{ id: "offscreen", time: 1, index: invalidIndex, price: 1_000 }]
          }
        ],
        []
      );
      const visibleScale = createMainPanelPriceScale(
        series,
        visibleRange,
        priceScaleMode,
        [
          {
            id: "visible-marker",
            label: "Visible marker",
            type: "marker",
            panelId: "main",
            marks: [{ id: "visible", time: 2, index: invalidIndex, price: 1_000 }]
          }
        ],
        []
      );
      const visibleMarkerY = priceToY(1_000, visibleScale, 0, 80);

      expect(offscreenScale).toEqual(baselineScale);
      expect(visibleMarkerY).toBeGreaterThanOrEqual(0);
      expect(visibleMarkerY).toBeLessThanOrEqual(80);
    }
  );

  it("uses the shared percentage scale and host formatter for axis labels", () => {
    const series = { ...createSeries(), timeframe: "1m" as const };
    const viewport = { ...createViewport(), priceScaleMode: "percentage" as const };
    const renderContext = createRenderContext(
      createState({
        series,
        viewport,
        layout: {
          ...createLayout(),
          width: 380,
          leftAxisWidth: 40,
          leftPriceAxisArea: { x: 0, y: 0, width: 40, height: 80 },
          plotArea: { x: 40, y: 0, width: 300, height: 80 },
          priceAxisArea: { x: 340, y: 0, width: 40, height: 80 },
          volumeArea: { x: 40, y: 80, width: 300, height: 0 },
          timeAxisArea: { x: 40, y: 80, width: 300, height: 20 }
        },
        formatTime: (time, timeframe) => `SH:${time}:${timeframe}`
      })
    );

    createAxisLayer().render(renderContext);

    const labels = callsNamed(renderContext, "fillText").map((call) => call.args[0]);
    const priceAxisLabels = callsNamed(renderContext, "fillText").filter((call) => {
      const x = Number(call.args[1]);
      return x === 8 || x === 348;
    });

    expect(labels.some((label) => String(label).endsWith("%"))).toBe(true);
    expect(labels.some((label) => !String(label).endsWith("%") && /^\d+(\.\d+)?$/.test(String(label)))).toBe(true);
    expect(labels).toContain("SH:4:1m");
    expect(priceAxisLabels.every((call) => Number(call.args[2]) >= 6)).toBe(true);
    expect(priceAxisLabels.every((call) => Number(call.args[2]) <= 74)).toBe(true);
  });

  it("colors the current-price line from the previous close, not the current open", () => {
    const series = createSeries();
    series.candles[5] = {
      ...series.candles[5],
      open: 20,
      high: 21,
      close: 17
    };
    const viewport = createViewport({ from: 3, to: 5 });
    const renderContext = createRenderContext(createState({ series, viewport }));

    createAxisLayer().render(renderContext);

    expect((renderContext.context as unknown as FakeCanvasContext).fillRectStyles).toEqual([
      "#16a34a"
    ]);
    expect(callsNamed(renderContext, "setLineDash")).toEqual([
      { name: "setLineDash", args: [[4, 4]] },
      { name: "setLineDash", args: [[]] }
    ]);
  });

  it.each([
    [1, /^09:\d{2}$/],
    [2, /^07-(16|17)$/]
  ] as const)("compacts and deconflicts %s-day intraday time labels", (intradayDays, pattern) => {
    const series: CandleSeries = {
      ...createSeries(),
      timeframe: "1m",
      candles: Array.from({ length: 12 }, (_, index) => ({
        time: index,
        open: 10,
        high: 11,
        low: 9,
        close: 10,
        volume: 1,
        turnover: 10
      }))
    };
    const viewport = createViewport({ from: 0, to: 11 });
    const renderContext = createRenderContext(createState({
      series,
      viewport,
      intradayDays,
      layout: {
        ...createLayout(),
        width: 300,
        plotArea: { x: 0, y: 0, width: 260, height: 56 },
        priceAxisArea: { x: 260, y: 0, width: 40, height: 56 },
        volumeArea: { x: 0, y: 64, width: 260, height: 16 },
        timeAxisArea: { x: 0, y: 80, width: 260, height: 20 }
      },
      formatTime: (time) => `2026-07-${time < 6 ? "16" : "17"} 09:${String(30 + time).padStart(2, "0")}`
    }));

    createAxisLayer().render(renderContext);

    const labels = callsNamed(renderContext, "fillText")
      .filter((call) => call.args[2] === 88)
      .map((call) => ({ label: String(call.args[0]), x: Number(call.args[1]) }));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every(({ label }) => pattern.test(label))).toBe(true);
    for (let index = 1; index < labels.length; index += 1) {
      const previous = labels[index - 1];
      const current = labels[index];
      expect(current.x - current.label.length * 3.6)
        .toBeGreaterThanOrEqual(previous.x + previous.label.length * 3.6 + 8);
    }
  });

  it("uses real intraday day slots for boundary grid lines and date labels", () => {
    const firstDay = Date.UTC(2026, 6, 16, 1, 30);
    const secondDay = Date.UTC(2026, 6, 17, 1, 30);
    const series: CandleSeries = {
      ...createSeries(),
      timeframe: "1m",
      candles: [
        { time: firstDay, open: 10, high: 11, low: 9, close: 10, volume: 1, turnover: 10 },
        { time: firstDay + 330 * 60_000, open: 10, high: 11, low: 9, close: 10, volume: 1, turnover: 10 },
        { time: secondDay, open: 10, high: 11, low: 9, close: 10, volume: 1, turnover: 10 },
        { time: secondDay + 330 * 60_000, open: 10, high: 11, low: 9, close: 10, volume: 1, turnover: 10 }
      ]
    };
    const viewport = createViewport({ from: 0, to: 3 });
    const renderContext = createRenderContext(createState({
      series,
      viewport,
      intradayDays: 2,
      layout: {
        ...createLayout(),
        width: 300,
        plotArea: { x: 0, y: 0, width: 260, height: 56 },
        priceAxisArea: { x: 260, y: 0, width: 40, height: 56 },
        volumeArea: { x: 0, y: 64, width: 260, height: 16 },
        timeAxisArea: { x: 0, y: 80, width: 260, height: 20 }
      },
      timeCoordinates: {
        positions: [0, 130, 130, 260],
        barWidth: 1,
        dayStartIndices: [0, 2],
        dayStartOffsets: [0, 130]
      },
      formatTime: (time) => time < secondDay ? "2026-07-16 09:30" : "2026-07-17 09:30"
    }));

    createGridLayer().render(renderContext);
    createAxisLayer().render(renderContext);

    const boundaryMoves = callsNamed(renderContext, "moveTo")
      .filter((call) => call.args[0] === 130 && call.args[1] === 0);
    const boundaryLines = callsNamed(renderContext, "lineTo")
      .filter((call) => call.args[0] === 130 && call.args[1] === 56);
    const dateLabels = callsNamed(renderContext, "fillText")
      .filter((call) => call.args[2] === 88)
      .map((call) => [call.args[0], call.args[1]]);

    expect(boundaryMoves).toHaveLength(1);
    expect(boundaryLines).toHaveLength(1);
    expect(dateLabels).toEqual([["07-16", 18], ["07-17", 130]]);
  });

  it.each(["linear", "log", "percentage"] as const)(
    "renders the static chart with the shared %s scale",
    (priceScaleMode) => {
      const viewport = { ...createViewport(), priceScaleMode };
      const renderContext = createRenderContext(createState({ viewport }));

      expect(() => renderStaticChart(renderContext)).not.toThrow();
      expect(callsNamed(renderContext, "fillText").length).toBeGreaterThan(0);
    }
  );

  it("creates static layers in deterministic render order", () => {
    expect(createStaticLayers().map((layer) => layer.id)).toEqual([
      "grid",
      "axis",
      "series",
      "volume",
      "movingAverage"
    ]);
  });

  it("isolates the configured grid dash from later layers", () => {
    const renderContext = createRenderContext();

    renderContext.state.theme.lineDashes.grid = [1, 3];
    createGridLayer().render(renderContext);

    expect(callsNamed(renderContext, "save")).toHaveLength(1);
    expect(callsNamed(renderContext, "setLineDash")).toEqual([
      { name: "setLineDash", args: [[1, 3]] }
    ]);
    expect(callsNamed(renderContext, "restore")).toHaveLength(1);
  });

  it("renders layers in order with the same neutral render state", () => {
    const state = createState();
    const order: string[] = [];
    const receivedStates: RenderState[] = [];
    const layers: ChartLayer[] = ["grid", "axis", "candlestick", "volume", "movingAverage"].map(
      (id) => ({
        id,
        render(context) {
          order.push(id);
          receivedStates.push(context.state);
        }
      })
    );

    renderStaticChart(createRenderContext(state), layers);

    expect(order).toEqual(["grid", "axis", "candlestick", "volume", "movingAverage"]);
    expect(receivedStates).toEqual([state, state, state, state, state]);
  });

  it("does not clear the static surface unless requested", () => {
    const renderContext = createRenderContext();
    const layers: ChartLayer[] = [
      {
        id: "probe",
        render({ context }) {
          context.fillRect(1, 2, 3, 4);
        }
      }
    ];

    renderStaticChart(renderContext, layers);

    expect((renderContext.context as unknown as FakeCanvasContext).calls).toEqual([
      { name: "fillRect", args: [1, 2, 3, 4] }
    ]);
  });

  it("clears and paints the chart background when requested", () => {
    const renderContext = createRenderContext();
    const layers: ChartLayer[] = [
      {
        id: "probe",
        render({ context }) {
          context.fillRect(1, 2, 3, 4);
        }
      }
    ];

    renderStaticChart(renderContext, layers, { clear: true, paintBackground: true });

    expect((renderContext.context as unknown as FakeCanvasContext).calls).toEqual([
      { name: "clearRect", args: [0, 0, 140, 100] },
      { name: "fillRect", args: [0, 0, 140, 100] },
      { name: "fillRect", args: [1, 2, 3, 4] }
    ]);
  });

  it("draws one candlestick body and one wick per visible candle", () => {
    const renderContext = createRenderContext();

    createCandlestickLayer().render(renderContext);

    expect(callsNamed(renderContext, "fillRect")).toHaveLength(3);
    expect(callsNamed(renderContext, "lineTo")).toHaveLength(3);
    expect(callsNamed(renderContext, "stroke")).toHaveLength(3);
  });

  it("draws one volume bar per visible candle using its price direction color", () => {
    const renderContext = createRenderContext();

    createVolumeLayer().render(renderContext);

    expect(callsNamed(renderContext, "fillRect")).toHaveLength(3);
    expect((renderContext.context as unknown as FakeCanvasContext).fillRectStyles).toEqual([
      "#dc2626",
      "#16a34a",
      "#16a34a"
    ]);
    for (const call of callsNamed(renderContext, "fillRect")) {
      const y = Number(call.args[1]);
      const height = Number(call.args[3]);
      expect(y).toBeGreaterThanOrEqual(renderContext.state.layout.volumeArea.y);
      expect(y + height).toBeLessThanOrEqual(
        renderContext.state.layout.volumeArea.y + renderContext.state.layout.volumeArea.height
      );
    }
  });

  it("aligns volume bars to the shared intraday day-slot coordinates", () => {
    const series = createSeries();
    series.candles = series.candles.slice(0, 4);
    const renderContext = createRenderContext(createState({
      series,
      viewport: createViewport({ from: 0, to: 3 }),
      timeCoordinates: {
        positions: [0, 50, 50, 100],
        barWidth: 1,
        dayStartIndices: [0, 2],
        dayStartOffsets: [0, 50]
      }
    }));

    createVolumeLayer().render(renderContext);

    expect(callsNamed(renderContext, "fillRect").map((call) => call.args[0])).toEqual([
      0,
      49.5,
      49.5,
      99.5
    ]);
  });

  it("skips undefined moving average values and draws continuous defined segments", () => {
    const renderContext = createRenderContext(
      createState({
        viewport: createViewport({ from: 0, to: 5 }),
        movingAverages: [
          [
            { time: 1, value: undefined },
            { time: 2, value: 11 },
            { time: 3, value: 12 },
            { time: 4, value: undefined },
            { time: 5, value: 14 },
            { time: 6, value: 15 }
          ]
        ]
      })
    );

    createMovingAverageLayer().render(renderContext);

    const pathCalls = (renderContext.context as unknown as FakeCanvasContext).calls
      .filter((call) => call.name === "moveTo" || call.name === "lineTo")
      .map((call) => ({ name: call.name, x: call.args[0] }));

    expect(pathCalls).toEqual([
      { name: "moveTo", x: 15 },
      { name: "lineTo", x: 25 },
      { name: "moveTo", x: 45 },
      { name: "lineTo", x: 55 }
    ]);
    expect(callsNamed(renderContext, "stroke")).toHaveLength(2);
  });

  it("skips non-positive moving-average points on a log scale", () => {
    const viewport = {
      ...createViewport({ from: 0, to: 2 }),
      priceScaleMode: "log" as const
    };
    const renderContext = createRenderContext(
      createState({
        viewport,
        movingAverages: [
          [
            { time: 1, value: -1 },
            { time: 2, value: 12 },
            { time: 3, value: 13 }
          ]
        ]
      })
    );

    expect(() => createMovingAverageLayer().render(renderContext)).not.toThrow();
    expect(callsNamed(renderContext, "lineTo")).toHaveLength(1);
  });

  it.each(["linear", "log", "percentage"] as const)(
    "breaks the %s moving-average path at non-finite values",
    (priceScaleMode) => {
      const series: CandleSeries = {
        ...createSeries(),
        candles: Array.from({ length: 8 }, (_, index) => ({
          time: index + 1,
          open: 12,
          high: 16,
          low: 9,
          close: 12,
          volume: 1,
          turnover: 12
        }))
      };
      const viewport = {
        ...createViewport({ from: 0, to: 7 }),
        priceScaleMode
      };
      const movingAverages = [
        [
          { time: 1, value: 10 },
          { time: 2, value: 11 },
          { time: 3, value: Number.NaN },
          { time: 4, value: 12 },
          { time: 5, value: 13 },
          { time: 6, value: Number.POSITIVE_INFINITY },
          { time: 7, value: 14 },
          { time: 8, value: 15 }
        ]
      ];
      const renderContext = createRenderContext(
        createState({ series, viewport, movingAverages })
      );

      createMovingAverageLayer().render(renderContext);

      const calls = (renderContext.context as unknown as FakeCanvasContext).calls;
      const numericArguments = calls.flatMap((call) =>
        call.args.filter((value): value is number => typeof value === "number")
      );
      const pathCallNames = calls
        .filter((call) => call.name === "moveTo" || call.name === "lineTo")
        .map((call) => call.name);

      expect(numericArguments.every(Number.isFinite)).toBe(true);
      expect(pathCallNames).toEqual([
        "moveTo",
        "lineTo",
        "moveTo",
        "lineTo",
        "moveTo",
        "lineTo"
      ]);
    }
  );

  it.each(["linear", "log", "percentage"] as const)(
    "includes cross-boundary moving-average extrema in the shared %s scale",
    (priceScaleMode) => {
      const series: CandleSeries = {
        ...createSeries(),
        candles: [
          { time: 1, open: 100, high: 100, low: 100, close: 100, volume: 1, turnover: 100 },
          { time: 2, open: 10, high: 10, low: 10, close: 10, volume: 1, turnover: 10 },
          { time: 3, open: 10, high: 10, low: 10, close: 10, volume: 1, turnover: 10 }
        ]
      };
      const viewport = {
        ...createViewport({ from: 1, to: 2 }),
        priceScaleMode
      };
      const movingAverages = [
        [
          { time: 1, value: undefined },
          { time: 2, value: 55 },
          { time: 3, value: 10 }
        ]
      ];
      const priceScale = createMainPanelPriceScale(
        series,
        viewport.visibleRange,
        priceScaleMode,
        [],
        movingAverages
      );
      const renderContext = createRenderContext(
        createState({ series, viewport, priceScale, movingAverages })
      );

      createMovingAverageLayer().render(renderContext);

      const yCoordinates = (renderContext.context as unknown as FakeCanvasContext).calls
        .filter((call) => call.name === "moveTo" || call.name === "lineTo")
        .map((call) => Number(call.args[1]));
      const { plotArea } = renderContext.state.layout;

      expect(yCoordinates[0]).toBeCloseTo(
        priceToY(55, priceScale, plotArea.y, plotArea.height)
      );
      expect(yCoordinates).toHaveLength(2);
      expect(
        yCoordinates.every(
          (y) => Number.isFinite(y) && y >= plotArea.y && y <= plotArea.y + plotArea.height
        )
      ).toBe(true);
    }
  );
});
