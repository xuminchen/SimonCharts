import { expect, test } from "@playwright/test";

const chartTypes = [
  "bars",
  "candles",
  "hollowCandles",
  "volumeCandles",
  "line",
  "lineWithMarkers",
  "stepLine",
  "area",
  "hlcArea",
  "baseline",
  "columns",
  "highLow",
  "heikinAshi",
  "renko",
  "lineBreak",
  "kagi",
  "pointAndFigure"
];

test("can switch every v0.1 chart type", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("chart-canvas")).toBeVisible();

  for (const type of chartTypes) {
    await page.getByTestId("series-type").selectOption(type);
    await expect(page.getByTestId("active-series-type")).toHaveText(type);
    await expect
      .poll(() =>
        page.getByTestId("chart-canvas").evaluate((element) => {
          const canvas = element as HTMLCanvasElement;
          const context = canvas.getContext("2d");
          if (!context) return 0;
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let renderedPixels = 0;
          for (let index = 3; index < pixels.length; index += 4) {
            const red = pixels[index - 3];
            const green = pixels[index - 2];
            const blue = pixels[index - 1];
            const alpha = pixels[index];
            if (alpha !== 0 && (red !== 255 || green !== 255 || blue !== 255)) renderedPixels += 1;
          }
          return renderedPixels;
        })
      )
      .toBeGreaterThan(1000);
  }
});
