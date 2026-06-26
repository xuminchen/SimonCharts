import type { DrawingStyle } from "./drawingTypes";

export function mergeDrawingStyle(
  current: DrawingStyle | undefined,
  patch: DrawingStyle
): DrawingStyle {
  return {
    ...(current ?? {}),
    ...patch
  };
}
