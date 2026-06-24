import type { DrawingType } from "../drawing/drawingTypes";
import type { ViewportState } from "../model/runtime";
import type { SeriesType } from "../series/seriesTypes";

export type ChartCommandThemeMode = "light" | "dark";
export type ChartCommandTimeframe = "1d" | "1w" | "1mo";

export type ChartEngineCommand =
  | { type: "setSeriesType"; seriesType: SeriesType }
  | { type: "setTimeframe"; timeframe: ChartCommandTimeframe }
  | { type: "setViewport"; viewport: ViewportState }
  | { type: "zoomIn" }
  | { type: "zoomOut" }
  | { type: "resetZoom" }
  | { type: "pan"; deltaX: number }
  | { type: "toggleGrid" }
  | { type: "invertPriceScale" }
  | { type: "setThemeMode"; themeMode: ChartCommandThemeMode }
  | { type: "setDrawingTool"; drawingTool: DrawingType | "select" }
  | { type: "deleteSelectedDrawing" }
  | { type: "lockSelectedDrawing" }
  | { type: "hideSelectedDrawing" }
  | { type: "undo" }
  | { type: "redo" };

export interface ChartCommandState {
  seriesType: SeriesType;
  timeframe: ChartCommandTimeframe;
  viewport?: ViewportState;
  gridVisible: boolean;
  invertedPriceScale: boolean;
  themeMode: ChartCommandThemeMode;
  drawingTool: DrawingType | "select";
  lastCommandType?: ChartEngineCommand["type"];
}

export interface ChartCommandDispatcher {
  dispatch(command: ChartEngineCommand): ChartCommandState;
  getState(): ChartCommandState;
}

export function createChartCommandDispatcher(
  initialState: ChartCommandState
): ChartCommandDispatcher {
  let state = { ...initialState };

  return {
    dispatch(command) {
      state = reduceChartCommand(state, command);

      return state;
    },
    getState() {
      return { ...state };
    }
  };
}

function reduceChartCommand(
  state: ChartCommandState,
  command: ChartEngineCommand
): ChartCommandState {
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
    return { ...nextState, gridVisible: !state.gridVisible };
  }

  if (command.type === "invertPriceScale") {
    return { ...nextState, invertedPriceScale: !state.invertedPriceScale };
  }

  if (command.type === "setThemeMode") {
    return { ...nextState, themeMode: command.themeMode };
  }

  if (command.type === "setDrawingTool") {
    return { ...nextState, drawingTool: command.drawingTool };
  }

  return nextState;
}
