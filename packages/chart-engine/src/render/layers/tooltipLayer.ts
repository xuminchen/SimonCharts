import { priceToY } from "../../viewport/priceScale";
import { indexToX } from "../../viewport/viewport";
import type { Candle } from "../../model/market";
import type { TooltipFormattingContext } from "../../series/seriesTypes";
import type { ChartLayer, ChartLayout } from "../renderTypes";

const tooltipPadding = 8;
const tooltipOffset = 8;
const lineHeight = 16;

interface TooltipLine {
  readonly text: string;
  readonly color?: string;
}

export function createTooltipLayer(): ChartLayer {
  return {
    id: "tooltip",
    render({ context, state }) {
      const { crosshair, layout, series, theme, viewport } = state;
      const { plotArea } = layout;

      if (state.visualTooltip) {
        const lines: TooltipLine[] = [
          ...(state.visualTooltip.title ? [{ text: state.visualTooltip.title }] : []),
          ...state.visualTooltip.rows.map((row) => ({ text: `${row.label}: ${row.value}` }))
        ];
        drawTooltip(context, lines, state.visualTooltip.x, state.visualTooltip.y, layout, theme);
        return;
      }

      if (
        !crosshair ||
        crosshair.index < viewport.visibleRange.from ||
        crosshair.index > viewport.visibleRange.to ||
        crosshair.index < 0 ||
        crosshair.index >= series.candles.length ||
        plotArea.width <= 0 ||
        plotArea.height <= 0
      ) {
        return;
      }

      const candle = series.candles[crosshair.index];
      const lines = createTooltipLines(
        candle,
        series.candles[crosshair.index - 1],
        {
          formatTime: state.formatTime,
          timeframe: series.timeframe
        },
        state.locale ?? "en-US",
        state.intradayDays !== undefined,
        theme.colors.bullishCandle,
        theme.colors.bearishCandle
      );
      const x = indexToX(crosshair.index, viewport, plotArea.x, state.timeCoordinates);
      const y = priceToY(
        crosshair.price,
        state.priceScale,
        plotArea.y,
        plotArea.height
      );

      drawTooltip(context, lines, x, y, layout, theme);
    }
  };
}

function drawTooltip(
  context: CanvasRenderingContext2D,
  lines: TooltipLine[],
  x: number,
  y: number,
  layout: ChartLayout,
  theme: Parameters<ReturnType<typeof createTooltipLayer>["render"]>[0]["state"]["theme"]
): void {
  if (lines.length === 0) return;
  context.save();
  context.font = `${theme.typography.fontSize}px ${theme.typography.fontFamily}`;
  context.textAlign = "left";
  context.textBaseline = "top";
  const boxWidth = Math.max(...lines.map((line) => context.measureText(line.text).width)) + tooltipPadding * 2;
  const boxHeight = lines.length * lineHeight + tooltipPadding * 2;
  const { x: boxX, y: boxY } = placeTooltipBox(x, y, boxWidth, boxHeight, layout);
  context.fillStyle = theme.colors.tooltip.background;
  context.fillRect(boxX, boxY, boxWidth, boxHeight);
  context.strokeStyle = theme.colors.tooltip.border;
  context.lineWidth = 1;
  context.strokeRect(boxX, boxY, boxWidth, boxHeight);
  lines.forEach((line, index) => {
    context.fillStyle = line.color ?? theme.colors.tooltip.text;
    context.fillText(line.text, boxX + tooltipPadding, boxY + tooltipPadding + index * lineHeight);
  });
  context.restore();
}

