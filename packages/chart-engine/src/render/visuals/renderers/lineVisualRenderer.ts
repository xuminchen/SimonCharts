import {
  createTimeIndex,
  createVisualRenderer,
  getAutoscaleFromIndicatorPoints,
  getPaddedRange,
  getVisibleIndicatorPoint,
  withPanelPlotClip,
  xForVisualIndex,
  yForVisualValue
} from "./visualRendererHelpers";

export function createLineVisualRenderer() {
  return createVisualRenderer(
    "line",
    (renderContext) => {
      const output = renderContext.output;

      if (output.type !== "line") {
        return;
      }

      const range = getAutoscaleFromIndicatorPoints(output.values);

      if (!range) {
        return;
      }

      const renderRange = getPaddedRange(range);
      const indexByTime = createTimeIndex(renderContext.state.series);
      const { context, state } = renderContext;

      withPanelPlotClip(renderContext, () => {
        context.strokeStyle = output.color ?? state.theme.colors.text;
        context.lineWidth = output.lineWidth ?? state.theme.lineWidths.indicator;

        let hasOpenPath = false;
        let hasSegment = false;

        for (const point of output.values) {
          const visiblePoint = getVisibleIndicatorPoint(renderContext, indexByTime, point);

          if (!visiblePoint) {
            if (hasSegment) {
              context.stroke();
            }
            hasOpenPath = false;
            hasSegment = false;
            continue;
          }

          const x = xForVisualIndex(renderContext, visiblePoint.index);
          const y = yForVisualValue(renderContext, renderRange, visiblePoint.value);

          if (!hasOpenPath) {
            context.beginPath();
            context.moveTo(x, y);
            hasOpenPath = true;
            continue;
          }

          context.lineTo(x, y);
          hasSegment = true;
        }

        if (hasSegment) {
          context.stroke();
        }
      });
    },
    (output) => (output.type === "line" ? getAutoscaleFromIndicatorPoints(output.values) : undefined)
  );
}
