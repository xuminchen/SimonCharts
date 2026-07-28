import { expect, test } from "@playwright/test";

function percentile(values: number[], ratio: number): number {
  return [...values].sort((left, right) => left - right)[Math.ceil(values.length * ratio) - 1] ?? 0;
}

test("renders a lazy million-candle source within bounded frame budgets", async ({ page }) => {
  await page.goto("/?million=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const start = window.__hostCounters.lastSeriesResolvedAt;
    const end = window.__hostCounters.firstFrameAfterSeriesResolvedAt;
    return start === undefined || end === undefined ? undefined : end - start;
  })).not.toBeUndefined();
  const responseToFrameMs = await page.evaluate(() => window.__hostCounters.firstFrameAfterSeriesResolvedAt! - window.__hostCounters.lastSeriesResolvedAt!);
  expect(responseToFrameMs).toBeLessThanOrEqual(100);
  const initial = await page.evaluate(() => (window.__workspaceRequests ?? []).find((request) => request.hasCursor === false && request.status === "resolved"));
  expect(initial).toMatchObject({ candleCount: 500, totalAvailable: 1_000_000 });

  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.evaluate(() => { window.__hostCounters.frameCallbackDurations = []; });
  for (let index = 0; index < 30; index += 1) {
    await canvas.evaluate((element, offset) => new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        element.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 200 + offset * 5, clientY: 220 }));
        requestAnimationFrame(() => resolve());
      });
    }), index);
  }
  const frameDurations = await page.evaluate(() => window.__hostCounters.frameCallbackDurations);
  expect(percentile(frameDurations, 0.95)).toBeLessThanOrEqual(16.7);
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
