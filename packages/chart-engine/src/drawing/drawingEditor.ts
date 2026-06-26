import { createCommandHistory } from "../commands/history";
import type { DrawingEditorEvent, DrawingEditorTool } from "./drawingCommands";
import type { DrawingClipboard, DrawingObjectManagerItem } from "./drawingEditState";
import { builtInDrawingToolDefinitions } from "./drawingToolDefinitions";
import { createDrawingToolRegistry, type DrawingToolRegistry } from "./drawingToolRegistry";
import type { DrawingAnchor, DrawingObject, DrawingStyle } from "./drawingTypes";

export interface DrawingEditorPoint {
  x: number;
  y: number;
  time?: number;
  price?: number;
}

export interface DrawingEditorState {
  drawings: DrawingObject[];
  selectedDrawingIds: string[];
  activeTool: DrawingEditorTool;
  isCreating: boolean;
}

export interface DrawingEditorOptions {
  drawings: DrawingObject[];
  onEvent?: (event: DrawingEditorEvent) => void;
  toolRegistry?: DrawingToolRegistry;
}

export interface DrawingEditor {
  setTool(tool: DrawingEditorTool): void;
  pointerDown(point: DrawingEditorPoint): void;
  pointerMove(point: DrawingEditorPoint): void;
  pointerUp(point: DrawingEditorPoint): void;
  cancel(): void;
  selectDrawing(id: string): void;
  selectDrawings(ids: string[]): void;
  bringSelectedForward(): void;
  sendSelectedBackward(): void;
  copySelected(): void;
  pasteCopied(offset: { dx: number; dy: number }): void;
  duplicateSelected(offset: { dx: number; dy: number }): void;
  updateSelectedStyle(style: DrawingStyle): void;
  updateSelectedText(text: string): void;
  getObjectManagerItems(): DrawingObjectManagerItem[];
  dragSelected(delta: { dx: number; dy: number }): void;
  dragAnchor(id: string, anchorIndex: number, point: DrawingEditorPoint): void;
  deleteSelected(): void;
  lockSelected(): void;
  hideSelected(): void;
  undo(): void;
  redo(): void;
  getState(): DrawingEditorState;
}

interface EditorSnapshot {
  drawings: DrawingObject[];
  selectedDrawingIds: string[];
}

