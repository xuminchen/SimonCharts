import { expect, test } from "@playwright/test";

test("exposes a keyboard-operable ARIA combobox without moving DOM focus", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const input = page.getByTestId("symbol-search-input");
  const listbox = page.locator('[role="listbox"]');

  await expect(input).toHaveAttribute("role", "combobox");
  await expect(input).toHaveAttribute("aria-autocomplete", "list");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  const listboxId = await input.getAttribute("aria-controls");
  expect(listboxId).toBeTruthy();
  await expect(page.locator(`#${listboxId}`)).toHaveAttribute("role", "listbox");

  await input.fill("股票");
  await expect(listbox.getByRole("option")).toHaveCount(2);
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await input.press("Home");
  await expect(input).not.toHaveAttribute("aria-activedescendant", /.+/);
  expect(await input.evaluate((element) => (element as HTMLInputElement).selectionStart)).toBe(0);
  await input.press("ArrowDown");
  const firstOption = listbox.getByRole("option").first();
  await expect(firstOption).toHaveAttribute("aria-selected", "true");
  await input.press("ArrowRight");
  await expect(input).not.toHaveAttribute("aria-activedescendant", /.+/);
  await expect(firstOption).toHaveAttribute("aria-selected", "false");
  await input.press("ArrowDown");
  await input.press("End");
  const lastOption = listbox.getByRole("option").last();
  await expect(lastOption).toHaveAttribute("aria-selected", "true");
  await expect(input).toHaveAttribute("aria-activedescendant", await lastOption.getAttribute("id") ?? "");
  await expect(input).toBeFocused();

  await input.press("Home");
  await expect(firstOption).toHaveAttribute("aria-selected", "true");
  await input.press("ArrowDown");
  await expect(lastOption).toHaveAttribute("aria-selected", "true");
  await input.press("ArrowUp");
  await expect(firstOption).toHaveAttribute("aria-selected", "true");
  await input.press("Enter");
  await expect(page.locator(".sc-current-symbol")).toContainText("慢速股票");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(input).toBeFocused();
});

test("Escape retains focus, Tab leaves normally, and options are not tabbable", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const input = page.getByTestId("symbol-search-input");
  const listbox = page.locator('[role="listbox"]');
  const initial = await page.locator(".sc-current-symbol").textContent();

  await input.fill("000001");
  await expect(listbox.getByRole("option")).toHaveCount(1);
  await input.press("ArrowDown");
  await input.press("Escape");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(input).toBeFocused();
  await expect(page.locator(".sc-current-symbol")).toHaveText(initial ?? "");

  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await input.press("Tab");
  await expect(input).not.toBeFocused();
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".sc-current-symbol")).toHaveText(initial ?? "");
  await expect(listbox.locator('[role="option"]')).toHaveAttribute("tabindex", "-1");
});

test("announces loading, results, no results, and cancels stale searches when cleared", async ({ page }) => {
  await page.goto("/?latency=500");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const input = page.getByTestId("symbol-search-input");
  const listbox = page.locator('[role="listbox"]');
  const status = page.getByRole("status");

  await input.fill("慢速");
  await page.waitForTimeout(250);
  await expect(input).toHaveAttribute("aria-busy", "true");
  await expect(status).toContainText("正在搜索");
  await input.fill("");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(input).toHaveAttribute("aria-busy", "false");
  await page.waitForTimeout(550);
  await expect(listbox.getByRole("option")).toHaveCount(0);
  expect(await page.evaluate(() => window.__hostCounters.abortedRequests)).toBeGreaterThan(0);

  await input.fill("股票");
  await expect(listbox.getByRole("option")).toHaveCount(2);
  await expect(status).toContainText("2");
  await input.fill("不存在");
  await expect(status).toContainText("没有找到");
  await expect(input).toHaveAttribute("aria-expanded", "true");
});

