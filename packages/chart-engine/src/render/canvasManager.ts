import type { ChartLayout } from "./renderTypes";

const RIGHT_AXIS_WIDTH = 64;
const LEFT_AXIS_WIDTH = 64;
const BOTTOM_AXIS_HEIGHT = 28;
const CHART_HEADER_HEIGHT = 34;
const PRICE_VOLUME_GAP = 8;
const VOLUME_HEIGHT_RATIO = 0.16;

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

  const styleWidth = `${cssWidth}px`;
  const styleHeight = `${cssHeight}px`;
  const pixelWidth = Math.floor(cssWidth * pixelRatio);
  const pixelHeight = Math.floor(cssHeight * pixelRatio);

  if (canvas.style.width !== styleWidth) canvas.style.width = styleWidth;
  if (canvas.style.height !== styleHeight) canvas.style.height = styleHeight;
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  context.resetTransform();
  context.scale(pixelRatio, pixelRatio);

  return context;
}

export function createChartLayout(
  width: number,
  height: number,
  options: { leftPriceAxis?: boolean } = {}
): ChartLayout {
  const leftAxisWidth = options.leftPriceAxis
    ? Math.min(LEFT_AXIS_WIDTH, Math.max(0, width))
    : 0;
  const rightAxisWidth = Math.min(RIGHT_AXIS_WIDTH, Math.max(0, width - leftAxisWidth));
  const bottomAxisHeight = Math.min(BOTTOM_AXIS_HEIGHT, Math.max(0, height));
  const plotWidth = Math.max(0, width - leftAxisWidth - rightAxisWidth);
  const chartHeight = Math.max(0, height - bottomAxisHeight);
  const chartHeaderHeight = Math.min(CHART_HEADER_HEIGHT, chartHeight);
  const contentHeight = Math.max(0, chartHeight - chartHeaderHeight);
  const volumeHeight = Math.floor(contentHeight * VOLUME_HEIGHT_RATIO);
  const volumeGap = volumeHeight > 0
    ? Math.min(PRICE_VOLUME_GAP, Math.max(0, contentHeight - volumeHeight - 1))
    : 0;
  const plotHeight = Math.max(0, contentHeight - volumeGap - volumeHeight);
  const plotLeft = leftAxisWidth;
  const volumeTop = chartHeaderHeight + plotHeight + volumeGap;

  return {
    width,
    height,
    leftAxisWidth,
    rightAxisWidth,
    bottomAxisHeight,
    leftPriceAxisArea: {
      x: 0,
      y: chartHeaderHeight,
      width: leftAxisWidth,
      height: plotHeight
    },
    plotArea: {
      x: plotLeft,
      y: chartHeaderHeight,
      width: plotWidth,
      height: plotHeight
    },
    priceAxisArea: {
      x: plotLeft + plotWidth,
      y: chartHeaderHeight,
      width: rightAxisWidth,
      height: plotHeight
    },
    volumeArea: {
      x: plotLeft,
      y: volumeTop,
      width: plotWidth,
      height: volumeHeight
    },
    timeAxisArea: {
      x: plotLeft,
      y: chartHeight,
      width: plotWidth,
      height: bottomAxisHeight
    }
  };
}
