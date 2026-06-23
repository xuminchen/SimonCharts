import type { ChartLayout } from "./renderTypes";

const RIGHT_AXIS_WIDTH = 64;
const BOTTOM_AXIS_HEIGHT = 28;

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number
): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  const pixelRatio =
    devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;

  if (!context) {
    throw new Error("Canvas 2D context is not available");
  }

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.floor(cssWidth * pixelRatio);
  canvas.height = Math.floor(cssHeight * pixelRatio);

  context.resetTransform();
  context.scale(pixelRatio, pixelRatio);

  return context;
}

export function createChartLayout(width: number, height: number): ChartLayout {
  const rightAxisWidth = Math.min(RIGHT_AXIS_WIDTH, Math.max(0, width));
  const bottomAxisHeight = Math.min(BOTTOM_AXIS_HEIGHT, Math.max(0, height));
  const plotWidth = Math.max(0, width - rightAxisWidth);
  const plotHeight = Math.max(0, height - bottomAxisHeight);

  return {
    width,
    height,
    rightAxisWidth,
    bottomAxisHeight,
    plotArea: {
      x: 0,
      y: 0,
      width: plotWidth,
      height: plotHeight
    },
    priceAxisArea: {
      x: plotWidth,
      y: 0,
      width: rightAxisWidth,
      height: plotHeight
    },
    timeAxisArea: {
      x: 0,
      y: plotHeight,
      width: plotWidth,
      height: bottomAxisHeight
    }
  };
}
