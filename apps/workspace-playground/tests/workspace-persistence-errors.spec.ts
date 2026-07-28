import { expect, test, type Page } from "@playwright/test";

async function chooseSeriesType(page: Page, type: string): Promise<void> {
  const trigger = page.getByTestId("series-type-select");
  await trigger.click();
  await page.locator(`[data-series-type="${type}"]`).click();
  await expect(trigger).toHaveAttribute("data-value", type);
}

async function chooseTimeframe(page: Page, timeframe: string): Promise<void> {
  const shortcut = page.locator(
    `.sc-timeframes > [data-timeframe-shortcut][data-chart-view="timeframe"][data-timeframe="${timeframe}"]`
  );
  if (await shortcut.isVisible()) {
    await shortcut.click();
    return;
  }
  const menu = page.locator(".sc-timeframe-more-menu");
  if (await menu.isHidden()) await page.locator(".sc-timeframe-more-toggle").click();
  await menu.locator(`[data-chart-view="timeframe"][data-timeframe="${timeframe}"]`).click();
}

async function createTrendLine(page: Page): Promise<void> {
  await page.getByTestId("drawing-palette-expand").click();
  await page.locator('[data-drawing-category="basic"]').click();
  await page.locator('[data-drawing-tool="trendLine"]').click();
  const box = await page.locator("canvas.sc-overlay-canvas").boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.mouse.click(box.x + 260, box.y + 180);
  await page.mouse.click(box.x + 440, box.y + 280);
}

test("restores UI preferences without persisting market data or search results", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"], .sc-workspace[data-state="ready-with-warning"]')).toBeVisible();
  await chooseSeriesType(page, "area");
  await page.getByTestId("price-scale-select").selectOption("percentage");
  await page.getByRole("tab", { name: "数据窗口", exact: true }).click();
  await page.getByTestId("indicator-manager-open").click();
  await page.getByRole("button", { name: "Moving Average", exact: true }).click();
  await page.getByRole("button", { name: "Apply MA", exact: true }).click();
  await page.getByTestId("symbol-search-input").fill("000001");
  await expect(page.getByRole("option", { name: /上证指数/ })).toBeVisible();

  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain("2026-06-05");
  expect(storage).not.toContain("上证指数");
  expect(storage).not.toMatch(/token|provider|turnover|candles|"open"|"high"|"low"|"close"/i);
  await page.reload();
  await expect(page.getByTestId("series-type-select")).toHaveAttribute("data-value", "area");
  await expect(page.getByTestId("price-scale-select")).toHaveValue("percentage");
  await expect(page.locator('[data-testid^="indicator-legend-MA-"]')).toHaveAttribute("data-visible", "true");
  await expect(page.getByRole("tab", { name: "数据窗口", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("scopes drawings by symbol and adjustment while sharing them across timeframes", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await createTrendLine(page);
  await page.getByRole("tab", { name: "对象", exact: true }).click();
  await expect(page.locator(".sc-object-row")).toHaveCount(1);
  await chooseTimeframe(page, "5m");
  await expect(page.locator(".sc-object-row")).toHaveCount(1);
  await page.getByTestId("adjust-select").selectOption("backward");
  await expect(page.locator(".sc-object-row")).toHaveCount(0);
  await page.getByTestId("adjust-select").selectOption("forward");
  await expect(page.locator(".sc-object-row")).toHaveCount(1);
  await page.getByTestId("symbol-search-input").fill("000001");
  await page.getByRole("option", { name: /上证指数/ }).click();
  await expect(page.locator(".sc-object-row")).toHaveCount(0);
});

test("recovers malformed storage and keeps trusted chart on storage write failure", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("simoncharts:workspace:v1:workspace-playground:fixture-user:layout", "not-json");
  });
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => window.__hostCounters.errors)).toBe(1);

  await page.close();
});

test("reports storage writes as nonblocking warnings", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
  });
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"], .sc-workspace[data-state="ready-with-warning"]')).toBeVisible();
  await chooseSeriesType(page, "line");
  await expect(page.locator('.sc-workspace[data-state="ready-with-warning"]')).toBeVisible();
  await expect(page.locator('[data-error-code="STORAGE_WRITE_FAILED"]')).toBeVisible();
  await expect(page.locator("canvas.sc-static-canvas")).toBeVisible();
});