function createTooltipLines(
  candle: Candle,
  previousCandle: Candle | undefined,
  formatting: TooltipFormattingContext,
  locale: "zh-CN" | "en-US",
  intraday: boolean,
  risingColor: string,
  fallingColor: string
): TooltipLine[] {
  const time = formatting.formatTime(candle.time, formatting.timeframe);
  if (intraday) {
    const labels = locale === "zh-CN"
      ? ["时间", "开", "高", "低", "收", "量", "额"]
      : ["Time", "Open", "High", "Low", "Close", "Volume", "Turnover"];
    return [
      { text: `${labels[0]}: ${time}` },
      { text: `${labels[1]}: ${formatNumber(candle.open, locale)}` },
      { text: `${labels[2]}: ${formatNumber(candle.high, locale)}` },
      { text: `${labels[3]}: ${formatNumber(candle.low, locale)}` },
      { text: `${labels[4]}: ${formatNumber(candle.close, locale)}` },
      { text: `${labels[5]}: ${formatCompact(candle.volume, locale)}` },
      { text: `${labels[6]}: ${formatCompact(candle.turnover, locale)}` }
    ];
  }

  const previousClose = previousCandle?.close ?? candle.open;
  const change = candle.close - previousClose;
  const changePercent = previousClose === 0 ? 0 : (change / previousClose) * 100;
  const amplitude = candle.low === 0 ? 0 : ((candle.high - candle.low) / candle.low) * 100;
  const range = candle.high - candle.low;
  const position = range === 0 ? 0 : ((candle.close - candle.low) / range) * 100;
  const directionColor = change > 0 ? risingColor : change < 0 ? fallingColor : undefined;
  const signedChange = `${change > 0 ? "+" : ""}${formatNumber(change, locale)}`;
  const signedPercent = `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%`;

  if (locale === "zh-CN") {
    return [
      { text: `${time} 北京时间` },
      { text: `开    ${formatNumber(candle.open, locale)}` },
      { text: `高    ${formatNumber(candle.high, locale)}` },
      { text: `低    ${formatNumber(candle.low, locale)}` },
      { text: `收    ${formatNumber(candle.close, locale)}` },
      { text: `涨跌  ${signedChange} (${signedPercent})`, color: directionColor },
      { text: `振幅  ${amplitude.toFixed(2)}%` },
      { text: `位置  ${position.toFixed(1)}%` },
      { text: `量    ${formatCompact(candle.volume, locale)}` },
      { text: `额    ${formatCompact(candle.turnover, locale)}` }
    ];
  }

  return [
    { text: `${time} Asia/Shanghai` },
    { text: `Open      ${formatNumber(candle.open, locale)}` },
    { text: `High      ${formatNumber(candle.high, locale)}` },
    { text: `Low       ${formatNumber(candle.low, locale)}` },
    { text: `Close     ${formatNumber(candle.close, locale)}` },
    { text: `Change    ${signedChange} (${signedPercent})`, color: directionColor },
    { text: `Amplitude ${amplitude.toFixed(2)}%` },
    { text: `Position  ${position.toFixed(1)}%` },
    { text: `Volume    ${formatCompact(candle.volume, locale)}` },
    { text: `Turnover  ${formatCompact(candle.turnover, locale)}` }
  ];
}

function formatNumber(value: number, locale: "zh-CN" | "en-US"): string {
  return value.toLocaleString(locale, { maximumFractionDigits: 4 });
}

function formatCompact(value: number, locale: "zh-CN" | "en-US"): string {
  if (locale === "zh-CN") {
    if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}亿`;
    if (Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(2)}万`;
  }
  return value.toLocaleString(locale, { maximumFractionDigits: 2 });
}

function placeTooltipBox(
  x: number,
  y: number,
  width: number,
  height: number,
  layout: ChartLayout
): { x: number; y: number } {
  const { plotArea } = layout;
  const right = plotArea.x + plotArea.width;
  const bottom = plotArea.y + plotArea.height;
  const preferredX = x + tooltipOffset;
  const preferredY = y + tooltipOffset;
  const boxX =
    preferredX + width <= right ? preferredX : Math.max(plotArea.x, x - tooltipOffset - width);
  const boxY =
    preferredY + height <= bottom ? preferredY : Math.max(plotArea.y, y - tooltipOffset - height);

  return { x: boxX, y: boxY };
}
