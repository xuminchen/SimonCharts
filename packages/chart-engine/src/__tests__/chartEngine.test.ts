import { describe, expect, it } from "vitest";
import type { DrawingObject } from "../drawing/drawingTypes";
import type { InteractionSessionState } from "../interaction/sessionTypes";
import { createChartEngine, fixtureDailyCandleSeries } from "../index";
import type { CandleSeries } from "../model/market";
import type { ViewportState } from "../model/runtime";
import type { IndicatorVisualOutput } from "../model/visual";
import type { RenderSchedulerState } from "../render/scheduler/renderSchedulerTypes";

describe("chart engine facade", () => {
  it("updates neutral state through public API", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });

    engine.setSeriesType("line");
    engine.setViewport({
      visibleRange: { from: 1, to: 10 },
      candleWidth: 8,
      scrollOffset: 0,
      priceScaleMode: "linear"
    });

    expect(engine.getState().seriesType).toBe("line");
    expect(engine.getState().viewport.visibleRange).toEqual({ from: 1, to: 10 });
  });

  it("emits neutral events", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });
    const events: unknown[] = [];
    const unsubscribe = engine.subscribe((event) => events.push(event));

    engine.setSeriesType("area");
    unsubscribe();
    engine.setSeriesType("line");

    expect(events).toEqual([{ type: "seriesTypeChanged", seriesType: "area" }]);
  });

  it("stores neutral interaction and render snapshots", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });

    engine.setInteractionState(createInteractionSnapshot());
    engine.setRenderState(createRenderSnapshot());

    expect(engine.getState().interaction?.cursor).toBe("crosshair");
    expect(engine.getState().render?.metrics.totalRenderCount).toBe(2);
  });

  it("isolates stored snapshots from caller-owned input mutation", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });
    const interaction = createInteractionSnapshot();
    const render = createRenderSnapshot();

    engine.setInteractionState(interaction);
    engine.setRenderState(render);

    interaction.pointer.point!.x = 99;
    interaction.tooltip.rows![0].value = "99";
    render.dirtyLayers.push("tooltip");
    render.metrics.lastInvalidationReasons.push("tooltipChanged");

    expect(engine.getState().interaction?.pointer.point?.x).toBe(10);
    expect(engine.getState().interaction?.tooltip.rows?.[0].value).toBe("10");
    expect(engine.getState().render?.dirtyLayers).toEqual(["crosshair"]);
    expect(engine.getState().render?.metrics.lastInvalidationReasons).toEqual(["pointerMoved"]);
  });

  it("isolates stored snapshots from emitted event payload mutation", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });

    engine.subscribe((event) => {
      if (event.type === "interactionStateChanged") {
        event.interaction.pointer.point!.x = 99;
        event.interaction.tooltip.rows![0].value = "99";
      }

      if (event.type === "renderStateChanged") {
        event.render.dirtyLayers.push("tooltip");
        event.render.metrics.lastInvalidationReasons.push("tooltipChanged");
      }
    });

    engine.setInteractionState(createInteractionSnapshot());
    engine.setRenderState(createRenderSnapshot());

    expect(engine.getState().interaction?.pointer.point?.x).toBe(10);
    expect(engine.getState().interaction?.tooltip.rows?.[0].value).toBe("10");
    expect(engine.getState().render?.dirtyLayers).toEqual(["crosshair"]);
    expect(engine.getState().render?.metrics.lastInvalidationReasons).toEqual(["pointerMoved"]);
  });

  it("isolates subscriber event payloads from other subscribers", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });
    const observedInteractionPoints: number[] = [];
    const observedRenderLayers: string[][] = [];

    engine.subscribe((event) => {
      if (event.type === "interactionStateChanged") {
        event.interaction.pointer.point!.x = 99;
        event.interaction.tooltip.rows![0].value = "99";
      }

      if (event.type === "renderStateChanged") {
        event.render.dirtyLayers.push("tooltip");
        event.render.metrics.lastInvalidationReasons.push("tooltipChanged");
      }
    });
    engine.subscribe((event) => {
      if (event.type === "interactionStateChanged") {
        observedInteractionPoints.push(event.interaction.pointer.point!.x);
        expect(event.interaction.tooltip.rows?.[0].value).toBe("10");
      }

      if (event.type === "renderStateChanged") {
        observedRenderLayers.push(event.render.dirtyLayers);
        expect(event.render.metrics.lastInvalidationReasons).toEqual(["pointerMoved"]);
      }
    });

    engine.setInteractionState(createInteractionSnapshot());
    engine.setRenderState(createRenderSnapshot());

    expect(observedInteractionPoints).toEqual([10]);
    expect(observedRenderLayers).toEqual([["crosshair"]]);
    expect(engine.getState().interaction?.pointer.point?.x).toBe(10);
    expect(engine.getState().interaction?.tooltip.rows?.[0].value).toBe("10");
    expect(engine.getState().render?.dirtyLayers).toEqual(["crosshair"]);
    expect(engine.getState().render?.metrics.lastInvalidationReasons).toEqual(["pointerMoved"]);
  });

  it("isolates mutable event payloads from other subscribers and state", () => {
    const engine = createChartEngine({ series: createSeriesSnapshot() });
    const observedSeriesCloses: number[] = [];
    const observedSeriesLengths: number[] = [];
    const observedViewportStarts: number[] = [];
    const observedLineValues: number[] = [];
    const observedMarkerPrices: number[] = [];
    const observedDrawingPrices: number[] = [];
    const observedDrawingDashes: number[] = [];

    engine.subscribe((event) => {
      if (event.type === "seriesChanged") {
        event.series.candles[0]!.close = 999;
        event.series.candles.push({ ...event.series.candles[0]! });
      }

      if (event.type === "viewportChanged") {
        event.viewport.visibleRange.from = 99;
      }

      if (event.type === "visualOutputsChanged") {
        const line = event.outputs.find((output) => output.type === "line");
        const marker = event.outputs.find((output) => output.type === "marker");

        if (line) {
          line.values[0]!.value = 999;
        }
        if (marker) {
          marker.marks[0]!.price = 999;
          marker.marks[0]!.metadata!.source = "mutated";
        }
      }

      if (event.type === "drawingsChanged") {
        event.drawings[0]!.anchors[0]!.price = 999;
        event.drawings[0]!.style!.lineDash![0] = 99;
        event.drawings[0]!.metadata!.source = "mutated";
      }
    });
    engine.subscribe((event) => {
      if (event.type === "seriesChanged") {
        observedSeriesCloses.push(event.series.candles[0]!.close);
        observedSeriesLengths.push(event.series.candles.length);
      }

      if (event.type === "viewportChanged") {
        observedViewportStarts.push(event.viewport.visibleRange.from);
      }

      if (event.type === "visualOutputsChanged") {
        const line = event.outputs.find((output) => output.type === "line");
        const marker = event.outputs.find((output) => output.type === "marker");

        observedLineValues.push(line?.values[0]?.value ?? -1);
        observedMarkerPrices.push(marker?.marks[0]?.price ?? -1);
        expect(marker?.marks[0]?.metadata).toEqual({ source: "fixture" });
      }

      if (event.type === "drawingsChanged") {
        observedDrawingPrices.push(event.drawings[0]!.anchors[0]!.price!);
        observedDrawingDashes.push(event.drawings[0]!.style!.lineDash![0]!);
        expect(event.drawings[0]!.metadata).toEqual({ source: "fixture" });
      }
    });

    engine.setSeries(createSeriesSnapshot());
    engine.setViewport(createViewportSnapshot());
    engine.setVisualOutputs(createVisualOutputsSnapshot());
    engine.setDrawings(createDrawingsSnapshot());

    const state = engine.getState();
    const stateLine = state.visualOutputs.find((output) => output.type === "line");
    const stateMarker = state.visualOutputs.find((output) => output.type === "marker");

    expect(observedSeriesCloses).toEqual([101]);
    expect(observedSeriesLengths).toEqual([2]);
    expect(observedViewportStarts).toEqual([1]);
    expect(observedLineValues).toEqual([101]);
    expect(observedMarkerPrices).toEqual([101]);
    expect(observedDrawingPrices).toEqual([100]);
    expect(observedDrawingDashes).toEqual([4]);
    expect(state.series.candles[0]!.close).toBe(101);
    expect(state.series.candles).toHaveLength(2);
    expect(state.viewport.visibleRange.from).toBe(1);
    expect(stateLine?.values[0]?.value).toBe(101);
    expect(stateMarker?.marks[0]?.price).toBe(101);
    expect(stateMarker?.marks[0]?.metadata).toEqual({ source: "fixture" });
    expect(state.drawings[0]!.anchors[0]!.price).toBe(100);
    expect(state.drawings[0]!.style!.lineDash).toEqual([4, 2]);
    expect(state.drawings[0]!.metadata).toEqual({ source: "fixture" });
  });

  it("isolates stored snapshots from returned state mutation", () => {
    const engine = createChartEngine({ series: fixtureDailyCandleSeries });

    engine.setInteractionState(createInteractionSnapshot());
    engine.setRenderState(createRenderSnapshot());

    const snapshot = engine.getState();
    snapshot.interaction!.pointer.point!.x = 99;
    snapshot.interaction!.tooltip.rows![0].value = "99";
    snapshot.render!.dirtyLayers.push("tooltip");
    snapshot.render!.metrics.lastInvalidationReasons.push("tooltipChanged");

    expect(engine.getState().interaction?.pointer.point?.x).toBe(10);
    expect(engine.getState().interaction?.tooltip.rows?.[0].value).toBe("10");
    expect(engine.getState().render?.dirtyLayers).toEqual(["crosshair"]);
    expect(engine.getState().render?.metrics.lastInvalidationReasons).toEqual(["pointerMoved"]);
  });
});

