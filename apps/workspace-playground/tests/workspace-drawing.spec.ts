import { expect, test, type Page } from "@playwright/test";

async function persistedDrawingCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.startsWith("simoncharts:workspace:v1:workspace-playground:fixture-user:drawings:fixture-current:")
    );
    if (!key) return 0;
    const envelope = JSON.parse(localStorage.getItem(key) ?? "null") as { value?: unknown[] } | null;
    return Array.isArray(envelope?.value) ? envelope.value.length : 0;
  });
}

async function stepGesture(page: Page) {
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  for (const point of [[250, 220], [450, 320]] as const) {
    await page.mouse.move(box.x + point[0], box.y + point[1]);
    await page.mouse.down();
    await page.mouse.up();
  }
}

test("exposes 63 tools and persists drawing lifecycle in the fixed drawing rail", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.getByTestId("drawing-palette-expand").click();
  const toolTypes: string[] = [];
  for (const category of await page.locator("[data-drawing-category]").all()) {
    await category.click();
    toolTypes.push(...await page.locator("[data-drawing-tool]").evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("data-drawing-tool") ?? "")
    ));
  }
  expect(toolTypes).toHaveLength(63);
  expect(new Set(toolTypes).size).toBe(63);

  await page.locator('[data-drawing-category="basic"]').click();
  await page.getByRole("menuitem", { name: "Trend Line", exact: true }).click();
  await stepGesture(page);
  await expect.poll(() => persistedDrawingCount(page)).toBe(1);
  await expect(page.getByTestId("drawing-undo")).toBeEnabled();
  await page.getByTestId("drawing-undo").click();
  await expect.poll(() => persistedDrawingCount(page)).toBe(0);
  await page.getByTestId("drawing-redo").click();
  await expect.poll(() => persistedDrawingCount(page)).toBe(1);

  const railBefore = await page.locator(".sc-drawing-palette-host").boundingBox();
  const chartBefore = await page.locator(".sc-chart-region").boundingBox();
  expect(railBefore?.width).toBe(44);
  expect((railBefore?.x ?? 0) + (railBefore?.width ?? 0)).toBe(chartBefore?.x);
  await page.reload();
  const railAfter = await page.locator(".sc-drawing-palette-host").boundingBox();
  expect(railAfter).toMatchObject({ x: railBefore?.x, width: 44 });
});

test("commits every continuous drawing mode only on pointer up", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.getByTestId("drawing-palette-expand").click();
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  const tools = [
    { category: "path", name: "Path" },
    { category: "path", name: "Brush" },
    { category: "forecast", name: "Forecast Path" }
  ];
  for (const [index, tool] of tools.entries()) {
    await page.locator(`[data-drawing-category="${tool.category}"]`).click();
    await page.getByRole("menuitem", { name: tool.name, exact: true }).click();
    await page.mouse.move(box.x + 220, box.y + 220 + index * 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 280, box.y + 240 + index * 20);
    await page.mouse.move(box.x + 350, box.y + 270 + index * 20);
    await page.mouse.up();
    await expect.poll(() => persistedDrawingCount(page)).toBe(index + 1);
  }
});

test("creates, edits, serializes, and restores all 63 drawing tools", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.getByTestId("drawing-palette-expand").click();
  const definitions: Array<{ type: string; category: string; mode: string; anchorCount: number }> = [];
  for (const category of await page.locator("[data-drawing-category]").all()) {
    const categoryId = await category.getAttribute("data-drawing-category") ?? "";
    await category.click();
    definitions.push(...await page.locator("[data-drawing-tool]").evaluateAll((buttons, currentCategory) => buttons.map((button) => ({
      type: button.getAttribute("data-drawing-tool") ?? "",
      category: currentCategory,
      mode: button.getAttribute("data-drawing-mode") ?? "",
      anchorCount: Number(button.getAttribute("data-anchor-count"))
    })), categoryId));
  }
  expect(definitions).toHaveLength(63);
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  for (const [index, definition] of definitions.entries()) {
    await page.locator(`[data-drawing-category="${definition.category}"]`).click();
    await page.locator(`[data-drawing-tool="${definition.type}"]`).click();
    const baseX = box.x + 260 + (index % 10) * 35;
    const baseY = box.y + 100 + (index % 8) * 30;
    if (definition.mode === "continuous") {
      await page.mouse.move(baseX, baseY);
      await page.mouse.down();
      for (let point = 1; point < definition.anchorCount; point += 1) await page.mouse.move(baseX + point * 24, baseY + point * 10);
      await page.mouse.up();
    } else {
      for (let point = 0; point < definition.anchorCount; point += 1) await page.mouse.click(baseX + point * 24, baseY + point * 10);
    }
    await expect.poll(() => persistedDrawingCount(page)).toBe(index + 1);
  }

  await page.reload();
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.getByRole("tab", { name: "对象", exact: true }).click();
  const rows = page.locator(".sc-object-row");
  await expect(rows).toHaveCount(63);
  for (let index = 0; index < 63; index += 1) {
    await rows.nth(index).locator("button").first().click();
    await page.getByRole("tab", { name: "属性", exact: true }).click();
    await page.getByLabel("Color", { exact: true }).fill(index % 2 === 0 ? "#f04455" : "#00aa91");
    await page.getByRole("tab", { name: "对象", exact: true }).click();
  }
  await expect.poll(() => page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => candidate.includes(":drawings:"));
    const stored = key ? JSON.parse(localStorage.getItem(key) ?? "null") as { value?: Array<{ style?: { color?: string } }> } : null;
    return stored?.value?.filter((drawing) => drawing.style?.color === "#f04455" || drawing.style?.color === "#00aa91").length ?? 0;
  })).toBe(63);
  await page.reload();
  await page.getByRole("tab", { name: "对象", exact: true }).click();
  await expect(page.locator(".sc-object-row")).toHaveCount(63);
  for (const [label, id] of [["Moving Average", "MA"], ["RSI", "RSI"], ["MACD", "MACD"]] as const) {
    await page.getByTestId("indicator-manager-open").click();
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("button", { name: `Apply ${id}`, exact: true }).click();
    await expect(page.getByTestId(`indicator-legend-${id}`)).toHaveCount(1);
  }
  const performanceCanvas = page.locator("canvas.sc-overlay-canvas");
  await page.evaluate(() => { window.__hostCounters.frameCallbackDurations = []; });
  for (let index = 0; index < 30; index += 1) {
    await performanceCanvas.evaluate((element, offset) => new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        element.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 300 + offset * 3, clientY: 220 }));
        requestAnimationFrame(() => resolve());
      });
    }), index);
  }
  const frameDurations = await page.evaluate(() => window.__hostCounters.frameCallbackDurations);
  frameDurations.sort((left, right) => left - right);
  expect(frameDurations[Math.ceil(frameDurations.length * 0.95) - 1]).toBeLessThanOrEqual(16.7);
  expect(errors).toEqual([]);
});
