import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  calculateDefaultMovingAverages,
  createChartLayout,
  createInitialViewport,
  createMainPanelPriceScale,
  createOhlcMagnetTargetsFromSeries,
  createPanelLayout,
  fixtureDailyCandleSeries,
  projectDrawingObject,
  unprojectDrawingObject,
  zoomViewportAtIndex,
  type DrawingAnchor,
  type DrawingCoordinateContext,
  type PriceScaleMode
} from "@simoncharts/chart-engine";
import { playgroundVisualOutputs } from "../src/fixtures/visualFixtures";

interface Point {
  x: number;
  y: number;
}

interface ExportedAnchor {
  x?: number;
  y?: number;
  time?: number;
  price?: number;
}

interface DrawingExportPayload {
  drawings: Array<{ anchors: ExportedAnchor[] }>;
}

async function getDrawingExport(page: Page): Promise<DrawingExportPayload> {
  return JSON.parse(await page.getByTestId("drawing-json-export").inputValue()) as DrawingExportPayload;
}

function expectPointToEqual(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
}

function getVisibleHighTarget(width: number, height: number): Point {
  const context = getInitialDrawingCoordinateContext(width, height);
  const targets = createOhlcMagnetTargetsFromSeries({
    series: fixtureDailyCandleSeries,
    viewport: context.viewport,
    plotArea: context.plotArea,
    priceScale: context.priceScale,
    fields: ["high"]
  });
  const target = targets.find(
    (candidate) =>
      candidate.x > 500 &&
      candidate.x < context.plotArea.width - 360 &&
      candidate.y > 180 &&
      candidate.y < context.plotArea.height - 40
  );

  if (!target) {
    throw new Error("visible OHLC high target missing");
  }

  return { x: target.x, y: target.y };
}

function getInitialDrawingCoordinateContext(
  width: number,
  height: number
): DrawingCoordinateContext {
  return getDrawingCoordinateContext(width, height);
}

function getDrawingCoordinateContext(
  width: number,
  height: number,
  options: { priceScaleMode?: PriceScaleMode; zoomInCount?: number } = {}
): DrawingCoordinateContext {
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

  let viewport = createInitialViewport(
    fixtureDailyCandleSeries.candles.length,
    layout.plotArea.width
  );
  viewport = {
    ...viewport,
    priceScaleMode: options.priceScaleMode ?? viewport.priceScaleMode
  };
  for (let count = 0; count < (options.zoomInCount ?? 0); count += 1) {
    const anchorIndex = Math.floor((viewport.visibleRange.from + viewport.visibleRange.to) / 2);

    viewport = zoomViewportAtIndex(
      viewport,
      anchorIndex,
      -1,
      fixtureDailyCandleSeries.candles.length
    );
  }
  const priceScale = createMainPanelPriceScale(
    fixtureDailyCandleSeries,
    viewport.visibleRange,
    viewport.priceScaleMode,
    playgroundVisualOutputs,
    Object.values(calculateDefaultMovingAverages(fixtureDailyCandleSeries))
  );

  return {
    series: fixtureDailyCandleSeries,
    viewport,
    plotArea: mainPanel.plotArea,
    priceScale
  };
}

function projectExportedAnchor(
  anchor: DrawingAnchor,
  width: number,
  height: number
): DrawingAnchor {
  return projectDrawingObject(
    { id: "projected-test-anchor", type: "trendLine", anchors: [anchor] },
    getInitialDrawingCoordinateContext(width, height)
  ).anchors[0];
}

function projectExportedAnchors(
  anchors: ExportedAnchor[],
  width: number,
  height: number,
  options: { priceScaleMode?: PriceScaleMode; zoomInCount?: number } = {}
): DrawingAnchor[] {
  return projectDrawingObject(
    { id: "projected-test-drawing", type: "trendLine", anchors },
    getDrawingCoordinateContext(width, height, options)
  ).anchors;
}

function getCanonicalAnchors(
  anchors: ExportedAnchor[],
  width: number,
  height: number
): Array<{ time?: number; price?: number }> {
  return unprojectDrawingObject(
    { id: "canonical-test-drawing", type: "trendLine", anchors },
    getInitialDrawingCoordinateContext(width, height)
  ).anchors.map(({ time, price }) => ({ time, price }));
}

