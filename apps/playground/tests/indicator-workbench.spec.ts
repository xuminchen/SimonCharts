import { expect, test } from "@playwright/test";
import { calculateCoreIndicator, coreIndicatorDefinitions, fixtureDailyCandleSeries } from "@simoncharts/chart-engine";
import { playgroundVisualOutputs } from "../src/fixtures/visualFixtures";

test("exposes every core indicator definition", async ({ page }) => {
  await page.goto("/");

  const selector = page.getByTestId("indicator-selector");
  const optionValues = await selector.locator("option").evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value)
  );

  await expect(selector).toBeVisible();
  expect(optionValues).toEqual(
    expect.arrayContaining(coreIndicatorDefinitions.map((definition) => definition.id))
  );
});

test("routes MACD outputs to an indicator sub panel", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("indicator-selector").selectOption("MACD");

  const macdOutputCount = calculateCoreIndicator("MACD", fixtureDailyCandleSeries).outputs.length;

  await expect(page.getByTestId("visual-output-count")).toHaveText(`${macdOutputCount} visuals`);
  await expect(page.getByTestId("panel-title-MACD")).toBeVisible();
});

test("routes BOLL outputs to the main panel", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("indicator-selector").selectOption("BOLL");

  const bollOutputCount = calculateCoreIndicator("BOLL", fixtureDailyCandleSeries).outputs.length;

  await expect(page.getByTestId("visual-output-count")).toHaveText(`${bollOutputCount} visuals`);
  await expect(page.getByTestId("panel-title-main")).toBeVisible();
});

test("clears interaction state across same-page indicator transitions", async ({ page }) => {
  await page.goto("/");

  const selector = page.getByTestId("indicator-selector");
  const overlay = page.getByTestId("chart-overlay");
  const bollOutputCount = calculateCoreIndicator("BOLL", fixtureDailyCandleSeries).outputs.length;
  const macdOutputCount = calculateCoreIndicator("MACD", fixtureDailyCandleSeries).outputs.length;

  await selector.selectOption("BOLL");
  await expect(page.getByTestId("panel-count")).toHaveText("1 panels");
  await expect(page.getByTestId("visual-output-count")).toHaveText(`${bollOutputCount} visuals`);
  await expect(page.getByTestId("panel-title-main")).toBeVisible();
  await expect(page.getByTestId("panel-title-MACD")).toHaveCount(0);

  await expect
    .poll(() =>
      overlay.evaluate((element) => {
        const canvas = element as HTMLCanvasElement;

        return canvas.width > 0 && canvas.height > 0;
      })
    )
    .toBe(true);

  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.mouse.move(box.x + 180, box.y + 220);
  await expect(page.getByTestId("cursor-state")).toHaveText("crosshair");
  await page.evaluate(() => {
    (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ = [];
  });

  await selector.selectOption("MACD");
  await expect(page.getByTestId("panel-count")).toHaveText("2 panels");
  await expect(page.getByTestId("visual-output-count")).toHaveText(`${macdOutputCount} visuals`);
  await expect(page.getByTestId("panel-title-main")).toBeVisible();
  await expect(page.getByTestId("panel-title-MACD")).toBeVisible();
  await expect(page.getByTestId("cursor-state")).toHaveText("default");
  await expect(page.getByTestId("magnet-state")).toHaveText("off");

  const resetEvents = await page.evaluate(() => {
    const events =
      (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ ?? [];

    return {
      crosshairHidden: events.some(
        (event) =>
          (event as { type?: string; crosshair?: { visible?: boolean } }).type ===
            "crosshairChanged" &&
          (event as { crosshair?: { visible?: boolean } }).crosshair?.visible === false
      ),
      cursorDefault: events.some(
        (event) =>
          (event as { type?: string; cursor?: string }).type === "cursorChanged" &&
          (event as { cursor?: string }).cursor === "default"
      )
    };
  });

  expect(resetEvents).toEqual({ crosshairHidden: true, cursorDefault: true });

  await selector.selectOption("");
  await expect(page.getByTestId("panel-count")).toHaveText("2 panels");
  await expect(page.getByTestId("visual-output-count")).toHaveText(`${playgroundVisualOutputs.length} visuals`);
  await expect(page.getByTestId("panel-title-main")).toBeVisible();
  await expect(page.getByTestId("panel-title-sub")).toBeVisible();
  await expect(page.getByTestId("panel-title-MACD")).toHaveCount(0);
  await expect(page.getByTestId("cursor-state")).toHaveText("default");
});
