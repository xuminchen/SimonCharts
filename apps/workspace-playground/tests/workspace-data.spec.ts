import { expect, test, type Page } from "@playwright/test";

async function requestLog(page: Page) {
  return page.evaluate(() => window.__workspaceRequests ?? []);
}

test("routes complete market controls through the workspace controller", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.getByRole("button", { name: "5分钟", exact: true }).click();
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
  await expect(page.getByTestId("indicator-legend-MA")).toContainText("20");
  await page.getByLabel("Hide MA").click();
  await expect(page.getByTestId("indicator-legend-MA")).toBeHidden();
  await expect(page.getByTestId("drawing-undo")).toBeDisabled();
});

test("operates every timeframe, chart, indicator, adjustment, and scale", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const timeframeButtons = page.locator("[data-timeframe]");
  expect(await timeframeButtons.count()).toBe(8);
  for (const button of await timeframeButtons.all()) {
    const timeframe = await button.getAttribute("data-timeframe");
    await button.click();
    await expect.poll(() => requestLog(page)).toContainEqual(expect.objectContaining({ timeframe }));
  }

  const series = page.getByTestId("series-type-select");
  const seriesTypes = await series.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  expect(seriesTypes).toHaveLength(17);
  for (const type of seriesTypes) {
    await series.selectOption(type);
    await expect(series).toHaveValue(type);
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
    const legend = page.getByTestId(`indicator-legend-${id}`);
    await expect(legend).toBeVisible();
    await legend.getByRole("button", { name: "删除", exact: true }).click();
    await expect(legend).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("formats intraday data-window time in Asia/Shanghai without epoch leakage", async ({ page }) => {
  await page.goto("/?single=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.getByRole("button", { name: "1分钟", exact: true }).click();
  await expect.poll(() => requestLog(page)).toContainEqual(expect.objectContaining({ timeframe: "1m" }));
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.mouse.move(box.x + 4, box.y + 200);
  await page.getByRole("button", { name: "数据窗口", exact: true }).click();
  await expect(page.locator(".sc-data-window")).toContainText("2026-06-05 09:30");
  await expect(page.locator(".sc-data-window")).not.toContainText(/\b\d{13}\b/);
});

declare global {
  interface Window {
    __workspaceRequests?: Array<Record<string, unknown>>;
  }
}
