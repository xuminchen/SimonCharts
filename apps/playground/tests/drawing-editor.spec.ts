import { expect, test } from "@playwright/test";

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