export function createDrawingEditor(options: DrawingEditorOptions): DrawingEditor {
  let drawings = cloneDrawings(options.drawings);
  let selectedDrawingIds: string[] = [];
  let activeTool: DrawingEditorTool = "select";
  let pendingAnchors: DrawingAnchor[] = [];
  let nextDrawingNumber = 1;
  let clipboard: DrawingClipboard = { drawings: [] };
  const toolRegistry = options.toolRegistry ?? createBuiltInDrawingToolRegistry();
  const history = createCommandHistory<EditorSnapshot>(createSnapshot());

  const emit = (event: DrawingEditorEvent): void => {
    options.onEvent?.(event);
  };

  return {
    setTool(tool) {
      assertDrawingTool(tool, toolRegistry);
      activeTool = tool;
      pendingAnchors = [];
      emit({ type: "toolChanged", tool });
    },
    pointerDown(point) {
      if (activeTool === "select") {
        return;
      }

      pendingAnchors = [...pendingAnchors, pointToAnchor(point)];

      if (pendingAnchors.length < toolRegistry.require(activeTool).anchorCount) {
        return;
      }

      const drawing: DrawingObject = {
        id: createDrawingId(drawings, nextDrawingNumber),
        type: activeTool,
        anchors: pendingAnchors
      };

      nextDrawingNumber += 1;
      pendingAnchors = [];
      commitSnapshot(
        "createDrawing",
        { drawings: [...drawings, drawing], selectedDrawingIds: [drawing.id] },
        () => {
          emit({ type: "drawingCreated", drawing: cloneDrawing(drawing) });
          emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
        }
      );
    },
    pointerMove() {},
    pointerUp() {},
    cancel() {
      if (pendingAnchors.length > 0) {
        pendingAnchors = [];
        emit({ type: "creationCanceled" });
      }
    },
    selectDrawing(id) {
      selectedDrawingIds = drawings.some((drawing) => drawing.id === id) ? [id] : [];
      emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
    },
    selectDrawings(ids) {
      selectedDrawingIds = getExistingUniqueIds(ids);
      emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
    },
    bringSelectedForward() {
      reorderSelected("forward");
    },
    sendSelectedBackward() {
      reorderSelected("backward");
    },
    copySelected() {
      clipboard = {
        drawings: selectedDrawingIds
          .map((id) => drawings.find((drawing) => drawing.id === id))
          .filter(isDrawingObject)
          .map(cloneDrawing)
      };
    },
    pasteCopied(offset) {
      pasteDrawings(clipboard.drawings, offset, "pasteDrawing");
    },
    duplicateSelected(offset) {
      const selectedDrawings = selectedDrawingIds
        .map((id) => drawings.find((drawing) => drawing.id === id))
        .filter((drawing): drawing is DrawingObject => Boolean(drawing));

      clipboard = { drawings: selectedDrawings.map(cloneDrawing) };
      pasteDrawings(clipboard.drawings, offset, "duplicateDrawing");
    },
    updateSelectedStyle(style) {
      mutateSelected("updateDrawingStyle", (drawing) => ({
        ...drawing,
        style: { ...drawing.style, ...style }
      }));
    },
    updateSelectedText(text) {
      mutateSelected("updateDrawingText", (drawing) => ({ ...drawing, text }));
    },
    getObjectManagerItems() {
      const selectedIds = new Set(selectedDrawingIds);

      return drawings.map((drawing, index) => ({
        id: drawing.id,
        type: drawing.type,
        visible: drawing.visible !== false,
        locked: drawing.locked === true,
        selected: selectedIds.has(drawing.id),
        zIndex: index
      }));
    },
    dragSelected(delta) {
      const selectedIds = new Set(selectedDrawingIds);
      const updatedDrawings: DrawingObject[] = [];

      const nextDrawings = drawings.map((drawing) => {
        if (!selectedIds.has(drawing.id) || drawing.locked) {
          return drawing;
        }

        const updated = moveDrawing(drawing, delta.dx, delta.dy);

        updatedDrawings.push(updated);
        return updated;
      });

      if (updatedDrawings.length === 0) {
        return;
      }

      commitSnapshot(
        "moveDrawing",
        { drawings: nextDrawings, selectedDrawingIds },
        () => {
          for (const drawing of updatedDrawings) {
            emit({ type: "drawingUpdated", drawing: cloneDrawing(drawing) });
          }
        }
      );
    },
    dragAnchor(id, anchorIndex, point) {
      const drawing = drawings.find((existing) => existing.id === id);

      if (!drawing || drawing.locked || anchorIndex < 0 || anchorIndex >= drawing.anchors.length) {
        return;
      }

      const updated: DrawingObject = {
        ...drawing,
        anchors: drawing.anchors.map((anchor, index) =>
          index === anchorIndex ? { ...anchor, ...pointToAnchor(point) } : anchor
        )
      };

      commitSnapshot(
        "dragAnchor",
        {
          drawings: drawings.map((existing) => (existing.id === updated.id ? updated : existing)),
          selectedDrawingIds
        },
        () => emit({ type: "drawingUpdated", drawing: cloneDrawing(updated) })
      );
    },
    deleteSelected() {
      const selectedIds = new Set(selectedDrawingIds);
      const deletedIds = drawings
        .filter((drawing) => selectedIds.has(drawing.id) && !drawing.locked)
        .map((drawing) => drawing.id);

      if (deletedIds.length === 0) {
        return;
      }

      const nextSelectedDrawingIds = selectedDrawingIds.filter((id) => !deletedIds.includes(id));

      commitSnapshot(
        "deleteDrawing",
        {
          drawings: drawings.filter((drawing) => !selectedIds.has(drawing.id) || drawing.locked),
          selectedDrawingIds: nextSelectedDrawingIds
        },
        () => {
          for (const drawingId of deletedIds) {
            emit({ type: "drawingDeleted", drawingId });
          }
          emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
        }
      );
    },
    lockSelected() {
      mutateSelected("lockDrawing", (drawing) => ({ ...drawing, locked: true }));
    },
    hideSelected() {
      mutateSelected("hideDrawing", (drawing) => ({ ...drawing, visible: false }));
    },
    undo() {
      restoreSnapshot(history.undo());
      pendingAnchors = [];
      emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
    },
    redo() {
      restoreSnapshot(history.redo());
      pendingAnchors = [];
      emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
    },
    getState() {
      return {
        drawings: cloneDrawings(drawings),
        selectedDrawingIds: [...selectedDrawingIds],
        activeTool,
        isCreating: pendingAnchors.length > 0
      };
    }
  };

  function getExistingUniqueIds(ids: string[]): string[] {
    const existingIds = new Set(drawings.map((drawing) => drawing.id));
    const seenIds = new Set<string>();
    const nextSelectedDrawingIds: string[] = [];

    for (const id of ids) {
      if (!existingIds.has(id) || seenIds.has(id)) {
        continue;
      }

      seenIds.add(id);
      nextSelectedDrawingIds.push(id);
    }

    return nextSelectedDrawingIds;
  }

  function reorderSelected(direction: "forward" | "backward"): void {
    const selectedIds = new Set(selectedDrawingIds);
    const nextDrawings = [...drawings];
    let changed = false;

    if (direction === "forward") {
      for (let index = nextDrawings.length - 2; index >= 0; index -= 1) {
        const drawing = nextDrawings[index];
        const nextDrawing = nextDrawings[index + 1];

        if (
          selectedIds.has(drawing.id) &&
          !drawing.locked &&
          !selectedIds.has(nextDrawing.id) &&
          !nextDrawing.locked
        ) {
          nextDrawings[index] = nextDrawing;
          nextDrawings[index + 1] = drawing;
          changed = true;
        }
      }
    } else {
      for (let index = 1; index < nextDrawings.length; index += 1) {
        const drawing = nextDrawings[index];
        const previousDrawing = nextDrawings[index - 1];

        if (
          selectedIds.has(drawing.id) &&
          !drawing.locked &&
          !selectedIds.has(previousDrawing.id) &&
          !previousDrawing.locked
        ) {
          nextDrawings[index] = previousDrawing;
          nextDrawings[index - 1] = drawing;
          changed = true;
        }
      }
    }

    if (!changed) {
      return;
    }

    commitSnapshot(
      "reorderDrawing",
      { drawings: nextDrawings, selectedDrawingIds },
      () => {
        emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
      }
    );
  }

  function pasteDrawings(
    sourceDrawings: DrawingObject[],
    offset: { dx: number; dy: number },
    label: string
  ): void {
    if (sourceDrawings.length === 0) {
      return;
    }

    const nextDrawings = [...drawings];
    const pastedDrawings: DrawingObject[] = [];

    for (const sourceDrawing of sourceDrawings) {
      const id = createDrawingId(nextDrawings, nextDrawingNumber);
      nextDrawingNumber += 1;

      const pastedDrawing = moveDrawing(
        { ...cloneDrawing(sourceDrawing), id },
        offset.dx,
        offset.dy
      );

      nextDrawings.push(pastedDrawing);
      pastedDrawings.push(pastedDrawing);
    }

    commitSnapshot(
      label,
      {
        drawings: nextDrawings,
        selectedDrawingIds: pastedDrawings.map((drawing) => drawing.id)
      },
      () => {
        for (const drawing of pastedDrawings) {
          emit({ type: "drawingCreated", drawing: cloneDrawing(drawing) });
        }
        emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
      }
    );
  }

  function mutateSelected(
    label: string,
    update: (drawing: DrawingObject) => DrawingObject
  ): void {
    const selectedIds = new Set(selectedDrawingIds);
    const updatedDrawings: DrawingObject[] = [];

    const nextDrawings = drawings.map((drawing) => {
      if (!selectedIds.has(drawing.id) || drawing.locked) {
        return drawing;
      }

      const updated = update(drawing);

      updatedDrawings.push(updated);
      return updated;
    });

    if (updatedDrawings.length === 0) {
      return;
    }

    commitSnapshot(
      label,
      { drawings: nextDrawings, selectedDrawingIds },
      () => {
        for (const drawing of updatedDrawings) {
          emit({ type: "drawingUpdated", drawing: cloneDrawing(drawing) });
        }
      }
    );
  }

  function commitSnapshot(
    label: string,
    nextSnapshot: EditorSnapshot,
    afterCommit?: () => void
  ): void {
    const beforeSnapshot = createSnapshot();
    const appliedSnapshot = history.apply({
      label,
      do() {
        return cloneSnapshot(nextSnapshot);
      },
      undo() {
        return cloneSnapshot(beforeSnapshot);
      }
    });

    restoreSnapshot(appliedSnapshot);
    afterCommit?.();
  }

  function createSnapshot(): EditorSnapshot {
    return {
      drawings: cloneDrawings(drawings),
      selectedDrawingIds: [...selectedDrawingIds]
    };
  }

  function restoreSnapshot(snapshot: EditorSnapshot): void {
    drawings = cloneDrawings(snapshot.drawings);
    selectedDrawingIds = [...snapshot.selectedDrawingIds];
  }
}

