import { expect, test } from "@playwright/test";

test("opens the native data table from More and the chart context menu", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.setViewportSize({ width: 760, height: 700 });
  await page.goto("/");
  const workspace = page.locator('.sc-workspace[data-state="ready"]');
  await expect(workspace).toBeVisible();
  const canvases = page.locator(".sc-chart-canvas");
  await expect(canvases.first()).toBeVisible();
  const requestsBefore = await page.evaluate(() => window.__workspaceRequests?.length ?? 0);

  await page.locator(".sc-toolbar-more-toggle").click();
  await page.getByTestId("data-table-toggle").click();

  const tableView = page.getByTestId("chart-data-table");
  await expect(tableView).toBeVisible();
  await expect(page.locator(".sc-data-table-scroll")).toBeFocused();
  await expect(workspace).toHaveAttribute("data-display-mode", "table");
  expect(await page.evaluate(() => window.__chart!.getDisplayMode())).toBe("table");
  await expect(canvases).toHaveCount(2);
  await expect(canvases.first()).toBeHidden();
  await expect(canvases.last()).toBeHidden();
  await expect(page.locator(".sc-drawing-palette-host")).toBeHidden();

  const rowTimes = await tableView.locator("tbody tr[data-time]").evaluateAll((rows) =>
    rows.slice(0, 3).map((row) => Number((row as HTMLElement).dataset.time))
  );
  expect(rowTimes).toHaveLength(3);
  expect(rowTimes[0]).toBeGreaterThan(rowTimes[1]!);
  expect(rowTimes[1]).toBeGreaterThan(rowTimes[2]!);
  await expect(tableView.locator('th[data-column-id="time"]')).toHaveText("时间");
  await expect(tableView.locator('th[data-column-id="time"]'))
    .toHaveAttribute("aria-sort", "descending");
  const tableBox = await tableView.boundingBox();
  if (!tableBox) throw new Error("data table missing");
  expect(await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return {
      insideTable: Boolean(hit?.closest('[data-testid="chart-data-table"]')),
      canvas: hit instanceof HTMLCanvasElement
    };
  }, { x: tableBox.x + tableBox.width / 2, y: tableBox.y + tableBox.height / 2 }))
    .toEqual({ insideTable: true, canvas: false });
  expect(await page.evaluate(() => window.__workspaceRequests?.length ?? 0)).toBe(requestsBefore);

  await page.getByTestId("data-table-back").click();
  await expect(tableView).toBeHidden();
  await expect(workspace).toHaveAttribute("data-display-mode", "chart");
  expect(await page.evaluate(() => window.__chart!.getDisplayMode())).toBe("chart");
  await expect(canvases.first()).toBeVisible();
  await expect(page.locator("canvas.sc-overlay-canvas")).toBeFocused();

  const overlay = page.locator("canvas.sc-overlay-canvas");
  const overlayBox = await overlay.boundingBox();
  if (!overlayBox) throw new Error("chart canvas missing");
  await overlay.click({
    button: "right",
    position: { x: overlayBox.width / 2, y: overlayBox.height / 2 }
  });
  const menu = page.getByTestId("chart-context-menu");
  await expect(menu).toHaveAttribute("data-kind", "chart");
  await menu.getByRole("menuitem", { name: "数据表", exact: true }).click();
  await expect(tableView).toBeVisible();
  await expect(canvases.first()).toBeHidden();
  await expect(canvases.last()).toBeHidden();
  expect(errors).toEqual([]);
});
