import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  calculateDefaultMovingAverages,
  createChartLayout,
  createInitialViewport,
  createMainPanelPriceScale,
  createOhlcMagnetTargetsFromSeries,
  createPanelLayout,
  fixtureDailyCandleSeries
} from "@simoncharts/chart-engine";
import { playgroundVisualOutputs } from "../src/fixtures/visualFixtures";

interface RecordedViewportEvent {
  type: "viewportChanged";
  viewport: {
    candleWidth: number;
    scrollOffset: number;
    visibleRange: {
      from: number;
      to: number;
    };
  };
  visibleRange: {
    from: number;
    to: number;
  };
}

interface RecordedCrosshairEvent {
  type: "crosshairMoved";
  crosshair?: {
    index: number;
    time: number;
    price: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    turnover: number;
  };
}

interface OverlayCanvasCall {
  name: "moveTo" | "lineTo" | "fillRect";
  args: number[];
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 400 });
  await page.goto("/");
  await expect(page.getByTestId("chart-canvas")).toBeVisible();
  await expect(page.getByTestId("chart-overlay")).toBeVisible();
  await expect
    .poll(() =>
      page.getByTestId("chart-canvas").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;

        return canvas.width > 0 && canvas.height > 0;
      })
    )
    .toBe(true);
  await clearRecordedEvents(page);
});

test("wheel over chart changes the visible range and records neutral events", async ({ page }) => {
  const overlay = page.getByTestId("chart-overlay");

  await wheelAtCenter(page, overlay, -240);
  await expect.poll(async () => (await getViewportEvents(page)).length).toBeGreaterThanOrEqual(1);
  const first = (await getViewportEvents(page)).at(-1);

  await wheelAtCenter(page, overlay, 240);
  await expect.poll(async () => (await getViewportEvents(page)).length).toBeGreaterThanOrEqual(2);
  const events = await getViewportEvents(page);
  const second = events.at(-1);

  expect(first).toBeDefined();
  expect(second).toBeDefined();
  expect(second?.visibleRange).not.toEqual(first?.visibleRange);
  expect(second?.viewport.candleWidth).not.toBe(first?.viewport.candleWidth);
  expect(JSON.stringify(events)).not.toMatch(
    /review|strategy|candidate|watchlist|AI|auth|portfolio|trading-review-system/i
  );
});

test("drag over chart pans the visible range", async ({ page }) => {
  const overlay = page.getByTestId("chart-overlay");
  const point = await centerPoint(overlay);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 96, point.y);
  await page.mouse.up();

  await expect.poll(async () => (await getViewportEvents(page)).length).toBeGreaterThanOrEqual(1);
  const event = (await getViewportEvents(page)).at(-1);

  expect(event?.viewport.scrollOffset).toBeGreaterThan(0);
  expect(event?.visibleRange.to).toBeLessThan(119);
});

test("mouse move renders canvas crosshair tooltip and records OHLCV payload", async ({ page }) => {
  const overlay = page.getByTestId("chart-overlay");
  const point = await centerPoint(overlay);

  await page.mouse.move(point.x, point.y);

  await expect
    .poll(async () => (await getCrosshairEvents(page)).filter((event) => event.crosshair).length)
    .toBeGreaterThanOrEqual(1);
  await expect.poll(() => countOverlayPixels(overlay)).toBeGreaterThan(1_000);

  const crosshair = findLastCrosshair(await getCrosshairEvents(page));

  expect(crosshair).toMatchObject({
    index: expect.any(Number),
    time: expect.any(Number),
    price: expect.any(Number),
    open: expect.any(Number),
    high: expect.any(Number),
    low: expect.any(Number),
    close: expect.any(Number),
    volume: expect.any(Number),
    turnover: expect.any(Number)
  });
  expect(crosshair?.high).toBeGreaterThanOrEqual(
    Math.max(crosshair?.open ?? 0, crosshair?.close ?? 0)
  );
  expect(crosshair?.low).toBeLessThanOrEqual(Math.min(crosshair?.open ?? 0, crosshair?.close ?? 0));
});

