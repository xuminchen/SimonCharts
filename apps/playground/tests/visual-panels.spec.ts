import { expect, test, type Locator } from "@playwright/test";

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
      countMatchingPixels(canvas, {
        minYRatio: 0,
        maxYRatio: 0.72,
        red: [0, 20],
        green: [180, 220],
        blue: [195, 230],
        alpha: [201, 255]
      })
    )
    .toBeGreaterThan(8);

  await expect
    .poll(() =>
      countMatchingPixels(canvas, {
        minYRatio: 0,
        maxYRatio: 0.72,
        red: [240, 255],
        green: [205, 240],
        blue: [155, 205],
        alpha: [201, 255]
      })
    )
    .toBeGreaterThan(40);

  await expect
    .poll(() =>
      countMatchingPixels(canvas, {
        minYRatio: 0,
        maxYRatio: 0.72,
        red: [200, 235],
        green: [20, 60],
        blue: [100, 145],
        alpha: [201, 255]
      })
    )
    .toBeGreaterThan(8);

  await expect
    .poll(() =>
      countMatchingPixels(canvas, {
        minYRatio: 0.72,
        maxYRatio: 0.96,
        red: [0, 25],
        green: [120, 175],
        blue: [80, 130],
        alpha: [201, 255]
      })
    )
    .toBeGreaterThan(20);

  await expect
    .poll(() =>
      countMatchingPixels(canvas, {
        minYRatio: 0.72,
        maxYRatio: 0.96,
        red: [190, 235],
        green: [20, 60],
        blue: [20, 60],
        alpha: [201, 255]
      })
    )
    .toBeGreaterThan(8);

  await expect
    .poll(() =>
      countMatchingPixels(canvas, {
        minYRatio: 0.72,
        maxYRatio: 0.96,
        red: [20, 65],
        green: [80, 125],
        blue: [210, 255],
        alpha: [201, 255]
      })
    )
    .toBe(0);

  await expect
    .poll(() =>
      countMatchingPixels(canvas, {
        minYRatio: 0.72,
        maxYRatio: 0.96,
        red: [135, 165],
        green: [150, 180],
        blue: [170, 200],
        alpha: [201, 255]
      })
    )
    .toBe(0);

});

test("visual panel controls do not overlap reset on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");

  const controlsBox = await page.locator(".top-controls").boundingBox();
  const resetBox = await page.getByTestId("reset-view").boundingBox();

  expect(controlsBox).not.toBeNull();
  expect(resetBox).not.toBeNull();
  expect((controlsBox?.x ?? 0) + (controlsBox?.width ?? 0)).toBeLessThanOrEqual(
    resetBox?.x ?? 0
  );
});

type ColorRange = [number, number];

interface PixelCountOptions {
  minYRatio: number;
  maxYRatio: number;
  red: ColorRange;
  green: ColorRange;
  blue: ColorRange;
  alpha: ColorRange;
}

function countMatchingPixels(canvas: Locator, options: PixelCountOptions): Promise<number> {
  return canvas.evaluate((element, evaluateOptions) => {
    const chartCanvas = element as HTMLCanvasElement;
    const context = chartCanvas.getContext("2d");

    if (!context || chartCanvas.width === 0 || chartCanvas.height === 0) {
      return 0;
    }

    const minY = Math.floor(chartCanvas.height * evaluateOptions.minYRatio);
    const maxY = Math.ceil(chartCanvas.height * evaluateOptions.maxYRatio);
    const pixels = context.getImageData(0, 0, chartCanvas.width, chartCanvas.height).data;
    let count = 0;

    for (let y = minY; y < maxY; y += 1) {
      for (let x = 0; x < chartCanvas.width; x += 1) {
        const index = (y * chartCanvas.width + x) * 4;

        if (
          isBetween(pixels[index], evaluateOptions.red) &&
          isBetween(pixels[index + 1], evaluateOptions.green) &&
          isBetween(pixels[index + 2], evaluateOptions.blue) &&
          isBetween(pixels[index + 3], evaluateOptions.alpha)
        ) {
          count += 1;
        }
      }
    }

    return count;

    function isBetween(value: number, range: ColorRange): boolean {
      return value >= range[0] && value <= range[1];
    }
  }, options);
}
