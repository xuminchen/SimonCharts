import { expect, test, type Page } from "@playwright/test";

async function staticCanvasHash(page: Page): Promise<number> {
  return page.locator("canvas.sc-static-canvas").evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext("2d");
    if (!context) throw new Error("static canvas context missing");
    const pixels = context.getImageData(0, 0, context.canvas.width, context.canvas.height).data;
    let hash = 2_166_136_261;
    for (let index = 0; index < pixels.length; index += 4) {
      hash = Math.imul(hash ^ pixels[index]!, 16_777_619);
      hash = Math.imul(hash ^ pixels[index + 1]!, 16_777_619);
      hash = Math.imul(hash ^ pixels[index + 2]!, 16_777_619);
      hash = Math.imul(hash ^ pixels[index + 3]!, 16_777_619);
    }
    return hash;
  });
}

test("programs active and inactive synthetic series properties atomically", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => window.__chart!.dataReady())).toBe(true);

  const defaults = await page.evaluate(() => {
    const chart = window.__chart!;
    const mutable = chart.getSeriesProperties("renko") as { brickSize: number };
    mutable.brickSize = 999;
    return {
      renko: chart.getSeriesProperties("renko"),
      lineBreak: chart.getSeriesProperties("lineBreak"),
      kagi: chart.getSeriesProperties("kagi"),
      pointAndFigure: chart.getSeriesProperties("pointAndFigure")
    };
  });
  expect(defaults).toEqual({
    renko: { type: "renko", brickSize: 1 },
    lineBreak: { type: "lineBreak", lineCount: 3 },
    kagi: { type: "kagi", reversalAmount: 2 },
    pointAndFigure: { type: "pointAndFigure", boxSize: 1, reversalBoxes: 3 }
  });

  expect(await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setSeriesType("renko");
    return chart.dataReady();
  })).toBe(true);
  const defaultHash = await staticCanvasHash(page);

  const activeTransition = await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setSeriesProperties({ type: "renko", brickSize: 4 });
    const ready = chart.dataReady();
    const first = await Promise.race([
      ready.then(() => "ready"),
      new Promise<string>((resolve) => requestAnimationFrame(() => resolve("frame")))
    ]);
    return { first, ready: await ready };
  });
  expect(activeTransition).toEqual({ first: "frame", ready: true });
  const configuredHash = await staticCanvasHash(page);
  expect(configuredHash).not.toBe(defaultHash);

  const inactiveTransition = await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setSeriesProperties({ type: "lineBreak", lineCount: 7 });
    const ready = await chart.dataReady();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    return {
      ready,
      seriesType: chart.getSeriesType(),
      lineBreak: chart.getSeriesProperties("lineBreak")
    };
  });
  expect(inactiveTransition).toEqual({
    ready: true,
    seriesType: "renko",
    lineBreak: { type: "lineBreak", lineCount: 7 }
  });
  expect(await staticCanvasHash(page)).toBe(configuredHash);

  const invalid = await page.evaluate(() => {
    const chart = window.__chart!;
    const before = chart.exportLayout();
    let layoutEvents = 0;
    const stop = chart.subscribeEvents((event) => {
      if (event.type === "layout-changed") layoutEvents += 1;
    });
    let error = "";
    try {
      chart.setSeriesProperties({ type: "renko", brickSize: 0 });
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    }
    stop();
    return { before, after: chart.exportLayout(), layoutEvents, error };
  });
  expect(invalid.error).toContain("positive");
  expect(invalid.layoutEvents).toBe(0);
  expect(invalid.after).toEqual(invalid.before);
  expect(await staticCanvasHash(page)).toBe(configuredHash);
  expect(errors).toEqual([]);
});

