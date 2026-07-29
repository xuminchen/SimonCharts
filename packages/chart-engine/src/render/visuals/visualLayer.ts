import type { IndicatorVisualOutput } from "../../model/visual";
import type { PanelArea } from "../../panels/panelTypes";
import { mergeVisualAutoscaleRanges } from "../../visuals/visualAutoscale";
import type { VisualAutoscaleRange, VisualRenderer } from "../../visuals/visualTypes";
import type { VisualRendererRegistry } from "../../visuals/visualRegistry";
import { createPriceScaleFromBounds, type PriceScale } from "../../viewport/priceScale";
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
      const valueScaleByPanelId = createPanelValueScales(
        routedOutputs,
        rangeByPanelId,
        context.state.priceScale,
        context.state.panelPriceScales
      );

      for (const routedOutput of routedOutputs) {
        const valueRange = rangeByPanelId.get(routedOutput.panel.id);
        const sharedScale = valueScaleByPanelId.get(routedOutput.panel.id)!;
        const valueScale =
          routedOutput.output.coordinateSpace === "percentage" &&
          routedOutput.panel.kind === "main" &&
          sharedScale.mode === "percentage"
            ? {
                ...sharedScale,
                mode: "linear" as const,
                basePrice: 1
              }
            : sharedScale;

        routedOutput.renderer.render({
          ...context,
          output: routedOutput.output,
          panel: routedOutput.panel,
          valueScale,
          valueRange
        });
      }
    }
  };
}

function createPanelValueScales(
  routedOutputs: RoutedVisualOutput[],
  rangeByPanelId: Map<string, VisualAutoscaleRange | undefined>,
  mainPriceScale: PriceScale,
  configuredScales?: ReadonlyMap<string, PriceScale>
): Map<string, PriceScale> {
  const valueScaleByPanelId = new Map<string, PriceScale>();

  for (const routedOutput of routedOutputs) {
    if (valueScaleByPanelId.has(routedOutput.panel.id)) {
      continue;
    }

    valueScaleByPanelId.set(
      routedOutput.panel.id,
      configuredScales?.get(routedOutput.panel.id) ??
      (routedOutput.panel.kind === "main"
        ? mainPriceScale
        : createLinearValueScale(rangeByPanelId.get(routedOutput.panel.id)))
    );
  }

  return valueScaleByPanelId;
}

function createLinearValueScale(range: VisualAutoscaleRange | undefined): PriceScale {
  return createPriceScaleFromBounds(range ?? { min: 0, max: 1 }, 1, "linear");
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
