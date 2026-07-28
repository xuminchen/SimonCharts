import {
  createTimeIndex,
  createVisualRenderer,
  getAutoscaleFromIndicatorPoints,
  getNearestVisualHit,
  getVisualRenderRange,
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

      const renderRange = getVisualRenderRange(renderContext, range);
      const indexByTime = createTimeIndex(renderContext.state.series);
      const { context, state } = renderContext;

      withPanelPlotClip(renderContext, () => {
        context.strokeStyle = output.color ?? state.theme.colors.text;
        context.lineWidth = output.lineWidth ?? state.theme.lineWidths.indicator;

        let hasOpenPath = false;
        let hasSegment = false;
        let singlePoint: { x: number; y: number } | undefined;
        const flushPath = () => {
          if (hasSegment) {
            context.stroke();
          } else if (singlePoint) {
            context.fillStyle = output.color ?? state.theme.colors.text;
            context.beginPath();
            context.arc(singlePoint.x, singlePoint.y, 2, 0, Math.PI * 2);
            context.fill();
          }

          hasOpenPath = false;
          hasSegment = false;
          singlePoint = undefined;
        };

        for (const point of output.values) {
          const visiblePoint = getVisibleIndicatorPoint(renderContext, indexByTime, point);

          if (!visiblePoint) {
            flushPath();
            continue;
          }

          const x = xForVisualIndex(renderContext, visiblePoint.index);
          const y = yForVisualValue(renderContext, renderRange, visiblePoint.value);

          if (!hasOpenPath) {
            context.beginPath();
            context.moveTo(x, y);
            hasOpenPath = true;
            singlePoint = { x, y };
            continue;
          }

          context.lineTo(x, y);
          hasSegment = true;
          singlePoint = undefined;
        }

        flushPath();
      });
    },
    (output) => (output.type === "line" ? getAutoscaleFromIndicatorPoints(output.values) : undefined),
    (hitContext, x, y) => {
      const output = hitContext.output;

      if (output.type !== "line") {
        return undefined;
      }

      const range = getAutoscaleFromIndicatorPoints(output.values);

      if (!range) {
        return undefined;
      }

      const renderRange = getVisualRenderRange(hitContext, range);
      const indexByTime = createTimeIndex(hitContext.state.series);
      const candidates = output.values.map((point) => {
        const visible = getVisibleIndicatorPoint(hitContext, indexByTime, point);
        return visible === undefined
          ? undefined
          : {
              time: visible.time,
              value: visible.value,
              x: xForVisualIndex(hitContext, visible.index),
              y: yForVisualValue(hitContext, renderRange, visible.value)
            };
      });
      const pointHit = getNearestVisualHit(
        output,
        x,
        y,
        candidates.filter((point): point is NonNullable<typeof point> => point !== undefined)
      );
      let segmentHit = pointHit;
      for (let index = 1; index < candidates.length; index += 1) {
        const start = candidates[index - 1];
        const end = candidates[index];
        if (!start || !end) continue;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy;
        const ratio = lengthSquared === 0
          ? 0
          : Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / lengthSquared));
        const distance = Math.hypot(
          x - (start.x + ratio * dx),
          y - (start.y + ratio * dy)
        );
        if (segmentHit && segmentHit.distance <= distance) continue;
        const nearest = ratio <= 0.5 ? start : end;
        segmentHit = {
          outputId: output.id,
          outputType: output.type,
          time: nearest.time,
          value: nearest.value,
          distance
        };
      }

      return segmentHit;
    }
  );
}
