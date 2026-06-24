import type { ChartEngineCommand } from "../commands/chartCommands";
import type { DrawingObject } from "../drawing/drawingTypes";
import type { CandleSeries } from "../model/market";
import type { ViewportState } from "../model/runtime";
import type { IndicatorVisualOutput } from "../model/visual";
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
  dispatch(command: ChartEngineCommand): void;
  subscribe(listener: ChartEngineEventListener): () => void;
  destroy(): void;
}

export function createChartEngine(options: CreateChartEngineOptions): ChartEngine {
  let state: ChartEngineState = {
    series: options.series,
    seriesType: options.seriesType ?? "candles",
    timeframe: "1d",
    viewport: options.viewport ?? createDefaultViewport(options.series),
    visualOutputs: options.visualOutputs ?? [],
    drawings: options.drawings ?? [],
    settings: { ...defaultChartSettings, ...options.settings },
    invertedPriceScale: false,
    drawingTool: "select"
  };
  const listeners = new Set<ChartEngineEventListener>();

  function emit(event: ChartEngineEvent): void {
    listeners.forEach((listener) => listener(event));
  }

  function updateState(nextState: ChartEngineState): void {
    state = nextState;
  }

  return {
    getState() {
      return {
        ...state,
        visualOutputs: [...state.visualOutputs],
        drawings: [...state.drawings],
        settings: { ...state.settings }
      };
    },
    setSeries(series) {
      updateState({ ...state, series });
      emit({ type: "seriesChanged", series });
    },
    setSeriesType(seriesType) {
      updateState({ ...state, seriesType });
      emit({ type: "seriesTypeChanged", seriesType });
    },
    setViewport(viewport) {
      updateState({ ...state, viewport });
      emit({ type: "viewportChanged", viewport });
    },
    setVisualOutputs(outputs) {
      updateState({ ...state, visualOutputs: outputs });
      emit({ type: "visualOutputsChanged", outputs });
    },
    setDrawings(drawings) {
      updateState({ ...state, drawings });
      emit({ type: "drawingsChanged", drawings });
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

function reduceCommand(state: ChartEngineState, command: ChartEngineCommand): ChartEngineState {
  const nextState = { ...state, lastCommandType: command.type };

  if (command.type === "setSeriesType") {
    return { ...nextState, seriesType: command.seriesType };
  }

  if (command.type === "setTimeframe") {
    return { ...nextState, timeframe: command.timeframe };
  }

  if (command.type === "setViewport") {
    return { ...nextState, viewport: command.viewport };
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
