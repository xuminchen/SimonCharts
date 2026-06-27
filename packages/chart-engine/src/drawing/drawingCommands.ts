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
  | { type: "bringSelectedForward" }
  | { type: "sendSelectedBackward" }
  | { type: "copySelected" }
  | { type: "pasteCopied"; offset: { dx: number; dy: number } }
  | { type: "duplicateSelected"; offset: { dx: number; dy: number } }
  | { type: "updateSelectedStyle"; style: DrawingStyle }
  | { type: "updateSelectedText"; text: string }
  | { type: "cancelCreation" }
  | { type: "deleteSelected" }
  | { type: "lockSelected" }
  | { type: "unlockSelected" }
  | { type: "hideSelected" }
  | { type: "showSelected" };
