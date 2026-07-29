import { expect, test, type Page } from "@playwright/test";

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) throw new Error("performance sample is empty");
  return [...values].sort((left, right) => left - right)[Math.ceil(values.length * ratio) - 1]!;
}

async function sampleInteraction(
  page: Page,
  eventType: "pointermove" | "wheel",
  action: () => Promise<void>
) {
  await expect.poll(() => page.evaluate(() => window.__hostCounters.activeAnimationFrames))
    .toBe(0);
  await page.evaluate((type) => {
    window.__hostCounters.frameCallbackDurations = [];
    window.__hostCounters.frameCallbackScheduledAt = [];
    window.__hostCounters.frameCallbackCompletedAt = [];
    window.__hostCounters.interactionStartedAt = undefined;
    const canvas = document.querySelector("canvas.sc-overlay-canvas")!;
    const record = (event: Event) => {
      window.__hostCounters.interactionStartedAt = performance.now();
      canvas.removeEventListener(type, record, true);
    };
    canvas.addEventListener(type, record, true);
  }, eventType);
  await action();
  await expect.poll(
    () => page.evaluate(() => {
      const startedAt = window.__hostCounters.interactionStartedAt;
      return startedAt === undefined
        ? 0
        : window.__hostCounters.frameCallbackScheduledAt.filter((time) => time >= startedAt).length;
    }),
    { intervals: [2, 5, 10], timeout: 1_000 }
  ).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__hostCounters.activeAnimationFrames))
    .toBe(0);
  return page.evaluate(() => {
    const durations = window.__hostCounters.frameCallbackDurations;
    const scheduled = window.__hostCounters.frameCallbackScheduledAt;
    const completed = window.__hostCounters.frameCallbackCompletedAt;
    const startedAt = window.__hostCounters.interactionStartedAt;
    if (startedAt === undefined) throw new Error("interaction event was not observed");
    const frameIndexes = scheduled.flatMap((time, index) => time >= startedAt ? [index] : []);
    if (frameIndexes.length === 0) throw new Error("interaction did not schedule a frame");
    const first = frameIndexes[0]!;
    return {
      callbackMs: Math.max(...frameIndexes.map((index) => durations[index]!)),
      responseMs: completed[first]! - startedAt,
      frameCount: frameIndexes.length
    };
  });
}

