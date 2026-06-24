import type { IndicatorPoint } from "../../../model/visual";
import type { VisualRenderContext } from "../../../visuals/visualTypes";
import {
  createTimeIndex,
  createVisualRenderer,
  getAutoscaleFromValues,
  getNearestVisualHit,
  getVisualRenderRange,
  getVisibleIndicatorPoint,
  withPanelPlotClip,
  xForVisualIndex,
  yForVisualValue
} from "./visualRendererHelpers";

interface VisibleBandPoint {
  index: number;
  upper: number;
  lower: number;
}

export function createBandVisualRenderer() {
  return createVisualRenderer(
    "band",
    (renderContext) => {
      const output = renderContext.output;

      if (output.type !== "band") {
        return;
      }

      const range = getBandAutoscale(output.upper, output.lower);

      if (!range) {
        return;
      }

      const renderRange = getVisualRenderRange(renderContext, range);
      const lowerByTime = new Map(output.lower.map((point) => [point.time, point]));
      const indexByTime = createTimeIndex(renderContext.state.series);
      const { context, state } = renderContext;

      withPanelPlotClip(renderContext, () => {
        context.fillStyle = output.fill ?? state.theme.colors.volume;
        context.globalAlpha = output.fill ? 1 : 0.18;

        let segment: VisibleBandPoint[] = [];

        for (const upperPoint of output.upper) {
          const lowerPoint = lowerByTime.get(upperPoint.time);
          const upperVisiblePoint = getVisibleIndicatorPoint(renderContext, indexByTime, upperPoint);
          const lowerVisiblePoint = lowerPoint
            ? getVisibleIndicatorPoint(renderContext, indexByTime, lowerPoint)
            : undefined;

          if (!upperVisiblePoint || !lowerVisiblePoint) {
            drawBandSegment(renderContext, renderRange, segment);
            segment = [];
            continue;
          }

          segment.push({
            index: upperVisiblePoint.index,
            upper: upperVisiblePoint.value,
            lower: lowerVisiblePoint.value
          });
        }

        drawBandSegment(renderContext, renderRange, segment);
      });
    },
    (output) => (output.type === "band" ? getBandAutoscale(output.upper, output.lower) : undefined),
    (hitContext, x, y) => {
      const output = hitContext.output;

      if (output.type !== "band") {
        return undefined;
      }

      const range = getBandAutoscale(output.upper, output.lower);

      if (!range) {
        return undefined;
      }

      const renderRange = getVisualRenderRange(hitContext, range);
      const lowerByTime = new Map(output.lower.map((point) => [point.time, point]));
      const indexByTime = createTimeIndex(hitContext.state.series);
      const candidates = output.upper.flatMap((upperPoint) => {
        const lowerPoint = lowerByTime.get(upperPoint.time);
        const upperVisiblePoint = getVisibleIndicatorPoint(hitContext, indexByTime, upperPoint);
        const lowerVisiblePoint = lowerPoint
          ? getVisibleIndicatorPoint(hitContext, indexByTime, lowerPoint)
          : undefined;

        if (!upperVisiblePoint || !lowerVisiblePoint) {
          return [];
        }

        const value = (upperVisiblePoint.value + lowerVisiblePoint.value) / 2;

        return [
          {
            time: upperVisiblePoint.time,
            value,
            x: xForVisualIndex(hitContext, upperVisiblePoint.index),
            y: yForVisualValue(hitContext, renderRange, value)
          }
        ];
      });

      return getNearestVisualHit(output, x, y, candidates);
    }
  );
}

function getBandAutoscale(
  upper: IndicatorPoint[],
  lower: IndicatorPoint[]
) {
  return getAutoscaleFromValues([
    ...upper.map((point) => point.value),
    ...lower.map((point) => point.value)
  ]);
}

function drawBandSegment(
  context: VisualRenderContext,
  range: Parameters<typeof yForVisualValue>[1],
  points: VisibleBandPoint[]
): void {
  if (points.length === 0) {
    return;
  }

  context.context.beginPath();
  points.forEach((point, index) => {
    const x = xForVisualIndex(context, point.index);
    const y = yForVisualValue(context, range, point.upper);

    if (index === 0) {
      context.context.moveTo(x, y);
    } else {
      context.context.lineTo(x, y);
    }
  });

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];

    context.context.lineTo(
      xForVisualIndex(context, point.index),
      yForVisualValue(context, range, point.lower)
    );
  }

  context.context.fill();
}
