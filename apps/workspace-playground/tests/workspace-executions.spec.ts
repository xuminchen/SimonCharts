import { expect, test, type Page } from "@playwright/test";

async function findExecutionMarker(
  page: Page,
  nearRightEdge = false
): Promise<{ x: number; y: number }> {
  return page.locator("canvas.sc-overlay-canvas").evaluate(async (canvas, nearRightEdge) => {
    const tooltip = document.querySelector<HTMLElement>(".sc-execution-tooltip");
    const rect = canvas.getBoundingClientRect();
    if (!tooltip) throw new Error("execution tooltip missing");
    const from = nearRightEdge ? rect.width - 110 : 70;
    for (let x = from; x <= rect.width - 45; x += 4) {
      for (let y = 70; y <= rect.height - 100; y += 6) {
        canvas.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true,
          clientX: rect.left + x,
          clientY: rect.top + y,
          pointerType: "mouse"
        }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (!tooltip.hidden) return { x: rect.left + x, y: rect.top + y };
      }
    }
    throw new Error("execution marker not found");
  }, nearRightEdge);
}

test("keeps every grouped execution reachable inside a bounded tooltip", async ({ page }) => {
  await page.goto("/?executionOverflow=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const marker = await findExecutionMarker(page, true);

  const tooltip = page.getByTestId("execution-tooltip");
  const region = page.locator(".sc-chart-region");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveAttribute("data-pinned", "false");
  expect(await tooltip.locator(".sc-execution-tooltip-row").count()).toBe(210);

  const bounds = await Promise.all([region.boundingBox(), tooltip.boundingBox()]);
  if (!bounds[0] || !bounds[1]) throw new Error("tooltip bounds missing");
  expect(bounds[1].x).toBeGreaterThanOrEqual(bounds[0].x + 8);
  expect(bounds[1].y).toBeGreaterThanOrEqual(bounds[0].y + 8);
  expect(bounds[1].x + bounds[1].width).toBeLessThanOrEqual(bounds[0].x + bounds[0].width - 8);
  expect(bounds[1].y + bounds[1].height).toBeLessThanOrEqual(bounds[0].y + bounds[0].height - 8);
  await expect.poll(() => tooltip.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  await page.mouse.click(marker.x, marker.y);
  await expect(tooltip).toHaveAttribute("data-pinned", "true");
  await tooltip.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => tooltip.evaluate((element) => element.scrollTop > 0)).toBe(true);
  await expect(tooltip).toContainText("#30 时间");

  const canvasBox = await page.locator("canvas.sc-overlay-canvas").boundingBox();
  if (!canvasBox) throw new Error("canvas missing");
  await page.mouse.click(canvasBox.x + 140, canvasBox.y + 90);
  await expect(tooltip).toBeHidden();
});

test("shows a broker split time range in the same hover and pinned tooltip", async ({ page }) => {
  const pageErrors: Error[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/?executionTimeRange=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.evaluate(async () => {
    window.__chart?.setVisibleRange({
      from: Date.UTC(2026, 5, 5, 1, 30),
      to: Date.UTC(2026, 5, 5, 1, 40)
    });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });

  const persistence = await page.evaluate(() => {
    const layout = window.__chart?.exportLayout();
    if (!layout) throw new Error("layout missing");
    return {
      layout: JSON.stringify(layout),
      hasExecutions: Object.prototype.hasOwnProperty.call(layout, "executions"),
      storage: JSON.stringify(localStorage)
    };
  });
  expect(persistence.hasExecutions).toBe(false);
  expect(persistence.storage).not.toContain("broker-split-summary");

  const marker = await findExecutionMarker(page);
  const tooltip = page.getByTestId("execution-tooltip");
  await expect(tooltip).toHaveAttribute("role", "tooltip");
  await expect(tooltip).toHaveAttribute("data-pinned", "false");
  await expect(tooltip).toContainText("09:31:00");
  await expect(tooltip).toContainText("09:33:00");
  await expect(page.locator(".sc-status-time")).toHaveText("2026-06-05 09:33");
  const hoverText = await tooltip.innerText();

  await page.mouse.click(marker.x, marker.y);
  await expect(tooltip).toHaveAttribute("data-pinned", "true");
  expect(await tooltip.innerText()).toBe(hoverText);

  const canvasBox = await page.locator("canvas.sc-overlay-canvas").boundingBox();
  if (!canvasBox) throw new Error("canvas missing");
  await page.mouse.click(canvasBox.x + canvasBox.width - 140, canvasBox.y + 90);
  await expect(tooltip).toBeHidden();

  const invalidLayoutRejected = await page.evaluate(async (serializedLayout) => {
    const chart = window.__chart;
    if (!chart) throw new Error("chart missing");
    const layout = JSON.parse(serializedLayout);
    const anchor = Date.UTC(2026, 5, 5, 1, 33);
    const replacement = {
      id: "replacement",
      firstTime: Date.UTC(2026, 5, 5, 1, 30),
      lastTime: anchor,
      time: anchor,
      side: "buy" as const,
      price: 100,
      quantity: 300,
      label: "B"
    };
    chart.setExecutions([replacement]);
    chart.importLayout(layout);
    let rejected = false;
    try {
      chart.importLayout({ ...layout, executions: [replacement] });
    } catch (error) {
      rejected = error instanceof TypeError;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return rejected;
  }, persistence.layout);
  expect(invalidLayoutRejected).toBe(true);
  await page.mouse.move(marker.x + 40, marker.y + 40);
  await page.mouse.move(marker.x, marker.y);
  await expect(tooltip).toContainText("09:30:00");
  await expect(tooltip).toContainText("09:33:00");

  await page.evaluate(async (serializedLayout) => {
    const layout = JSON.parse(serializedLayout);
    window.__chart?.setExecutions([]);
    window.__chart?.importLayout(layout);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }, persistence.layout);
  await page.mouse.move(marker.x + 40, marker.y + 40);
  await page.mouse.move(marker.x, marker.y);
  await expect(tooltip).toBeHidden();
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("rejects invalid execution ranges atomically in initial options and setExecutions", async ({ page }) => {
  await page.goto("/?invalidExecutionRange=1");
  await expect(page.locator('.sc-workspace[data-state="blocked"]')).toBeVisible();

  await page.goto("/?executionTimeRange=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const results = await page.evaluate(() => {
    const anchor = Date.UTC(2026, 5, 5, 1, 33);
    const valid = {
      id: "valid",
      time: anchor,
      firstTime: anchor - 180_000,
      lastTime: anchor,
      side: "buy" as const,
      price: 100,
      quantity: 300,
      label: "B"
    };
    const invalid = [
      { ...valid, firstTime: anchor - 120_000, lastTime: undefined },
      { ...valid, firstTime: undefined, lastTime: anchor },
      { ...valid, firstTime: Number.NaN },
      { ...valid, lastTime: Number.POSITIVE_INFINITY },
      { ...valid, firstTime: 0 },
      { ...valid, time: Number.MAX_VALUE, firstTime: Number.MAX_VALUE, lastTime: Number.MAX_VALUE },
      { ...valid, firstTime: anchor, lastTime: anchor - 120_000 },
      { ...valid, time: anchor - 240_000 },
      { ...valid, time: anchor + 60_000 }
    ];
    return invalid.map((row, index) => {
      try {
        window.__chart?.setExecutions(index === 0 ? [valid, row] : [row]);
        return false;
      } catch (error) {
        return error instanceof TypeError;
      }
    });
  });
  expect(results).toEqual(Array(9).fill(true));

  await page.evaluate(async () => {
    window.__chart?.setVisibleRange({
      from: Date.UTC(2026, 5, 5, 1, 30),
      to: Date.UTC(2026, 5, 5, 1, 40)
    });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  await findExecutionMarker(page);
  const tooltip = page.getByTestId("execution-tooltip");
  await expect(tooltip).toContainText("09:31:00");
  await expect(tooltip).toContainText("09:33:00");
  await expect(tooltip).not.toContainText("09:30:00");
});