test("creates edits deletes and restores a trend line drawing", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");

  await page.getByTestId("drawing-tool-trendLine").click();
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  await expect(page.getByTestId("drawing-object-manager")).toContainText("trendLine");
  await expect(page.getByTestId("drawing-property-panel")).toContainText("drawing-1");
  await expect(page.getByTestId("drawing-handle-count")).toHaveText("11 handles");
  await expect(page.getByTestId("drawing-style-line")).toBeVisible();
  await expect(page.getByTestId("drawing-state-visible")).toBeVisible();
  await expect(page.getByTestId("drawing-state-locked")).toBeVisible();
  await expect(page.getByTestId("drawing-json-export")).toHaveValue(/trendLine/);

  await page.getByTestId("drawing-tool-select").click();
  await page.mouse.click(box.x + 180, box.y + 210);
  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: drawing-1");
  const originalCanonical = (await getDrawingExport(page)).drawings[0].anchors;

  await page.keyboard.press("ArrowRight");
  const nudgedCanonical = (await getDrawingExport(page)).drawings[0].anchors;

  expect(nudgedCanonical).not.toEqual(originalCanonical);
  await page.getByTestId("resize-drawing").click();
  const resizedCanonical = (await getDrawingExport(page)).drawings[0].anchors;

  expect(resizedCanonical).not.toEqual(nudgedCanonical);
  await page.getByTestId("rotate-drawing").click();
  const rotatedCanonical = (await getDrawingExport(page)).drawings[0].anchors;

  expect(rotatedCanonical).not.toEqual(resizedCanonical);
  await expect(page.getByTestId("drawing-json-export")).not.toHaveValue(/"x":/);
  await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 250);
  await page.mouse.up();

  await page.getByTestId("delete-drawing").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("0 drawings");
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  await page.getByTestId("redo").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("0 drawings");
});

test("property panel updates selected drawing text and export", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-text").click();
  await page.mouse.click(box.x + 180, box.y + 180);
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: drawing-1");
  await expect(page.getByTestId("drawing-style-text-color")).toBeVisible();
  await expect(page.getByTestId("drawing-style-font-size")).toBeVisible();

  await page.getByTestId("drawing-text").fill("Breakout note");
  await page.getByTestId("drawing-text").blur();

  await expect(page.getByTestId("drawing-json-export")).toHaveValue(/"text": "Breakout note"/);
});

test("drags selected drawing anchor handles through engine operation flow", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await page.getByTestId("drawing-tool-select").click();
  await page.mouse.click(box.x + 180, box.y + 210);

  await expect(page.getByTestId("drawing-handle-count")).toHaveText("11 handles");
  await page.mouse.move(box.x + 120, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 200);
  await page.mouse.up();

  const firstAnchor = (await getDrawingExport(page)).drawings[0].anchors[0];
  const projectedFirstAnchor = projectExportedAnchor(firstAnchor, box.width, box.height);

  expectPointToEqual(projectedFirstAnchor as Point, { x: 140, y: 200 });
});

test("snaps new drawing anchors to existing drawing anchors", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");

  const firstAnchor = (await getDrawingExport(page)).drawings[0].anchors[0];
  const projectedFirstAnchor = projectExportedAnchor(firstAnchor, box.width, box.height);

  await page.mouse.click(
    box.x + (projectedFirstAnchor.x ?? 0) + 6,
    box.y + (projectedFirstAnchor.y ?? 0) + 2
  );
  await expect(page.getByTestId("magnet-state")).toHaveText("drawingAnchor");
  await page.mouse.click(box.x + 340, box.y + 260);

  await expect(page.getByTestId("drawing-count")).toHaveText("2 drawings");
  const drawings = (await getDrawingExport(page)).drawings;

  expectPointToEqual(
    projectExportedAnchor(drawings[1].anchors[0], box.width, box.height) as Point,
    projectedFirstAnchor as Point
  );
  expect(drawings[1].anchors[0].time).toBe(firstAnchor.time);
  expect(drawings[1].anchors[0].price).toBeCloseTo(firstAnchor.price ?? 0, 8);
});

