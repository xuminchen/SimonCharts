import type { DrawingRenderer } from "../../../drawing/drawingRegistry";
import type { DrawingType } from "../../../drawing/drawingTypes";
import { createDrawingRenderer, drawLine, getAnchorPoints } from "./drawingRendererHelpers";

export function createFibonacciDrawingRenderers(): DrawingRenderer[] {
  return fibonacciDrawingTypes.map((type) =>
    createDrawingRenderer(type, (context, drawing) => {
      const points = getAnchorPoints(drawing);
      const first = points[0];
      const second = points[1];

      if (!first || !second) {
        return;
      }

      const levels = type === "fibonacciExtension" ? extensionLevels : retracementLevels;
      const minX = Math.min(first.x, second.x);
      const maxX = Math.max(first.x, second.x);
      const spanY = second.y - first.y;

      for (const level of levels) {
        const y = first.y + spanY * level;

        drawLine(context, { x: minX, y }, { x: maxX, y });
      }
    })
  );
}

const fibonacciDrawingTypes: DrawingType[] = ["fibonacciRetracement", "fibonacciExtension"];
const retracementLevels = [0, 0.382, 0.5, 0.618, 1];
const extensionLevels = [0, 0.618, 1, 1.272, 1.618];
