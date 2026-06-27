import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createChartLayout,
  createInitialViewport,
  createOhlcMagnetTargetsFromSeries,
  createPanelLayout,
  fixtureDailyCandleSeries
} from "@simoncharts/chart-engine";

interface DrawingExportPayload {
  drawings: Array<{ anchors: Array<{ x: number; y: number }> }>;
}

interface Point {
  x: number;
  y: number;
}

async function getDrawingExport(page: Page): Promise<DrawingExportPayload> {
  return JSON.parse(await page.getByTestId("drawing-json-export").inputValue()) as DrawingExportPayload;
}

function expectPointToEqual(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
}

function getVisibleHighTarget(width: number, height: number): Point {
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
    fields: ["high"]
  });
  const target = targets.find(
    (candidate) =>
      candidate.x > 500 &&
      candidate.x < mainPanel.plotArea.width - 360 &&
      candidate.y > 180 &&
      candidate.y < mainPanel.plotArea.height - 40
  );

  if (!target) {
    throw new Error("visible OHLC high target missing");
  }

  return { x: target.x, y: target.y };
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
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("drawing-json-export")).toHaveValue(/"x": 121/);
  await page.getByTestId("resize-drawing").click();
  await expect(page.getByTestId("drawing-json-export")).toHaveValue(/"x": 273/);
  await page.getByTestId("rotate-drawing").click();
  await expect(page.getByTestId("drawing-json-export")).toHaveValue(/"x": 233/);
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

  await expect(page.getByTestId("drawing-json-export")).toHaveValue(/"x": 140/);
  await expect(page.getByTestId("drawing-json-export")).toHaveValue(/"y": 200/);
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

  await page.mouse.click(box.x + firstAnchor.x + 6, box.y + firstAnchor.y + 2);
  await expect(page.getByTestId("magnet-state")).toHaveText("drawingAnchor");
  await page.mouse.click(box.x + 340, box.y + 260);

  await expect(page.getByTestId("drawing-count")).toHaveText("2 drawings");
  const drawings = (await getDrawingExport(page)).drawings;

  expect(drawings[1].anchors[0]).toEqual(firstAnchor);
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
  expectPointToEqual(firstAnchor, target);
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

  await page.getByTestId("drawing-tool-select").click();
  await page.mouse.click(box.x + 180, box.y + 210);
  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: drawing-1");

  await page.mouse.move(box.x + 120, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + targetAnchor.x + 4, box.y + targetAnchor.y + 3);
  await expect(page.getByTestId("magnet-state")).toHaveText("drawingAnchor");
  await page.mouse.up();

  const drawings = (await getDrawingExport(page)).drawings;

  expect(drawings[0].anchors[0]).toEqual(targetAnchor);
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

  const getAnchors = async (): Promise<Array<{ x: number; y: number }>> => {
    const payload = JSON.parse(await page.getByTestId("drawing-json-export").inputValue()) as {
      drawings: Array<{ anchors: Array<{ x: number; y: number }> }>;
    };

    return payload.drawings[0].anchors;
  };
  const originalAnchors = await getAnchors();

  await page.mouse.move(box.x + 160, box.y + 197);
  await page.mouse.down();
  await page.mouse.move(box.x + 170, box.y + 207);
  await page.mouse.move(box.x + 180, box.y + 217);
  await page.mouse.move(box.x + 190, box.y + 227);
  await page.mouse.up();

  await expect.poll(getAnchors).toEqual([
    { x: originalAnchors[0].x + 30, y: originalAnchors[0].y + 30 },
    { x: originalAnchors[1].x + 30, y: originalAnchors[1].y + 30 }
  ]);

  await page.getByTestId("undo").click();

  await expect.poll(getAnchors).toEqual(originalAnchors);
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

  const getDrawings = async (): Promise<Array<{ anchors: Array<{ x: number; y: number }> }>> => {
    const payload = JSON.parse(await page.getByTestId("drawing-json-export").inputValue()) as {
      drawings: Array<{ anchors: Array<{ x: number; y: number }> }>;
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

  await expect.poll(getDrawings).toEqual(
    originalDrawings.map((drawing) => ({
      ...drawing,
      anchors: drawing.anchors.map((anchor) => ({ x: anchor.x + 30, y: anchor.y + 30 }))
    }))
  );

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
