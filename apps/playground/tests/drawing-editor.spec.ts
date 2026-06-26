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
  await expect(page.getByTestId("drawing-json-export")).toHaveValue(/trendLine/);

  await page.getByTestId("drawing-tool-select").click();
  await page.mouse.click(box.x + 180, box.y + 210);
  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: drawing-1");
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
