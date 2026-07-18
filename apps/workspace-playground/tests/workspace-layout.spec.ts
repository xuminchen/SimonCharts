import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
]) {
  test(`renders the advanced chart-first shell at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
    await expect(page.locator(".sc-top-toolbar")).toHaveCount(1);
    await expect(page.locator(".sc-chart-region")).toHaveCount(1);
    await expect(page.locator(".sc-bottom-panel")).toHaveCount(1);
    await expect(page.locator(".sc-right-sidebar")).toHaveCount(1);
    await expect(page.getByTestId("right-inspector")).toHaveAttribute("data-collapsed", "true");
    await expect(page.getByTestId("chart-status-bar")).toBeVisible();
    await expect(page.getByTestId("chart-fullscreen")).toBeVisible();

    const chartBox = await page.locator(".sc-chart-region").boundingBox();
    const rootBox = await page.locator(".sc-workspace").boundingBox();
    const toolbarBox = await page.locator(".sc-top-toolbar").boundingBox();
    const paletteBox = await page.locator(".sc-drawing-palette-host").boundingBox();
    const inspectorBox = await page.locator(".sc-right-sidebar").boundingBox();
    const statusBox = await page.getByTestId("chart-status-bar").boundingBox();
    expect(toolbarBox?.height).toBe(40);
    expect(paletteBox?.width).toBe(44);
    expect(inspectorBox?.width).toBe(40);
    expect(statusBox?.height).toBe(26);
    expect(chartBox?.x).toBe((paletteBox?.x ?? 0) + (paletteBox?.width ?? 0));
    expect((chartBox?.x ?? 0) + (chartBox?.width ?? 0)).toBe(inspectorBox?.x);
    expect((paletteBox?.width ?? 0) + (chartBox?.width ?? 0) + (inspectorBox?.width ?? 0)).toBe(rootBox?.width);
    await expect(page.getByRole("button", { name: "日", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    expect(errors).toEqual([]);
  });
}

test("opens only real clamped chart, price-axis, and time-axis context menus", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const canvas = page.locator("canvas.sc-overlay-canvas");
  let box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
  const menu = page.getByTestId("chart-context-menu");
  await expect(menu).toHaveAttribute("data-kind", "chart");
  await expect(menu.getByRole("menuitem", { name: "复位视图", exact: true })).toBeVisible();
  await menu.getByRole("menuitem", { name: "隐藏网格", exact: true }).click();
  await expect(page.getByTestId("grid-visible")).not.toBeChecked();

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
  await menu.getByRole("menuitem", { name: "数据窗口", exact: true }).click();
  await expect(page.getByTestId("right-inspector")).toHaveAttribute("data-collapsed", "false");
  expect((await page.getByTestId("right-inspector").boundingBox())?.width).toBeGreaterThan(40);
  await page.getByTestId("inspector-data").click();
  await expect(page.getByTestId("right-inspector")).toHaveAttribute("data-collapsed", "true");
  await expect.poll(async () => (await canvas.boundingBox())?.width ?? 0).toBeGreaterThan(1_000);

  box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  await canvas.click({ button: "right", position: { x: box.width - 20, y: box.height / 2 } });
  await expect(menu).toHaveAttribute("data-kind", "price");
  await expect(menu.getByRole("menuitemradio", { name: "线性", exact: true })).toHaveAttribute("aria-checked", "true");
  await menu.getByRole("menuitemradio", { name: "百分比", exact: true }).click();
  await expect(page.getByTestId("price-scale-select")).toHaveValue("percentage");

  await canvas.click({ button: "right", position: { x: box.width / 2, y: box.height - 4 } });
  await expect(menu).toHaveAttribute("data-kind", "time");
  await expect(menu.getByText("Asia/Shanghai", { exact: true })).toBeVisible();
  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(box.x);
  expect(menuBox!.y).toBeGreaterThanOrEqual(box.y);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(box.x + box.width);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(box.y + box.height);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("keeps the advanced toolbar usable in a narrow container", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 640 });
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const more = page.locator(".sc-toolbar-more-toggle");
  await expect(more).toBeVisible();
  await more.click();
  await expect(page.getByTestId("series-type-select")).toBeVisible();
  await page.getByTestId("series-type-select").click();
  await expect(page.getByTestId("series-type-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("series-type-menu")).toBeHidden();
  await expect(page.getByTestId("right-inspector")).toHaveCSS("width", "40px");
  await page.getByRole("button", { name: "分时", exact: true }).click();
  await expect(page.getByTestId("intraday-days-select")).toBeVisible();
  await page.getByTestId("intraday-days-select").selectOption("9");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(760);
});

test("paints the approved dark A-share canvas colors", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const counts = await page.locator("canvas.sc-static-canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    const targets = [[19, 22, 29], [240, 68, 85], [0, 170, 145]];
    return targets.map(([red, green, blue]) => {
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (Math.abs(pixels[index] - red) <= 3 && Math.abs(pixels[index + 1] - green) <= 3 && Math.abs(pixels[index + 2] - blue) <= 3) count += 1;
      }
      return count;
    });
  });
  expect(counts.every((count) => count > 0)).toBe(true);
});

test("creates only the minimal embedded controls by default", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 520 });
  await page.goto("/?minimal=1");
  await expect(page.getByTestId("simon-chart")).toHaveAttribute("data-state", "ready");
  await expect(page.getByTestId("adjust-select")).toHaveCount(1);
  await expect(page.getByTestId("indicator-manager-open")).toHaveCount(1);
  for (const selector of [
    '[data-testid="symbol-search-input"]',
    '[data-testid="series-type-select"]',
    '[data-testid="price-scale-select"]',
    '[data-testid="drawing-palette"]',
    '[data-testid="drawing-undo"]',
    '[data-testid="drawing-redo"]',
    '[data-testid="chart-settings-open"]',
    '[data-testid="bottom-panel-toggle"]',
    ".sc-bottom-host"
  ]) {
    await expect(page.locator(selector)).toHaveCount(0);
  }
  const timeframes = page.locator(".sc-timeframes");
  await expect(timeframes).toHaveCount(1);
  expect(await timeframes.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.getByTestId("indicator-manager-open").click();
  const popupBox = await page.locator(".sc-indicator-popup").boundingBox();
  expect(popupBox).not.toBeNull();
  expect(popupBox!.x).toBeGreaterThanOrEqual(0);
  expect(popupBox!.x + popupBox!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("applies the light theme and English series labels", async ({ page }) => {
  await page.goto("/?theme=light&locale=en-US");
  const root = page.getByTestId("simon-chart");
  await expect(root).toHaveAttribute("data-state", "ready");
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveAttribute("lang", "en-US");
  await page.getByTestId("series-type-select").click();
  await expect(page.locator('[data-series-type="hollowCandles"]')).toHaveText("Hollow candles");
  await expect(page.locator('[data-series-type="pointAndFigure"]')).toHaveText("Point & figure");
  const lightPixels = await page.locator("canvas.sc-static-canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    const targets = [[255, 255, 255], [217, 45, 66], [0, 138, 115]];
    return targets.map(([red, green, blue]) => {
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (Math.abs(pixels[index] - red) <= 3 && Math.abs(pixels[index + 1] - green) <= 3 && Math.abs(pixels[index + 2] - blue) <= 3) count += 1;
      }
      return count;
    });
  });
  expect(lightPixels.every((count) => count > 0)).toBe(true);
});

test("blocks invalid options without constructing an unsafe shell", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/?invalid=features&theme=invalid&locale=invalid");
  await expect(page.getByTestId("simon-chart")).toHaveAttribute("data-state", "blocked");
  await expect(page.getByTestId("simon-chart")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByTestId("simon-chart")).toHaveAttribute("lang", "zh-CN");
  expect(pageErrors).toEqual([]);
});
