import type { DrawingEditorCommand } from "./drawingCommands";
import type { DrawingTransformPoint } from "./drawingTransform";
import type { DrawingObject } from "./drawingTypes";

export type DrawingMoveDragCommand = Extract<DrawingEditorCommand, { type: "dragSelected" }>;

export interface DrawingMoveDragOptions {
  drawings: DrawingObject[];
  selectedDrawingIds: string[];
  startPoint: DrawingTransformPoint;
}

export interface DrawingMoveDragOperation {
  drawings: DrawingObject[];
  selectedDrawingIds: string[];
  startPoint: DrawingTransformPoint;
}

export interface DrawingMoveDragPreview {
  drawings: DrawingObject[];
  command: DrawingMoveDragCommand;
}

export function beginDrawingMoveDrag(
  options: DrawingMoveDragOptions
): DrawingMoveDragOperation | undefined {
  const selectedIds = new Set(options.selectedDrawingIds);
  const hasEditableSelectedDrawing = options.drawings.some(
    (drawing) => selectedIds.has(drawing.id) && drawing.locked !== true
  );

  if (!hasEditableSelectedDrawing) {
    return undefined;
  }

  return {
    drawings: options.drawings.map(cloneDrawing),
    selectedDrawingIds: [...options.selectedDrawingIds],
    startPoint: { ...options.startPoint }
  };
}

export function updateDrawingMoveDrag(
  operation: DrawingMoveDragOperation,
  point: DrawingTransformPoint
): DrawingMoveDragPreview | undefined {
  const command = getDrawingMoveDragCommand(operation, point);

  if (!command) {
    return undefined;
  }

  return {
    drawings: previewDrawings(operation, command.delta),
    command
  };
}

export function finishDrawingMoveDrag(
  operation: DrawingMoveDragOperation,
  point: DrawingTransformPoint
): DrawingMoveDragCommand | undefined {
  return getDrawingMoveDragCommand(operation, point);
}

export function getDrawingMoveDragCommand(
  operation: DrawingMoveDragOperation,
  point: DrawingTransformPoint
): DrawingMoveDragCommand | undefined {
  const dx = point.x - operation.startPoint.x;
  const dy = point.y - operation.startPoint.y;

  if (dx === 0 && dy === 0) {
    return undefined;
  }

  return {
    type: "dragSelected",
    delta: { dx, dy }
  };
}

function previewDrawings(
  operation: DrawingMoveDragOperation,
  delta: { dx: number; dy: number }
): DrawingObject[] {
  const selectedIds = new Set(operation.selectedDrawingIds);

  return operation.drawings.map((drawing) => {
    if (!selectedIds.has(drawing.id) || drawing.locked) {
      return cloneDrawing(drawing);
    }

    return moveDrawing(drawing, delta.dx, delta.dy);
  });
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

function cloneDrawing(drawing: DrawingObject): DrawingObject {
  return JSON.parse(JSON.stringify(drawing)) as DrawingObject;
}
