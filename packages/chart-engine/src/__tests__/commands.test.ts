import { describe, expect, it } from "vitest";
import { createCommandHistory } from "../index";

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
