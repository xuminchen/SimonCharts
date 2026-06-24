import type { DrawingObject, DrawingType } from "./drawingTypes";

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
  | { type: "deleteSelected" }
  | { type: "lockSelected" }
  | { type: "hideSelected" };
