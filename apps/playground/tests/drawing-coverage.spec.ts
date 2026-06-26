import { expect, test } from "@playwright/test";

const tools = [
  "trendLine",
  "segment",
  "horizontalLine",
  "priceLine",
  "priceChannelLine",
  "fibonacciRetracement",
  "fibFan",
  "gannFan",
  "pitchfork",
  "text",
  "rectangle",
  "triangle",
  "longPosition",
  "datePriceRange",
  "elliottImpulseWave",
  "forecastPath"
];

test("playground exposes drawing tool categories and creates representative tools", async ({ page }) => {
  await page.goto("/");

  for (const tool of tools) {
    await expect(page.getByTestId(`drawing-tool-${tool}`)).toBeVisible();
  }

  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 160, box.y + 160);
  await page.mouse.click(box.x + 260, box.y + 220);

  await expect(page.getByTestId("drawing-count")).toContainText("1");
  await expect(page.getByTestId("drawing-object-manager")).toContainText("trendLine");
});
