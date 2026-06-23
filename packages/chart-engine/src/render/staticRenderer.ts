import { createAxisLayer } from "./layers/axisLayer";
import { createCrosshairLayer } from "./layers/crosshairLayer";
import { createGridLayer } from "./layers/gridLayer";
import { createMovingAverageLayer } from "./layers/movingAverageLayer";
import { createTooltipLayer } from "./layers/tooltipLayer";
import { createVolumeLayer } from "./layers/volumeLayer";
import { createSeriesLayer } from "./series/seriesLayer";
import { createDefaultSeriesRendererRegistry } from "./series/renderers/defaultSeriesRenderers";
import type { ChartLayer, LayerRenderContext } from "./renderTypes";

const defaultSeriesRegistry = createDefaultSeriesRendererRegistry();

export function createStaticLayers(): ChartLayer[] {
  return [
    createGridLayer(),
    createAxisLayer(),
    createSeriesLayer(defaultSeriesRegistry),
    createVolumeLayer(),
    createMovingAverageLayer()
  ];
}

export function createOverlayLayers(): ChartLayer[] {
  return [createCrosshairLayer(), createTooltipLayer()];
}

export function renderStaticChart(
  context: LayerRenderContext,
  layers: ChartLayer[] = createStaticLayers()
): void {
  for (const layer of layers) {
    layer.render(context);
  }
}

export function renderOverlay(
  context: LayerRenderContext,
  layers: ChartLayer[] = createOverlayLayers()
): void {
  context.context.clearRect(0, 0, context.state.layout.width, context.state.layout.height);

  for (const layer of layers) {
    layer.render(context);
  }
}