function createInteractionSnapshot(): InteractionSessionState {
  return {
    pointer: { mode: "hover", point: { x: 10, y: 20 } },
    crosshair: { visible: false },
    tooltip: { visible: true, sourceType: "series", rows: [{ label: "Open", value: "10" }] },
    cursor: "crosshair",
    magnet: { mode: "off" },
    keyboard: { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false }
  };
}

function createSeriesSnapshot(): CandleSeries {
  return {
    symbol: "SIMON",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "event-isolation",
    candles: [
      {
        time: 1,
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1000,
        turnover: 101000
      },
      {
        time: 2,
        open: 101,
        high: 103,
        low: 100,
        close: 102,
        volume: 1100,
        turnover: 112200
      }
    ]
  };
}

function createViewportSnapshot(): ViewportState {
  return {
    visibleRange: { from: 1, to: 2 },
    candleWidth: 8,
    scrollOffset: 0,
    priceScaleMode: "linear"
  };
}

function createVisualOutputsSnapshot(): IndicatorVisualOutput[] {
  return [
    {
      type: "line",
      id: "ma",
      label: "MA",
      values: [{ time: 1, value: 101 }],
      color: "#1f77b4",
      lineWidth: 2
    },
    {
      type: "marker",
      id: "events",
      label: "Events",
      marks: [
        {
          id: "m1",
          time: 1,
          price: 101,
          label: "E",
          metadata: { source: "fixture" }
        }
      ]
    }
  ];
}

function createDrawingsSnapshot(): DrawingObject[] {
  return [
    {
      id: "d1",
      type: "trendLine",
      anchors: [
        { time: 1, price: 100 },
        { time: 2, price: 102 }
      ],
      style: { color: "#d62728", lineWidth: 2, lineDash: [4, 2] },
      metadata: { source: "fixture" }
    }
  ];
}

function createRenderSnapshot(): RenderSchedulerState {
  return {
    pending: false,
    dirtyLayers: ["crosshair"],
    layoutRequired: false,
    metrics: {
      totalRenderCount: 2,
      renderCountByPass: { static: 1, dynamic: 0, overlay: 1 },
      lastRenderDuration: 3,
      dirtyLayerCount: 1,
      lastInvalidationReasons: ["pointerMoved"],
      slowFrameCount: 0
    }
  };
}
