import { expect, test } from "@playwright/test";

test("keeps every grouped execution reachable inside a bounded tooltip", async ({ page }) => {
  await page.goto("/?executionOverflow=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const marker = await page.locator("canvas.sc-overlay-canvas").evaluate(async (canvas) => {
    const tooltip = document.querySelector<HTMLElement>(".sc-execution-tooltip");
    const rect = canvas.getBoundingClientRect();
    if (!tooltip) throw new Error("execution tooltip missing");
    for (let x = rect.width - 110; x <= rect.width - 45; x += 4) {
      for (let y = 70; y <= rect.height - 100; y += 6) {
        canvas.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true,
          clientX: rect.left + x,
          clientY: rect.top + y,
          pointerType: "mouse"
        }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (!tooltip.hidden) return { x: rect.left + x, y: rect.top + y };
      }
    }
    throw new Error("execution marker not found");
  });

  const tooltip = page.getByTestId("execution-tooltip");
  const region = page.locator(".sc-chart-region");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveAttribute("data-pinned", "false");
  expect(await tooltip.locator(".sc-execution-tooltip-row").count()).toBe(210);

  const bounds = await Promise.all([region.boundingBox(), tooltip.boundingBox()]);
  if (!bounds[0] || !bounds[1]) throw new Error("tooltip bounds missing");
  expect(bounds[1].x).toBeGreaterThanOrEqual(bounds[0].x + 8);
  expect(bounds[1].y).toBeGreaterThanOrEqual(bounds[0].y + 8);
  expect(bounds[1].x + bounds[1].width).toBeLessThanOrEqual(bounds[0].x + bounds[0].width - 8);
  expect(bounds[1].y + bounds[1].height).toBeLessThanOrEqual(bounds[0].y + bounds[0].height - 8);
  await expect.poll(() => tooltip.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  await page.mouse.click(marker.x, marker.y);
  await expect(tooltip).toHaveAttribute("data-pinned", "true");
  await tooltip.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => tooltip.evaluate((element) => element.scrollTop > 0)).toBe(true);
  await expect(tooltip).toContainText("#30 时间");

  const canvasBox = await page.locator("canvas.sc-overlay-canvas").boundingBox();
  if (!canvasBox) throw new Error("canvas missing");
  await page.mouse.click(canvasBox.x + 140, canvasBox.y + 90);
  await expect(tooltip).toBeHidden();
});
