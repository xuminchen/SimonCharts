import type { DrawingRenderer } from "../../../drawing/drawingRegistry";
import type { DrawingType } from "../../../drawing/drawingTypes";
import { getDrawingFibonacciLevels } from "../../../drawing/drawingParameters";
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

      const levels = getDrawingFibonacciLevels(drawing);
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
