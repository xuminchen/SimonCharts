import { expect, test, type Page } from "@playwright/test";

async function requestLog(page: Page) {
  return page.evaluate(() => window.__workspaceRequests ?? []);
}

async function chooseTimeframe(page: Page, timeframe: string, view = "timeframe") {
  const shortcut = page.locator(
    `.sc-timeframes > [data-timeframe-shortcut][data-chart-view="${view}"][data-timeframe="${timeframe}"]`
  );
  if (await shortcut.isVisible()) {
    await shortcut.click();
    return;
  }
  const menu = page.locator(".sc-timeframe-more-menu");
  if (await menu.isHidden()) await page.locator(".sc-timeframe-more-toggle").click();
  await menu.locator(`[data-chart-view="${view}"][data-timeframe="${timeframe}"]`).click();
}

async function chooseSeriesType(page: Page, type: string) {
  const trigger = page.getByTestId("series-type-select");
  await trigger.click();
  await page.locator(`[data-series-type="${type}"]`).click();
  await expect(trigger).toHaveAttribute("data-value", type);
}

test("routes complete market controls through the workspace controller", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await chooseTimeframe(page, "5m");
  await expect.poll(() => requestLog(page)).toContainEqual(expect.objectContaining({ timeframe: "5m" }));

  await page.getByTestId("symbol-search-input").fill("000001");
  await expect(page.getByRole("option", { name: /上证指数/ })).toBeVisible();
  await page.getByRole("option", { name: /上证指数/ }).click();
  await expect(page.getByTestId("adjust-select")).toBeDisabled();
  await expect.poll(() => requestLog(page)).toContainEqual(expect.objectContaining({ symbolId: "index:SSE:000001", adjustMode: "none" }));

  await page.getByTestId("indicator-manager-open").click();
  await page.getByRole("button", { name: "Moving Average", exact: true }).click();
  await page.getByLabel("MA period").fill("20");
  await page.getByRole("button", { name: "Apply MA" }).click();
  const maLegend = page.locator('[data-testid^="indicator-legend-MA-"]');
  await expect(maLegend).toContainText("20");
  await page.getByTestId("indicator-manager-open").click();
  await page.getByLabel("Hide MA").click();
  await expect(maLegend).toHaveAttribute("data-visible", "false");
  await expect(page.getByLabel("Show MA")).toBeVisible();
  await expect(page.getByTestId("drawing-undo")).toBeDisabled();
});