test("round-trips sparse properties through layout, preferences and intraday", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => window.__chart!.dataReady())).toBe(true);

  const imported = await page.evaluate(async () => {
    const chart = window.__chart!;
    const base = chart.exportLayout();
    let layoutEvents = 0;
    const stop = chart.subscribeEvents((event) => {
      if (event.type === "layout-changed") layoutEvents += 1;
    });
    chart.importLayout({
      ...base,
      seriesType: "renko",
      seriesProperties: [
        { type: "renko", brickSize: 2 },
        { type: "lineBreak", lineCount: 6 }
      ]
    });
    const ready = await chart.dataReady();
    stop();
    return { ready, layoutEvents, layout: chart.exportLayout() };
  });
  expect(imported.ready).toBe(true);
  expect(imported.layoutEvents).toBe(1);
  expect(imported.layout).toMatchObject({
    schemaVersion: 2,
    seriesType: "renko",
    seriesProperties: [
      { type: "renko", brickSize: 2 },
      { type: "lineBreak", lineCount: 6 }
    ]
  });

  const legacy = await page.evaluate(async () => {
    const chart = window.__chart!;
    const layout = chart.exportLayout() as unknown as Record<string, unknown>;
    delete layout.seriesProperties;
    chart.importLayout(layout as unknown as import("@simoncharts/charts").ChartLayoutV2);
    await chart.dataReady();
    return {
      renko: chart.getSeriesProperties("renko"),
      lineBreak: chart.getSeriesProperties("lineBreak"),
      layout: chart.exportLayout()
    };
  });
  expect(legacy.renko).toEqual({ type: "renko", brickSize: 1 });
  expect(legacy.lineBreak).toEqual({ type: "lineBreak", lineCount: 3 });
  expect(legacy.layout).not.toHaveProperty("seriesProperties");

  await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setSeriesProperties({ type: "renko", brickSize: 5 });
    await chart.dataReady();
  });
  await page.reload();
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(async () => ({
    ready: await window.__chart!.dataReady(),
    seriesType: window.__chart!.getSeriesType(),
    renko: window.__chart!.getSeriesProperties("renko")
  }))).toEqual({
    ready: true,
    seriesType: "renko",
    renko: { type: "renko", brickSize: 5 }
  });

  expect(await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setView("intraday");
    return chart.dataReady();
  })).toBe(true);
  const intradayHash = await staticCanvasHash(page);
  const intraday = await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setSeriesProperties({ type: "renko", brickSize: 6 });
    const ready = await chart.dataReady();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    return {
      ready,
      seriesType: chart.getSeriesType(),
      renko: chart.getSeriesProperties("renko")
    };
  });
  expect(intraday).toEqual({
    ready: true,
    seriesType: "line",
    renko: { type: "renko", brickSize: 6 }
  });
  expect(await staticCanvasHash(page)).toBe(intradayHash);

  expect(await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setView("timeframe");
    await chart.dataReady();
    return {
      seriesType: chart.getSeriesType(),
      renko: chart.getSeriesProperties("renko")
    };
  })).toEqual({
    seriesType: "renko",
    renko: { type: "renko", brickSize: 6 }
  });
  expect(errors).toEqual([]);
});

test("renders configured synthetic series after historical pages are materialized", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?history=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(async () => {
    const chart = window.__chart!;
    const origin = Date.UTC(2026, 5, 5, 1, 30);
    chart.setVisibleRange({
      from: origin,
      to: origin + 499 * 60_000
    });
    if (!await chart.dataReady()) return false;
    chart.resetToLatest();
    return chart.dataReady();
  })).toBe(true);
  await expect.poll(() => page.evaluate(() =>
    (window.__workspaceRequests ?? []).filter(
      (request) => request.hasCursor === true && request.status === "resolved"
    ).length
  )).toBeGreaterThan(0);

  await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setSeriesType("renko");
    if (!await chart.dataReady()) throw new Error("default Renko did not become ready");
  });
  const defaultHash = await staticCanvasHash(page);
  await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setSeriesProperties({ type: "renko", brickSize: 4 });
    if (!await chart.dataReady()) throw new Error("configured Renko did not become ready");
  });

  expect(await staticCanvasHash(page)).not.toBe(defaultHash);
  expect(errors).toEqual([]);
});
