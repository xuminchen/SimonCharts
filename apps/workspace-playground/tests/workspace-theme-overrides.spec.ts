import { expect, test, type Page } from "@playwright/test";

async function waitForPaint(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  ));
}

async function canvasColorCounts(
  page: Page,
  colors: readonly [number, number, number][]
): Promise<number[]> {
  return page.locator("canvas.sc-static-canvas").evaluate((canvas, targets) => {
    const context = (canvas as HTMLCanvasElement).getContext("2d");
    if (!context) throw new Error("static canvas context missing");
    const pixels = context.getImageData(0, 0, context.canvas.width, context.canvas.height).data;
    return targets.map(([red, green, blue]) => {
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (
          Math.abs(pixels[index]! - red) <= 2 &&
          Math.abs(pixels[index + 1]! - green) <= 2 &&
          Math.abs(pixels[index + 2]! - blue) <= 2
        ) count += 1;
      }
      return count;
    });
  }, colors);
}

test("applies, replaces and resets host-owned theme overrides atomically", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?themeOverrides=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => window.__chart!.dataReady())).toBe(true);
  await waitForPaint(page);

  expect(await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".sc-workspace")!;
    const style = getComputedStyle(root);
    const snapshot = window.__chart!.getThemeOverrides() as {
      backgroundColor?: string;
    };
    snapshot.backgroundColor = "#000000";
    return {
      theme: window.__chart!.getTheme(),
      overrides: window.__chart!.getThemeOverrides(),
      variables: [
        "--sc-bg",
        "--sc-surface",
        "--sc-surface-hover",
        "--sc-border",
        "--sc-grid",
        "--sc-text",
        "--sc-muted",
        "--sc-accent",
        "--sc-up",
        "--sc-down",
        "--sc-intraday-average"
      ].map((name) => style.getPropertyValue(name).trim()),
      background: style.backgroundColor,
      color: style.color
    };
  })).toEqual({
    theme: "dark",
    overrides: {
      backgroundColor: "#123456",
      surfaceColor: "#234567",
      surfaceHoverColor: "#345678",
      borderColor: "#456789",
      gridColor: "#56789a",
      textColor: "#6789ab",
      mutedTextColor: "#789abc",
      accentColor: "#89abcd",
      upColor: "#ff00ff",
      downColor: "#00ffff",
      intradayAverageColor: "#abcdef"
    },
    variables: [
      "#123456",
      "#234567",
      "#345678",
      "#456789",
      "#56789a",
      "#6789ab",
      "#789abc",
      "#89abcd",
      "#ff00ff",
      "#00ffff",
      "#abcdef"
    ],
    background: "rgb(18, 52, 86)",
    color: "rgb(103, 137, 171)"
  });
  expect((await canvasColorCounts(page, [
    [0x12, 0x34, 0x56],
    [0xff, 0x00, 0xff],
    [0x00, 0xff, 0xff]
  ])).every((count) => count > 0)).toBe(true);

  const isolation = await page.evaluate(async () => {
    const chart = window.__chart!;
    const beforeLayout = chart.exportLayout();
    const beforeRange = chart.getVisibleRange();
    const beforeRequests = window.__workspaceRequests?.length ?? 0;
    let layoutEvents = 0;
    const stop = chart.subscribeEvents((event) => {
      if (event.type === "layout-changed") layoutEvents += 1;
    });
    chart.setThemeOverrides({
      backgroundColor: "#223344",
      surfaceColor: "#334455",
      textColor: "#f0f0f0",
      upColor: "#ff8800",
      downColor: "#0088ff"
    });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    stop();
    return {
      overrides: chart.getThemeOverrides(),
      layoutEvents,
      beforeLayout,
      afterLayout: chart.exportLayout(),
      beforeRange,
      afterRange: chart.getVisibleRange(),
      beforeRequests,
      afterRequests: window.__workspaceRequests?.length ?? 0,
      ready: await chart.dataReady(),
      storage: Object.values(localStorage).join("\n")
    };
  });
  expect(isolation).toMatchObject({
    overrides: {
      backgroundColor: "#223344",
      surfaceColor: "#334455",
      textColor: "#f0f0f0",
      upColor: "#ff8800",
      downColor: "#0088ff"
    },
    layoutEvents: 0,
    ready: true,
    storage: expect.not.stringContaining("#123456")
  });
  expect(isolation.storage).not.toContain("#223344");
  expect(isolation.storage).not.toContain("themeOverrides");
  expect(isolation.afterLayout).toEqual(isolation.beforeLayout);
  expect(isolation.afterRange).toEqual(isolation.beforeRange);
  expect(isolation.afterRequests).toBe(isolation.beforeRequests);
  expect((await canvasColorCounts(page, [
    [0x22, 0x33, 0x44],
    [0xff, 0x88, 0x00],
    [0x00, 0x88, 0xff]
  ])).every((count) => count > 0)).toBe(true);

  await page.evaluate(() => window.__chart!.setThemeOverrides({
    backgroundColor: "#445566"
  }));
  await waitForPaint(page);
  expect(await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".sc-workspace")!;
    const style = getComputedStyle(root);
    return {
      overrides: window.__chart!.getThemeOverrides(),
      inlineUp: root.style.getPropertyValue("--sc-up"),
      computedUp: style.getPropertyValue("--sc-up").trim()
    };
  })).toEqual({
    overrides: { backgroundColor: "#445566" },
    inlineUp: "",
    computedUp: "#f04455"
  });

  await page.evaluate(() => window.__chart!.setThemeOverrides({}));
  await waitForPaint(page);
  expect(await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".sc-workspace")!;
    return {
      overrides: window.__chart!.getThemeOverrides(),
      inlineBackground: root.style.getPropertyValue("--sc-bg"),
      computedBackground: getComputedStyle(root).getPropertyValue("--sc-bg").trim()
    };
  })).toEqual({
    overrides: {},
    inlineBackground: "",
    computedBackground: "#13161d"
  });
  expect((await canvasColorCounts(page, [[0x13, 0x16, 0x1d]]))[0]).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("switches the base theme at runtime while preserving valid overrides", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const chart = window.__chart!;
    const defaultOverrides = chart.getThemeOverrides();
    chart.setThemeOverrides({ upColor: "#ff00ff" });
    chart.setTheme("light");
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    const beforeInvalid = chart.getThemeOverrides();
    const failures: string[] = [];
    try {
      chart.setTheme("sepia" as import("@simoncharts/charts").ChartTheme);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
    try {
      chart.setThemeOverrides({
        backgroundColor: "definitely-not-a-color"
      });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
    try {
      chart.setThemeOverrides(undefined as never);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
    try {
      chart.setThemeOverrides({
        backgroundColor: "color-mix(in srgb, currentColor, red)"
      });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
    const root = document.querySelector<HTMLElement>(".sc-workspace")!;
    const style = getComputedStyle(root);
    return {
      defaultOverrides,
      theme: chart.getTheme(),
      overrides: chart.getThemeOverrides(),
      beforeInvalid,
      datasetTheme: root.dataset.theme,
      background: style.getPropertyValue("--sc-bg").trim(),
      up: style.getPropertyValue("--sc-up").trim(),
      failures
    };
  });
  expect(result).toMatchObject({
    defaultOverrides: {},
    theme: "light",
    overrides: { upColor: "#ff00ff" },
    beforeInvalid: { upColor: "#ff00ff" },
    datasetTheme: "light",
    background: "#ffffff",
    up: "#ff00ff"
  });
  expect(result.failures).toHaveLength(4);
  expect((await canvasColorCounts(page, [
    [0xff, 0xff, 0xff],
    [0xff, 0x00, 0xff]
  ])).every((count) => count > 0)).toBe(true);

  await page.evaluate(() => window.__chart!.setTheme("dark"));
  await waitForPaint(page);
  expect(await page.evaluate(() => ({
    theme: window.__chart!.getTheme(),
    overrides: window.__chart!.getThemeOverrides(),
    up: getComputedStyle(document.querySelector(".sc-workspace")!)
      .getPropertyValue("--sc-up").trim()
  }))).toEqual({
    theme: "dark",
    overrides: { upColor: "#ff00ff" },
    up: "#ff00ff"
  });
  expect(errors).toEqual([]);
});
