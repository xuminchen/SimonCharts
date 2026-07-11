import { describe, expect, it } from "vitest";
import {
  createCrosshairLayer,
  createOverlayLayers,
  createTooltipLayer,
  defaultChartTimeFormatter,
  priceToY,
  renderOverlay
} from "../index";
import { createMainPanelPriceScale } from "../render/mainPriceScale";
import type {
  CandleSeries,
  ChartCrosshairState,
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
    this.record("stroke", this.strokeStyle, this.lineWidth);
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.record("fillRect", x, y, width, height, this.fillStyle);
  }

  strokeRect(x: number, y: number, width: number, height: number): void {
    this.record("strokeRect", x, y, width, height, this.strokeStyle);
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    this.record("clearRect", x, y, width, height);
  }

  fillText(text: string, x: number, y: number): void {
    this.record("fillText", text, x, y, this.fillStyle);
  }

  measureText(text: string): TextMetrics {
    return { width: text.length * 7 } as TextMetrics;
  }

  save(): void {
    this.record("save");
  }

  restore(): void {
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
      { time: 1, open: 10, high: 14, low: 9, close: 13, volume: 100, turnover: 1300 },
      { time: 2, open: 13, high: 15, low: 11, close: 12, volume: 120, turnover: 1440 },
      { time: 3, open: 12, high: 16, low: 10, close: 15, volume: 90, turnover: 1350 },
      { time: 4, open: 15, high: 17, low: 14, close: 16, volume: 150, turnover: 2400 }
    ]
  };
}

function createViewport(): ViewportState {
  return {
    visibleRange: { from: 1, to: 3 },
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

function createCrosshair(override: Partial<ChartCrosshairState> = {}): ChartCrosshairState {
  return {
    index: 2,
    time: 3,
    price: 13.5,
    open: 12,
    high: 16,
    low: 10,
    close: 15,
    volume: 90,
    turnover: 1350,
    ...override
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

describe("overlay layers", () => {
  it("creates overlay layers in crosshair then tooltip order", () => {
    expect(createOverlayLayers().map((layer) => layer.id)).toEqual(["crosshair", "tooltip"]);
  });

  it("renders overlay layers in order with the same neutral render state", () => {
    const state = createState();
    const order: string[] = [];
    const receivedStates: RenderState[] = [];
    const layers: ChartLayer[] = ["crosshair", "tooltip"].map((id) => ({
      id,
      render(context) {
        order.push(id);
        receivedStates.push(context.state);
      }
    }));

    renderOverlay(createRenderContext(state), layers);

    expect(order).toEqual(["crosshair", "tooltip"]);
    expect(receivedStates).toEqual([state, state]);
  });

  it("clears the overlay surface before rendering layers", () => {
    const renderContext = createRenderContext();
    const layers: ChartLayer[] = [
      {
        id: "probe",
        render({ context }) {
          context.fillRect(1, 2, 3, 4);
        }
      }
    ];

    renderOverlay(renderContext, layers);

    expect((renderContext.context as unknown as FakeCanvasContext).calls).toEqual([
      { name: "clearRect", args: [0, 0, 140, 100] },
      { name: "fillRect", args: [1, 2, 3, 4, ""] }
    ]);
  });

  it("can render overlay layers without clearing when the host owns clearing", () => {
    const renderContext = createRenderContext();
    const layers: ChartLayer[] = [
      {
        id: "probe",
        render({ context }) {
          context.fillRect(1, 2, 3, 4);
        }
      }
    ];

    renderOverlay(renderContext, layers, { clear: false });

    expect((renderContext.context as unknown as FakeCanvasContext).calls).toEqual([
      { name: "fillRect", args: [1, 2, 3, 4, ""] }
    ]);
  });

  it("draws vertical and horizontal guide lines when crosshair is visible", () => {
    const renderContext = createRenderContext(createState({ crosshair: createCrosshair() }));

    createCrosshairLayer().render(renderContext);

    const pathCalls = (renderContext.context as unknown as FakeCanvasContext).calls
      .filter((call) => call.name === "moveTo" || call.name === "lineTo")
      .map((call) => ({ name: call.name, x: call.args[0], y: call.args[1] }));

    expect(pathCalls).toHaveLength(4);
    expect(pathCalls[0]).toMatchObject({ name: "moveTo", x: 15, y: 0 });
    expect(pathCalls[1]).toMatchObject({ name: "lineTo", x: 15, y: 80 });
    expect(pathCalls[2]).toMatchObject({ name: "moveTo", x: 0 });
    expect(pathCalls[2].y).toBeCloseTo(40);
    expect(pathCalls[3]).toMatchObject({ name: "lineTo", x: 100 });
    expect(pathCalls[3].y).toBeCloseTo(40);
    expect(callsNamed(renderContext, "stroke")).toEqual([
      { name: "stroke", args: ["#64748b", 1] }
    ]);
  });

  it.each(["linear", "log", "percentage"] as const)(
    "uses the shared %s scale for the crosshair",
    (priceScaleMode) => {
      const viewport = { ...createViewport(), priceScaleMode };
      const state = createState({ viewport, crosshair: createCrosshair() });
      const renderContext = createRenderContext(state);

      expect(() => createCrosshairLayer().render(renderContext)).not.toThrow();

      const horizontalLine = callsNamed(renderContext, "moveTo")[1];
      const expectedY = priceToY(
        state.crosshair?.price ?? 0,
        state.priceScale,
        state.layout.plotArea.y,
        state.layout.plotArea.height
      );

      expect(horizontalLine.args[1]).toBeCloseTo(expectedY);
      expect(expectedY).toBeGreaterThanOrEqual(state.layout.plotArea.y);
      expect(expectedY).toBeLessThanOrEqual(
        state.layout.plotArea.y + state.layout.plotArea.height
      );
    }
  );

  it("draws nothing when crosshair is absent", () => {
    const renderContext = createRenderContext();

    createCrosshairLayer().render(renderContext);

    expect((renderContext.context as unknown as FakeCanvasContext).calls).toEqual([]);
  });

  it("renders tooltip values from the neutral candle under the crosshair", () => {
    const renderContext = createRenderContext(
      createState({
        crosshair: createCrosshair({
          time: 999,
          open: 999,
          high: 999,
          low: 999,
          close: 999,
          volume: 999,
          turnover: 999
        })
      })
    );

    createTooltipLayer().render(renderContext);

    const text = callsNamed(renderContext, "fillText").map((call) => call.args[0]);
    expect(text).toEqual([
      "Time: 3",
      "Open: 12",
      "High: 16",
      "Low: 10",
      "Close: 15",
      "Volume: 90",
      "Turnover: 1350"
    ]);
    expect(text).not.toContain("Open: 999");
  });

  it("uses the host time formatter for the candle tooltip", () => {
    const renderContext = createRenderContext(
      createState({
        crosshair: createCrosshair(),
        formatTime: (time, timeframe) => `SH:${time}:${timeframe}`
      })
    );

    createTooltipLayer().render(renderContext);

    expect(callsNamed(renderContext, "fillText")[0]?.args[0]).toBe("Time: SH:3:1d");
  });

  it("does not require host metadata to render the tooltip", () => {
    const renderContext = createRenderContext(createState({ crosshair: createCrosshair() }));

    expect(() => createTooltipLayer().render(renderContext)).not.toThrow();
    expect(callsNamed(renderContext, "fillText")).toHaveLength(7);
  });

  it("draws no tooltip when crosshair is absent", () => {
    const renderContext = createRenderContext();

    createTooltipLayer().render(renderContext);

    expect((renderContext.context as unknown as FakeCanvasContext).calls).toEqual([]);
  });
});
