import type { ChartEngineCommand } from "../commands/chartCommands";
import type { DrawingObject } from "../drawing/drawingTypes";
import type { InteractionSessionState } from "../interaction/sessionTypes";
import type { CandleSeries } from "../model/market";
import type { ViewportState } from "../model/runtime";
import type { IndicatorVisualOutput } from "../model/visual";
import type { RenderSchedulerState } from "../render/scheduler/renderSchedulerTypes";
import { defaultChartSettings } from "../settings/chartSettings";
import type { ChartSettings } from "../settings/chartSettings";
import type { SeriesType } from "../series/seriesTypes";
import type { ChartEngineState } from "./chartState";
import type { ChartEngineEvent, ChartEngineEventListener } from "./events";

export interface CreateChartEngineOptions {
  series: CandleSeries;
  seriesType?: SeriesType;
  viewport?: ViewportState;
  visualOutputs?: IndicatorVisualOutput[];
  drawings?: DrawingObject[];
  settings?: Partial<ChartSettings>;
}

export interface ChartEngine {
  getState(): ChartEngineState;
  setSeries(series: CandleSeries): void;
  setSeriesType(seriesType: SeriesType): void;
  setViewport(viewport: ViewportState): void;
  setVisualOutputs(outputs: IndicatorVisualOutput[]): void;
  setDrawings(drawings: DrawingObject[]): void;
  setInteractionState(interaction: InteractionSessionState): void;
  setRenderState(render: RenderSchedulerState): void;
  dispatch(command: ChartEngineCommand): void;
  subscribe(listener: ChartEngineEventListener): () => void;
  destroy(): void;
}

export function createChartEngine(options: CreateChartEngineOptions): ChartEngine {
  const initialSeries = cloneSeries(options.series);
  let state: ChartEngineState = {
    series: initialSeries,
    seriesType: options.seriesType ?? "candles",
    timeframe: "1d",
    viewport: options.viewport ? cloneViewport(options.viewport) : createDefaultViewport(initialSeries),
    visualOutputs: options.visualOutputs ? cloneVisualOutputs(options.visualOutputs) : [],
    drawings: options.drawings ? cloneDrawings(options.drawings) : [],
    settings: { ...defaultChartSettings, ...options.settings },
    invertedPriceScale: false,
    drawingTool: "select"
  };
  const listeners = new Set<ChartEngineEventListener>();

  function emit(event: ChartEngineEvent): void {
    listeners.forEach((listener) => listener(cloneEvent(event)));
  }

  function updateState(nextState: ChartEngineState): void {
    state = nextState;
  }

  return {
    getState() {
      return {
        ...state,
        series: cloneSeries(state.series),
        viewport: cloneViewport(state.viewport),
        visualOutputs: cloneVisualOutputs(state.visualOutputs),
        drawings: cloneDrawings(state.drawings),
        settings: { ...state.settings },
        interaction: state.interaction ? cloneInteractionState(state.interaction) : undefined,
        render: state.render ? cloneRenderState(state.render) : undefined
      };
    },
    setSeries(series) {
      const nextSeries = cloneSeries(series);

      updateState({ ...state, series: nextSeries });
      emit({ type: "seriesChanged", series: nextSeries });
    },
    setSeriesType(seriesType) {
      updateState({ ...state, seriesType });
      emit({ type: "seriesTypeChanged", seriesType });
    },
    setViewport(viewport) {
      const nextViewport = cloneViewport(viewport);

      updateState({ ...state, viewport: nextViewport });
      emit({ type: "viewportChanged", viewport: nextViewport });
    },
    setVisualOutputs(outputs) {
      const nextOutputs = cloneVisualOutputs(outputs);

      updateState({ ...state, visualOutputs: nextOutputs });
      emit({ type: "visualOutputsChanged", outputs: nextOutputs });
    },
    setDrawings(drawings) {
      const nextDrawings = cloneDrawings(drawings);

      updateState({ ...state, drawings: nextDrawings });
      emit({ type: "drawingsChanged", drawings: nextDrawings });
    },
    setInteractionState(interaction) {
      const nextInteraction = cloneInteractionState(interaction);

      updateState({ ...state, interaction: nextInteraction });
      emit({ type: "interactionStateChanged", interaction: cloneInteractionState(nextInteraction) });
    },
    setRenderState(render) {
      const nextRender = cloneRenderState(render);

      updateState({ ...state, render: nextRender });
      emit({ type: "renderStateChanged", render: cloneRenderState(nextRender) });
    },
    dispatch(command) {
      updateState(reduceCommand(state, command));
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      listeners.clear();
    }
  };
}

