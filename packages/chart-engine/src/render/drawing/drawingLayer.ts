import type { DrawingObject } from "../../drawing/drawingTypes";
import type { DrawingRendererRegistry } from "../../drawing/drawingRegistry";
import type { ChartLayer, LayerRenderContext } from "../renderTypes";

const handleRadius = 4;

export function createDrawingLayer(registry: DrawingRendererRegistry): ChartLayer {
  return {
    id: "drawings",
    render(context) {
      const drawings = context.state.drawings ?? [];
      const selectedIds = new Set(context.state.selectedDrawingIds ?? []);

      for (const drawing of drawings) {
        if (drawing.visible === false) {
          continue;
        }

        registry.require(drawing.type).render({
          context: context.context,
          drawing
        });

        if (
          drawing.interactive !== false &&
          (selectedIds.has(drawing.id) || context.state.hoveredDrawingId === drawing.id)
        ) {
          renderDrawingHandles(context, drawing);
        }
      }
    }
  };
}

function renderDrawingHandles(context: LayerRenderContext, drawing: DrawingObject): void {
  const canvas = context.context;

  canvas.save();
  try {
    canvas.fillStyle = drawing.style?.color ?? context.state.theme.colors.text;

    for (const anchor of drawing.anchors) {
      if (
        typeof anchor.x !== "number" ||
        typeof anchor.y !== "number" ||
        !Number.isFinite(anchor.x) ||
        !Number.isFinite(anchor.y)
      ) {
        continue;
      }

      canvas.beginPath();
      canvas.arc(anchor.x, anchor.y, handleRadius, 0, Math.PI * 2);
      canvas.fill();
    }
  } finally {
    canvas.restore();
  }
}
