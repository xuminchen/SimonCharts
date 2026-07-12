import { expect, test, type Page } from "@playwright/test";

async function persistedDrawingCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.startsWith("simoncharts:workspace:v1:workspace-playground:drawings:")
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

test("exposes 63 tools and persists drawing lifecycle and palette position", async ({ page }) => {
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
  await page.getByRole("button", { name: "Trend Line", exact: true }).click();
  await stepGesture(page);
  await expect.poll(() => persistedDrawingCount(page)).toBe(1);
  await expect(page.getByTestId("drawing-undo")).toBeEnabled();
  await page.getByTestId("drawing-undo").click();
  await expect.poll(() => persistedDrawingCount(page)).toBe(0);
  await page.getByTestId("drawing-redo").click();
  await expect.poll(() => persistedDrawingCount(page)).toBe(1);

  const before = await page.getByTestId("drawing-palette").boundingBox();
  const handle = page.getByTestId("drawing-palette-drag-handle");
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("palette handle missing");
  await page.mouse.move(handleBox.x + 5, handleBox.y + 5);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 300, handleBox.y + 120);
  await page.mouse.up();
  await page.reload();
  const after = await page.getByTestId("drawing-palette").boundingBox();
  expect(after?.x).not.toBe(before?.x);
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
    await page.getByRole("button", { name: tool.name, exact: true }).click();
    await page.mouse.move(box.x + 220, box.y + 220 + index * 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 280, box.y + 240 + index * 20);
    await page.mouse.move(box.x + 350, box.y + 270 + index * 20);
    await page.mouse.up();
    await expect.poll(() => persistedDrawingCount(page)).toBe(index + 1);
  }
});
