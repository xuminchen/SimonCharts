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

export interface RenderCanvasClearOptions {
  clear?: boolean;
  paintBackground?: boolean;
}

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
  layers: ChartLayer[] = createStaticLayers(),
  options: RenderCanvasClearOptions = { clear: false }
): void {
  clearCanvas(context, options);

  for (const layer of layers) {
    layer.render(context);
  }
}

export function renderOverlay(
  context: LayerRenderContext,
  layers: ChartLayer[] = createOverlayLayers(),
  options: RenderCanvasClearOptions = { clear: true }
): void {
  clearCanvas(context, options);

  for (const layer of layers) {
    layer.render(context);
  }
}

function clearCanvas(context: LayerRenderContext, options: RenderCanvasClearOptions): void {
  if (options.clear !== true && options.paintBackground !== true) {
    return;
  }

  context.context.clearRect(0, 0, context.state.layout.width, context.state.layout.height);

  if (options.paintBackground === true) {
    context.context.fillStyle = context.state.theme.colors.background;
    context.context.fillRect(0, 0, context.state.layout.width, context.state.layout.height);
  }
}
