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
