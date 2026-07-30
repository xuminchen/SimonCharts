import { describe, expect, it } from "vitest";
import {
  createDrawingEditor,
  type DrawingObject
} from "../index";

const drawing = (
  id: string,
  options: Pick<DrawingObject, "interactive" | "locked"> = {}
): DrawingObject => ({
  id,
  type: "trendLine",
  anchors: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  ...options
});

describe("drawing groups", () => {
  it("creates one contiguous group and preserves member order", () => {
    const editor = createDrawingEditor({
      drawings: [drawing("a"), drawing("x"), drawing("b"), drawing("y")]
    });

    const id = editor.createGroup(["a", "b"], "Plan");

    expect(id).toBe("drawing-group:1");
    expect(editor.getState()).toMatchObject({
      drawings: [{ id: "x" }, { id: "a" }, { id: "b" }, { id: "y" }],
      drawingGroups: [{ id, name: "Plan", drawingIds: ["a", "b"] }]
    });
  });

  it("rejects empty, duplicate, unknown, and multiply grouped members atomically", () => {
    const editor = createDrawingEditor({ drawings: [drawing("a"), drawing("b")] });
    const id = editor.createGroup(["a"], "First");
    const before = editor.getState();

    expect(() => editor.createGroup([], "Empty")).toThrow();
    expect(() => editor.createGroup(["b", "b"], "Duplicate")).toThrow();
    expect(() => editor.createGroup(["missing"], "Unknown")).toThrow();
    expect(() => editor.createGroup(["a", "b"], "Overlap")).toThrow();
    expect(editor.getState()).toEqual(before);
    expect(editor.getState().drawingGroups[0]?.id).toBe(id);
  });

  it("rejects locked members and locked z-order barriers while compacting", () => {
    const lockedMember = createDrawingEditor({
      drawings: [drawing("a", { locked: true }), drawing("b")]
    });
    expect(() => lockedMember.createGroup(["a", "b"], "Plan")).toThrow();

    const lockedBarrier = createDrawingEditor({
      drawings: [drawing("a"), drawing("locked", { locked: true }), drawing("b")]
    });
    const before = lockedBarrier.getState();
    expect(() => lockedBarrier.createGroup(["a", "b"], "Plan")).toThrow();
    expect(lockedBarrier.getState()).toEqual(before);
  });

  it("applies visibility and lock to every member and restores both with undo", () => {
    const editor = createDrawingEditor({
      drawings: [
        drawing("a"),
        drawing("b", { interactive: false })
      ]
    });
    const id = editor.createGroup(["a", "b"], "Plan");

    editor.setGroupVisible(id, false);
    expect(editor.getState().drawings.every((item) => item.visible === false)).toBe(true);
    editor.undo();
    expect(editor.getState().drawings.every((item) => item.visible !== false)).toBe(true);

    editor.setGroupLocked(id, true);
    expect(editor.getState().drawings.every((item) => item.locked === true)).toBe(true);
    editor.undo();
    expect(editor.getState().drawings.every((item) => item.locked !== true)).toBe(true);
    expect(editor.getState().drawingGroups).toEqual([
      { id, name: "Plan", drawingIds: ["a", "b"] }
    ]);
  });

  it("moves a group as one z-order block and restores it with undo and redo", () => {
    const editor = createDrawingEditor({
      drawings: [drawing("a"), drawing("b"), drawing("x"), drawing("y")]
    });
    const id = editor.createGroup(["a", "b"], "Plan");

    editor.moveGroup(id, "front");
    expect(editor.getState().drawings.map(({ id: drawingId }) => drawingId))
      .toEqual(["x", "y", "a", "b"]);

    editor.undo();
    expect(editor.getState().drawings.map(({ id: drawingId }) => drawingId))
      .toEqual(["a", "b", "x", "y"]);

    editor.redo();
    expect(editor.getState().drawings.map(({ id: drawingId }) => drawingId))
      .toEqual(["x", "y", "a", "b"]);
  });

  it("moves groups only within unlocked z-order segments", () => {
    const forward = createDrawingEditor({
      drawings: [
        drawing("a"),
        drawing("b"),
        drawing("x"),
        drawing("locked", { locked: true }),
        drawing("y")
      ]
    });
    const forwardId = forward.createGroup(["a", "b"], "Plan");
    forward.moveGroup(forwardId, "forward");
    expect(forward.getState().drawings.map(({ id }) => id))
      .toEqual(["x", "a", "b", "locked", "y"]);
    forward.moveGroup(forwardId, "front");
    expect(forward.getState().drawings.map(({ id }) => id))
      .toEqual(["x", "a", "b", "locked", "y"]);

    const backward = createDrawingEditor({
      drawings: [
        drawing("x"),
        drawing("locked", { locked: true }),
        drawing("a"),
        drawing("b"),
        drawing("y")
      ]
    });
    const backwardId = backward.createGroup(["a", "b"], "Plan");
    backward.moveGroup(backwardId, "backward");
    expect(backward.getState().drawings.map(({ id }) => id))
      .toEqual(["x", "locked", "a", "b", "y"]);
    backward.moveGroup(backwardId, "back");
    expect(backward.getState().drawings.map(({ id }) => id))
      .toEqual(["x", "locked", "a", "b", "y"]);
  });

  it("ungroups without deleting drawings and prunes membership with drawing deletion", () => {
    const editor = createDrawingEditor({
      drawings: [drawing("a"), drawing("b")]
    });
    const id = editor.createGroup(["a", "b"], "Plan");

    editor.removeGroup(id);
    expect(editor.getState().drawingGroups).toEqual([]);
    expect(editor.getState().drawings).toHaveLength(2);
    editor.undo();

    editor.selectDrawing("a");
    editor.deleteSelected();
    expect(editor.getState().drawingGroups).toEqual([
      { id, name: "Plan", drawingIds: ["b"] }
    ]);
    editor.undo();
    expect(editor.getState().drawingGroups).toEqual([
      { id, name: "Plan", drawingIds: ["a", "b"] }
    ]);
  });

  it("deep-clones initial and returned group state", () => {
    const groups = [{ id: "drawing-group:plan", name: "Plan", drawingIds: ["a", "b"] }];
    const editor = createDrawingEditor({
      drawings: [drawing("a"), drawing("b")],
      drawingGroups: groups
    });

    groups[0]!.name = "Changed";
    editor.getState().drawingGroups[0]!.drawingIds.push("changed");

    expect(editor.getState().drawingGroups).toEqual([
      { id: "drawing-group:plan", name: "Plan", drawingIds: ["a", "b"] }
    ]);
    expect(() => createDrawingEditor({
      drawings: [drawing("a")],
      drawingGroups: [{
        id: "drawing-group:long",
        name: "x".repeat(257),
        drawingIds: ["a"]
      }]
    })).toThrow();
  });

  it("publishes each group mutation once and restores deleted groups with undo", () => {
    const events: string[] = [];
    const editor = createDrawingEditor({
      drawings: [drawing("a"), drawing("x"), drawing("b")],
      onEvent: (event) => events.push(event.type)
    });
    const id = editor.createGroup(["a"], "Plan");

    expect(events).toEqual(["drawingGroupsChanged"]);
    events.length = 0;
    editor.setGroupDrawings(id, ["a", "b"]);
    expect(events).toEqual(["drawingGroupsChanged"]);
    events.length = 0;
    editor.setGroupName(id, "Updated");
    expect(events).toEqual(["drawingGroupsChanged"]);
    events.length = 0;
    editor.deleteGroupDrawings(id);
    expect(events).toEqual(["drawingGroupsChanged"]);
    expect(editor.getState().drawings.map(({ id: drawingId }) => drawingId)).toEqual(["x"]);

    editor.undo();
    expect(editor.getState().drawingGroups).toEqual([
      { id, name: "Updated", drawingIds: ["a", "b"] }
    ]);
    expect(editor.getState().drawings.map(({ id: drawingId }) => drawingId))
      .toEqual(["x", "a", "b"]);
  });

  it("rejects group mutations with locked members atomically but allows group unlock", () => {
    const editor = createDrawingEditor({
      drawings: [
        drawing("a"),
        drawing("b", { interactive: false })
      ]
    });
    const id = editor.createGroup(["a", "b"], "Plan");
    editor.setGroupLocked(id, true);
    const before = editor.getState();

    expect(() => editor.setGroupVisible(id, false)).toThrow();
    expect(() => editor.setGroupDrawings(id, ["b"])).toThrow();
    expect(() => editor.moveGroup(id, "front")).toThrow();
    expect(() => editor.deleteGroupDrawings(id)).toThrow();
    expect(editor.getState()).toEqual(before);

    editor.setGroupLocked(id, false);
    expect(editor.getState().drawings.every((item) => item.locked !== true)).toBe(true);
  });

  it("keeps adjacent groups intact when existing z-order commands move one member", () => {
    const editor = createDrawingEditor({
      drawings: [drawing("a"), drawing("b"), drawing("c"), drawing("d")]
    });
    editor.createGroup(["a", "b"], "First");
    editor.createGroup(["c", "d"], "Second");

    editor.selectDrawing("a");
    editor.bringSelectedForward();

    expect(editor.getState().drawings.map(({ id }) => id)).toEqual(["c", "d", "a", "b"]);
    expect(editor.getState().drawingGroups.map(({ drawingIds }) => drawingIds)).toEqual([
      ["a", "b"],
      ["c", "d"]
    ]);
  });
});