test("projects interaction price through the main-panel overlay geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    type CapturedCall = {
      name: "moveTo" | "lineTo" | "fillRect";
      args: number[];
    };
    const calls: CapturedCall[] = [];
    const targetWindow = window as typeof window & {
      __SIMON_OVERLAY_CANVAS_CALLS__?: CapturedCall[];
    };
    const originalMoveTo = CanvasRenderingContext2D.prototype.moveTo;
    const originalLineTo = CanvasRenderingContext2D.prototype.lineTo;
    const originalFillRect = CanvasRenderingContext2D.prototype.fillRect;

    targetWindow.__SIMON_OVERLAY_CANVAS_CALLS__ = calls;
    CanvasRenderingContext2D.prototype.moveTo = function moveTo(x, y) {
      if (this.canvas.dataset.testid === "chart-overlay") {
        calls.push({ name: "moveTo", args: [x, y] });
      }
      originalMoveTo.call(this, x, y);
    };
    CanvasRenderingContext2D.prototype.lineTo = function lineTo(x, y) {
      if (this.canvas.dataset.testid === "chart-overlay") {
        calls.push({ name: "lineTo", args: [x, y] });
      }
      originalLineTo.call(this, x, y);
    };
    CanvasRenderingContext2D.prototype.fillRect = function fillRect(x, y, width, height) {
      if (this.canvas.dataset.testid === "chart-overlay") {
        calls.push({ name: "fillRect", args: [x, y, width, height] });
      }
      originalFillRect.call(this, x, y, width, height);
    };
  });
  await page.reload();
  await expect(page.getByTestId("panel-count")).toHaveText("2 panels");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  const geometry = getMainPanelOhlcGeometry(box.width, box.height);

  await clearRecordedEvents(page);
  await page.evaluate(() => {
    const targetWindow = window as typeof window & {
      __SIMON_OVERLAY_CANVAS_CALLS__?: unknown[];
    };

    targetWindow.__SIMON_OVERLAY_CANVAS_CALLS__?.splice(0);
  });
  await page.mouse.move(box.x + geometry.target.x, box.y + geometry.target.y);
  await expect
    .poll(async () => (await getCrosshairEvents(page)).filter((event) => event.crosshair).length)
    .toBeGreaterThanOrEqual(1);
  await expect
    .poll(
      async () =>
        (await getOverlayCanvasCalls(page)).filter((call) => call.name === "lineTo").length
    )
    .toBeGreaterThanOrEqual(2);

  const crosshair = findLastCrosshair(await getCrosshairEvents(page));
  const candle = fixtureDailyCandleSeries.candles[geometry.target.dataIndex];
  const calls = await getOverlayCanvasCalls(page);
  const pathCalls = calls
    .filter((call) => call.name === "moveTo" || call.name === "lineTo")
    .slice(-4);
  const tooltipRect = calls.filter((call) => call.name === "fillRect").at(-1);
  const plotRight = geometry.plotArea.x + geometry.plotArea.width;
  const plotBottom = geometry.plotArea.y + geometry.plotArea.height;

  expect(crosshair?.index).toBe(geometry.target.dataIndex);
  expect(crosshair?.price).toBeCloseTo(candle.high, 5);
  expect(pathCalls).toHaveLength(4);
  expect(pathCalls.map((call) => call.name)).toEqual(["moveTo", "lineTo", "moveTo", "lineTo"]);
  expect(pathCalls[2].args[0]).toBeCloseTo(geometry.plotArea.x, 5);
  expect(pathCalls[2].args[1]).toBeCloseTo(geometry.target.y, 4);
  expect(pathCalls[3].args[0]).toBeCloseTo(plotRight, 5);
  expect(pathCalls[3].args[1]).toBeCloseTo(geometry.target.y, 4);
  expect(pathCalls[0].args[0]).toBeCloseTo(geometry.target.x, 5);
  expect(pathCalls[0].args[1]).toBeCloseTo(geometry.plotArea.y, 5);
  expect(pathCalls[1].args[0]).toBeCloseTo(geometry.target.x, 5);
  expect(pathCalls[1].args[1]).toBeCloseTo(plotBottom, 5);
  expect(tooltipRect).toBeDefined();

  const [tooltipX, tooltipY, tooltipWidth, tooltipHeight] = tooltipRect?.args ?? [];
  const expectedTooltipX =
    geometry.target.x + 8 + tooltipWidth <= plotRight
      ? geometry.target.x + 8
      : Math.max(geometry.plotArea.x, geometry.target.x - 8 - tooltipWidth);
  const expectedTooltipY =
    geometry.target.y + 8 + tooltipHeight <= plotBottom
      ? geometry.target.y + 8
      : Math.max(geometry.plotArea.y, geometry.target.y - 8 - tooltipHeight);

  expect(tooltipX).toBeCloseTo(expectedTooltipX, 5);
  expect(tooltipY).toBeCloseTo(expectedTooltipY, 4);
});