test("keeps a deep million-candle workspace within usable-frame and interaction budgets", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?million=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const start = window.__hostCounters.lastSeriesResolvedAt;
    const end = window.__hostCounters.firstDataReadyAt;
    return start === undefined || end === undefined ? undefined : end - start;
  })).not.toBeUndefined();
  const responseToFrameMs = await page.evaluate(() => window.__hostCounters.firstDataReadyAt! - window.__hostCounters.lastSeriesResolvedAt!);
  expect(responseToFrameMs).toBeLessThanOrEqual(100);
  const initial = await page.evaluate(() => (window.__workspaceRequests ?? []).find((request) => request.hasCursor === false && request.status === "resolved"));
  expect(initial).toMatchObject({ candleCount: 500, totalAvailable: 1_000_000 });

  const origin = Date.UTC(2026, 5, 5, 1, 30);
  const targetFrom = origin + 949_500 * 60_000;
  const targetTo = origin + 949_999 * 60_000;
  const deepHistory = await page.evaluate(async ({ from, to }) => {
    const chart = window.__chart!;
    chart.setVisibleRange({ from, to });
    const ready = await chart.dataReady();
    return {
      ready,
      responseToUsableFrameMs: performance.now() - window.__hostCounters.lastSeriesResolvedAt!,
      range: chart.getVisibleRange()
    };
  }, { from: targetFrom, to: targetTo });
  expect(deepHistory.ready).toBe(true);
  expect(deepHistory.responseToUsableFrameMs).toBeLessThanOrEqual(100);
  expect(deepHistory.range).toEqual({ from: targetFrom, to: targetTo });

  const history = await page.evaluate(() => (window.__workspaceRequests ?? [])
    .filter((request) => request.status === "resolved" && request.candleCount === 500));
  expect(history.reduce((total, request) => total + Number(request.candleCount), 0))
    .toBeGreaterThanOrEqual(50_000);
  const cursorPositions = history
    .filter((request) => request.hasCursor)
    .map((request) => Number(String(request.cursor).split(":")[1]));
  expect(new Set(cursorPositions).size).toBe(cursorPositions.length);
  expect(cursorPositions.every((position, index) =>
    index === 0 || cursorPositions[index - 1]! - position === 500
  )).toBe(true);

  expect(await page.evaluate(async ({ from }) => {
    const chart = window.__chart!;
    chart.setDrawings(Array.from({ length: 63 }, (_, index) => ({
      id: `perf-${index}`,
      type: "trendLine" as const,
      interactive: false,
      anchors: [
        { time: from + index * 60_000, price: 96 + index / 20 },
        { time: from + (index + 30) * 60_000, price: 97 + index / 20 }
      ]
    })));
    chart.setIndicators([
      { instanceId: "perf-ma", id: "MA", params: { period: 20 }, visible: true },
      { instanceId: "perf-rsi", id: "RSI", params: { period: 14 }, visible: true },
      { instanceId: "perf-macd", id: "MACD", params: { fast: 12, slow: 26, signal: 9 }, visible: true }
    ]);
    return chart.dataReady();
  }, { from: targetFrom })).toBe(true);

  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
  for (let index = 0; index < 5; index += 1) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(20);
  }

  const crosshairSamples = [];
  for (let index = 0; index < 30; index += 1) {
    crosshairSamples.push(await sampleInteraction(
      page,
      "pointermove",
      () => page.mouse.move(box.x + 100 + index * 10, box.y + box.height * 0.35)
    ));
  }
  expect(crosshairSamples.every((sample) => sample.frameCount > 0)).toBe(true);
  expect(percentile(crosshairSamples.map((sample) => sample.callbackMs), 0.95)).toBeLessThanOrEqual(16.7);
  expect(percentile(crosshairSamples.map((sample) => sample.responseMs), 0.95)).toBeLessThanOrEqual(50);

  for (let index = 0; index < 5; index += 1) {
    const startX = box.x + box.width * 0.55;
    const y = box.y + box.height * 0.45;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 8, y);
    await page.mouse.up();
    await page.waitForTimeout(20);
  }
  const beforePan = await page.evaluate(() => window.__chart!.getVisibleRange());
  const panSamples = [];
  for (let index = 0; index < 30; index += 1) {
    const startX = box.x + box.width * 0.55;
    const y = box.y + box.height * 0.45;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.waitForTimeout(20);
    panSamples.push(await sampleInteraction(
      page,
      "pointermove",
      () => page.mouse.move(startX - 8, y)
    ));
    await page.mouse.up();
  }
  const afterPan = await page.evaluate(() => window.__chart!.getVisibleRange());
  expect(afterPan).not.toEqual(beforePan);
  expect(panSamples.every((sample) => sample.frameCount > 0)).toBe(true);
  expect(percentile(panSamples.map((sample) => sample.callbackMs), 0.95)).toBeLessThanOrEqual(16.7);
  expect(percentile(panSamples.map((sample) => sample.responseMs), 0.95)).toBeLessThanOrEqual(50);

  const beforeZoom = await page.evaluate(() => window.__chart!.getVisibleRange());
  const zoomSamples = [];
  let firstZoomRange;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
  for (let index = 0; index < 30; index += 1) {
    zoomSamples.push(await sampleInteraction(
      page,
      "wheel",
      () => page.mouse.wheel(0, index % 2 === 0 ? -20 : 20)
    ));
    if (index === 0) {
      firstZoomRange = await page.evaluate(() => window.__chart!.getVisibleRange());
    }
  }
  expect(firstZoomRange).not.toEqual(beforeZoom);
  expect(zoomSamples.every((sample) => sample.frameCount > 0)).toBe(true);
  expect(percentile(zoomSamples.map((sample) => sample.callbackMs), 0.95)).toBeLessThanOrEqual(16.7);
  expect(percentile(zoomSamples.map((sample) => sample.responseMs), 0.95)).toBeLessThanOrEqual(50);

  await page.getByTestId("destroy-workspace").click();
  await expect(page.locator(".sc-workspace")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__hostCounters.activeRequests)).toBe(0);
  expect(await page.evaluate(() => ({
    observers: window.__hostCounters.activeObservers,
    frames: window.__hostCounters.activeAnimationFrames,
    errors: window.__hostCounters.errors
  }))).toEqual({ observers: 0, frames: 0, errors: 0 });
});

