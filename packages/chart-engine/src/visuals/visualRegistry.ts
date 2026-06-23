import type { VisualOutputType, VisualRenderer } from "./visualTypes";

export interface VisualRendererRegistry {
  register(type: VisualOutputType, renderer: VisualRenderer): void;
  get(type: VisualOutputType): VisualRenderer;
  has(type: VisualOutputType): boolean;
  listTypes(): VisualOutputType[];
}

export function createVisualRendererRegistry(): VisualRendererRegistry {
  const renderers = new Map<VisualOutputType, VisualRenderer>();

  return {
    register(type, renderer) {
      renderers.set(type, renderer);
    },
    get(type) {
      const renderer = renderers.get(type);

      if (!renderer) {
        throw new Error(`Visual renderer is not registered: ${type}`);
      }

      return renderer;
    },
    has(type) {
      return renderers.has(type);
    },
    listTypes() {
      return [...renderers.keys()];
    }
  };
}
