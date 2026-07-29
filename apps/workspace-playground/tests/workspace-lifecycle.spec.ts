import { expect, test } from "@playwright/test";

test("destroy removes the workspace and every live host resource", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toHaveCount(1);
  await page.getByTestId("destroy-workspace").click();
  await expect(page.locator(".sc-workspace")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__hostCounters.activeRequests)).toBe(0);
  expect(await page.evaluate(() => window.__hostCounters.activeObservers)).toBe(0);
  expect(await page.evaluate(() => window.__hostCounters.activeAnimationFrames)).toBe(0);
  expect(await page.evaluate(() => window.__hostCounters.activeEventListeners)).toBe(0);
  await page.getByTestId("destroy-workspace").click();
  await expect(page.locator(".sc-workspace")).toHaveCount(0);
});

test("aborts in-flight work before removing the shell", async ({ page }) => {
  await page.goto("/?latency=1000");
  await expect(page.locator('.sc-workspace[data-state="loading"]')).toBeVisible();
  await page.getByTestId("destroy-workspace").click();
  await expect(page.locator(".sc-workspace")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__hostCounters.activeRequests)).toBe(0);
  expect(await page.evaluate(() => window.__hostCounters.abortedRequests)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__hostCounters.activeEventListeners)).toBe(0);
});

test("cancels readiness frames when data-loaded synchronously destroys the chart", async ({ page }) => {
  await page.goto("/?latency=1000");
  const result = await page.evaluate(async () => {
    const chart = window.__chart!;
    const pending = chart.dataReady();
    await new Promise<void>((resolve) => {
      const stop = chart.subscribeEvents((event) => {
        if (event.type !== "data-loaded" || event.phase !== "initial") return;
        stop();
        chart.destroy();
        resolve();
      });
    });
    return {
      ready: await pending,
      frames: window.__hostCounters.activeAnimationFrames,
      workspaces: document.querySelectorAll(".sc-workspace").length
    };
  });

  expect(result).toEqual({ ready: false, frames: 0, workspaces: 0 });
});

test("aborts a stale slow symbol and only publishes the latest selection", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.getByTestId("symbol-search-input").fill("慢速");
  await page.getByRole("option", { name: /慢速股票/ }).click();
  await page.getByTestId("symbol-search-input").fill("快速");
  await page.getByRole("option", { name: /快速股票/ }).click();
  await expect(page.locator('.sc-workspace[data-state="ready"] .sc-current-symbol')).toContainText("快速股票");
  await expect.poll(() => page.evaluate(() => window.__hostCounters.abortedRequests)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window.__workspaceRequests ?? []).filter((request) => request.status === "resolved" && request.symbolId === "stock:SSE:slow").length)).toBe(0);
});

test("retries a recoverable initial failure and blocks invalid data without retry", async ({ page }) => {
  await page.goto("/?initialFailure=once");
  await expect(page.locator('[data-error-code="INITIAL_DATA_FAILED"]')).toBeVisible();
  const retried = page.evaluate(async () => {
    const chart = window.__chart!;
    chart.retry();
    return chart.dataReady();
  });
  expect(await retried).toBe(true);
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  await page.goto("/?invalidPage=initial");
  await expect(page.locator('[data-error-code="INVALID_DATA"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);
});

async function requestOlderHistory(page: import("@playwright/test").Page): Promise<void> {
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.mouse.move(box.x + box.width / 2, box.y + 250);
  for (let step = 0; step < 10; step += 1) await page.mouse.wheel(0, 400);
}

for (const control of ["historyFailure=1", "invalidPage=history", "cursorCycle=1", "boundaryConflict=1"] as const) {
  test(`keeps trusted chart for ${control} history rejection`, async ({ page }) => {
    await page.goto(`/?${control}`);
    await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
    await requestOlderHistory(page);
    await expect(page.locator('.sc-workspace[data-state="ready-with-warning"]')).toBeVisible();
    await expect(page.locator('.sc-error-panel[data-warning="true"]')).toBeVisible();
    await expect(page.locator("canvas.sc-static-canvas")).toBeVisible();
  });
}

for (const control of ["historyFailure=1", "invalidPage=history"] as const) {
  test(`settles dataReady false when ${control} blocks a requested range`, async ({ page }) => {
    await page.goto(`/?${control}`);
    await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
    expect(await page.evaluate(async () => {
      const origin = Date.UTC(2026, 5, 5, 1, 30);
      window.__chart!.setVisibleRange({ from: origin, to: origin + 499 * 60_000 });
      return Promise.race([
        window.__chart!.dataReady(),
        new Promise<"timeout">((resolve) => window.setTimeout(() => resolve("timeout"), 1_000))
      ]);
    })).toBe(false);
  });
}

test("atomically refreshes a changed data version", async ({ page }) => {
  await page.goto("/?versionChange=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await requestOlderHistory(page);
  await expect.poll(() => page.evaluate(() => (window.__workspaceRequests ?? []).filter((request) => request.hasCursor === false && request.status === "resolved").map((request) => request.dataVersion))).toEqual(["fixture-v1", "fixture-v2"]);
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
});

for (const invalid of ["workspace", "context", "symbol", "datasource"] as const) {
  test(`rejects ${invalid} configuration without requests or retry`, async ({ page }) => {
    await page.goto(`/?invalid=${invalid}`);
    await expect(page.locator('[data-error-code="INVALID_CONFIGURATION"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__workspaceRequests?.length ?? 0)).toBe(0);
    expect(await page.evaluate(() => window.__hostCounters.errors)).toBe(1);
    await page.getByTestId("destroy-workspace").click();
    await expect(page.locator(".sc-workspace")).toHaveCount(0);
  });
}

test("throws synchronously for a non-element container", async ({ page }) => {
  await page.goto("/?nonElement=1");
  await expect(page.locator('body[data-non-element-error="TypeError"]')).toBeVisible();
  expect(await page.evaluate(() => window.__workspaceRequests?.length ?? 0)).toBe(0);
});

declare global {
  interface Window {
    __hostCounters: {
      activeRequests: number;
      activeObservers: number;
      activeAnimationFrames: number;
      activeEventListeners: number;
      abortedRequests: number;
      errors: number;
      frameCallbackDurations: number[];
      frameCallbackScheduledAt: number[];
      frameCallbackCompletedAt: number[];
      interactionStartedAt?: number;
      lastSeriesResolvedAt?: number;
      firstDataReadyAt?: number;
    };
    __workspaceRequests?: Array<Record<string, unknown>>;
  }
}