test("snaps drawing creation to visible candle OHLC targets", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  const target = getVisibleHighTarget(box.width, box.height);
  const rawClickPoint = { x: target.x + 4, y: target.y + 3 };

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + rawClickPoint.x, box.y + rawClickPoint.y);
  await expect(page.getByTestId("magnet-state")).toHaveText("ohlc");
  await page.mouse.click(box.x + target.x + 120, box.y + target.y + 80);

  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  const firstAnchor = (await getDrawingExport(page)).drawings[0].anchors[0];

  expect(firstAnchor).not.toEqual(rawClickPoint);
  expectPointToEqual(projectExportedAnchor(firstAnchor, box.width, box.height) as Point, target);
});

test("snaps selected anchor handle drags to another drawing anchor", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await page.mouse.click(box.x + 320, box.y + 200);
  await page.mouse.click(box.x + 440, box.y + 260);
  await expect(page.getByTestId("drawing-count")).toHaveText("2 drawings");

  const targetAnchor = (await getDrawingExport(page)).drawings[1].anchors[0];
  const projectedTargetAnchor = projectExportedAnchor(targetAnchor, box.width, box.height);

  await page.getByTestId("drawing-tool-select").click();
  await page.mouse.click(box.x + 180, box.y + 210);
  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: drawing-1");

  await page.mouse.move(box.x + 120, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(
    box.x + (projectedTargetAnchor.x ?? 0) + 4,
    box.y + (projectedTargetAnchor.y ?? 0) + 3
  );
  await expect(page.getByTestId("magnet-state")).toHaveText("drawingAnchor");
  await page.mouse.up();

  const drawings = (await getDrawingExport(page)).drawings;

  expectPointToEqual(
    projectExportedAnchor(drawings[0].anchors[0], box.width, box.height) as Point,
    projectedTargetAnchor as Point
  );
  expect(drawings[0].anchors[0].time).toBe(targetAnchor.time);
  expect(drawings[0].anchors[0].price).toBeCloseTo(targetAnchor.price ?? 0, 8);
});

test("drawing hover updates cursor diagnostics and hovered render state", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await page.getByTestId("drawing-tool-select").click();

  await page.mouse.move(box.x + 180, box.y + 206);
  await expect(page.getByTestId("cursor-state")).toHaveText("drawing");

  await page.mouse.move(box.x + Math.min(box.width - 40, 520), box.y + 180);
  await expect(page.getByTestId("cursor-state")).toHaveText("crosshair");

  await page.mouse.click(box.x + 180, box.y + 206);
  await expect(page.getByTestId("drawing-handle-count")).toHaveText("11 handles");

  await page.mouse.move(box.x + 260, box.y + 210);
  await expect(page.getByTestId("cursor-state")).toHaveText("resize");
});

test("body drag commits one undoable drawing move command", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await page.getByTestId("drawing-tool-select").click();
  await page.mouse.click(box.x + 150, box.y + 193);
  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: drawing-1");

  const getAnchors = async (): Promise<ExportedAnchor[]> => {
    const payload = JSON.parse(await page.getByTestId("drawing-json-export").inputValue()) as {
      drawings: Array<{ anchors: ExportedAnchor[] }>;
    };

    return payload.drawings[0].anchors;
  };
  const originalAnchors = await getAnchors();
  const originalScreenAnchors = projectExportedAnchors(
    originalAnchors,
    box.width,
    box.height
  );

  await page.mouse.move(box.x + 160, box.y + 197);
  await page.mouse.down();
  await page.mouse.move(box.x + 170, box.y + 207);
  await page.mouse.move(box.x + 180, box.y + 217);
  await page.mouse.move(box.x + 190, box.y + 227);
  await page.mouse.up();

  const movedScreenAnchors = originalScreenAnchors.map((anchor) => ({
    ...anchor,
    x: (anchor.x ?? 0) + 30,
    y: (anchor.y ?? 0) + 30
  }));
  const movedCanonicalAnchors = getCanonicalAnchors(
    movedScreenAnchors,
    box.width,
    box.height
  );

  await expect.poll(getAnchors).toEqual(movedCanonicalAnchors);

  await page.getByTestId("undo").click();

  await expect.poll(getAnchors).toEqual(originalAnchors);
});