test("blocks empty and network initial data with the correct retry ownership", async ({ page }) => {
  await page.goto("/?emptyPage=1");
  await expect(page.locator('[data-error-code="NO_VALID_DATA"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);
  await page.goto("/?initialFailure=always");
  await expect(page.locator('[data-error-code="INITIAL_DATA_FAILED"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "重试", exact: true })).toBeVisible();
});

test("preserves safe host data-source messages and recoverability", async ({ page }) => {
  await page.goto("/?dataSourceFailure=notConfigured");
  await expect(page.locator('[data-error-code="INITIAL_DATA_FAILED"]')).toContainText("尚未配置授权行情源");
  await expect(page.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);

  await page.goto("/?dataSourceFailure=rateLimited");
  await expect(page.locator('[data-error-code="INITIAL_DATA_FAILED"]')).toContainText("行情服务限额已用尽");
  await expect(page.getByRole("button", { name: "重试", exact: true })).toBeVisible();
});

test("converts render failures into a recoverable blocking state", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => { throw new Error("controlled canvas failure"); };
  });
  await page.goto("/");
  await expect(page.locator('[data-error-code="RENDER_FAILED"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "重试", exact: true })).toBeVisible();
});

test("invalidates dataReady when an already-ready presentation becomes blocked", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => window.__chart!.dataReady())).toBe(true);

  await page.evaluate(() => {
    HTMLCanvasElement.prototype.getContext = () => {
      throw new Error("controlled post-ready canvas failure");
    };
    window.__chart!.setGridVisible(false);
  });

  await expect(page.locator('[data-error-code="RENDER_FAILED"]')).toBeVisible();
  expect(await page.evaluate(() => window.__chart!.dataReady())).toBe(false);
});

test("recovers a blocked presentation after a successful render retry", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  await page.evaluate(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    let failOnce = true;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      if (failOnce) {
        failOnce = false;
        throw new Error("controlled one-shot canvas failure");
      }
      return (nativeGetContext as any).apply(this, args);
    };
    window.__chart!.setGridVisible(false);
  });
  await expect(page.locator('[data-error-code="RENDER_FAILED"]')).toBeVisible();

  const recovered = page.evaluate(async () => {
    const chart = window.__chart!;
    chart.retry();
    return chart.dataReady();
  });
  expect(await recovered).toBe(true);
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await expect(page.locator('[data-error-code="RENDER_FAILED"]')).toHaveCount(0);
});

test("preserves terminal data unavailability across a successful render retry", async ({ page }) => {
  await page.goto("/?million=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  expect(await page.evaluate(async () => {
    const chart = window.__chart!;
    const origin = Date.UTC(2026, 5, 5, 1, 30);
    chart.setTimeframe("5m");
    chart.setVisibleRange({
      from: origin + 975_000 * 60_000,
      to: origin + 999_999 * 60_000
    });
    return chart.dataReady();
  })).toBe(false);

  await page.evaluate(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    let failOnce = true;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      if (failOnce) {
        failOnce = false;
        throw new Error("controlled one-shot canvas failure");
      }
      return (nativeGetContext as any).apply(this, args);
    };
    window.__chart!.setGridVisible(false);
  });
  await expect(page.locator('[data-error-code="RENDER_FAILED"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.retry();
    return Promise.race([
      chart.dataReady(),
      new Promise<"timeout">((resolve) => window.setTimeout(() => resolve("timeout"), 3_000))
    ]);
  });
  expect(result).toBe(false);
});

test("preserves the original ready state across a failed render retry", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  await page.evaluate(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    let failuresRemaining = 2;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      if (failuresRemaining > 0) {
        failuresRemaining -= 1;
        throw new Error("controlled repeated canvas failure");
      }
      return (nativeGetContext as any).apply(this, args);
    };
    window.__chart!.setGridVisible(false);
  });
  await expect(page.locator('[data-error-code="RENDER_FAILED"]')).toBeVisible();

  await page.evaluate(() => new Promise<void>((resolve) => {
    const workspace = document.querySelector(".sc-workspace")!;
    let sawLoading = false;
    const observer = new MutationObserver(() => {
      const state = workspace.getAttribute("data-state");
      if (state === "loading") sawLoading = true;
      if (!sawLoading || state !== "blocked") return;
      observer.disconnect();
      resolve();
    });
    observer.observe(workspace, { attributes: true, attributeFilter: ["data-state"] });
    window.__chart!.retry();
  }));

  const recovered = page.evaluate(async () => {
    const chart = window.__chart!;
    chart.retry();
    return chart.dataReady();
  });
  expect(await recovered).toBe(true);
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
});

test("does not expose stale readiness to a synchronous onError retry", async ({ page }) => {
  await page.goto("/?retryOnRenderError=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  await page.evaluate(() => {
    HTMLCanvasElement.prototype.getContext = () => {
      throw new Error("controlled persistent canvas failure");
    };
    window.__chart!.setGridVisible(false);
  });
  await expect(page.locator('[data-error-code="RENDER_FAILED"]')).toBeVisible();

  const result = await page.evaluate(() => Promise.race([
    window.__reentrantDataReady!,
    new Promise<"timeout">((resolve) => window.setTimeout(() => resolve("timeout"), 3_000))
  ]));
  expect(result).toBe(false);
});
