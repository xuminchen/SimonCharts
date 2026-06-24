import type { DrawingRenderer } from "../../../drawing/drawingRegistry";
import type { DrawingType } from "../../../drawing/drawingTypes";
import { createDrawingRenderer, drawLine, getAnchorPoints } from "./drawingRendererHelpers";

export function createChannelDrawingRenderers(): DrawingRenderer[] {
  return channelDrawingTypes.map((type) =>
    createDrawingRenderer(type, (context, drawing) => {
      const points = getAnchorPoints(drawing);
      const first = points[0];
      const second = points[1];
      const third = points[2];

      if (!first || !second) {
        return;
      }

      drawLine(context, first, second);

      if (!third) {
        return;
      }

      const offsetX = third.x - first.x;
      const offsetY = third.y - first.y;

      drawLine(
        context,
        { x: first.x + offsetX, y: first.y + offsetY },
        { x: second.x + offsetX, y: second.y + offsetY }
      );
    })
  );
}

const channelDrawingTypes: DrawingType[] = ["parallelChannel", "regressionChannel"];