function cloneEvent(event: ChartEngineEvent): ChartEngineEvent {
  if (event.type === "seriesChanged") {
    return { type: event.type, series: cloneSeries(event.series) };
  }

  if (event.type === "seriesTypeChanged") {
    return { ...event };
  }

  if (event.type === "viewportChanged") {
    return { type: event.type, viewport: cloneViewport(event.viewport) };
  }

  if (event.type === "visualOutputsChanged") {
    return { type: event.type, outputs: cloneVisualOutputs(event.outputs) };
  }

  if (event.type === "drawingsChanged") {
    return { type: event.type, drawings: cloneDrawings(event.drawings) };
  }

  if (event.type === "interactionStateChanged") {
    return { type: event.type, interaction: cloneInteractionState(event.interaction) };
  }

  return { type: event.type, render: cloneRenderState(event.render) };
}

function cloneSeries(series: CandleSeries): CandleSeries {
  return {
    ...series,
    candles: series.candles.map((candle) => ({ ...candle }))
  };
}

function cloneViewport(viewport: ViewportState): ViewportState {
  return {
    ...viewport,
    visibleRange: { ...viewport.visibleRange }
  };
}

function cloneVisualOutputs(outputs: IndicatorVisualOutput[]): IndicatorVisualOutput[] {
  return outputs.map((output) => {
    if (output.type === "line") {
      return {
        ...output,
        values: output.values.map((point) => ({ ...point }))
      };
    }

    if (output.type === "histogram") {
      return {
        ...output,
        values: output.values.map((point) => ({ ...point }))
      };
    }

    if (output.type === "band") {
      return {
        ...output,
        upper: output.upper.map((point) => ({ ...point })),
        lower: output.lower.map((point) => ({ ...point }))
      };
    }

    return {
      ...output,
      marks: output.marks.map((mark) => {
        const nextMark = { ...mark };
        if (mark.metadata) {
          nextMark.metadata = { ...mark.metadata };
        }
        return nextMark;
      })
    };
  });
}

function cloneDrawings(drawings: DrawingObject[]): DrawingObject[] {
  return drawings.map((drawing) => {
    const nextDrawing: DrawingObject = {
      ...drawing,
      anchors: drawing.anchors.map((anchor) => ({ ...anchor }))
    };

    if (drawing.style) {
      nextDrawing.style = { ...drawing.style };
      if (drawing.style.lineDash) {
        nextDrawing.style.lineDash = [...drawing.style.lineDash];
      }
    }

    if (drawing.metadata) {
      nextDrawing.metadata = { ...drawing.metadata };
    }

    return nextDrawing;
  });
}

function cloneInteractionState(interaction: InteractionSessionState): InteractionSessionState {
  return {
    ...interaction,
    pointer: {
      ...interaction.pointer,
      point: interaction.pointer.point ? { ...interaction.pointer.point } : undefined,
      startPoint: interaction.pointer.startPoint ? { ...interaction.pointer.startPoint } : undefined
    },
    crosshair: { ...interaction.crosshair } as InteractionSessionState["crosshair"],
    tooltip: {
      ...interaction.tooltip,
      rows: interaction.tooltip.rows?.map((row) => ({ ...row }))
    },
    magnet: {
      ...interaction.magnet,
      target: interaction.magnet.target
        ? {
            ...interaction.magnet.target,
            point: { ...interaction.magnet.target.point }
          }
        : undefined
    },
    keyboard: { ...interaction.keyboard }
  };
}

function cloneRenderState(render: RenderSchedulerState): RenderSchedulerState {
  return {
    ...render,
    dirtyLayers: [...render.dirtyLayers],
    metrics: {
      ...render.metrics,
      renderCountByPass: { ...render.metrics.renderCountByPass },
      lastInvalidationReasons: [...render.metrics.lastInvalidationReasons]
    }
  };
}

function reduceCommand(state: ChartEngineState, command: ChartEngineCommand): ChartEngineState {
  const nextState = { ...state, lastCommandType: command.type };

  if (command.type === "setSeriesType") {
    return { ...nextState, seriesType: command.seriesType };
  }

  if (command.type === "setTimeframe") {
    return { ...nextState, timeframe: command.timeframe };
  }

  if (command.type === "setViewport") {
    return { ...nextState, viewport: cloneViewport(command.viewport) };
  }

  if (command.type === "toggleGrid") {
    return {
      ...nextState,
      settings: { ...state.settings, gridVisible: !state.settings.gridVisible }
    };
  }

  if (command.type === "invertPriceScale") {
    return { ...nextState, invertedPriceScale: !state.invertedPriceScale };
  }

  if (command.type === "setThemeMode") {
    return {
      ...nextState,
      settings: { ...state.settings, themeMode: command.themeMode }
    };
  }

  if (command.type === "setDrawingTool") {
    return { ...nextState, drawingTool: command.drawingTool };
  }

  return nextState;
}

function createDefaultViewport(series: CandleSeries): ViewportState {
  const to = Math.max(series.candles.length - 1, 0);
  const from = Math.max(to - 80, 0);

  return {
    visibleRange: { from, to },
    candleWidth: 8,
    scrollOffset: 0,
    priceScaleMode: "linear"
  };
}
