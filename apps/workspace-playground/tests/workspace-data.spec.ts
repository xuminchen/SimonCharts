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

declare global {
  interface Window {
    __workspaceRequests?: Array<Record<string, unknown>>;
  }
}