function pointToAnchor(point: DrawingEditorPoint): DrawingAnchor {
  return {
    x: point.x,
    y: point.y,
    time: point.time,
    price: point.price
  };
}

function moveDrawing(drawing: DrawingObject, dx: number, dy: number): DrawingObject {
  return {
    ...drawing,
    anchors: drawing.anchors.map((anchor) => ({
      ...anchor,
      x: typeof anchor.x === "number" ? anchor.x + dx : anchor.x,
      y: typeof anchor.y === "number" ? anchor.y + dy : anchor.y
    }))
  };
}

function createDrawingId(drawings: DrawingObject[], nextDrawingNumber: number): string {
  const existingIds = new Set(drawings.map((drawing) => drawing.id));
  let currentNumber = nextDrawingNumber;

  while (existingIds.has(`drawing-${currentNumber}`)) {
    currentNumber += 1;
  }

  return `drawing-${currentNumber}`;
}

function cloneDrawings(drawings: DrawingObject[]): DrawingObject[] {
  return drawings.map(cloneDrawing);
}

function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    drawings: cloneDrawings(snapshot.drawings),
    selectedDrawingIds: [...snapshot.selectedDrawingIds]
  };
}

function cloneDrawing(drawing: DrawingObject): DrawingObject {
  return JSON.parse(JSON.stringify(drawing)) as DrawingObject;
}

function isDrawingObject(drawing: DrawingObject | undefined): drawing is DrawingObject {
  return drawing !== undefined;
}

function createBuiltInDrawingToolRegistry(): DrawingToolRegistry {
  const registry = createDrawingToolRegistry();

  for (const definition of builtInDrawingToolDefinitions) {
    registry.register(definition);
  }

  return registry;
}

function assertDrawingTool(tool: DrawingEditorTool, registry: DrawingToolRegistry): void {
  if (tool === "select") {
    return;
  }

  registry.require(tool);
}