test("crosshair stays aligned after repeated zooms near the left edge", async ({ page }) => {
  const overlay = page.getByTestId("chart-overlay");

  await wheelAtCenter(page, overlay, -240);
  await wheelAtCenter(page, overlay, -240);
  await expect.poll(async () => (await getViewportEvents(page)).length).toBeGreaterThanOrEqual(2);
  const viewport = (await getViewportEvents(page)).at(-1);

  expect(viewport).toBeDefined();
  await clearRecordedEvents(page);

  const point = await pointInCanvas(overlay, 8, 200);
  await page.mouse.move(point.x, point.y);

  await expect
    .poll(async () => (await getCrosshairEvents(page)).filter((event) => event.crosshair).length)
    .toBeGreaterThanOrEqual(1);
  await expect.poll(() => countOverlayPixels(overlay)).toBeGreaterThan(1_000);

  const crosshair = findLastCrosshair(await getCrosshairEvents(page));

  expect(crosshair?.index).toBeGreaterThanOrEqual(viewport?.visibleRange.from ?? 0);
  expect(crosshair?.index).toBeLessThanOrEqual(viewport?.visibleRange.to ?? 0);
});

test("pointer cancellation ends dragging before later pointer moves", async ({ page }) => {
  const overlay = page.getByTestId("chart-overlay");
  const point = await centerPoint(overlay);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await overlay.evaluate(
    (element, input) => {
      element.dispatchEvent(
        new PointerEvent("pointercancel", {
          bubbles: true,
          pointerId: 1,
          clientX: input.x,
          clientY: input.y
        })
      );
    },
    point
  );
  await clearRecordedEvents(page);

  await page.mouse.move(point.x + 96, point.y);
  await page.mouse.up();

  expect(await getViewportEvents(page)).toHaveLength(0);
});

test("resize normalizes scroll offset before later drag interactions", async ({ page }) => {
  const overlay = page.getByTestId("chart-overlay");
  const point = await centerPoint(overlay);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 160, point.y);
  await page.mouse.up();
  await expect.poll(async () => (await getViewportEvents(page)).length).toBeGreaterThanOrEqual(1);
  const panned = (await getViewportEvents(page)).at(-1);

  expect(panned?.viewport.scrollOffset).toBeGreaterThan(0);

  await page.setViewportSize({ width: 900, height: 400 });
  await expect
    .poll(() =>
      page.getByTestId("chart-overlay").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;

        return canvas.clientWidth === 900;
      })
    )
    .toBe(true);
  await clearRecordedEvents(page);

  const resizedOverlay = page.getByTestId("chart-overlay");
  const resizedPoint = await centerPoint(resizedOverlay);

  await page.mouse.move(resizedPoint.x, resizedPoint.y);
  await page.mouse.down();
  await page.mouse.move(resizedPoint.x - 80, resizedPoint.y);
  await page.mouse.up();

  await expect.poll(async () => (await getViewportEvents(page)).length).toBeGreaterThanOrEqual(1);
  const afterResizeDrag = (await getViewportEvents(page)).at(-1);

  expect(afterResizeDrag?.viewport.scrollOffset).toBeLessThan(panned?.viewport.scrollOffset ?? 0);
});

test("reset button restores the latest visible range", async ({ page }) => {
  const overlay = page.getByTestId("chart-overlay");

  await wheelAtCenter(page, overlay, -240);
  await expect.poll(async () => (await getViewportEvents(page)).length).toBeGreaterThanOrEqual(1);
  const zoomed = (await getViewportEvents(page)).at(-1);

  await page.getByTestId("reset-view").click();
  await expect.poll(async () => (await getViewportEvents(page)).length).toBeGreaterThanOrEqual(2);
  const reset = (await getViewportEvents(page)).at(-1);

  expect(zoomed).toBeDefined();
  expect(reset).toBeDefined();
  expect(reset?.viewport.scrollOffset).toBe(0);
  expect(reset?.viewport.candleWidth).toBeLessThan(zoomed?.viewport.candleWidth ?? 0);
  expect(reset?.visibleRange.to).toBe(zoomed?.visibleRange.to);
  expect(reset?.visibleRange.from).toBeLessThan(zoomed?.visibleRange.from ?? 0);
});

