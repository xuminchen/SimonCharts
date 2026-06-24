import {
  createTimeIndex,
  createVisualRenderer,
  getAutoscaleFromValues,
  getNearestVisualHit,
  getVisualRenderRange,
  isFiniteNumber,
  isVisibleIndex,
  withPanelPlotClip,
  xForVisualIndex,
  yForVisualValue
} from "./visualRendererHelpers";

export function createHistogramVisualRenderer() {
  return createVisualRenderer(
    "histogram",
    (renderContext) => {
      const output = renderContext.output;

      if (output.type !== "histogram") {
        return;
      }

      const range = getAutoscaleFromValues(output.values.map((point) => point.value));

      if (!range) {
        return;
      }

      const renderRange = getVisualRenderRange(renderContext, range);
      const baselineValue =
        range.min <= 0 && range.max >= 0 ? 0 : range.min > 0 ? range.min : range.max;
      const baselineY = yForVisualValue(renderContext, renderRange, baselineValue);
      const indexByTime = createTimeIndex(renderContext.state.series);
      const barWidth = Math.max(1, renderContext.state.viewport.candleWidth * 0.7);
      const { context, state } = renderContext;

      withPanelPlotClip(renderContext, () => {
        for (const point of output.values) {
          if (!isFiniteNumber(point.value)) {
            continue;
          }

          const index = indexByTime.get(point.time);

          if (index === undefined || !isVisibleIndex(renderContext, index)) {
            continue;
          }

          const valueY = yForVisualValue(renderContext, renderRange, point.value);
          const top = Math.min(valueY, baselineY);
          const height = Math.max(1, Math.abs(baselineY - valueY));

          context.fillStyle = point.color ?? state.theme.colors.volume;
          context.fillRect(xForVisualIndex(renderContext, index) - barWidth / 2, top, barWidth, height);
        }
      });
    },
    (output) =>
      output.type === "histogram"
        ? getAutoscaleFromValues(output.values.map((point) => point.value))
        : undefined,
    (hitContext, x, y) => {
      const output = hitContext.output;

      if (output.type !== "histogram") {
        return undefined;
      }

      const range = getAutoscaleFromValues(output.values.map((point) => point.value));

      if (!range) {
        return undefined;
      }

      const renderRange = getVisualRenderRange(hitContext, range);
      const indexByTime = createTimeIndex(hitContext.state.series);
      const candidates = output.values.flatMap((point) => {
        if (!isFiniteNumber(point.value)) {
          return [];
        }

        const index = indexByTime.get(point.time);

        if (index === undefined || !isVisibleIndex(hitContext, index)) {
          return [];
        }

        return [
          {
            time: point.time,
            value: point.value,
            x: xForVisualIndex(hitContext, index),
            y: yForVisualValue(hitContext, renderRange, point.value)
          }
        ];
      });

      return getNearestVisualHit(output, x, y, candidates);
    }
  );
}
