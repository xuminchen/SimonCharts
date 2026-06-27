import type { FigureRenderer, FigureType } from "./figureTypes";

export interface FigureRendererRegistry {
  register(renderer: FigureRenderer): void;
  unregister(type: FigureType): FigureRenderer | undefined;
  get(type: FigureType): FigureRenderer | undefined;
  require(type: FigureType): FigureRenderer;
  list(): FigureRenderer[];
}

export function createFigureRendererRegistry(): FigureRendererRegistry {
  const renderers = new Map<FigureType, FigureRenderer>();

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
        throw new Error(`Figure renderer is not registered: ${type}`);
      }

      return renderer;
    },
    list() {
      return [...renderers.values()];
    }
  };
}