async function clearRecordedEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ = [];
  });
}

async function getViewportEvents(page: Page): Promise<RecordedViewportEvent[]> {
  const events = await getRecordedEvents(page);

  return events.filter(isViewportEvent);
}

async function getCrosshairEvents(page: Page): Promise<RecordedCrosshairEvent[]> {
  const events = await getRecordedEvents(page);

  return events.filter(isCrosshairEvent);
}

async function getRecordedEvents(page: Page): Promise<unknown[]> {
  return page.evaluate(
    () => (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ ?? []
  );
}

async function getOverlayCanvasCalls(page: Page): Promise<OverlayCanvasCall[]> {
  return page.evaluate(
    () =>
      (window as typeof window & {
        __SIMON_OVERLAY_CANVAS_CALLS__?: OverlayCanvasCall[];
      }).__SIMON_OVERLAY_CANVAS_CALLS__ ?? []
  );
}

async function wheelAtCenter(page: Page, locator: Locator, deltaY: number): Promise<void> {
  const point = await centerPoint(locator);

  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, deltaY);
}

async function centerPoint(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Element bounding box is unavailable");
  }

  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

async function pointInCanvas(locator: Locator, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Element bounding box is unavailable");
  }

  return {
    x: box.x + x,
    y: box.y + y
  };
}

async function countOverlayPixels(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");

    if (!context || canvas.width === 0 || canvas.height === 0) {
      return 0;
    }

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;

    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0) {
        count += 1;
      }
    }

    return count;
  });
}

function findLastCrosshair(
  events: RecordedCrosshairEvent[]
): RecordedCrosshairEvent["crosshair"] {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].crosshair) {
      return events[index].crosshair;
    }
  }

  return undefined;
}

function isViewportEvent(event: unknown): event is RecordedViewportEvent {
  return (
    isRecord(event) &&
    event.type === "viewportChanged" &&
    isRecord(event.viewport) &&
    isRange(event.visibleRange) &&
    typeof event.viewport.candleWidth === "number" &&
    typeof event.viewport.scrollOffset === "number" &&
    isRange(event.viewport.visibleRange)
  );
}

function isCrosshairEvent(event: unknown): event is RecordedCrosshairEvent {
  return isRecord(event) && event.type === "crosshairMoved";
}

function isRange(value: unknown): value is { from: number; to: number } {
  return isRecord(value) && typeof value.from === "number" && typeof value.to === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getMainPanelOhlcGeometry(width: number, height: number): {
  plotArea: { x: number; y: number; width: number; height: number };
  target: { x: number; y: number; dataIndex: number };
} {
  const layout = createChartLayout(Math.floor(width), Math.floor(height));
  const panels = createPanelLayout({
    width: layout.width,
    height: layout.height,
    rightAxisWidth: layout.rightAxisWidth,
    bottomAxisHeight: layout.bottomAxisHeight,
    panels: [
      { id: "main", kind: "main", label: "Main", heightRatio: 3 },
      { id: "sub", kind: "sub", label: "Sub", heightRatio: 1 }
    ]
  });
  const mainPanel = panels.find((panel) => panel.kind === "main") ?? panels[0];

  if (!mainPanel) {
    throw new Error("main panel missing");
  }

  const viewport = createInitialViewport(
    fixtureDailyCandleSeries.candles.length,
    layout.plotArea.width
  );
  const targets = createOhlcMagnetTargetsFromSeries({
    series: fixtureDailyCandleSeries,
    viewport,
    plotArea: mainPanel.plotArea,
    priceScale: createMainPanelPriceScale(
      fixtureDailyCandleSeries,
      viewport.visibleRange,
      viewport.priceScaleMode,
      playgroundVisualOutputs,
      Object.values(calculateDefaultMovingAverages(fixtureDailyCandleSeries))
    ),
    fields: ["high"]
  });
  const target = targets.find(
    (candidate) =>
      candidate.dataIndex !== undefined &&
      candidate.x > 500 &&
      candidate.x < mainPanel.plotArea.width - 360 &&
      candidate.y > 180 &&
      candidate.y < mainPanel.plotArea.height - 40
  );

  if (!target || target.dataIndex === undefined) {
    throw new Error("visible OHLC high target missing");
  }

  return {
    plotArea: mainPanel.plotArea,
    target: { x: target.x, y: target.y, dataIndex: target.dataIndex }
  };
}