test("committed body, resize, and rotate edits keep canonical projection through rerender", async ({
  page
}) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const canvas = page.getByTestId("chart-canvas");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await page.getByTestId("drawing-tool-select").click();
  await page.mouse.click(box.x + 150, box.y + 193);
  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: drawing-1");

  const readAnchors = async (): Promise<ExportedAnchor[]> =>
    (await getDrawingExport(page)).drawings[0].anchors;
  const readPixels = async (): Promise<string> =>
    canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  const originalAnchors = await readAnchors();
  const originalCanonical = originalAnchors.map(({ time, price }) => ({ time, price }));
  const originalPixels = await readPixels();

  await page.mouse.move(box.x + 160, box.y + 197);
  await page.mouse.down();
  await page.mouse.move(box.x + 190, box.y + 227);
  await page.mouse.up();

  const movedAnchors = await readAnchors();
  const movedCanonical = movedAnchors.map(({ time, price }) => ({ time, price }));

  expect(movedCanonical).toEqual(
    getCanonicalAnchors(
      projectExportedAnchors(movedAnchors, box.width, box.height),
      box.width,
      box.height
    )
  );
  expect(movedCanonical).not.toEqual(originalCanonical);
  await expect.poll(readPixels).not.toBe(originalPixels);

  const movedPixels = await readPixels();
  await page.getByTestId("resize-drawing").click();
  const resizedAnchors = await readAnchors();
  const resizedCanonical = resizedAnchors.map(({ time, price }) => ({ time, price }));

  expect(resizedCanonical).toEqual(
    getCanonicalAnchors(
      projectExportedAnchors(resizedAnchors, box.width, box.height),
      box.width,
      box.height
    )
  );
  expect(resizedCanonical).not.toEqual(movedCanonical);
  await expect.poll(readPixels).not.toBe(movedPixels);

  const resizedPixels = await readPixels();
  await page.getByTestId("rotate-drawing").click();
  const rotatedAnchors = await readAnchors();
  const rotatedCanonical = rotatedAnchors.map(({ time, price }) => ({ time, price }));

  expect(rotatedCanonical).toEqual(
    getCanonicalAnchors(
      projectExportedAnchors(rotatedAnchors, box.width, box.height),
      box.width,
      box.height
    )
  );
  expect(rotatedCanonical).not.toEqual(resizedCanonical);
  await expect.poll(readPixels).not.toBe(resizedPixels);

  await page.getByTestId("price-scale-mode-control").selectOption("percentage");
  await page.getByTestId("zoom-in").click();
  await expect
    .poll(async () => (await readAnchors()).map(({ time, price }) => ({ time, price })))
    .toEqual(rotatedCanonical);

  for (let index = 0; index < 3; index += 1) {
    await page.getByTestId("undo").click();
  }
  await expect
    .poll(async () => (await readAnchors()).map(({ time, price }) => ({ time, price })))
    .toEqual(originalCanonical);

  for (let index = 0; index < 3; index += 1) {
    await page.getByTestId("redo").click();
  }
  await expect
    .poll(async () => (await readAnchors()).map(({ time, price }) => ({ time, price })))
    .toEqual(rotatedCanonical);
});

test("uses the current projection for hit testing and body drag after scale and zoom changes", async ({
  page
}) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await page.getByTestId("drawing-tool-select").click();

  const original = (await getDrawingExport(page)).drawings[0];

  await page.getByTestId("price-scale-mode-control").selectOption("percentage");
  await page.getByTestId("zoom-in").click();
  await page.getByTestId("zoom-in").click();

  const context = getDrawingCoordinateContext(box.width, box.height, {
    priceScaleMode: "percentage",
    zoomInCount: 2
  });
  const projected = projectDrawingObject(
    { id: "current", type: "trendLine", anchors: original.anchors },
    context
  );
  const start = {
    x: ((projected.anchors[0].x ?? 0) + (projected.anchors[1].x ?? 0)) / 2,
    y: ((projected.anchors[0].y ?? 0) + (projected.anchors[1].y ?? 0)) / 2
  };
  const delta = { x: 24, y: 18 };

  await page.mouse.move(box.x + start.x, box.y + start.y);
  await expect(page.getByTestId("cursor-state")).toHaveText("drawing");
  await page.mouse.down();
  await page.mouse.move(box.x + start.x + delta.x, box.y + start.y + delta.y);
  await page.mouse.up();

  const moved = (await getDrawingExport(page)).drawings[0];
  const movedProjected = projectDrawingObject(
    { id: "moved", type: "trendLine", anchors: moved.anchors },
    context
  );

  expect(moved.anchors.map(({ time, price }) => ({ time, price }))).not.toEqual(
    original.anchors.map(({ time, price }) => ({ time, price }))
  );
  const snappedDeltaX = Math.round(delta.x / context.viewport.candleWidth) *
    context.viewport.candleWidth;
  movedProjected.anchors.forEach((anchor, index) => {
    expect(anchor.x).toBeCloseTo((projected.anchors[index].x ?? 0) + snappedDeltaX, 5);
    expect(anchor.y).toBeCloseTo((projected.anchors[index].y ?? 0) + delta.y, 5);
  });

  await page.getByTestId("undo").click();
  await expect
    .poll(async () =>
      (await getDrawingExport(page)).drawings[0].anchors.map(({ time, price }) => ({ time, price }))
    )
    .toEqual(original.anchors.map(({ time, price }) => ({ time, price })));
  await page.getByTestId("redo").click();
  await expect
    .poll(async () =>
      (await getDrawingExport(page)).drawings[0].anchors.map(({ time, price }) => ({ time, price }))
    )
    .toEqual(moved.anchors.map(({ time, price }) => ({ time, price })));
});

