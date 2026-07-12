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
  const frameDurations: number[] = [];
  for (let index = 0; index < 30; index += 1) {
    frameDurations.push(await canvas.evaluate((element, offset) => new Promise<number>((resolve) => {
      requestAnimationFrame(() => {
        const started = performance.now();
        element.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 200 + offset * 5, clientY: 220 }));
        requestAnimationFrame(() => resolve(performance.now() - started));
      });
    }), index));
  }
  expect(percentile(frameDurations, 0.95)).toBeLessThanOrEqual(16.7);
});
