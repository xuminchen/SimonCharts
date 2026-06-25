import type { FigureRenderer, FigureType } from "./figureTypes";

export interface FigureRendererRegistry {
  register(renderer: FigureRenderer): void;
  require(type: FigureType): FigureRenderer;
  list(): FigureRenderer[];
}

export function createFigureRendererRegistry(): FigureRendererRegistry {
  const renderers = new Map<FigureType, FigureRenderer>();

  return {
    register(renderer) {
      renderers.set(renderer.type, renderer);
    },
    require(type) {
      const renderer = renderers.get(type);

      if (!renderer) {
        throw new Error(`Figure renderer is not registered: ${type}`);
      }

      return renderer;
    },
    list() {
      return [...renderers.values()];
    }
  };
}
