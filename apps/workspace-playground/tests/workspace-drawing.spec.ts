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
  await expect(page.locator(".sc-drawing-tools-header-label")).toHaveText("趋势线工具");
  await expect(page.locator(".sc-drawing-tools-header-count")).toHaveText("16");
  await expect(page.locator(".sc-drawing-tool-icon")).toHaveCount(16);
  expect(await page.locator(".sc-drawing-tool-icon").evaluateAll(
    (icons) => icons.every((icon) => icon.childElementCount > 0 && icon.getBoundingClientRect().width > 0)
  )).toBe(true);
  await page.locator('[data-drawing-tool="trendLine"]').click();
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
    { category: "path", type: "path" },
    { category: "path", type: "brush" },
    { category: "forecast", type: "forecastPath" }
  ];
  for (const [index, tool] of tools.entries()) {
    await page.locator(`[data-drawing-category="${tool.category}"]`).click();
    await page.locator(`[data-drawing-tool="${tool.type}"]`).click();
    await page.mouse.move(box.x + 220, box.y + 220 + index * 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 280, box.y + 240 + index * 20);
    await page.mouse.move(box.x + 350, box.y + 270 + index * 20);
    await page.mouse.up();
    await expect.poll(() => persistedDrawingCount(page)).toBe(index + 1);
  }
});

test("renders an autoscaled non-interactive range without blocking chart pan", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const drawing = await page.evaluate(() => {
    const chart = window.__chart!;
    const visible = chart.getVisibleRange();
    if (!visible) throw new Error("visible range missing");
    const span = visible.to - visible.from;
    const range = {
      id: "planned-price-range",
      type: "datePriceRange" as const,
      anchors: [
        { time: visible.from + span * 0.25, price: 150 },
        { time: visible.from + span * 0.75, price: 170 }
      ],
      style: {
        color: "#ff00ff",
        textColor: "#00ffff",
        lineWidth: 3
      },
      interactive: false,
      affectsPriceScale: true,
      locked: true
    };
    chart.setDrawings([range]);
    return range;
  });
  const canvas = page.locator("canvas.sc-static-canvas");
  const coloredBounds = async () => canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    const pixels = target.getContext("2d")!.getImageData(0, 0, target.width, target.height).data;
    let count = 0;
    let minX = target.width;
    let minY = target.height;
    let maxX = -1;
    let maxY = -1;
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        Math.abs(pixels[index]! - 255) > 3 ||
        pixels[index + 1]! > 3 ||
        Math.abs(pixels[index + 2]! - 255) > 3
      ) continue;
      const pixel = index / 4;
      const x = pixel % target.width;
      const y = Math.floor(pixel / target.width);
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const rect = target.getBoundingClientRect();
    return {
      count,
      minX,
      minY,
      maxX,
      maxY,
      scaleX: target.width / rect.width,
      scaleY: target.height / rect.height
    };
  });
  await expect.poll(async () => (await coloredBounds()).count).toBeGreaterThan(0);
  const beforeHover = await coloredBounds();
  expect(beforeHover.minY).toBeGreaterThanOrEqual(0);
  expect(beforeHover.maxY).toBeLessThan(await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).height
  ));
  const overlay = page.locator("canvas.sc-overlay-canvas");
  const overlayBox = await overlay.boundingBox();
  if (!overlayBox) throw new Error("overlay missing");
  const x = overlayBox.x + ((beforeHover.minX + beforeHover.maxX) / 2) / beforeHover.scaleX;
  const y = overlayBox.y + ((beforeHover.minY + beforeHover.maxY) / 2) / beforeHover.scaleY;

  await page.mouse.move(x, y);
  await expect(overlay).toHaveCSS("cursor", "crosshair");
  await expect.poll(async () => (await coloredBounds()).count).toBe(beforeHover.count);
  const before = await page.evaluate(() => ({
    visibleRange: window.__chart!.getVisibleRange(),
    drawings: window.__chart!.getDrawings()
  }));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 100, y);
  await page.mouse.up();
  const after = await page.evaluate(() => ({
    visibleRange: window.__chart!.getVisibleRange(),
    drawings: window.__chart!.getDrawings()
  }));

  expect(after.visibleRange).not.toEqual(before.visibleRange);
  expect(after.drawings).toEqual(before.drawings);
  expect(after.drawings[0]).toMatchObject(drawing);
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
    await expect(page.locator(`[data-testid^="indicator-legend-${id}-"]`)).toHaveCount(1);
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
