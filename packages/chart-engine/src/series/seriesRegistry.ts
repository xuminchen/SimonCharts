import type { SeriesRenderer, SeriesType } from "./seriesTypes";

export interface SeriesRendererRegistry {
  register(renderer: SeriesRenderer): void;
  unregister(type: SeriesType): SeriesRenderer | undefined;
  get(type: SeriesType): SeriesRenderer | undefined;
  require(type: SeriesType): SeriesRenderer;
  list(): SeriesRenderer[];
}

export function createSeriesRendererRegistry(): SeriesRendererRegistry {
  const renderers = new Map<SeriesType, SeriesRenderer>();

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
        throw new Error(`Series renderer is not registered: ${type}`);
      }

      return renderer;
    },
    list() {
      return [...renderers.values()];
    }
  };
}
