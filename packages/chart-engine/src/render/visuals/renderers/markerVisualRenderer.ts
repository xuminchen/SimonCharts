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
const executionMarkerStackGap = 22;
const executionMarkerBaseOffset = 9;
const executionMarkerStemOffset = 15;
const executionMarkerTextGap = 2;

function isExecutionMark(mark: ChartMark): boolean {
  return mark.metadata?.kind === "execution" && (mark.direction === "above" || mark.direction === "below");
}

function executionMarkerAnchorY(
  y: number,
  mark: ChartMark,
  plotTop: number,
  plotHeight: number,
  fontSize: number,
  stackCount: number
): number {
  const stackIndex = typeof mark.metadata?.stackIndex === "number" && mark.metadata.stackIndex >= 0
    ? mark.metadata.stackIndex
    : 0;
  const below = mark.direction === "below";
  const direction = below ? 1 : -1;
  const desired = y + direction * stackIndex * executionMarkerStackGap;
  const groupEdge = y + direction * (stackCount - 1) * executionMarkerStackGap;
  const extent = executionMarkerStemOffset + (mark.label ? executionMarkerTextGap + fontSize : 0);
  const shift = below
    ? Math.max(0, groupEdge - (plotTop + plotHeight - extent))
    : Math.max(0, plotTop + extent - groupEdge);
  return desired - direction * shift;
}

function executionMarkerStackCount(marks: readonly ChartMark[], mark: ChartMark): number {
  return marks.reduce((count, otherMark) => {
    if (
      !isExecutionMark(otherMark) ||
      otherMark.direction !== mark.direction ||
      otherMark.time !== mark.time ||
      otherMark.index !== mark.index
    ) return count;
    const index = typeof otherMark.metadata?.stackIndex === "number" && otherMark.metadata.stackIndex >= 0
      ? otherMark.metadata.stackIndex
      : 0;
    return Math.max(count, index + 1);
  }, 1);
}

function drawExecutionMark(
  context: CanvasRenderingContext2D,
  mark: ChartMark,
  x: number,
  anchorY: number,
  color: string,
  font: string
): void {
  const below = mark.direction === "below";
  const tipY = anchorY + (below ? 2 : -2);
  const baseY = anchorY + (below ? executionMarkerBaseOffset : -executionMarkerBaseOffset);
  const stemY = anchorY + (below ? executionMarkerStemOffset : -executionMarkerStemOffset);
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, tipY);
  context.lineTo(x - 5, baseY);
  context.lineTo(x + 5, baseY);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(x, baseY);
  context.lineTo(x, stemY);
  context.stroke();
  if (mark.label) {
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = below ? "top" : "bottom";
    context.fillText(mark.label, x, stemY + (below ? 2 : -2));
  }
}

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

          const x = xForVisualIndex(renderContext, index);
          const y = yForVisualValue(renderContext, renderRange, mark.price);
          if (isExecutionMark(mark)) {
            const anchorY = executionMarkerAnchorY(
              y,
              mark,
              renderContext.panel.plotArea.y,
              renderContext.panel.plotArea.height,
              state.theme.typography.fontSize,
              executionMarkerStackCount(output.marks, mark)
            );
            const color = mark.color ?? (
              mark.direction === "below"
                ? state.theme.colors.bullishCandle
                : state.theme.colors.bearishCandle
            );
            drawExecutionMark(
              context,
              mark,
              x,
              anchorY,
              color,
              `${state.theme.typography.fontSize}px ${state.theme.typography.fontFamily}`
            );
          } else {
            context.fillStyle = mark.color ?? state.theme.colors.text;
            context.beginPath();
            context.arc(x, y, markerRadius, 0, Math.PI * 2);
            context.fill();
          }
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
            itemId: mark.id,
            time: mark.time,
            value: mark.price,
            x: xForVisualIndex(hitContext, index),
            y: isExecutionMark(mark)
              ? executionMarkerAnchorY(
                  yForVisualValue(hitContext, renderRange, mark.price),
                  mark,
                  hitContext.panel.plotArea.y,
                  hitContext.panel.plotArea.height,
                  hitContext.state.theme.typography.fontSize,
                  executionMarkerStackCount(output.marks, mark)
                ) + (mark.direction === "below" ? executionMarkerBaseOffset : -executionMarkerBaseOffset)
              : yForVisualValue(hitContext, renderRange, mark.price)
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
