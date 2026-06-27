import type { DrawingSelectionBounds } from "./drawingInteraction";
import type { DrawingResizeOptions, DrawingRotateOptions } from "./drawingTransform";
import type { DrawingObject, DrawingStyle, DrawingType } from "./drawingTypes";

export type DrawingEditorTool = DrawingType | "select";

export type DrawingEditorEvent =
  | { type: "toolChanged"; tool: DrawingEditorTool }
  | { type: "selectionChanged"; selectedDrawingIds: string[] }
  | { type: "drawingCreated"; drawing: DrawingObject }
  | { type: "drawingUpdated"; drawing: DrawingObject }
  | { type: "drawingDeleted"; drawingId: string }
  | { type: "creationCanceled" };

export type DrawingEditorCommand =
  | { type: "setTool"; tool: DrawingEditorTool }
  | { type: "selectDrawing"; drawingId: string }
  | { type: "selectDrawings"; drawingIds: string[] }
  | { type: "selectDrawingsInBounds"; bounds: DrawingSelectionBounds; additive?: boolean }
  | {
      type: "dragAnchor";
      drawingId: string;
      anchorIndex: number;
      point: { x: number; y: number; time?: number; price?: number };
    }
  | { type: "bringSelectedForward" }
  | { type: "sendSelectedBackward" }
  | { type: "copySelected" }
  | { type: "pasteCopied"; offset: { dx: number; dy: number } }
  | { type: "duplicateSelected"; offset: { dx: number; dy: number } }
  | { type: "nudgeSelected"; delta: { dx: number; dy: number } }
  | { type: "resizeSelected"; options: DrawingResizeOptions }
  | { type: "rotateSelected"; options: DrawingRotateOptions }
  | { type: "updateSelectedStyle"; style: DrawingStyle }
  | { type: "updateSelectedMetadata"; metadata: Record<string, unknown> }
  | { type: "updateSelectedText"; text: string }
  | { type: "cancelCreation" }
  | { type: "deleteSelected" }
  | { type: "lockSelected" }
  | { type: "unlockSelected" }
  | { type: "hideSelected" }
  | { type: "showSelected" };
