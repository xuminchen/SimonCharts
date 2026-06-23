import { expect, test } from "@playwright/test";

test("renders a nonblank static chart canvas", async ({ page }, testInfo) => {
  await page.goto("/");

  const canvas = page.getByTestId("chart-canvas");
  await expect(canvas).toBeVisible();

  await expect
    .poll(async () =>
      canvas.evaluate((element) => {
        const chartCanvas = element as HTMLCanvasElement;
        const context = chartCanvas.getContext("2d");

        if (!context || chartCanvas.width === 0 || chartCanvas.height === 0) {
          return 0;
        }

        const pixels = context.getImageData(0, 0, chartCanvas.width, chartCanvas.height).data;
        const colors = new Set<string>();

        for (let index = 0; index < pixels.length; index += 4) {
          colors.add(
            `${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`
          );

          if (colors.size > 4) {
            break;
          }
        }

        return colors.size;
      })
    )
    .toBeGreaterThan(4);

  await testInfo.attach("static-chart", {
    body: await canvas.screenshot(),
    contentType: "image/png"
  });
});

test("resizes the chart canvas with the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("/");

  const canvas = page.getByTestId("chart-canvas");
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const chartCanvas = element as HTMLCanvasElement;

        return (
          chartCanvas.clientWidth === 800 &&
          chartCanvas.clientHeight === 600 &&
          chartCanvas.width === Math.floor(800 * window.devicePixelRatio) &&
          chartCanvas.height === Math.floor(600 * window.devicePixelRatio)
        );
      })
    )
    .toBe(true);

  await page.setViewportSize({ width: 500, height: 400 });
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const chartCanvas = element as HTMLCanvasElement;

        return (
          chartCanvas.clientWidth === 500 &&
          chartCanvas.clientHeight === 400 &&
          chartCanvas.width === Math.floor(500 * window.devicePixelRatio) &&
          chartCanvas.height === Math.floor(400 * window.devicePixelRatio)
        );
      })
    )
    .toBe(true);
});
