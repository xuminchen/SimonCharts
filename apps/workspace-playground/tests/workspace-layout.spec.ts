import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
]) {
  test(`renders the approved full-width shell at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
    await expect(page.locator(".sc-top-toolbar")).toHaveCount(1);
    await expect(page.locator(".sc-chart-region")).toHaveCount(1);
    await expect(page.locator(".sc-bottom-panel")).toHaveCount(1);
    await expect(page.locator(".sc-right-sidebar")).toHaveCount(0);

    const chartBox = await page.locator(".sc-chart-region").boundingBox();
    const rootBox = await page.locator(".sc-workspace").boundingBox();
    expect(chartBox?.width).toBe(rootBox?.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    expect(errors).toEqual([]);
  });
}

test("paints the approved dark A-share canvas colors", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const counts = await page.locator("canvas.sc-static-canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    const targets = [[8, 9, 13], [240, 68, 85], [0, 170, 145]];
    return targets.map(([red, green, blue]) => {
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (Math.abs(pixels[index] - red) <= 3 && Math.abs(pixels[index + 1] - green) <= 3 && Math.abs(pixels[index + 2] - blue) <= 3) count += 1;
      }
      return count;
    });
  });
  expect(counts.every((count) => count > 0)).toBe(true);
});
