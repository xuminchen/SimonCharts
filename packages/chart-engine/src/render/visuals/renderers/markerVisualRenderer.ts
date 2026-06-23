import type { ChartMark } from "../../../model/visual";
import {
  createTimeIndex,
  createVisualRenderer,
  getAutoscaleFromValues,
  getPaddedRange,
  isFiniteNumber,
  isVisibleIndex,
  withPanelPlotClip,
  xForVisualIndex,
  yForVisualValue
} from "./visualRendererHelpers";

const markerRadius = 4;

export function createMarkerVisualRenderer() {
  return createVisualRenderer(
    "marker",
    (renderContext) => {
      const output = renderContext.output;

      if (output.type !== "marker") {
        return;
      }

      const range = getAutoscaleFromValues(output.marks.map((mark) => mark.price));

      if (!range) {
        return;
      }

      const renderRange = getPaddedRange(range);
      const indexByTime = createTimeIndex(renderContext.state.series);
      const { context, state } = renderContext;

      withPanelPlotClip(renderContext, () => {
        for (const mark of output.marks) {
          if (!isFiniteNumber(mark.price)) {
            continue;
          }

          const index = getMarkIndex(mark, indexByTime);

          if (index === undefined || !isVisibleIndex(renderContext, index)) {
            continue;
          }

          context.fillStyle = mark.color ?? state.theme.colors.text;
          context.beginPath();
          context.arc(
            xForVisualIndex(renderContext, index),
            yForVisualValue(renderContext, renderRange, mark.price),
            markerRadius,
            0,
            Math.PI * 2
          );
          context.fill();
        }
      });
    },
    (output) =>
      output.type === "marker"
        ? getAutoscaleFromValues(output.marks.map((mark) => mark.price))
        : undefined
  );
}

function getMarkIndex(mark: ChartMark, indexByTime: Map<number, number>): number | undefined {
  if (isFiniteNumber(mark.index)) {
    return mark.index;
  }

  return indexByTime.get(mark.time);
}
