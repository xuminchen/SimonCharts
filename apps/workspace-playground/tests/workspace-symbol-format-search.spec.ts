import { expect, test } from "@playwright/test";

test("reuses one symbol search for adding and managing comparisons", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const input = page.getByTestId("symbol-search-input");
  const initialSymbol = await page.locator(".sc-current-symbol").textContent();

  await expect(input).toHaveCount(1);
  await page.getByTestId("symbol-compare-toggle").click();
  await expect(input).toHaveAttribute("aria-label", "添加比较标的");
  await expect(input).toBeFocused();

  await input.fill("慢速");
  await page.getByRole("option", { name: /慢速股票/ }).click();
  await expect(page.locator(".sc-current-symbol")).toHaveText(initialSymbol ?? "");
  const chip = page.locator('[data-comparison-symbol-id="stock:SSE:slow"]');
  await expect(chip).toContainText("慢速股票 600001");
  await expect(chip.locator(".sc-comparison-status")).toHaveText("加载中");
  await expect(chip.locator(".sc-comparison-swatch")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__chart?.getPriceScaleMode()))
    .toBe("percentage");
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas.sc-static-canvas");
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let matches = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        pixels[index] === 41 &&
        pixels[index + 1] === 98 &&
        pixels[index + 2] === 255 &&
        pixels[index + 3]! > 0
      ) matches += 1;
    }
    return matches;
  })).toBeGreaterThan(0);
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.45);
  await page.getByRole("tab", { name: "数据窗口", exact: true }).click();
  await expect(page.getByTestId("data-window-comparison-stock:SSE:slow"))
    .toContainText(/[\d.]+ · [+-]?[\d.]+%/);
  await expect(chip).toHaveAttribute("data-status", "ready");
  await expect(chip.locator(".sc-comparison-status")).toBeHidden();
  await expect(chip.locator(".sc-comparison-visibility")).toHaveAttribute("title", /已就绪/);

  const visibility = chip.getByRole("button", { name: /隐藏比较标的/ });
  await visibility.click();
  await expect(chip).toHaveAttribute("data-status", "hidden");
  await expect(chip.locator(".sc-comparison-status")).toHaveText("已隐藏");
  await expect(page.getByTestId("data-window-comparison-stock:SSE:slow")).toHaveCount(0);
  await expect(chip.getByRole("button", { name: /显示比较标的/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__chart?.getComparisons()[0]?.visible))
    .toBe(false);

  await chip.getByRole("button", { name: /移除比较标的/ }).click();
  await expect(chip).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__chart?.getComparisons()))
    .toEqual([]);

  await page.getByTestId("symbol-compare-toggle").click();
  await expect(input).toHaveAttribute("aria-label", "搜索标的");
  await expect(input).toHaveCount(1);
});

test("localizes the comparison search mode in English", async ({ page }) => {
  await page.goto("/?locale=en-US");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const input = page.getByTestId("symbol-search-input");
  const toggle = page.getByTestId("symbol-compare-toggle");

  await expect(toggle).toHaveAttribute("aria-label", "Add comparison symbol");
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(input).toHaveAttribute("aria-label", "Add comparison symbol");
  await expect(input).toBeFocused();
});

test("formats each comparison data-window value with its own precision", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setComparisons([
      {
        symbol: {
          id: "stock:SSE:slow",
          code: "600001",
          name: "零位精度标的",
          exchange: "SSE",
          kind: "stock",
          pricePrecision: 0
        },
        color: "#2962ff"
      },
      {
        symbol: {
          id: "stock:SSE:fast",
          code: "600002",
          name: "五位精度标的",
          exchange: "SSE",
          kind: "stock",
          pricePrecision: 5
        },
        color: "#f59e0b"
      }
    ]);
    return chart.dataReady();
  })).toBe(true);
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.45);
  await page.getByRole("tab", { name: "数据窗口", exact: true }).click();

  await expect(page.getByTestId("data-window-comparison-stock:SSE:slow"))
    .toHaveText(/^\d+ · [+-]?[\d.]+%$/);
  await expect(page.getByTestId("data-window-comparison-stock:SSE:fast"))
    .toHaveText(/^\d+\.\d{5} · [+-]?[\d.]+%$/);
});

test("surfaces the contract rejection without partially adding a fifth comparison", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.evaluate(() => window.__chart!.setComparisons([
    { symbol: { id: "index:SSE:000001", code: "000001", name: "上证指数", exchange: "SSE", kind: "index" } },
    { symbol: { id: "stock:SSE:slow", code: "600001", name: "慢速股票", exchange: "SSE", kind: "stock" } },
    { symbol: { id: "stock:SSE:fast", code: "600002", name: "快速股票", exchange: "SSE", kind: "stock" } },
    { symbol: { id: "stock:SSE:other", code: "600003", name: "其他股票", exchange: "SSE", kind: "stock" } }
  ]));
  await expect(page.locator(".sc-comparison-chip")).toHaveCount(4);
  await page.getByTestId("symbol-compare-toggle").click();
  await page.getByTestId("symbol-search-input").fill("600008");
  await page.getByRole("option", { name: /八位精度标的/ }).click();

  await expect(page.locator(".sc-symbol-search-message")).toContainText("at most 4");
  await expect(page.locator(".sc-comparison-chip")).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => window.__chart!.getComparisons().length))
    .toBe(4);
});

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
