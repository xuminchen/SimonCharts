import { describe, expect, it } from "vitest";
import {
  createCandlestickLayer,
  createMovingAverageLayer,
  createStaticLayers,
  createVolumeLayer,
  renderStaticChart
} from "../index";
import type {
  CandleSeries,
  ChartLayer,
  ChartLayout,
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
    rightAxisWidth: 40,
    bottomAxisHeight: 20,
    plotArea: { x: 0, y: 0, width: 100, height: 80 },
    priceAxisArea: { x: 100, y: 0, width: 40, height: 80 },
    timeAxisArea: { x: 0, y: 80, width: 100, height: 20 }
  };
}

function createState(override: Partial<RenderState> = {}): RenderState {
  return {
    series: createSeries(),
    viewport: createViewport(),
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
      }
    },
    layout: createLayout(),
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
  it("creates static layers in deterministic render order", () => {
    expect(createStaticLayers().map((layer) => layer.id)).toEqual([
      "grid",
      "axis",
      "series",
      "volume",
      "movingAverage"
    ]);
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

  it("draws one volume bar per visible candle", () => {
    const renderContext = createRenderContext();

    createVolumeLayer().render(renderContext);

    expect(callsNamed(renderContext, "fillRect")).toHaveLength(3);
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
});
