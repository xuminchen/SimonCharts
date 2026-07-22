import { expect, test, type Page } from "@playwright/test";

async function drawTrendLine(page: Page): Promise<void> {
  await page.getByTestId("drawing-palette-expand").click();
  await page.locator('[data-drawing-category="basic"]').click();
  await page.locator('[data-drawing-tool="trendLine"]').click();
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  for (const [x, y] of [[250, 220], [450, 320]] as const) {
    await page.mouse.click(box.x + x, box.y + y);
  }
}

test("edits drawing objects and shows the runtime data window in the bottom workbench", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await drawTrendLine(page);

  await page.getByRole("tab", { name: "对象", exact: true }).click();
  await page.getByRole("button", { name: /trendLine/ }).click();
  await page.getByRole("tab", { name: "属性", exact: true }).click();
  await page.getByLabel("Color").fill("#f04455");
  await page.getByLabel("Color").press("Enter");

  await expect.poll(() => page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => candidate.includes(":drawings:"));
    if (!key) return undefined;
    const stored = JSON.parse(localStorage.getItem(key) ?? "null") as {
      value?: Array<{ style?: { color?: string } }>;
    } | null;
    return stored?.value?.[0]?.style?.color;
  })).toBe("#f04455");

  const redPixels = await page.locator("canvas.sc-static-canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] > 220 && pixels[index + 1] < 100 && pixels[index + 2] < 110) count += 1;
    }
    return count;
  });
  expect(redPixels).toBeGreaterThan(0);

  await page.getByTestId("indicator-manager-open").click();
  await page.getByRole("button", { name: "Moving Average", exact: true }).click();
  await page.getByRole("button", { name: "Apply MA" }).click();
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.45);

  await page.getByRole("tab", { name: "数据窗口", exact: true }).click();
  await expect(page.getByTestId("data-window-open")).not.toHaveText("--");
  await expect(page.getByTestId("data-window-indicator-MA")).not.toHaveText("--");
});
