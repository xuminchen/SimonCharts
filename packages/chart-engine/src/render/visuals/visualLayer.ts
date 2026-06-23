import type { VisualRendererRegistry } from "../../visuals/visualRegistry";
import type { ChartLayer } from "../renderTypes";

export function createVisualLayer(registry: VisualRendererRegistry): ChartLayer {
  return {
    id: "visuals",
    render(context) {
      const outputs = context.state.visualOutputs ?? [];
      const panels = context.state.panels ?? [];
      const panel = panels.find((area) => area.kind === "main") ?? panels[0];

      if (!panel) {
        return;
      }

      for (const output of outputs) {
        registry.require(output.type).render({
          ...context,
          output,
          panel
        });
      }
    }
  };
}
