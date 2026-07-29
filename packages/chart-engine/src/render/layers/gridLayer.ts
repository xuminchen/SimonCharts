import type { ChartLayer } from "../renderTypes";

const horizontalLineCount = 4;
const verticalLineCount = 5;

export function createGridLayer(): ChartLayer {
  return {
    id: "grid",
    render({ context, state }) {
      const { plotArea } = state.layout;
      const plots = [
        plotArea,
        ...(state.panels ?? [])
          .filter((panel) => panel.kind === "sub")
          .map((panel) => panel.plotArea)
      ];

      if (plotArea.width <= 0 || plotArea.height <= 0) {
        return;
      }

      context.save();

      try {
        context.setLineDash(state.theme.lineDashes.grid);
        context.strokeStyle = state.theme.colors.grid;
        context.lineWidth = state.theme.lineWidths.grid;
        context.beginPath();

        for (const panelPlot of plots) {
          for (let step = 0; step <= horizontalLineCount; step += 1) {
            const y = panelPlot.y + (panelPlot.height / horizontalLineCount) * step;

            context.moveTo(panelPlot.x, y);
            context.lineTo(panelPlot.x + panelPlot.width, y);
          }
        }

        const verticalXs = state.intradayDays !== undefined && state.intradayDays > 1 && state.timeCoordinates
          ? state.timeCoordinates.dayStartOffsets.slice(1).map((offset) => plotArea.x + offset)
          : Array.from(
              { length: verticalLineCount + 1 },
              (_, step) => plotArea.x + (plotArea.width / verticalLineCount) * step
            );
        for (const x of verticalXs) {
          context.moveTo(x, plotArea.y);
          context.lineTo(x, Math.max(...plots.map(
            (panelPlot) => panelPlot.y + panelPlot.height
          )));
        }

        context.stroke();
      } finally {
        context.restore();
      }
    }
  };
}
