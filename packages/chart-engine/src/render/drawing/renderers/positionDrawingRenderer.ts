import type { DrawingRenderer } from "../../../drawing/drawingRegistry";
import type { DrawingType } from "../../../drawing/drawingTypes";
import { getDrawingParameterLabel } from "../../../drawing/drawingParameters";
import { createDrawingRenderer, drawRectFromPoints, drawText, getAnchorPoints } from "./drawingRendererHelpers";

export function createPositionDrawingRenderers(): DrawingRenderer[] {
  return positionDrawingTypes.map((type) =>
    createDrawingRenderer(type, (context, drawing) => {
      const points = getAnchorPoints(drawing);
      const first = points[0];
      const second = points[1] ?? first;

      if (!first) {
        return;
      }

      context.fillStyle =
        drawing.style?.fill ?? (type === "longPosition" ? "rgba(22, 163, 74, 0.14)" : "rgba(220, 38, 38, 0.14)");
      drawRectFromPoints(context, first, second, true);
      drawText(
        context,
        { ...drawing, text: getDrawingParameterLabel(drawing, "positionLabel", type === "longPosition" ? "Long" : "Short") },
        first
      );
    })
  );
}

const positionDrawingTypes: DrawingType[] = ["longPosition", "shortPosition"];
