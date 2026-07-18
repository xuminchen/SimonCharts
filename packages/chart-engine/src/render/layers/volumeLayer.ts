import { indexToX } from "../../viewport/viewport";
import type { ViewportState } from "../../model/runtime";
import type { ChartLayer } from "../renderTypes";

export function createVolumeLayer(): ChartLayer {
  return {
    id: "volume",
    render({ context, state }) {
      const { layout, series, theme, viewport } = state;
      const { volumeArea } = layout;
      const bounds = getVisibleBounds(viewport, series.candles.length);

      if (!bounds || volumeArea.width <= 0 || volumeArea.height <= 0) {
        return;
      }

      let maxVolume = 0;

      for (let index = bounds.from; index <= bounds.to; index += 1) {
        maxVolume = Math.max(maxVolume, series.candles[index].volume);
      }

      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const candle = series.candles[index];
        const x = indexToX(index, viewport, volumeArea.x);
        const barWidth = Math.max(1, viewport.candleWidth * 0.7);
        const baseline = volumeArea.y + volumeArea.height;
        const barHeight = maxVolume > 0 ? (candle.volume / maxVolume) * volumeArea.height : 0;

        context.fillStyle =
          candle.close >= candle.open
            ? theme.colors.bullishCandle
            : theme.colors.bearishCandle;
        context.fillRect(x - barWidth / 2, baseline - barHeight, barWidth, barHeight);
      }
    }
  };
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
