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
  "headAndShouldersPattern",
  "forecastPath"
];

const longLabelTools = [
  ["fibonacciRetracement", "Fibonacci Retracement"],
  ["elliottImpulseWave", "Elliott Impulse Wave"],
  ["headAndShouldersPattern", "Head And Shoulders"]
];

test("drawing actions and count are initially visible at desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  for (const testId of ["delete-drawing", "lock-drawing", "hide-drawing", "undo", "redo", "drawing-count"]) {
    await expect(page.getByTestId(testId)).toBeInViewport({ ratio: 1 });
  }
});

test("playground exposes drawing tool categories and creates representative tools", async ({ page }) => {
  await page.goto("/");

  for (const tool of tools) {
    await expect(page.getByTestId(`drawing-tool-${tool}`)).toBeVisible();
  }

  for (const [tool, label] of longLabelTools) {
    const button = page.getByTestId(`drawing-tool-${tool}`);

    await expect(button).toHaveText(label);
    await expect(button).toHaveAttribute("title", label);
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

test("imports valid drawing JSON into the workbench", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("drawing-json-import").fill(
    JSON.stringify({
      schemaVersion: 1,
      drawings: [
        {
          schemaVersion: 1,
          id: "imported-text",
          type: "text",
          anchors: [{ x: 180, y: 160 }],
          text: "Imported note",
          style: { color: "#2563eb", lineWidth: 3 }
        }
      ],
      selectedDrawingIds: ["imported-text"]
    })
  );
  await page.getByTestId("drawing-json-import-apply").click();

  await expect(page.getByTestId("drawing-json-import-status")).toHaveText("Imported 1 drawing");
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  await expect(page.getByTestId("drawing-object-manager")).toContainText("text imported-text");
  await expect(page.getByTestId("drawing-property-panel")).toContainText("Selection: imported-text");
});