test("keeps paste and duplicate visually offset after scale and zoom changes", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await page.getByTestId("copy-drawing").click();
  await page.getByTestId("price-scale-mode-control").selectOption("percentage");
  await page.getByTestId("zoom-in").click();
  await page.getByTestId("zoom-in").click();
  await page.getByTestId("paste-drawing").click();
  await page.getByTestId("duplicate-drawing").click();

  const exported = await getDrawingExport(page);
  const context = getDrawingCoordinateContext(box.width, box.height, {
    priceScaleMode: "percentage",
    zoomInCount: 2
  });
  const projected = exported.drawings.map((drawing, index) =>
    projectDrawingObject(
      { id: `drawing-${index}`, type: "trendLine", anchors: drawing.anchors },
      context
    )
  );

  expect(projected).toHaveLength(3);
  const snappedXOffset = context.viewport.candleWidth;
  for (const anchorIndex of [0, 1]) {
    expect(projected[1].anchors[anchorIndex].x).toBeCloseTo(
      (projected[0].anchors[anchorIndex].x ?? 0) + snappedXOffset,
      5
    );
    expect(projected[1].anchors[anchorIndex].y).toBeCloseTo(
      (projected[0].anchors[anchorIndex].y ?? 0) + 12,
      5
    );
    expect(projected[2].anchors[anchorIndex].x).toBeCloseTo(
      (projected[0].anchors[anchorIndex].x ?? 0) + snappedXOffset * 2,
      5
    );
    expect(projected[2].anchors[anchorIndex].y).toBeCloseTo(
      (projected[0].anchors[anchorIndex].y ?? 0) + 24,
      5
    );
  }

  await page.getByTestId("undo").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("2 drawings");
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  await page.getByTestId("redo").click();
  await page.getByTestId("redo").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("3 drawings");
});

test("selects topmost drawing for equal-distance overlapping body hits", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await expect(page.getByTestId("drawing-count")).toHaveText("2 drawings");

  await page.locator("[data-drawing-id='drawing-1']").click();
  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: drawing-1");

  await page.getByTestId("drawing-tool-select").click();
  await page.mouse.click(box.x + 150, box.y + 193);

  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: drawing-2");
});

test("body drag preserves multi-selection and moves selected drawings together", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await page.mouse.click(box.x + 300, box.y + 200);
  await page.mouse.click(box.x + 440, box.y + 260);
  await page.getByTestId("drawing-tool-select").click();

  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 100, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 460, box.y + 280);
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: drawing-1, drawing-2");

  const getDrawings = async (): Promise<Array<{ anchors: ExportedAnchor[] }>> => {
    const payload = JSON.parse(await page.getByTestId("drawing-json-export").inputValue()) as {
      drawings: Array<{ anchors: ExportedAnchor[] }>;
    };

    return payload.drawings;
  };
  const originalDrawings = await getDrawings();

  await page.mouse.move(box.x + 180, box.y + 206);
  await page.mouse.down();
  await page.mouse.move(box.x + 190, box.y + 216);
  await page.mouse.move(box.x + 200, box.y + 226);
  await page.mouse.move(box.x + 210, box.y + 236);
  await page.mouse.up();

  const movedDrawings = originalDrawings.map((drawing) => {
    const screenAnchors = projectExportedAnchors(
      drawing.anchors,
      box.width,
      box.height
    ).map((anchor) => ({
      ...anchor,
      x: (anchor.x ?? 0) + 30,
      y: (anchor.y ?? 0) + 30
    }));
    const canonicalAnchors = getCanonicalAnchors(screenAnchors, box.width, box.height);

    return {
      ...drawing,
      anchors: canonicalAnchors
    };
  });

  await expect.poll(getDrawings).toEqual(movedDrawings);

  await page.getByTestId("undo").click();

  await expect.poll(getDrawings).toEqual(originalDrawings);
});

