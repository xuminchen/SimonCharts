import type { DrawingObject } from "./drawingTypes";

export type DrawingHandleKind = "anchor" | "rotate" | "resize";

export interface DrawingGroup {
  id: string;
  name: string;
  drawingIds: string[];
}

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

export interface DrawingEditorCapabilities {
  selectedDrawingCount: number;
  editableSelectedDrawingCount: number;
  clipboardDrawingCount: number;
  pendingAnchorCount: number;
  hasSelection: boolean;
  hasEditableSelection: boolean;
  canBringSelectedForward: boolean;
  canSendSelectedBackward: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canDuplicate: boolean;
  canNudge: boolean;
  canDelete: boolean;
  canLock: boolean;
  canUnlock: boolean;
  canHide: boolean;
  canShow: boolean;
  canCancelCreation: boolean;
  canUndo: boolean;
  canRedo: boolean;
}
