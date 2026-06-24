import type { DrawingEditorEvent, DrawingEditorTool } from "./drawingCommands";
import { drawingTypes, type DrawingAnchor, type DrawingObject, type DrawingType } from "./drawingTypes";

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
}

export interface DrawingEditor {
  setTool(tool: DrawingEditorTool): void;
  pointerDown(point: DrawingEditorPoint): void;
  pointerMove(point: DrawingEditorPoint): void;
  pointerUp(point: DrawingEditorPoint): void;
  cancel(): void;
  selectDrawing(id: string): void;
  dragSelected(delta: { dx: number; dy: number }): void;
  dragAnchor(id: string, anchorIndex: number, point: DrawingEditorPoint): void;
  deleteSelected(): void;
  lockSelected(): void;
  hideSelected(): void;
  getState(): DrawingEditorState;
}

export function createDrawingEditor(options: DrawingEditorOptions): DrawingEditor {
  let drawings = cloneDrawings(options.drawings);
  let selectedDrawingIds: string[] = [];
  let activeTool: DrawingEditorTool = "select";
  let pendingAnchors: DrawingAnchor[] = [];
  let nextDrawingNumber = 1;

  const emit = (event: DrawingEditorEvent): void => {
    options.onEvent?.(event);
  };

  const updateDrawing = (drawing: DrawingObject): void => {
    drawings = drawings.map((existing) => (existing.id === drawing.id ? cloneDrawing(drawing) : existing));
    emit({ type: "drawingUpdated", drawing: cloneDrawing(drawing) });
  };

  return {
    setTool(tool) {
      assertDrawingTool(tool);
      activeTool = tool;
      pendingAnchors = [];
      emit({ type: "toolChanged", tool });
    },
    pointerDown(point) {
      if (activeTool === "select") {
        return;
      }

      pendingAnchors = [...pendingAnchors, pointToAnchor(point)];

      if (pendingAnchors.length < getRequiredAnchorCount(activeTool)) {
        return;
      }

      const drawing: DrawingObject = {
        id: createDrawingId(drawings, nextDrawingNumber),
        type: activeTool,
        anchors: pendingAnchors
      };

      nextDrawingNumber += 1;
      drawings = [...drawings, drawing];
      selectedDrawingIds = [drawing.id];
      pendingAnchors = [];
      emit({ type: "drawingCreated", drawing: cloneDrawing(drawing) });
      emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
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
    dragSelected(delta) {
      const selectedIds = new Set(selectedDrawingIds);

      drawings = drawings.map((drawing) => {
        if (!selectedIds.has(drawing.id) || drawing.locked) {
          return drawing;
        }

        const updated = moveDrawing(drawing, delta.dx, delta.dy);

        emit({ type: "drawingUpdated", drawing: cloneDrawing(updated) });
        return updated;
      });
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

      updateDrawing(updated);
    },
    deleteSelected() {
      const selectedIds = new Set(selectedDrawingIds);
      const deletedIds = drawings
        .filter((drawing) => selectedIds.has(drawing.id) && !drawing.locked)
        .map((drawing) => drawing.id);

      drawings = drawings.filter((drawing) => !selectedIds.has(drawing.id) || drawing.locked);
      selectedDrawingIds = selectedDrawingIds.filter((id) => !deletedIds.includes(id));

      for (const drawingId of deletedIds) {
        emit({ type: "drawingDeleted", drawingId });
      }
      emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
    },
    lockSelected() {
      mutateSelected((drawing) => ({ ...drawing, locked: true }));
    },
    hideSelected() {
      mutateSelected((drawing) => ({ ...drawing, visible: false }));
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

  function mutateSelected(update: (drawing: DrawingObject) => DrawingObject): void {
    const selectedIds = new Set(selectedDrawingIds);

    drawings = drawings.map((drawing) => {
      if (!selectedIds.has(drawing.id) || drawing.locked) {
        return drawing;
      }

      const updated = update(drawing);

      emit({ type: "drawingUpdated", drawing: cloneDrawing(updated) });
      return updated;
    });
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

function getRequiredAnchorCount(type: DrawingType): number {
  if (
    type === "horizontalLine" ||
    type === "verticalLine" ||
    type === "crossLine" ||
    type === "text"
  ) {
    return 1;
  }

  if (type === "parallelChannel" || type === "regressionChannel" || type === "polygon") {
    return 3;
  }

  return 2;
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

function cloneDrawing(drawing: DrawingObject): DrawingObject {
  return JSON.parse(JSON.stringify(drawing)) as DrawingObject;
}

function assertDrawingTool(tool: DrawingEditorTool): void {
  if (tool !== "select" && !drawingTypes.includes(tool)) {
    throw new Error(`Unsupported drawing tool: ${String(tool)}`);
  }
}
