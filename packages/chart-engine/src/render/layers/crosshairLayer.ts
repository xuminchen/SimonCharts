import { priceToY, yToPrice } from "../../viewport/priceScale";
import { indexToX } from "../../viewport/viewport";
import { formatPriceScaleTickForRender } from "../internalPriceFormatting";
import type { ChartLayer, RenderState } from "../renderTypes";
import { getTimeAxisLabels } from "../timeAxisLabels";

const badgePadding = 6;
const badgeVerticalPadding = 4;
const crosshairDash = [4, 4];

export function createCrosshairLayer(): ChartLayer {
  return {
    id: "crosshair",
    render({ context, state }) {
      const { crosshair, layout, series, theme, viewport } = state;
      const { plotArea } = layout;
      const activePanel = state.crosshairPane === undefined
        ? undefined
        : state.panels?.find((panel) => panel.id === state.crosshairPane!.id);
      const activeScale = activePanel === undefined
        ? undefined
        : state.panelPriceScales?.get(activePanel.id);
      const activePane = activePanel !== undefined && activeScale !== undefined &&
        Number.isFinite(state.crosshairPane?.y)
        ? { panel: activePanel, scale: activeScale, y: state.crosshairPane!.y }
        : undefined;
      const targetPlot = activePane?.panel.plotArea ?? plotArea;
      const targetAxis = activePane?.panel.priceAxisArea ?? layout.priceAxisArea;

      if (
        !crosshair ||
        crosshair.index < viewport.visibleRange.from ||
        crosshair.index > viewport.visibleRange.to ||
        crosshair.index < 0 ||
        crosshair.index >= series.candles.length ||
        !Number.isFinite(crosshair.price) ||
        (state.priceScale.mode === "log" && crosshair.price <= 0) ||
        plotArea.width <= 0 ||
        plotArea.height <= 0
      ) {
        return;
      }

      const x = clamp(
        indexToX(crosshair.index, viewport, plotArea.x, state.timeCoordinates),
        plotArea.x,
        plotArea.x + plotArea.width
      );
      const y = activePane === undefined
        ? clamp(
            priceToY(crosshair.price, state.priceScale, targetPlot.y, targetPlot.height),
            targetPlot.y,
            targetPlot.y + targetPlot.height
          )
        : clamp(activePane.y, targetPlot.y, targetPlot.y + targetPlot.height);
      const displayedPrice = activePane === undefined
        ? crosshair.price
        : yToPrice(y, activePane.scale, targetPlot.y, targetPlot.height);
      const displayedScale = activePane?.scale ?? state.priceScale;
      if (
        !Number.isFinite(displayedPrice) ||
        (displayedScale.mode === "log" && displayedPrice <= 0)
      ) return;

      context.save();

      try {
        context.strokeStyle = theme.colors.crosshair;
        context.lineWidth = theme.lineWidths.crosshair;
        context.setLineDash(crosshairDash);
        context.beginPath();
        context.moveTo(x, plotArea.y);
        context.lineTo(x, Math.max(
          plotArea.y + plotArea.height,
          layout.volumeArea.y + layout.volumeArea.height,
          ...(state.panels ?? []).map((panel) => panel.plotArea.y + panel.plotArea.height)
        ));
        context.moveTo(targetPlot.x, y);
        context.lineTo(targetPlot.x + targetPlot.width, y);
        context.stroke();
        context.setLineDash([]);

        context.font = `${theme.typography.fontSize}px ${theme.typography.fontFamily}`;
        drawPriceBadge(
          context,
          formatPriceScaleTickForRender(
            displayedPrice,
            displayedScale,
            activePane?.panel.kind === "sub" ? undefined : state.formatPrice
          ),
          y,
          state,
          targetAxis
        );
        drawTimeBadge(
          context,
          state.formatTime(crosshair.time, series.timeframe),
          x,
          state
        );
      } finally {
        context.restore();
      }
    }
  };
}

function drawPriceBadge(
  context: CanvasRenderingContext2D,
  label: string,
  y: number,
  state: RenderState,
  priceAxisArea = state.layout.priceAxisArea
): void {
  if (priceAxisArea.width <= 0 || priceAxisArea.height <= 0) return;

  const height = Math.min(
    priceAxisArea.height,
    state.theme.typography.fontSize + badgeVerticalPadding * 2
  );
  const top = clamp(
    y - height / 2,
    priceAxisArea.y,
    priceAxisArea.y + priceAxisArea.height - height
  );

  context.fillStyle = state.theme.colors.crosshair;
  context.fillRect(priceAxisArea.x, top, priceAxisArea.width, height);
  context.fillStyle = state.theme.colors.tooltip.text;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(
    label,
    priceAxisArea.x + Math.min(badgePadding, priceAxisArea.width / 2),
    top + height / 2
  );
}

function drawTimeBadge(
  context: CanvasRenderingContext2D,
  label: string,
  x: number,
  state: RenderState
): void {
  const { timeAxisArea } = state.layout;

  if (timeAxisArea.width <= 0 || timeAxisArea.height <= 0) return;

  const width = Math.min(
    timeAxisArea.width,
    context.measureText(label).width + badgePadding * 2
  );
  const left = clamp(
    x - width / 2,
    timeAxisArea.x,
    timeAxisArea.x + timeAxisArea.width - width
  );

  context.fillStyle = state.theme.colors.background;
  for (const timeLabel of getTimeAxisLabels(context, state)) {
    const labelLeft = timeLabel.x - timeLabel.halfWidth;
    const labelRight = timeLabel.x + timeLabel.halfWidth;
    if (labelRight <= left || labelLeft >= left + width) continue;
    const clearLeft = Math.max(timeAxisArea.x, labelLeft - 2);
    const clearRight = Math.min(timeAxisArea.x + timeAxisArea.width, labelRight + 2);
    context.fillRect(
      clearLeft,
      timeAxisArea.y,
      clearRight - clearLeft,
      timeAxisArea.height
    );
  }
  context.fillStyle = state.theme.colors.crosshair;
  context.fillRect(left, timeAxisArea.y, width, timeAxisArea.height);
  context.fillStyle = state.theme.colors.tooltip.text;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, left + width / 2, timeAxisArea.y + timeAxisArea.height / 2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