test("announces search errors and keeps retry keyboard reachable", async ({ page }) => {
  await page.goto("/?searchFailure=1&latency=500");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const input = page.getByTestId("symbol-search-input");
  const retry = page.getByRole("button", { name: "重试", exact: true });

  await input.fill("失败");
  await expect(page.getByRole("status")).toContainText("Symbol search failed");
  await expect(retry).toBeVisible();
  await input.press("Tab");
  await expect(retry).toBeFocused();
  await retry.press("Enter");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status")).toContainText("Symbol search failed");
  await expect(retry).toBeVisible();
});

test("does not offer retry for terminal search errors", async ({ page }) => {
  await page.goto("/?searchFailure=terminal");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const input = page.getByTestId("symbol-search-input");

  await input.fill("失败");

  await expect(page.getByRole("status")).toContainText("尚未配置授权标的搜索");
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);
});

test("waits for IME composition before searching or handling Escape", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const input = page.getByTestId("symbol-search-input");

  await input.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.focus();
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.value = "慢";
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      data: "慢",
      inputType: "insertCompositionText",
      isComposing: true
    }));
    input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Escape",
      isComposing: true
    }));
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() =>
    (window.__workspaceRequests ?? []).filter((request) =>
      String(request.symbolId).startsWith("search:")
    )
  )).toHaveLength(0);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("慢");

  await input.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "慢速";
    input.dispatchEvent(new CompositionEvent("compositionend", {
      bubbles: true,
      data: "慢速"
    }));
  });
  await expect(page.getByRole("option", { name: /慢速股票/ })).toBeVisible();
  expect(await page.evaluate(() =>
    (window.__workspaceRequests ?? []).filter((request) =>
      request.symbolId === "search:慢速"
    )
  )).toHaveLength(1);
});

test("keeps symbol search available at the supported reflow width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const input = page.getByTestId("symbol-search-input");
  await expect(input).toBeVisible();
  await input.fill("000001");
  await expect(page.getByRole("option", { name: /上证指数/ })).toBeVisible();
  const popup = await page.locator(".sc-symbol-search-popup").boundingBox();
  expect(popup).not.toBeNull();
  expect(popup!.x).toBeGreaterThanOrEqual(0);
  expect(popup!.x + popup!.width).toBeLessThanOrEqual(321);
});

