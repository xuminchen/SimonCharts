import { expect, test } from "@playwright/test";

test("toolbar actions update neutral engine state", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("toggle-grid").click();
  await expect(page.getByTestId("grid-state")).toHaveText("grid off");

  await page.getByTestId("invert-price-scale").click();
  await expect(page.getByTestId("scale-state")).toHaveText("inverted");

  await page.getByTestId("theme-mode").selectOption("dark");
  await expect(page.getByTestId("theme-state")).toHaveText("dark");
});

test("canonical viewport and scale controls update owned render state", async ({ page }) => {
  await page.goto("/");

  const canvas = page.getByTestId("chart-canvas");
  const candleWidth = page.getByTestId("viewport-candle-width");
  const initialWidth = Number(await candleWidth.textContent());
  const initialPixels = await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());

  await page.getByTestId("zoom-in").click();
  await expect.poll(async () => Number(await candleWidth.textContent())).toBeGreaterThan(initialWidth);
  await expect
    .poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL()))
    .not.toBe(initialPixels);

  await page.getByTestId("reset-view").click();
  await expect.poll(async () => Number(await candleWidth.textContent())).toBe(initialWidth);

  await page.getByTestId("zoom-out").click();
  await expect.poll(async () => Number(await candleWidth.textContent())).toBeLessThan(initialWidth);

  const linearPixels = await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());

  await page.getByTestId("percentage-price-scale").click();
  await expect(page.getByTestId("price-scale-mode")).toHaveText("percentage");
  await expect
    .poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL()))
    .not.toBe(linearPixels);

  await page.getByTestId("zoom-in").click();
  await page.getByTestId("zoom-in").click();
  await expect.poll(async () => Number(await candleWidth.textContent())).toBe(10);

  await page.evaluate(() => {
    (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ = [];
  });
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -120);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          ((window as unknown as { __SIMON_CHART_EVENTS__?: Array<{ type?: string }> })
            .__SIMON_CHART_EVENTS__ ?? []).filter((event) => event.type === "viewportChanged").length
      )
    )
    .toBe(1);
  await expect.poll(async () => Number(await candleWidth.textContent())).toBe(12.5);
});
