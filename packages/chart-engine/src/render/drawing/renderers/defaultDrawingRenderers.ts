import { createDrawingRendererRegistry } from "../../../drawing/drawingRegistry";
import type { DrawingRendererRegistry } from "../../../drawing/drawingRegistry";
import { createChannelDrawingRenderers } from "./channelDrawingRenderer";
import { createFibonacciDrawingRenderers } from "./fibonacciDrawingRenderer";
import { createLineDrawingRenderers } from "./lineDrawingRenderer";
import { createPathDrawingRenderers } from "./pathDrawingRenderer";
import { createPositionDrawingRenderers } from "./positionDrawingRenderer";
import { createRangeDrawingRenderers } from "./rangeDrawingRenderer";
import { createShapeDrawingRenderers } from "./shapeDrawingRenderer";
import { createTextDrawingRenderers } from "./textDrawingRenderer";

export function createDefaultDrawingRendererRegistry(): DrawingRendererRegistry {
  const registry = createDrawingRendererRegistry();
  const renderers = [
    ...createLineDrawingRenderers(),
    ...createChannelDrawingRenderers(),
    ...createFibonacciDrawingRenderers(),
    ...createTextDrawingRenderers(),
    ...createShapeDrawingRenderers(),
    ...createPathDrawingRenderers(),
    ...createPositionDrawingRenderers(),
    ...createRangeDrawingRenderers()
  ];

  for (const renderer of renderers) {
    registry.register(renderer);
  }

  return registry;
}
