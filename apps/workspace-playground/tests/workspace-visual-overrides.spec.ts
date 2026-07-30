import { expect, test, type Page } from "@playwright/test";

async function waitForPaint(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  ));
}

async function staticCanvasColorCount(
  page: Page,
  [red, green, blue]: readonly [number, number, number]
): Promise<number> {
  return page.locator("canvas.sc-static-canvas").evaluate((canvas, target) => {
    const context = (canvas as HTMLCanvasElement).getContext("2d");
    if (!context) throw new Error("static canvas context missing");
    const pixels = context.getImageData(0, 0, context.canvas.width, context.canvas.height).data;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        Math.abs(pixels[index]! - target[0]) <= 2 &&
        Math.abs(pixels[index + 1]! - target[1]) <= 2 &&
        Math.abs(pixels[index + 2]! - target[2]) <= 2
      ) count += 1;
    }
    return count;
  }, [red, green, blue] as const);
}

test("renders sparse series overrides without changing data or theme precedence", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const chart = window.__chart!;
    const beforeRequests = window.__workspaceRequests?.length ?? 0;
    chart.setSeriesVisualOverrides({
      type: "candles",
      upColor: "#ff00ff",
      downColor: "#00ffff",
      lineWidth: 2
    });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    const snapshot = chart.getSeriesVisualOverrides("candles") as {
      upColor?: string;
    };
    snapshot.upColor = "#000000";
    chart.setTheme("light");
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    return {
      ready: await chart.dataReady(),
      overrides: chart.getSeriesVisualOverrides("candles"),
      layout: chart.exportLayout().seriesVisualOverrides,
      beforeRequests,
      afterRequests: window.__workspaceRequests?.length ?? 0
    };
  });

  expect(result).toMatchObject({
    ready: true,
    overrides: {
      type: "candles",
      upColor: "#ff00ff",
      downColor: "#00ffff",
      lineWidth: 2
    },
    layout: [{
      type: "candles",
      upColor: "#ff00ff",
      downColor: "#00ffff",
      lineWidth: 2
    }]
  });
  expect(result.afterRequests).toBe(result.beforeRequests);
  expect(await staticCanvasColorCount(page, [255, 0, 255])).toBeGreaterThan(0);
  expect(await staticCanvasColorCount(page, [0, 255, 255])).toBeGreaterThan(0);

  await page.evaluate(() => window.__chart!.setSeriesVisualOverrides({ type: "candles" }));
  await waitForPaint(page);
  expect(await page.evaluate(() =>
    window.__chart!.getSeriesVisualOverrides("candles")
  )).toEqual({ type: "candles" });
  expect(await staticCanvasColorCount(page, [255, 0, 255])).toBe(0);
  expect(await staticCanvasColorCount(page, [0, 255, 255])).toBe(0);

  const stateful = await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setSeriesVisualOverrides({
      type: "renko",
      upColor: "#ff5500",
      downColor: "#00aa55",
      lineWidth: 3
    });
    chart.setSeriesType("renko");
    return {
      ready: await chart.dataReady(),
      type: chart.getSeriesType(),
      overrides: chart.getSeriesVisualOverrides("renko")
    };
  });
  expect(stateful).toEqual({
    ready: true,
    type: "renko",
    overrides: {
      type: "renko",
      upColor: "#ff5500",
      downColor: "#00aa55",
      lineWidth: 3
    }
  });
  expect(errors).toEqual([]);
});

test("styles and hides a study output without recalculation", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?customStudies=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const styled = await page.evaluate(async () => {
    const chart = window.__chart!;
    const study = chart.getStudyApi(
      window.__customStudyIds![0] as import("@simoncharts/charts").ChartIndicatorEntityId
    )!;
    const calls = window.__customStudyCalls;
    study.setVisualOverrides([{
      outputId: "average",
      type: "line",
      color: "#ff00ff",
      lineWidth: 4
    }]);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    return {
      calls,
      callsAfter: window.__customStudyCalls,
      overrides: study.getVisualOverrides(),
      indicator: chart.getAllStudies()[0],
      layout: chart.exportLayout().indicators[0]
    };
  });
  expect(styled.callsAfter).toBe(styled.calls);
  expect(styled.overrides).toEqual([{
    outputId: "average",
    type: "line",
    color: "#ff00ff",
    lineWidth: 4
  }]);
  expect(styled.indicator?.visualOverrides).toEqual(styled.overrides);
  expect(styled.layout?.visualOverrides).toEqual(styled.overrides);
  expect(await staticCanvasColorCount(page, [255, 0, 255])).toBeGreaterThan(0);
  await page.getByRole("tab", { name: "数据窗口", exact: true }).click();
  await expect(page.getByTestId("data-window-indicator-fixture-average")).toHaveCount(1);

  const hidden = await page.evaluate(async () => {
    const study = window.__chart!.getStudyApi(
      window.__customStudyIds![0] as import("@simoncharts/charts").ChartIndicatorEntityId
    )!;
    const calls = window.__customStudyCalls;
    study.setVisualOverrides([{
      outputId: "average",
      type: "line",
      visible: false,
      color: "#ff00ff",
      lineWidth: 4
    }]);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    return { calls, callsAfter: window.__customStudyCalls };
  });
  expect(hidden.callsAfter).toBe(hidden.calls);
  expect(await staticCanvasColorCount(page, [255, 0, 255])).toBe(0);
  await expect(page.getByTestId("data-window-indicator-fixture-average")).toHaveCount(0);
  expect(errors).toEqual([]);
});
