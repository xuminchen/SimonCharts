import { describe, expect, it } from "vitest";
import type { InteractionSessionState } from "../interaction/sessionTypes";
import { createChartEngine, fixtureDailyCandleSeries } from "../index";
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
