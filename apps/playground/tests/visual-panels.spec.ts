import { expect, test } from "@playwright/test";

test("renders main and sub panel visual outputs", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("/");

  const canvas = page.getByTestId("chart-canvas");

  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("panel-count")).toHaveText("2 panels");
  await expect(page.getByTestId("visual-output-count")).toHaveText("4 visuals");

  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const chartCanvas = element as HTMLCanvasElement;
        const context = chartCanvas.getContext("2d");

        if (!context || chartCanvas.width === 0 || chartCanvas.height === 0) {
          return 0;
        }

        const pixels = context.getImageData(0, 0, chartCanvas.width, chartCanvas.height).data;
        let nonWhitePixels = 0;

        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const alpha = pixels[index + 3];

          if (alpha !== 0 && (red !== 255 || green !== 255 || blue !== 255)) {
            nonWhitePixels += 1;
          }
        }

        return nonWhitePixels;
      })
    )
    .toBeGreaterThan(1_000);

  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const chartCanvas = element as HTMLCanvasElement;
        const context = chartCanvas.getContext("2d");

        if (!context || chartCanvas.width === 0 || chartCanvas.height === 0) {
          return 0;
        }

        const pixels = context.getImageData(0, 0, chartCanvas.width, chartCanvas.height).data;
        let markerPixels = 0;

        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const alpha = pixels[index + 3];

          if (
            alpha > 200 &&
            red >= 200 &&
            red <= 235 &&
            green >= 20 &&
            green <= 60 &&
            blue >= 100 &&
            blue <= 145
          ) {
            markerPixels += 1;
          }
        }

        return markerPixels;
      })
    )
    .toBeGreaterThan(8);
});
