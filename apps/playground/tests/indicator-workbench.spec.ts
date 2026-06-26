import { expect, test } from "@playwright/test";
import { calculateCoreIndicator, coreIndicatorDefinitions, fixtureDailyCandleSeries } from "@simoncharts/chart-engine";

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
