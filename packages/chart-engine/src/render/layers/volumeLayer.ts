import { indexToX } from "../../viewport/viewport";
import type { ViewportState } from "../../model/runtime";
import type { ChartLayer } from "../renderTypes";

const volumePanelRatio = 0.24;

export function createVolumeLayer(): ChartLayer {
  return {
    id: "volume",
    render({ context, state }) {
      const { layout, series, theme, viewport } = state;
      const bounds = getVisibleBounds(viewport, series.candles.length);

      if (!bounds || layout.plotArea.width <= 0 || layout.plotArea.height <= 0) {
        return;
      }

      let maxVolume = 0;

      for (let index = bounds.from; index <= bounds.to; index += 1) {
        maxVolume = Math.max(maxVolume, series.candles[index].volume);
      }

      context.fillStyle = theme.colors.volume;

      for (let index = bounds.from; index <= bounds.to; index += 1) {
        const candle = series.candles[index];
        const x = indexToX(index, viewport, layout.plotArea.x);
        const barWidth = Math.max(1, viewport.candleWidth * 0.7);
        const panelHeight = layout.plotArea.height * volumePanelRatio;
        const baseline = layout.plotArea.y + layout.plotArea.height;
        const barHeight = maxVolume > 0 ? (candle.volume / maxVolume) * panelHeight : 0;

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
