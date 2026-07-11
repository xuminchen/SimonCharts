import type { ChartMark } from "../../../model/visual";
import {
  createTimeIndex,
  createVisualRenderer,
  getAutoscaleFromValues,
  getNearestVisualHit,
  getVisualRenderRange,
  isFiniteNumber,
  isRenderableVisualValue,
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

      const renderRange = getVisualRenderRange(renderContext, range);
      const indexByTime = createTimeIndex(renderContext.state.series);
      const { context, state } = renderContext;

      withPanelPlotClip(renderContext, () => {
        for (const mark of output.marks) {
          if (!isRenderableVisualValue(renderContext, mark.price)) {
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
        : undefined,
    (hitContext, x, y) => {
      const output = hitContext.output;

      if (output.type !== "marker") {
        return undefined;
      }

      const range = getAutoscaleFromValues(output.marks.map((mark) => mark.price));

      if (!range) {
        return undefined;
      }

      const renderRange = getVisualRenderRange(hitContext, range);
      const indexByTime = createTimeIndex(hitContext.state.series);
      const candidates = output.marks.flatMap((mark) => {
        if (!isRenderableVisualValue(hitContext, mark.price)) {
          return [];
        }

        const index = getMarkIndex(mark, indexByTime);

        if (index === undefined || !isVisibleIndex(hitContext, index)) {
          return [];
        }

        return [
          {
            time: mark.time,
            value: mark.price,
            x: xForVisualIndex(hitContext, index),
            y: yForVisualValue(hitContext, renderRange, mark.price)
          }
        ];
      });

      return getNearestVisualHit(output, x, y, candidates);
    }
  );
}

function getMarkIndex(mark: ChartMark, indexByTime: Map<number, number>): number | undefined {
  if (isFiniteNumber(mark.index)) {
    return mark.index;
  }

  return indexByTime.get(mark.time);
}
