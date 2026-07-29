import type { ViewportState } from "../../model/runtime";
import {
  priceToY,
  priceToScaleValue,
  yToPrice
} from "../../viewport/priceScale";
import { formatPriceScaleTickForRender } from "../internalPriceFormatting";
import type { ChartLayer, RenderState } from "../renderTypes";
import { getTimeAxisLabels } from "../timeAxisLabels";

const minimumPriceTickSpacing = 72;
const maximumPriceTickCount = 10;
const currentPriceDash = [4, 4];
const labelVerticalPadding = 4;

export function createAxisLayer(): ChartLayer {
  return {
    id: "axis",
    render({ context, state }) {
      const { layout, series, theme, viewport } = state;
      const { leftPriceAxisArea, plotArea, priceAxisArea, timeAxisArea } = layout;
      const bounds = getVisibleBounds(viewport, series.candles.length);

      if (
        !bounds ||
        plotArea.width <= 0 ||
        plotArea.height <= 0
      ) {
        return;
      }

      const priceScale = state.priceScale;
      let priceTickCount = Math.max(
        2,
        Math.min(maximumPriceTickCount, Math.floor(plotArea.height / minimumPriceTickSpacing))
      );
      if (
        priceScale.mode === "percentage" &&
        Math.abs(priceScale.min + priceScale.max) < Number.EPSILON &&
        priceTickCount % 2 === 1
      ) priceTickCount -= 1;

      context.save();

      try {
        context.fillStyle = theme.colors.text;
        context.font = `${theme.typography.fontSize}px ${theme.typography.fontFamily}`;
        context.textAlign = "left";
        context.textBaseline = "middle";

        for (let step = 0; step <= priceTickCount; step += 1) {
          const y = plotArea.y + (plotArea.height / priceTickCount) * step;
          const labelY = clamp(
            y,
            plotArea.y + theme.typography.fontSize / 2,
            plotArea.y + plotArea.height - theme.typography.fontSize / 2
          );
          const price = yToPrice(y, priceScale, plotArea.y, plotArea.height);
          const scaleValue = priceToScaleValue(price, priceScale);

          if (priceScale.mode === "percentage" && leftPriceAxisArea.width > 0) {
            context.fillStyle = theme.colors.text;
            context.fillText(
              state.formatPrice?.(price) ?? formatRawPrice(price),
              leftPriceAxisArea.x + theme.spacing.axisPadding,
              labelY
            );
          }

          context.fillStyle = priceScale.mode !== "percentage" || Math.abs(scaleValue) < Number.EPSILON
            ? theme.colors.text
            : scaleValue > 0
              ? theme.colors.bullishCandle
              : theme.colors.bearishCandle;

          context.fillText(
            formatPriceScaleTickForRender(price, priceScale, state.formatPrice),
            priceAxisArea.x + theme.spacing.axisPadding,
            labelY
          );
        }

        drawSubPanelPriceTicks(context, state);

        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = theme.colors.text;

        for (const { label, x } of getTimeAxisLabels(context, state)) {
          context.fillText(label, x, timeAxisArea.y + theme.spacing.axisPadding);
        }

        drawCurrentPrice(context, state);
      } finally {
        context.restore();
      }
    }
  };
}

function drawSubPanelPriceTicks(
  context: CanvasRenderingContext2D,
  state: RenderState
): void {
  for (const panel of state.panels ?? []) {
    if (panel.kind !== "sub" || panel.plotArea.height <= 0 || panel.priceAxisArea.width <= 0) {
      continue;
    }
    const scale = state.panelPriceScales?.get(panel.id);
    if (scale === undefined) continue;
    const count = Math.max(
      2,
      Math.min(maximumPriceTickCount, Math.floor(panel.plotArea.height / minimumPriceTickSpacing))
    );
    context.fillStyle = state.theme.colors.text;
    context.textAlign = "left";
    context.textBaseline = "middle";
    for (let step = 0; step <= count; step += 1) {
      const y = panel.plotArea.y + (panel.plotArea.height / count) * step;
      context.fillText(
        formatPriceScaleTickForRender(
          yToPrice(y, scale, panel.plotArea.y, panel.plotArea.height),
          scale
        ),
        panel.priceAxisArea.x + state.theme.spacing.axisPadding,
        clamp(
          y,
          panel.plotArea.y + state.theme.typography.fontSize / 2,
          panel.plotArea.y + panel.plotArea.height - state.theme.typography.fontSize / 2
        )
      );
    }
  }
}

function formatRawPrice(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2);
}

function drawCurrentPrice(
  context: CanvasRenderingContext2D,
  state: RenderState
): void {
  const { layout, priceScale, series, theme } = state;
  const { plotArea, priceAxisArea } = layout;
  const candle = series.candles[series.candles.length - 1];

  if (
    !candle ||
    !Number.isFinite(candle.close) ||
    (priceScale.mode === "log" && candle.close <= 0)
  ) {
    return;
  }

  const y = priceToY(candle.close, priceScale, plotArea.y, plotArea.height);

  if (y < plotArea.y || y > plotArea.y + plotArea.height) return;

  const previousClose = priceScale.mode === "percentage"
    ? priceScale.basePrice
    : series.candles[series.candles.length - 2]?.close ?? candle.open;
  const color =
    candle.close >= previousClose
      ? theme.colors.bullishCandle
      : theme.colors.bearishCandle;

  context.strokeStyle = color;
  context.lineWidth = theme.lineWidths.crosshair;
  context.setLineDash(currentPriceDash);
  context.beginPath();
  context.moveTo(plotArea.x, y);
  context.lineTo(plotArea.x + plotArea.width, y);
  context.stroke();
  context.setLineDash([]);

  if (priceAxisArea.width <= 0 || priceAxisArea.height <= 0) return;

  const height = Math.min(
    priceAxisArea.height,
    theme.typography.fontSize + labelVerticalPadding * 2
  );
  const top = clamp(
    y - height / 2,
    priceAxisArea.y,
    priceAxisArea.y + priceAxisArea.height - height
  );

  context.fillStyle = color;
  context.fillRect(priceAxisArea.x, top, priceAxisArea.width, height);
  context.fillStyle = theme.colors.tooltip.text;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(
    formatPriceScaleTickForRender(candle.close, priceScale, state.formatPrice),
    priceAxisArea.x + Math.min(theme.spacing.axisPadding, priceAxisArea.width / 2),
    top + height / 2
  );
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function getVisibleBounds(
  viewport: ViewportState,
  candleCount: number
): { from: number; to: number } | undefined {
  if (candleCount <= 0 || viewport.visibleRange.from > viewport.visibleRange.to) {
    return undefined;
  }

  const lastIndex = candleCount - 1;
  const from = Math.max(0, viewport.visibleRange.from);
  const to = Math.min(lastIndex, viewport.visibleRange.to);

  if (from > to) {
    return undefined;
  }

  return { from, to };
}
