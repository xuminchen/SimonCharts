import type { DrawingEditorCommand } from "./drawingCommands";
import {
  getDrawingSelectionBounds,
  type DrawingEditHandle,
  type DrawingEditHandleKind,
  type DrawingSelectionBounds
} from "./drawingInteraction";
import {
  resizeDrawings,
  rotateDrawings,
  type DrawingTransformPoint
} from "./drawingTransform";
import type { DrawingObject } from "./drawingTypes";

export type DrawingHandleDragKind = DrawingEditHandleKind;

export interface DrawingHandleHitTestOptions {
  radius?: number;
  kinds?: DrawingEditHandleKind[];
}

export interface DrawingHandleDragOptions {
  handle: DrawingEditHandle;
  drawings: DrawingObject[];
  selectedDrawingIds: string[];
  startPoint: DrawingTransformPoint;
  minSize?: number;
}

export interface DrawingHandleDragOperation {
  kind: DrawingHandleDragKind;
  handle: DrawingEditHandle;
  startPoint: DrawingTransformPoint;
  drawings: DrawingObject[];
  selectedDrawingIds: string[];
  selectedBounds?: DrawingSelectionBounds;
  rotationCenter?: DrawingTransformPoint;
  minSize?: number;
}

export interface DrawingHandleDragPreview {
  drawings: DrawingObject[];
  command: DrawingEditorCommand;
}

const defaultHitTestRadius = 8;

export function hitTestDrawingEditHandle(
  handles: DrawingEditHandle[],
  point: DrawingTransformPoint,
  options: DrawingHandleHitTestOptions = {}
): DrawingEditHandle | undefined {
  const radius = options.radius ?? defaultHitTestRadius;
  const allowedKinds = new Set(options.kinds ?? ["anchor", "resize", "rotate"]);

  const hit = handles
    .filter((handle) => allowedKinds.has(handle.kind))
    .map((handle) => ({
      handle,
      distance: distanceBetween(handle, point)
    }))
    .filter((hit) => hit.distance <= radius)
    .sort((left, right) => left.distance - right.distance)[0]?.handle;

  return hit ? { ...hit } : undefined;
}

export function beginDrawingHandleDrag(
  options: DrawingHandleDragOptions
): DrawingHandleDragOperation | undefined {
  const drawing = options.drawings.find((item) => item.id === options.handle.drawingId);

  if (!drawing || drawing.locked || drawing.interactive === false) {
    return undefined;
  }

  if (!options.selectedDrawingIds.includes(options.handle.drawingId)) {
    return undefined;
  }

  if (options.handle.kind === "anchor") {
    if (options.handle.anchorIndex === undefined) {
      return undefined;
    }

    return createOperation(options);
  }

  if (options.handle.kind === "resize") {
    if (!options.handle.position) {
      return undefined;
    }

    const selectedBounds = getSelectedBounds(options);

    return selectedBounds ? createOperation(options, selectedBounds) : undefined;
  }

  const selectedBounds = getSelectedBounds(options);

  if (!selectedBounds) {
    return undefined;
  }

  return createOperation(options, selectedBounds, {
    x: selectedBounds.x + selectedBounds.width / 2,
    y: selectedBounds.y + selectedBounds.height / 2
  });
}

export function updateDrawingHandleDrag(
  operation: DrawingHandleDragOperation,
  point: DrawingTransformPoint
): DrawingHandleDragPreview | undefined {
  const command = getDrawingHandleDragCommand(operation, point);

  if (!command) {
    return undefined;
  }

  return {
    command,
    drawings: previewDrawings(operation, command)
  };
}

export function finishDrawingHandleDrag(
  operation: DrawingHandleDragOperation,
  point: DrawingTransformPoint
): DrawingEditorCommand | undefined {
  return getDrawingHandleDragCommand(operation, point);
}

export function getDrawingHandleDragCommand(
  operation: DrawingHandleDragOperation,
  point: DrawingTransformPoint
): DrawingEditorCommand | undefined {
  if (operation.kind === "anchor") {
    if (operation.handle.anchorIndex === undefined) {
      return undefined;
    }

    return {
      type: "dragAnchor",
      drawingId: operation.handle.drawingId,
      anchorIndex: operation.handle.anchorIndex,
      point
    };
  }

  if (operation.kind === "resize") {
    if (!operation.handle.position || !operation.selectedBounds) {
      return undefined;
    }

    return {
      type: "resizeSelected",
      options: {
        handle: operation.handle.position,
        fromBounds: operation.selectedBounds,
        toPoint: point,
        minSize: operation.minSize
      }
    };
  }

  if (!operation.rotationCenter) {
    return undefined;
  }

  return {
    type: "rotateSelected",
    options: {
      center: operation.rotationCenter,
      angleRadians: angleBetween(operation.rotationCenter, point) -
        angleBetween(operation.rotationCenter, operation.startPoint)
    }
  };
}

function createOperation(
  options: DrawingHandleDragOptions,
  selectedBounds?: DrawingSelectionBounds,
  rotationCenter?: DrawingTransformPoint
): DrawingHandleDragOperation {
  return {
    kind: options.handle.kind,
    handle: { ...options.handle },
    startPoint: { ...options.startPoint },
    drawings: options.drawings.map(cloneDrawing),
    selectedDrawingIds: [...options.selectedDrawingIds],
    selectedBounds,
    rotationCenter,
    minSize: options.minSize
  };
}

function getSelectedBounds(options: DrawingHandleDragOptions): DrawingSelectionBounds | undefined {
  const selectedIds = new Set(options.selectedDrawingIds);
  const selectedDrawings = options.drawings.filter(
    (drawing) => selectedIds.has(drawing.id) && drawing.locked !== true
  );

  return getDrawingSelectionBounds(selectedDrawings);
}

function previewDrawings(
  operation: DrawingHandleDragOperation,
  command: DrawingEditorCommand
): DrawingObject[] {
  if (command.type === "dragAnchor") {
    return operation.drawings.map((drawing) => {
      if (drawing.id !== command.drawingId || drawing.locked) {
        return cloneDrawing(drawing);
      }

      return {
        ...drawing,
        anchors: drawing.anchors.map((anchor, index) =>
          index === command.anchorIndex ? { ...anchor, ...command.point } : { ...anchor }
        )
      };
    });
  }

  const selectedIds = new Set(operation.selectedDrawingIds);
  const selectedDrawings = operation.drawings.filter(
    (drawing) =>
      selectedIds.has(drawing.id) &&
      drawing.locked !== true &&
      drawing.interactive !== false
  );
  const transformed = new Map<string, DrawingObject>();

  if (command.type === "resizeSelected") {
    for (const drawing of resizeDrawings(selectedDrawings, command.options)) {
      transformed.set(drawing.id, drawing);
    }
  }

  if (command.type === "rotateSelected") {
    for (const drawing of rotateDrawings(selectedDrawings, command.options)) {
      transformed.set(drawing.id, drawing);
    }
  }

  return operation.drawings.map((drawing) => transformed.get(drawing.id) ?? cloneDrawing(drawing));
}

function distanceBetween(
  first: DrawingTransformPoint,
  second: DrawingTransformPoint
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function angleBetween(center: DrawingTransformPoint, point: DrawingTransformPoint): number {
  return Math.atan2(point.y - center.y, point.x - center.x);
}

function cloneDrawing(drawing: DrawingObject): DrawingObject {
  return JSON.parse(JSON.stringify(drawing)) as DrawingObject;
}
