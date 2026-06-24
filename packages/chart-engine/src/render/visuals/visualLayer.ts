import type { IndicatorVisualOutput } from "../../model/visual";
import type { PanelArea } from "../../panels/panelTypes";
import { mergeVisualAutoscaleRanges } from "../../visuals/visualAutoscale";
import type { VisualAutoscaleRange, VisualRenderer } from "../../visuals/visualTypes";
import type { VisualRendererRegistry } from "../../visuals/visualRegistry";
import type { ChartLayer, LayerRenderContext } from "../renderTypes";

interface RoutedVisualOutput {
  output: IndicatorVisualOutput;
  panel: PanelArea;
  renderer: VisualRenderer;
}

export function createVisualLayer(registry: VisualRendererRegistry): ChartLayer {
  return {
    id: "visuals",
    render(context) {
      const routedOutputs = routeVisualOutputs(context, registry);
      const rangeByPanelId = createPanelValueRanges(routedOutputs);

      for (const routedOutput of routedOutputs) {
        routedOutput.renderer.render({
          ...context,
          output: routedOutput.output,
          panel: routedOutput.panel,
          valueRange: rangeByPanelId.get(routedOutput.panel.id)
        });
      }
    }
  };
}

function routeVisualOutputs(
  context: LayerRenderContext,
  registry: VisualRendererRegistry
): RoutedVisualOutput[] {
  const outputs = context.state.visualOutputs ?? [];
  const panels = context.state.panels ?? [];
  const routedOutputs: RoutedVisualOutput[] = [];

  for (const output of outputs) {
    if (output.visible === false) {
      continue;
    }

    const panel = resolveVisualOutputPanel(output, panels);

    if (!panel) {
      continue;
    }

    routedOutputs.push({
      output,
      panel,
      renderer: registry.require(output.type)
    });
  }

  return routedOutputs;
}

function createPanelValueRanges(
  routedOutputs: RoutedVisualOutput[]
): Map<string, VisualAutoscaleRange | undefined> {
  const rangesByPanelId = new Map<string, Array<VisualAutoscaleRange | undefined>>();

  for (const routedOutput of routedOutputs) {
    const panelRanges = rangesByPanelId.get(routedOutput.panel.id) ?? [];

    panelRanges.push(routedOutput.renderer.getAutoscale(routedOutput.output));
    rangesByPanelId.set(routedOutput.panel.id, panelRanges);
  }

  return new Map(
    [...rangesByPanelId.entries()].map(([panelId, ranges]) => [
      panelId,
      mergeVisualAutoscaleRanges(ranges)
    ])
  );
}

function resolveVisualOutputPanel(
  output: IndicatorVisualOutput,
  panels: PanelArea[]
): PanelArea | undefined {
  if (output.panelId) {
    return panels.find((panel) => panel.id === output.panelId);
  }

  return panels.find((panel) => panel.kind === "main") ?? panels[0];
}
