import type { VisualOutputType, VisualRenderer } from "./visualTypes";

export interface VisualRendererRegistry {
  register(renderer: VisualRenderer): void;
  get(type: VisualOutputType): VisualRenderer | undefined;
  require(type: VisualOutputType): VisualRenderer;
  list(): VisualRenderer[];
}

export function createVisualRendererRegistry(): VisualRendererRegistry {
  const renderers = new Map<VisualOutputType, VisualRenderer>();

  return {
    register(renderer) {
      renderers.set(renderer.type, renderer);
    },
    get(type) {
      return renderers.get(type);
    },
    require(type) {
      const renderer = renderers.get(type);

      if (!renderer) {
        throw new Error(`Visual renderer is not registered: ${type}`);
      }

      return renderer;
    },
    list() {
      return [...renderers.values()];
    }
  };
}