test("box-selects drawings through engine selection flow", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 160, box.y + 200);
  await page.mouse.click(box.x + 220, box.y + 220);
  await page.mouse.click(box.x + 260, box.y + 240);
  await page.getByTestId("drawing-tool-select").click();

  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 100, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 260);
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: drawing-1, drawing-2");
  await expect(page.getByTestId("drawing-handle-count")).toHaveText("22 handles");
});

test("property panel follows engine schema for fill and state controls", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-rectangle").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);

  await expect(page.getByTestId("drawing-style-fill")).toBeVisible();
  await page.getByTestId("drawing-state-locked").check();
  await expect(page.getByTestId("drawing-object-manager")).toContainText("locked");
  await expect(page.getByTestId("delete-drawing")).toBeDisabled();
});

test("property panel edits advanced drawing parameters", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-fibFan").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);

  await expect(page.getByTestId("drawing-parameter-fibonacciLevels")).toBeVisible();
  await page.getByTestId("drawing-parameter-fibonacciLevels").fill("0, 0.5, 1");
  await page.getByTestId("drawing-parameter-fibonacciLevels").blur();

  await expect(page.getByTestId("drawing-json-export")).toHaveValue(
    /"fibonacciLevels": \[\s*0,\s*0\.5,\s*1\s*\]/
  );
});

test("drawing action controls follow engine capabilities", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await expect(page.getByTestId("copy-drawing")).toBeDisabled();
  await expect(page.getByTestId("paste-drawing")).toBeDisabled();
  await expect(page.getByTestId("undo")).toBeDisabled();

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);

  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  await expect(page.getByTestId("copy-drawing")).toBeEnabled();
  await expect(page.getByTestId("paste-drawing")).toBeDisabled();

  await page.getByTestId("copy-drawing").click();
  await expect(page.getByTestId("paste-drawing")).toBeEnabled();

  await page.getByTestId("paste-drawing").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("2 drawings");

  await page.getByTestId("duplicate-drawing").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("3 drawings");
  await expect(page.getByTestId("send-drawing-backward")).toBeEnabled();

  await page.getByTestId("send-drawing-backward").click();
  await expect(page.getByTestId("bring-drawing-forward")).toBeEnabled();
  await page.getByTestId("bring-drawing-forward").click();

  await page.getByTestId("lock-drawing").click();
  await expect(page.getByTestId("unlock-drawing")).toBeEnabled();
  await expect(page.getByTestId("delete-drawing")).toBeDisabled();
  await expect(page.getByTestId("hide-drawing")).toBeDisabled();

  await page.getByTestId("unlock-drawing").click();
  await expect(page.getByTestId("hide-drawing")).toBeEnabled();
  await page.getByTestId("hide-drawing").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("2 drawings");
  await expect(page.getByTestId("show-drawing")).toBeEnabled();

  await page.getByTestId("show-drawing").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("3 drawings");
  await expect(page.getByTestId("undo")).toBeEnabled();
  await expect(page.getByTestId("redo")).toBeDisabled();

  await page.getByTestId("undo").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("2 drawings");
  await expect(page.getByTestId("redo")).toBeEnabled();
});

test("malformed drawing import shows status and preserves current drawings", async ({ page }) => {
  const pageErrors: Error[] = [];

  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");

  await page.getByTestId("drawing-json-import").fill("{bad json");
  await page.getByTestId("drawing-json-import-apply").click();

  await expect(page.getByTestId("drawing-json-import-status")).toHaveText("Invalid drawing JSON");
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  await expect(page.getByTestId("drawing-object-manager")).toContainText("trendLine");
  await expect(page.getByTestId("drawing-json-export")).toHaveValue(/trendLine/);
  expect(pageErrors).toHaveLength(0);
});