test("remembers a terminal unavailable presentation without hanging later callers", async ({ page }) => {
  await page.goto("/?million=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const chart = window.__chart!;
    const origin = Date.UTC(2026, 5, 5, 1, 30);
    chart.setTimeframe("5m");
    chart.setVisibleRange({
      from: origin + 975_000 * 60_000,
      to: origin + 999_999 * 60_000
    });
    const first = await chart.dataReady();
    const second = await Promise.race([
      chart.dataReady(),
      new Promise<"timeout">((resolve) => window.setTimeout(() => resolve("timeout"), 3_000))
    ]);
    chart.setVisibleRange({
      from: origin + 999_900 * 60_000,
      to: origin + 999_999 * 60_000
    });
    const sameSelectionRecovered = await chart.dataReady();
    chart.setTimeframe("1d");
    const recovered = await chart.dataReady();
    return { first, second, sameSelectionRecovered, recovered };
  });

  expect(result).toEqual({
    first: false,
    second: false,
    sameSelectionRecovered: true,
    recovered: true
  });
});

test("settles an unavailable queued range and waits for a same-selection recovery attempt", async ({ page }) => {
  await page.goto("/?million=1&latency=200");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const chart = window.__chart!;
    const origin = Date.UTC(2026, 5, 5, 1, 30);
    chart.setTimeframe("5m");
    chart.setVisibleRange({
      from: origin + 1_000_100 * 60_000,
      to: origin + 1_000_200 * 60_000
    });
    const unavailable = await Promise.race([
      chart.dataReady(),
      new Promise<"timeout">((resolve) => window.setTimeout(() => resolve("timeout"), 3_000))
    ]);

    chart.setVisibleRange({
      from: origin + 998_900 * 60_000,
      to: origin + 998_999 * 60_000
    });
    const recovery = chart.dataReady();
    const immediate = await Promise.race([
      recovery,
      new Promise<"pending">((resolve) => window.setTimeout(() => resolve("pending"), 50))
    ]);
    return { unavailable, immediate, recovered: await recovery };
  });

  expect(result).toEqual({ unavailable: false, immediate: "pending", recovered: true });
});

test("materializes latest after cancelling a same-selection range recovery", async ({ page }) => {
  await page.goto("/?million=1&latency=200");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const chart = window.__chart!;
    const origin = Date.UTC(2026, 5, 5, 1, 30);
    chart.setTimeframe("5m");
    chart.setVisibleRange({
      from: origin + 1_000_100 * 60_000,
      to: origin + 1_000_200 * 60_000
    });
    const unavailable = await chart.dataReady();

    chart.setVisibleRange({
      from: origin + 998_900 * 60_000,
      to: origin + 998_999 * 60_000
    });
    const recovery = chart.dataReady();
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    chart.resetToLatest();
    const reset = await Promise.race([
      recovery,
      new Promise<"timeout">((resolve) => window.setTimeout(() => resolve("timeout"), 3_000))
    ]);
    return { unavailable, reset };
  });

  expect(result).toEqual({ unavailable: false, reset: true });
});
