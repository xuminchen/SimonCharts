import type { DrawingObject } from "./drawingTypes";

export type DrawingHandleKind = "anchor" | "rotate" | "resize";

export interface DrawingActiveHandle {
  drawingId: string;
  kind: DrawingHandleKind;
  anchorIndex?: number;
}

export interface DrawingObjectManagerItem {
  id: string;
  type: DrawingObject["type"];
  visible: boolean;
  locked: boolean;
  selected: boolean;
  zIndex: number;
}

export interface DrawingClipboard {
  drawings: DrawingObject[];
}
