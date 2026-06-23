import {
  assertCandleSeries,
  calculateDefaultMovingAverages,
  createInteractionEngine,
  createChartLayout,
  computeVisibleRange,
  createInitialViewport,
  defaultChartTheme,
  renderOverlay,
  fixtureDailyCandleSeries,
  renderStaticChart,
  resizeCanvas
} from "@simoncharts/chart-engine";
import type {
  ChartCrosshairState,
  ChartLayout,
  InteractionEngine,
  InteractionEvent,
  LayerRenderContext,
  ViewportState
} from "@simoncharts/chart-engine";
import "./styles.css";

declare global {
  interface Window {
    __SIMON_CHART_EVENTS__?: unknown[];
  }
}

assertCandleSeries(fixtureDailyCandleSeries);
window.__SIMON_CHART_EVENTS__ = [];

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Playground root element is missing");
}

const app = appElement;
const chartSurface = document.createElement("div");
const canvas = document.createElement("canvas");
const overlayCanvas = document.createElement("canvas");
const resetButton = document.createElement("button");

chartSurface.className = "chart-surface";
canvas.dataset.testid = "chart-canvas";
canvas.setAttribute("aria-label", "SimonCharts static chart");
overlayCanvas.dataset.testid = "chart-overlay";
overlayCanvas.setAttribute("aria-label", "SimonCharts interaction overlay");
resetButton.type = "button";
resetButton.className = "reset-view";
resetButton.dataset.testid = "reset-view";
resetButton.textContent = "Reset";

chartSurface.replaceChildren(canvas, overlayCanvas, resetButton);
app.replaceChildren(chartSurface);

const movingAverages = Object.values(calculateDefaultMovingAverages(fixtureDailyCandleSeries));
let viewport: ViewportState | undefined;
let crosshair: ChartCrosshairState | undefined;
let layout: ChartLayout | undefined;
let interactionEngine: InteractionEngine | undefined;

function syncLayout(): void {
  const width = Math.max(1, Math.floor(app.clientWidth));
  const height = Math.max(1, Math.floor(app.clientHeight));
  const nextLayout = createChartLayout(width, height);
  const layoutChanged = !layout || layout.width !== width || layout.height !== height;

  layout = nextLayout;

  if (!viewport) {
    viewport = createInitialViewport(fixtureDailyCandleSeries.candles.length, layout.plotArea.width);
  } else if (layoutChanged) {
    const visibleRange = computeVisibleRange(
      viewport,
      fixtureDailyCandleSeries.candles.length,
      layout.plotArea.width
    );

    viewport = {
      ...viewport,
      scrollOffset: Math.max(0, fixtureDailyCandleSeries.candles.length - 1 - visibleRange.to),
      visibleRange
    };
  }

  if (layoutChanged || !interactionEngine) {
    crosshair = undefined;
    interactionEngine = createInteractionEngine({
      series: fixtureDailyCandleSeries,
      viewport,
      width: layout.plotArea.width,
      plotLeft: layout.plotArea.x,
      plotTop: layout.plotArea.y,
      plotHeight: layout.plotArea.height,
      onEvent: handleInteractionEvent
    });
  }
}

function renderStatic(): void {
  syncLayout();

  if (!layout || !viewport) {
    return;
  }

  const context = resizeCanvas(canvas, layout.width, layout.height, window.devicePixelRatio);

  context.fillStyle = defaultChartTheme.colors.background;
  context.fillRect(0, 0, layout.width, layout.height);

  renderStaticChart(createRenderContext(context));
}

function renderOverlayCanvas(): void {
  syncLayout();

  if (!layout || !viewport) {
    return;
  }

  const context = resizeCanvas(
    overlayCanvas,
    layout.width,
    layout.height,
    window.devicePixelRatio
  );

  renderOverlay(createRenderContext(context));
}

function createRenderContext(context: CanvasRenderingContext2D): LayerRenderContext {
  if (!layout || !viewport) {
    throw new Error("Chart layout is not ready");
  }

  return {
    context,
    state: {
      series: fixtureDailyCandleSeries,
      viewport,
      theme: defaultChartTheme,
      layout,
      movingAverages,
      crosshair
    }
  };
}

function handleInteractionEvent(event: InteractionEvent): void {
  window.__SIMON_CHART_EVENTS__?.push(event);

  if (event.type === "viewportChanged") {
    viewport = event.viewport;
    renderStatic();
    renderOverlayCanvas();
    return;
  }

  crosshair = event.crosshair;
  renderOverlayCanvas();
}

function getCanvasPoint(event: PointerEvent): { x: number; y: number } {
  const rect = overlayCanvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function getWheelPoint(event: WheelEvent): { x: number } {
  const rect = overlayCanvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left
  };
}

overlayCanvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    interactionEngine?.handleWheel({
      ...getWheelPoint(event),
      deltaY: event.deltaY
    });
  },
  { passive: false }
);

overlayCanvas.addEventListener("pointerdown", (event) => {
  overlayCanvas.setPointerCapture(event.pointerId);
  interactionEngine?.handlePointerDown(getCanvasPoint(event));
});

overlayCanvas.addEventListener("pointermove", (event) => {
  interactionEngine?.handlePointerMove(getCanvasPoint(event));
});

function finishPointerInteraction(event: PointerEvent): void {
  if (overlayCanvas.hasPointerCapture(event.pointerId)) {
    overlayCanvas.releasePointerCapture(event.pointerId);
  }

  interactionEngine?.handlePointerUp(getCanvasPoint(event));
}

overlayCanvas.addEventListener("pointerup", finishPointerInteraction);
overlayCanvas.addEventListener("pointercancel", finishPointerInteraction);
overlayCanvas.addEventListener("lostpointercapture", finishPointerInteraction);

resetButton.addEventListener("click", () => {
  interactionEngine?.resetView();
});

function render(): void {
  renderStatic();
  renderOverlayCanvas();
}

window.addEventListener("resize", render);
requestAnimationFrame(render);