test("carries symbol price precision through selection, requests, DOM, and canvas", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    const nativeFillText = CanvasRenderingContext2D.prototype.fillText;
    const texts: Array<{ text: string; x: number; canvasWidth: number; fits: boolean }> = [];
    (window as typeof window & { __canvasTexts?: typeof texts }).__canvasTexts = texts;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      const value = String(text);
      const width = this.measureText(value).width;
      const right = this.textAlign === "right" || this.textAlign === "end"
        ? x
        : this.textAlign === "center" ? x + width / 2 : x + width;
      texts.push({ text: value, x, canvasWidth: this.canvas.clientWidth, fits: right <= this.canvas.clientWidth });
      if (maxWidth === undefined) nativeFillText.call(this, text, x, y);
      else nativeFillText.call(this, text, x, y, maxWidth);
    };
  });
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const input = page.getByTestId("symbol-search-input");
  await input.fill("600008");
  await page.getByRole("option", { name: /八位精度标的/ }).click();
  await expect.poll(() => page.evaluate(() => window.__chart?.getState().symbol))
    .toMatchObject({ id: "stock:SSE:precision", pricePrecision: 8 });
  await expect.poll(() => page.evaluate(() => window.__workspaceRequests ?? []))
    .toContainEqual(expect.objectContaining({
      symbolId: "stock:SSE:precision",
      pricePrecision: 8,
      status: "resolved"
    }));
  await expect(page.getByTestId("chart-ohlc-legend")).toContainText(/\d+\.\d{8}/);
  await expect.poll(() => page.evaluate(() => {
    const labels = (window as typeof window & {
      __canvasTexts?: Array<{ text: string; x: number; canvasWidth: number; fits: boolean }>;
    }).__canvasTexts?.filter(({ text, x, canvasWidth }) =>
      /^\d+\.\d{8}$/.test(text) && x > canvasWidth - 130
    ) ?? [];
    return labels.length > 0 && labels.every(({ fits }) => fits);
  })).toBe(true);

  await page.evaluate(() => {
    (window as typeof window & { __canvasTexts?: unknown[] }).__canvasTexts!.length = 0;
    window.__chart!.setPriceScaleMode("percentage");
  });
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & {
      __canvasTexts?: Array<{ text: string; x: number; canvasWidth: number; fits: boolean }>;
    }).__canvasTexts?.some(({ text, x, canvasWidth, fits }) =>
      /^[+-]?\d+\.\d{2}%$/.test(text) && x >= canvasWidth - 64 && fits
    ) ?? false
  )).toBe(true);
  await page.evaluate(() => {
    (window as typeof window & { __canvasTexts?: unknown[] }).__canvasTexts!.length = 0;
    window.__chart!.setPriceScaleMode("linear");
  });
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & {
      __canvasTexts?: Array<{ text: string; x: number; canvasWidth: number; fits: boolean }>;
    }).__canvasTexts?.some(({ text, x, canvasWidth, fits }) =>
      /^\d+\.\d{8}$/.test(text) && x > canvasWidth - 130 && fits
    ) ?? false
  )).toBe(true);

  expect(await page.evaluate(async () => {
    const texts = (window as typeof window & {
      __canvasTexts?: Array<{ text: string; x: number; canvasWidth: number; fits: boolean }>;
    }).__canvasTexts!;
    texts.length = 0;
    window.__chart!.setView("intraday");
    return window.__chart!.dataReady();
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const labels = (window as typeof window & {
      __canvasTexts?: Array<{ text: string; x: number; canvasWidth: number; fits: boolean }>;
    }).__canvasTexts ?? [];
    return {
      rawPriceFits: labels.some(({ text, x, fits }) =>
        /^\d+\.\d{8}$/.test(text) && x < 130 && fits
      ),
      percentageUsesDefaultRightAxis: labels.some(({ text, x, canvasWidth, fits }) =>
        /^[+-]?\d+\.\d{2}%$/.test(text) && x >= canvasWidth - 64 && fits
      )
    };
  })).toEqual({
    rawPriceFits: true,
    percentageUsesDefaultRightAxis: true
  });
});

test("applies corrected precision metadata for the same symbol id", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.evaluate(() => {
    const chart = window.__chart!;
    chart.setSymbol({ ...chart.getState().symbol, pricePrecision: 4 });
  });

  await expect.poll(() => page.evaluate(() => window.__chart?.getState().symbol.pricePrecision))
    .toBe(4);
  await expect.poll(() => page.evaluate(() => window.__workspaceRequests ?? []))
    .toContainEqual(expect.objectContaining({
      symbolId: "stock:SSE:600000",
      pricePrecision: 4,
      status: "resolved"
    }));
  await expect(page.getByTestId("chart-ohlc-legend")).toContainText(/\d+\.\d{4}/);
});

test("replaces dataReady when same-id symbol metadata changes again", async ({ page }) => {
  await page.goto("/?latency=500");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const replaced = await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setSymbol({ ...chart.getState().symbol, pricePrecision: 4 });
    const ready = chart.dataReady();
    chart.setSymbol({ ...chart.getState().symbol, pricePrecision: 3 });
    return ready;
  });

  expect(replaced).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__chart?.getState().symbol.pricePrecision))
    .toBe(3);
  expect(await page.evaluate(() => window.__chart!.dataReady())).toBe(true);
});

test("rejects invalid public precision without changing the active selection", async ({ page }) => {
  await page.goto("/?invalid=precision");
  await expect(page.getByTestId("simon-chart")).toHaveAttribute("data-state", "blocked");

  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(() => {
    const chart = window.__chart!;
    const before = chart.getState().symbol;
    let error = "";
    try {
      chart.setSymbol({ ...before, pricePrecision: 9 });
    } catch (caught) {
      error = caught instanceof TypeError ? "TypeError" : String(caught);
    }
    return { before, after: chart.getState().symbol, error };
  });

  expect(result).toEqual({ before: result.before, after: result.before, error: "TypeError" });
});
