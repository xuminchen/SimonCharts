import type { DrawingEditHandle, DrawingEditHandleKind } from "./drawingInteraction";
import {
  hitTestDrawingEditHandle,
  type DrawingHandleHitTestOptions
} from "./drawingHandleDrag";
import {
  hitTestDrawing,
  type DrawingHitTestOptions,
  type DrawingPoint
} from "./drawingHitTest";
import type { DrawingRendererRegistry } from "./drawingRegistry";
import type { DrawingObject } from "./drawingTypes";

export type DrawingHoverCursor = "crosshair" | "drawing" | "resize";

export type DrawingHoverTarget =
  | {
      kind: "handle";
      drawingId: string;
      handleId: string;
      handleKind: DrawingEditHandleKind;
    }
  | {
      kind: "body";
      drawingId: string;
    };

export interface DrawingHoverState {
  target?: DrawingHoverTarget;
  hoveredDrawingId?: string;
  cursor: DrawingHoverCursor;
}

export interface DrawingHoverStateOptions {
  drawings: DrawingObject[];
  point: DrawingPoint;
  handles: DrawingEditHandle[];
  registry: DrawingRendererRegistry;
  activeTarget?: DrawingHoverTarget;
  handleHitTestOptions?: DrawingHandleHitTestOptions;
  bodyHitTestOptions?: Omit<DrawingHitTestOptions, "registry">;
}

export function getDrawingHoverState(options: DrawingHoverStateOptions): DrawingHoverState {
  if (options.activeTarget) {
    return createStateForTarget(options.activeTarget);
  }

  const handle = hitTestDrawingEditHandle(
    options.handles,
    options.point,
    options.handleHitTestOptions
  );

  if (handle) {
    return createStateForTarget({
      kind: "handle",
      drawingId: handle.drawingId,
      handleId: handle.id,
      handleKind: handle.kind
    });
  }

  const body = hitTestDrawing(options.drawings, options.point, {
    registry: options.registry,
    ...options.bodyHitTestOptions
  });

  if (body) {
    return createStateForTarget({
      kind: "body",
      drawingId: body.drawing.id
    });
  }

  return { cursor: "crosshair" };
}

function createStateForTarget(target: DrawingHoverTarget): DrawingHoverState {
  return {
    target,
    hoveredDrawingId: target.drawingId,
    cursor: target.kind === "handle" && target.handleKind === "resize" ? "resize" : "drawing"
  };
}
