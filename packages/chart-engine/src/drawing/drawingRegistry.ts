import type { DrawingObject, DrawingType } from "./drawingTypes";

export interface DrawingRenderContext {
  drawing: DrawingObject;
  context: CanvasRenderingContext2D;
}

export interface DrawingHitTestResult {
  drawingId: string;
  distance: number;
}

export interface DrawingRenderer {
  type: DrawingType;
  render(context: DrawingRenderContext): void;
  hitTest(drawing: DrawingObject, point: { x: number; y: number }): DrawingHitTestResult | undefined;
}

export interface DrawingRendererRegistry {
  register(renderer: DrawingRenderer): void;
  unregister(type: DrawingType): DrawingRenderer | undefined;
  get(type: DrawingType): DrawingRenderer | undefined;
  require(type: DrawingType): DrawingRenderer;
  list(): DrawingRenderer[];
}

export function createDrawingRendererRegistry(): DrawingRendererRegistry {
  const renderers = new Map<DrawingType, DrawingRenderer>();

  return {
    register(renderer) {
      renderers.set(renderer.type, renderer);
    },
    unregister(type) {
      const renderer = renderers.get(type);

      renderers.delete(type);

      return renderer;
    },
    get(type) {
      return renderers.get(type);
    },
    require(type) {
      const renderer = renderers.get(type);

      if (!renderer) {
        throw new Error(`Drawing renderer is not registered: ${type}`);
      }

      return renderer;
    },
    list() {
      return [...renderers.values()];
    }
  };
}
