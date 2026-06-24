import { describe, expect, it } from "vitest";
import {
  createChartCommandDispatcher,
  createCommandHistory,
  type ChartCommandState
} from "../index";

describe("command history", () => {
  it("applies undo and redo for drawing commands", () => {
    const history = createCommandHistory<number>(0);

    history.apply({ label: "increment", do: (value) => value + 1, undo: (value) => value - 1 });

    expect(history.current()).toBe(1);
    expect(history.undo()).toBe(0);
    expect(history.redo()).toBe(1);
  });

  it("clears redo stack after a new command", () => {
    const history = createCommandHistory<number>(0);

    history.apply({ label: "one", do: (value) => value + 1, undo: (value) => value - 1 });
    history.undo();
    history.apply({ label: "two", do: (value) => value + 2, undo: (value) => value - 2 });

    expect(history.redo()).toBe(2);
  });
});

describe("chart command dispatcher", () => {
  it("dispatches neutral chart commands", () => {
    const initial: ChartCommandState = {
      seriesType: "candles",
      timeframe: "1d",
      gridVisible: true,
      invertedPriceScale: false,
      themeMode: "light",
      drawingTool: "select"
    };
    const dispatcher = createChartCommandDispatcher(initial);

    expect(dispatcher.dispatch({ type: "setSeriesType", seriesType: "line" }).seriesType).toBe(
      "line"
    );
    expect(dispatcher.dispatch({ type: "toggleGrid" }).gridVisible).toBe(false);
    expect(dispatcher.dispatch({ type: "invertPriceScale" }).invertedPriceScale).toBe(true);
    expect(
      dispatcher.dispatch({ type: "setDrawingTool", drawingTool: "trendLine" }).drawingTool
    ).toBe("trendLine");
    expect(dispatcher.dispatch({ type: "undo" }).lastCommandType).toBe("undo");
  });

  it("keeps dispatcher state immutable to callers", () => {
    const initial: ChartCommandState = {
      seriesType: "candles",
      timeframe: "1d",
      gridVisible: true,
      invertedPriceScale: false,
      themeMode: "light",
      drawingTool: "select"
    };
    const dispatcher = createChartCommandDispatcher(initial);
    const state = dispatcher.getState();

    state.gridVisible = false;

    expect(dispatcher.getState().gridVisible).toBe(true);
  });
});