test("renders and requests only the exact host capability subset", async ({ page }) => {
  await page.goto("/?capabilitySubset=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "日", exact: true })).toBeVisible();
  await expect(page.locator(".sc-timeframe-more-toggle")).toBeVisible();
  await page.locator(".sc-timeframe-more-toggle").click();
  await expect(page.getByRole("menuitemradio", { name: "5分", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: "分时", exact: true })).toBeDisabled();
  await expect(page.getByRole("menuitemcheckbox", { name: "取消固定 分时", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "1分", exact: true })).toBeHidden();
  await expect(page.getByTestId("adjust-select")).toHaveValue("forward");

  await page.getByRole("menuitemradio", { name: "5分", exact: true }).click();
  await expect(page.getByTestId("adjust-select")).toHaveValue("none");
  await expect.poll(() => requestLog(page)).toContainEqual(
    expect.objectContaining({ timeframe: "5m", adjustMode: "none", status: "resolved" })
  );
  expect(await page.getByTestId("adjust-select").locator('option[value="forward"]').evaluate(
    (option) => (option as HTMLOptionElement).hidden && (option as HTMLOptionElement).disabled
  )).toBe(true);

  const resolved = (await requestLog(page)).filter((request) => request.status === "resolved");
  expect(resolved.every((request) =>
    (request.timeframe === "1d" && request.adjustMode === "forward") ||
    (request.timeframe === "5m" && request.adjustMode === "none")
  )).toBe(true);
});

test("operates every timeframe, chart, indicator, adjustment, and scale", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  expect(await page.locator(".sc-timeframe-more-menu [role=menuitemradio]").count()).toBe(9);
  expect(await page.locator(".sc-timeframes > [data-timeframe-shortcut]").allTextContents()).toEqual([
    "15分", "60分", "日", "分时"
  ]);
  await page.locator(".sc-timeframe-more-toggle").click();
  await expect(page.locator(".sc-timeframe-more-menu [role=menuitemradio]")).toHaveText([
    "分时", "1分", "5分", "15分", "30分", "60分", "日", "周", "月"
  ]);
  for (const timeframe of ["15m", "60m", "5m", "30m"]) {
    await page.locator(`[data-favorite-timeframe-pin="${timeframe}"]`).click();
  }
  await expect(page.locator(".sc-timeframes > [data-timeframe-shortcut]")).toHaveText([
    "5分", "30分", "日", "分时"
  ]);
  await page.locator('[data-favorite-timeframe-pin="30m"]').click();
  await expect(page.locator(".sc-timeframes > [data-timeframe-shortcut]")).toHaveText([
    "5分", "日", "分时"
  ]);
  await page.locator('[data-favorite-timeframe-pin="15m"]').click();
  await expect(page.locator(".sc-timeframes > [data-timeframe-shortcut]")).toHaveText([
    "5分", "15分", "日", "分时"
  ]);
  await page.locator('[data-favorite-timeframe-pin="30m"]').click();
  await expect(page.getByTestId("favorite-timeframe-limit")).toBeVisible();
  await expect(page.locator(".sc-timeframes > [data-timeframe-shortcut]")).toHaveText([
    "5分", "15分", "日", "分时"
  ]);
  await page.keyboard.press("Escape");
  for (const { timeframe, view } of [
    { timeframe: "15m", view: "timeframe" },
    { timeframe: "60m", view: "timeframe" },
    { timeframe: "1d", view: "timeframe" },
    { timeframe: "1m", view: "intraday" },
    { timeframe: "1m", view: "timeframe" },
    { timeframe: "5m", view: "timeframe" },
    { timeframe: "30m", view: "timeframe" },
    { timeframe: "1w", view: "timeframe" },
    { timeframe: "1mo", view: "timeframe" }
  ]) {
    await chooseTimeframe(page, timeframe, view);
    await expect.poll(() => requestLog(page)).toContainEqual(expect.objectContaining({ timeframe }));
  }
  await expect(page.locator(".sc-timeframe-more-toggle")).toContainText("月");

  const series = page.getByTestId("series-type-select");
  await series.click();
  const seriesTypes = await page.locator("[data-series-type]").evaluateAll((options) => options.map((option) => (option as HTMLElement).dataset.seriesType ?? ""));
  expect(seriesTypes).toHaveLength(17);
  await expect(page.locator('[data-series-type="candles"] .sc-series-type-label')).toHaveText("蜡烛图（Candles）");
  await expect(page.locator('[data-series-type="pointAndFigure"] .sc-series-type-label')).toHaveText("点数图（Point & Figure）");
  await expect(page.locator("[data-series-type] .sc-series-type-icon")).toHaveCount(17);
  expect(await page.locator("[data-series-type] .sc-series-type-icon").evaluateAll(
    (icons) => icons.every((icon) => icon.childElementCount > 0 && icon.getBoundingClientRect().width > 0)
  )).toBe(true);
  await page.keyboard.press("Escape");
  for (const type of seriesTypes) {
    await chooseSeriesType(page, type);
    await expect(page.locator("canvas.sc-static-canvas")).toBeVisible();
  }

  const scales = page.getByTestId("price-scale-select");
  for (const mode of ["linear", "log", "percentage"]) {
    await scales.selectOption(mode);
    await expect(scales).toHaveValue(mode);
  }

  const adjust = page.getByTestId("adjust-select");
  for (const mode of ["none", "forward", "backward"]) {
    await adjust.selectOption(mode);
    await expect.poll(() => requestLog(page)).toContainEqual(expect.objectContaining({ adjustMode: mode }));
  }

  const indicatorOpen = page.getByTestId("indicator-manager-open");
  await indicatorOpen.click();
  const indicatorIds = await page.locator("[data-indicator-id]").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-indicator-id") ?? ""));
  expect(indicatorIds).toHaveLength(16);
  for (const id of indicatorIds) {
    if (await page.locator(".sc-indicator-popup").isHidden()) await indicatorOpen.click();
    await page.locator(`[data-indicator-id="${id}"]`).click();
    await page.getByRole("button", { name: `Apply ${id}`, exact: true }).click();
    await indicatorOpen.click();
    const legend = page.locator(`[data-testid^="indicator-legend-${id}-"]`);
    await expect(legend).toBeVisible();
    await legend.getByRole("button", { name: "删除", exact: true }).click();
    await expect(legend).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("treats intraday as a 1-minute line preset without resetting an advanced manual series choice", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const series = page.getByTestId("series-type-select");

  await page.getByRole("button", { name: "分时", exact: true }).click();
  await expect(series).toHaveAttribute("data-value", "line");
  await expect(series).toBeDisabled();
  await expect(page.getByTestId("chart-change-legend")).toBeHidden();
  await expect(page.getByRole("button", { name: "分时", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => requestLog(page)).toContainEqual(expect.objectContaining({ timeframe: "1m" }));

  await chooseTimeframe(page, "5m");
  await expect(series).toHaveAttribute("data-value", "candles");
  await expect(series).toBeEnabled();
  await expect(page.getByTestId("chart-change-legend")).toBeVisible();
  await expect(page.getByTestId("chart-change-legend")).toContainText(/[%▲▼•]/);

  await chooseSeriesType(page, "line");
  await page.getByRole("button", { name: "15分", exact: true }).click();
  await expect(series).toHaveAttribute("data-value", "line");
  await expect.poll(() => requestLog(page)).toContainEqual(expect.objectContaining({ timeframe: "15m" }));
});

test("switches between one and nine real intraday days without restarting the 1-minute selection", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.getByRole("button", { name: "分时", exact: true }).click();

  const series = page.getByTestId("series-type-select");
  await expect(series).toBeVisible();
  const days = page.getByTestId("intraday-days-select");
  await expect(days).toBeVisible();
  await expect(days.locator("xpath=..")).toContainText("分时图");
  await expect(page.getByTestId("chart-ohlc-legend")).toContainText(/高 .*开 .*低 .*收 /);
  await expect(days.locator("option")).toHaveText([
    "1日", "2日", "3日", "4日", "5日", "6日", "7日", "8日", "9日"
  ]);
  await expect(days).toHaveValue("1");
  await expect(page.getByTestId("price-scale-select")).toBeDisabled();

  const initialOneMinuteRequests = (await requestLog(page)).filter(
    (request) => request.timeframe === "1m" && request.status === "resolved"
  ).length;
  await days.selectOption("2");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await days.selectOption("9");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await expect(series).toHaveAttribute("data-value", "line");
  expect((await requestLog(page)).filter(
    (request) => request.timeframe === "1m" && request.status === "resolved"
  )).toHaveLength(initialOneMinuteRequests);
});

test("clears an intraday preset when a new symbol does not support 1-minute data", async ({ page }) => {
  await page.goto("/?capabilitySubset=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const series = page.getByTestId("series-type-select");

  await page.getByTestId("symbol-search-input").fill("000001");
  await page.getByRole("option", { name: /上证指数/ }).click();
  await expect(page.getByRole("button", { name: "分时", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "分时", exact: true }).click();
  await expect(series).toHaveAttribute("data-value", "line");

  await page.getByTestId("symbol-search-input").fill("600000");
  await page.getByRole("option", { name: /浦发银行/ }).click();
  await expect(page.getByRole("button", { name: "分时", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "日", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(series).toHaveAttribute("data-value", "candles");

  await chooseSeriesType(page, "line");
  await page.getByTestId("symbol-search-input").fill("000001");
  await page.getByRole("option", { name: /上证指数/ }).click();
  await expect(series).toHaveAttribute("data-value", "line");
});

test("formats intraday data-window time in Asia/Shanghai without epoch leakage", async ({ page }) => {
  await page.goto("/?single=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await chooseTimeframe(page, "1m");
  await expect.poll(() => requestLog(page)).toContainEqual(expect.objectContaining({ timeframe: "1m" }));
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.mouse.move(box.x + 4, box.y + 200);
  await page.getByRole("tab", { name: "数据窗口", exact: true }).click();
  await expect(page.locator(".sc-data-window")).toContainText("2026-06-05 09:30");
  await expect(page.locator(".sc-data-window")).not.toContainText(/\b\d{13}\b/);
});

declare global {
  interface Window {
    __workspaceRequests?: Array<Record<string, unknown>>;
  }
}
