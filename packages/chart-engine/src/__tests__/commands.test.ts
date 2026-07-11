import { describe, expect, it } from "vitest";
import {
  createCommandHistory,
  supportedPriceScaleModes,
  type ChartEngineCommand
} from "../index";

describe("chart engine command contract", () => {
  it("publishes canonical price scale modes", () => {
    expect(supportedPriceScaleModes).toEqual(["linear", "log", "percentage"]);

    const scaleCommand: ChartEngineCommand = {
      type: "setPriceScaleMode",
      mode: "percentage"
    };

    expect(scaleCommand.mode).toBe("percentage");
  });
});

describe("command history", () => {
  it("applies undo and redo for drawing commands", () => {
    const history = createCommandHistory<number>(0);

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    history.apply({ label: "increment", do: (value) => value + 1, undo: (value) => value - 1 });

    expect(history.current()).toBe(1);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
    expect(history.undo()).toBe(0);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
    expect(history.redo()).toBe(1);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it("clears redo stack after a new command", () => {
    const history = createCommandHistory<number>(0);

    history.apply({ label: "one", do: (value) => value + 1, undo: (value) => value - 1 });
    history.undo();
    history.apply({ label: "two", do: (value) => value + 2, undo: (value) => value - 2 });

    expect(history.canRedo()).toBe(false);
    expect(history.redo()).toBe(2);
  });
});
