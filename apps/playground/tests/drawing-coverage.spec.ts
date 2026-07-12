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

  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-select").click();
  await page.mouse.move(box.x + 180, box.y + 160);
  await expect(page.getByTestId("cursor-state")).toHaveText("drawing");
});

test("routes canonical timeframe, scale, projection, and continuous drawing lifecycle", async ({
  page
}) => {
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto("/");

  const timeframe = page.getByTestId("timeframe");
  const priceScaleMode = page.getByTestId("price-scale-mode-control");

  await expect(timeframe.locator("option")).toHaveText([
    "1m",
    "5m",
    "15m",
    "30m",
    "60m",
    "1d",
    "1w",
    "1mo"
  ]);
  await expect(priceScaleMode.locator("option")).toHaveText([
    "linear",
    "log",
    "percentage"
  ]);

  await timeframe.selectOption("1m");
  await expect(page.getByTestId("active-timeframe")).toHaveText("1m");
  await priceScaleMode.selectOption("percentage");
  await expect(page.getByTestId("price-scale-mode")).toHaveText("percentage");

  const overlay = page.getByTestId("chart-overlay");
  const canvas = page.getByTestId("chart-canvas");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-brush").click();
  await page.mouse.move(box.x + 140, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 170, box.y + 195);
  await page.mouse.move(box.x + 205, box.y + 220);
  await page.mouse.up();

  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  const committedPayload = JSON.parse(
    await page.getByTestId("drawing-json-export").inputValue()
  ) as {
    drawings: Array<{ anchors: Array<{ time?: number; price?: number }> }>;
  };
  const canonicalAnchors = committedPayload.drawings[0]?.anchors.map(({ time, price }) => ({
    time,
    price
  }));

  expect(committedPayload.drawings).toHaveLength(1);
  expect(canonicalAnchors?.length).toBeGreaterThanOrEqual(2);
  expect(
    canonicalAnchors?.every(
      (anchor) => Number.isFinite(anchor.time) && Number.isFinite(anchor.price)
    )
  ).toBe(true);
  await expect(page.getByTestId("undo")).toBeEnabled();

  const committedPixels = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).toDataURL()
  );

  await page.evaluate(() => {
    (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ = [];
  });
  await page.mouse.move(box.x + 260, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 295, box.y + 215);
  await page.mouse.move(box.x + 330, box.y + 240);

  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as unknown as { __SIMON_CHART_EVENTS__?: Array<Record<string, unknown>> })
          .__SIMON_CHART_EVENTS__ ?? []).some(
          (event) => event.type === "drawingPreviewChanged" && "drawing" in event
        )
      )
    )
    .toBe(true);
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  expect(
    (
      JSON.parse(await page.getByTestId("drawing-json-export").inputValue()) as {
        drawings: unknown[];
      }
    ).drawings
  ).toHaveLength(1);
  await expect
    .poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL()))
    .not.toBe(committedPixels);

  await overlay.evaluate((element, point) => {
    element.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        pointerId: 1,
        clientX: point.x,
        clientY: point.y
      })
    );
  }, { x: box.x + 330, y: box.y + 240 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const events =
          (window as unknown as { __SIMON_CHART_EVENTS__?: Array<Record<string, unknown>> })
            .__SIMON_CHART_EVENTS__ ?? [];

        return {
          previewCleared: events.some(
            (event) =>
              event.type === "drawingPreviewChanged" && event.drawing === undefined
          ),
          canceled: events.some((event) => event.type === "creationCanceled")
        };
      })
    )
    .toEqual({ previewCleared: true, canceled: true });
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
  await expect
    .poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL()))
    .toBe(committedPixels);

  await timeframe.selectOption("1w");
  expect(consoleErrors).toEqual([]);
  await expect(page.getByTestId("active-timeframe")).toHaveText("1w");
  await priceScaleMode.selectOption("log");
  await page.getByTestId("zoom-in").click();

  const reprojectedPayload = JSON.parse(
    await page.getByTestId("drawing-json-export").inputValue()
  ) as {
    drawings: Array<{ anchors: Array<{ time?: number; price?: number }> }>;
  };

  expect(
    reprojectedPayload.drawings[0]?.anchors.map(({ time, price }) => ({ time, price }))
  ).toEqual(canonicalAnchors);
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");

  await page.getByTestId("undo").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("0 drawings");
  await expect(page.getByTestId("undo")).toBeDisabled();
  expect(consoleErrors).toEqual([]);
});
