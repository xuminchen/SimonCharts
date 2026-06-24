import { expect, test } from "@playwright/test";

test("pointer movement updates overlay diagnostics without static redraw spam", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("chart-overlay")).toBeVisible();
  await expect
    .poll(() =>
      page.getByTestId("chart-canvas").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;

        return canvas.width > 0 && canvas.height > 0;
      })
    )
    .toBe(true);

  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  const staticBefore = Number(await page.getByTestId("static-render-count").textContent());

  for (let index = 0; index < 8; index += 1) {
    await page.mouse.move(box.x + 100 + index * 3, box.y + 180);
  }

  await expect(page.getByTestId("cursor-state")).toHaveText("crosshair");
  await expect(page.getByTestId("last-invalidation-reason")).toHaveText(
    /pointerMoved|crosshairChanged/
  );
  const staticAfter = Number(await page.getByTestId("static-render-count").textContent());
  const overlayAfter = Number(await page.getByTestId("overlay-render-count").textContent());

  expect(staticAfter - staticBefore).toBeLessThanOrEqual(1);
  expect(overlayAfter).toBeGreaterThan(0);
});

test("keyboard zoom commands use neutral interaction events", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("+");
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("zoomIn");

  await page.keyboard.press("-");
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("zoomOut");

  await page.keyboard.press("0");
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("resetZoom");
});
