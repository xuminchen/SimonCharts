import type { ChartCrosshairState } from "../model/runtime";

export interface InteractionPoint {
  x: number;
  y: number;
  time?: number;
  price?: number;
  index?: number;
}

export type PointerMode = "idle" | "hover" | "dragPan" | "drawing" | "resize" | "canceled";
export type ActivePointerMode = Extract<PointerMode, "dragPan" | "drawing" | "resize">;
export type CursorMode = "default" | "crosshair" | "grab" | "grabbing" | "drawing" | "resize";
export type MagnetMode = "off" | "ohlc" | "drawingAnchor" | "visualPoint";
export type TooltipSourceType = "series" | "visual" | "drawing";

export interface PointerSessionState {
  mode: PointerMode;
  point?: InteractionPoint;
  startPoint?: InteractionPoint;
}

export interface TooltipSessionState {
  visible: boolean;
  sourceType?: TooltipSourceType;
  rows?: { label: string; value: string }[];
}

export interface MagnetTarget {
  id: string;
  mode: Exclude<MagnetMode, "off">;
  point: InteractionPoint;
  distance: number;
}

export interface MagnetSessionState {
  mode: MagnetMode;
  target?: MagnetTarget;
}

export interface KeyboardSessionState {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  lastKey?: string;
}

export interface InteractionSessionState {
  pointer: PointerSessionState;
  crosshair: { visible: false } | ({ visible: true } & ChartCrosshairState);
  tooltip: TooltipSessionState;
  cursor: CursorMode;
  magnet: MagnetSessionState;
  keyboard: KeyboardSessionState;
}

export type InteractionInput =
  | { type: "pointerMove"; point: InteractionPoint }
  | { type: "pointerDown"; point: InteractionPoint; mode?: ActivePointerMode }
  | { type: "pointerDrag"; point: InteractionPoint }
  | { type: "pointerUp"; point: InteractionPoint }
  | { type: "pointerCancel" }
  | { type: "wheel"; point: InteractionPoint; deltaY: number }
  | {
      type: "keyboardDown";
      key: string;
      altKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
      shiftKey?: boolean;
    }
  | {
      type: "keyboardUp";
      key: string;
      altKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
      shiftKey?: boolean;
    }
  | { type: "crosshair"; crosshair: ChartCrosshairState | undefined }
  | { type: "tooltip"; tooltip: TooltipSessionState }
  | { type: "magnet"; magnet: MagnetSessionState }
  | { type: "leave" }
  | { type: "blur" };

export type InteractionSessionEvent =
  | { type: "pointerMoved"; point: InteractionPoint }
  | { type: "pointerDragStarted"; point: InteractionPoint }
  | { type: "pointerDragged"; point: InteractionPoint; startPoint: InteractionPoint }
  | { type: "pointerDragEnded"; point: InteractionPoint }
  | { type: "wheelZoomed"; point: InteractionPoint; deltaY: number }
  | { type: "crosshairChanged"; crosshair: InteractionSessionState["crosshair"] }
  | { type: "tooltipChanged"; tooltip: TooltipSessionState }
  | { type: "cursorChanged"; cursor: CursorMode }
  | { type: "magnetTargetChanged"; magnet: MagnetSessionState }
  | { type: "keyboardCommand"; command: "zoomIn" | "zoomOut" | "resetZoom"; key: string };

export interface InteractionSessionOptions {
  onEvent?: (event: InteractionSessionEvent) => void;
}

export interface InteractionSession {
  handleInput(input: InteractionInput): void;
  getState(): InteractionSessionState;
  destroy(): void;
}

export const defaultInteractionSessionState: InteractionSessionState = Object.freeze({
  pointer: Object.freeze({ mode: "idle" as const }),
  crosshair: Object.freeze({ visible: false as const }),
  tooltip: Object.freeze({ visible: false }),
  cursor: "default",
  magnet: Object.freeze({ mode: "off" as const }),
  keyboard: Object.freeze({
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false
  })
});
