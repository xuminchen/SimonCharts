import type { ChartLayer } from "../renderTypes";

const horizontalLineCount = 4;
const verticalLineCount = 5;

export function createGridLayer(): ChartLayer {
  return {
    id: "grid",
    render({ context, state }) {
      const { plotArea } = state.layout;

      if (plotArea.width <= 0 || plotArea.height <= 0) {
        return;
      }

      context.save();

      try {
        context.setLineDash(state.theme.lineDashes.grid);
        context.strokeStyle = state.theme.colors.grid;
        context.lineWidth = state.theme.lineWidths.grid;
        context.beginPath();

        for (let step = 0; step <= horizontalLineCount; step += 1) {
          const y = plotArea.y + (plotArea.height / horizontalLineCount) * step;

          context.moveTo(plotArea.x, y);
          context.lineTo(plotArea.x + plotArea.width, y);
        }

        for (let step = 0; step <= verticalLineCount; step += 1) {
          const x = plotArea.x + (plotArea.width / verticalLineCount) * step;

          context.moveTo(x, plotArea.y);
          context.lineTo(x, plotArea.y + plotArea.height);
        }

        context.stroke();
      } finally {
        context.restore();
      }
    }
  };
}
