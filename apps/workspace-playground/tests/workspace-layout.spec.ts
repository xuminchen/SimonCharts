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
  await expect(page.locator(".sc-chart-region")).toHaveAttribute("lang", "en-US");
  await page.getByTestId("series-type-select").click();
  await expect(page.locator('[data-series-type="hollowCandles"] .sc-series-type-label')).toHaveText("Hollow candles");
  await expect(page.locator('[data-series-type="pointAndFigure"] .sc-series-type-label')).toHaveText("Point & figure");
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

test("programs and atomically restores a versioned public layout", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "simoncharts:workspace:v1:workspace-playground:fixture-user:layout",
      "not-json"
    );
  });
  await page.goto("/?latency=100");
  const earlyAccess = await page.evaluate(() => {
    const result: Record<string, string> = {};
    try {
      window.__chart?.importLayout({
        schemaVersion: 2,
        seriesType: "area",
        priceScaleMode: "linear",
        indicators: [],
        drawings: [],
        gridVisible: true
      });
      result.import = "accepted";
    } catch (error) {
      result.import = error instanceof DOMException ? error.name : String(error);
    }
    try {
      window.__chart?.setDrawings([{
        id: "too-early",
        type: "horizontalLine",
        anchors: [{ time: 1, price: 1 }]
      }]);
      result.drawings = "accepted";
    } catch (error) {
      result.drawings = error instanceof DOMException ? error.name : String(error);
    }
    return result;
  });
  expect(earlyAccess).toEqual({
    import: "InvalidStateError",
    drawings: "InvalidStateError"
  });
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(() => {
    const chart = window.__chart;
    if (!chart) throw new Error("public chart handle missing");
    let layoutEvents = 0;
    let lastLayout: unknown;
    const entityEvents: string[] = [];
    const entitySnapshots: string[][] = [];
    let reenteredImport = false;
    const unsubscribe = chart.subscribeEvents((event) => {
      if (event.type === "layout-changed") {
        layoutEvents += 1;
        lastLayout = event.layout;
      }
      if (
        event.type === "entity-created" ||
        event.type === "entity-updated" ||
        event.type === "entity-removed"
      ) {
        entityEvents.push(`${event.type}:${event.entity.id}`);
        entitySnapshots.push(chart.getEntities().map((entity) => entity.id).sort());
        if (
          !reenteredImport &&
          event.type === "entity-created" &&
          event.entity.kind === "indicator" &&
          event.entity.value.id === "MA"
        ) {
          reenteredImport = true;
          chart.updateEntity({
            ...event.entity,
            value: { ...event.entity.value, visible: false }
          });
        }
      }
    });
    chart.setMarks([{ id: "earnings", time: Date.UTC(2026, 5, 5, 1, 30), price: 100, label: "E" }]);
    entityEvents.length = 0;
    entitySnapshots.length = 0;
    chart.importLayout({
      schemaVersion: 2,
      seriesType: "area",
      priceScaleMode: "percentage",
      indicators: [{ instanceId: "MA", id: "MA", params: { period: 5 }, visible: true }],
      drawings: [{
        id: "support",
        type: "horizontalLine",
        anchors: [{ time: Date.UTC(2026, 5, 5, 1, 30), price: 98 }],
        metadata: { rangeLabel: "支撑" }
      }],
      gridVisible: false
    });
    const finalEntityIds = chart.getEntities().map((entity) => entity.id).sort();
    const eventsBeforeInvalid = entityEvents.length;
    const restored = chart.exportLayout();
    let invalidError = "";
    try {
      chart.importLayout({
        ...restored,
        indicators: [{
          instanceId: "MACD",
          id: "MACD",
          params: { fast: 30, slow: 20, signal: 9 },
          visible: true
        }]
      });
    } catch (error) {
      invalidError = error instanceof Error ? error.message : String(error);
    }
    const invalidEntityEvents = entityEvents.length - eventsBeforeInvalid;
    const afterInvalid = chart.exportLayout();
    const marks = chart.getMarks();
    const leakedLayout = chart.exportLayout() as any;
    leakedLayout.drawings[0].anchors[0].price = 1;
    leakedLayout.drawings[0].metadata.rangeLabel = "changed";
    const leakedMarks = chart.getMarks() as any;
    leakedMarks[0].price = 1;
    const defensiveCopies =
      chart.exportLayout().drawings[0]?.anchors[0]?.price === 98 &&
      chart.exportLayout().drawings[0]?.metadata?.rangeLabel === "支撑" &&
      chart.getMarks()[0]?.price === 100;
    unsubscribe();
    return {
      restored,
      afterInvalid,
      marks,
      layoutEvents,
      lastLayout,
      invalidError,
      defensiveCopies,
      entityEvents,
      entitySnapshots,
      finalEntityIds,
      invalidEntityEvents
    };
  });

  expect(result.restored).toEqual(result.afterInvalid);
  expect(result.restored).toMatchObject({
    schemaVersion: 2,
    seriesType: "area",
    priceScaleMode: "percentage",
    indicators: [{
      instanceId: "MA",
      id: "MA",
      params: { period: 5 },
      visible: false
    }],
    drawings: [{ id: "support", metadata: { rangeLabel: "支撑" } }],
    gridVisible: false
  });
  expect(result.marks).toEqual([expect.objectContaining({ id: "earnings", label: "E" })]);
  expect(result.layoutEvents).toBe(1);
  expect(result.lastLayout).toEqual(result.restored);
  expect(result.entityEvents).toEqual([
    expect.stringMatching(/^entity-created:indicator:/),
    expect.stringMatching(/^entity-created:drawing:/),
    expect.stringMatching(/^entity-updated:indicator:/)
  ]);
  expect(result.entitySnapshots.every((snapshot) =>
    JSON.stringify(snapshot) === JSON.stringify(result.finalEntityIds)
  )).toBe(true);
  expect(result.invalidEntityEvents).toBe(0);
  expect(result.invalidError).toContain("fast must be less than slow");
  expect(result.defensiveCopies).toBe(true);
  await expect(page.getByTestId("series-type-select")).toHaveAttribute("data-value", "area");
  await expect(page.getByTestId("price-scale-select")).toHaveValue("percentage");
  await expect(page.getByTestId("indicator-legend-MA")).toHaveAttribute("data-visible", "false");
  await expect(page.getByTestId("grid-visible")).not.toBeChecked();

  await page.evaluate(() => window.__chart?.setView("intraday"));
  await expect.poll(() => page.evaluate(() => window.__chart?.getState()))
    .toMatchObject({ view: "intraday", loading: false });
  const intradayResult = await page.evaluate(() => {
    const chart = window.__chart!;
    const before = chart.exportLayout();
    let importError = "";
    let seriesError = "";
    try {
      chart.importLayout({ ...before, seriesType: "area" });
    } catch (error) {
      importError = error instanceof Error ? error.message : String(error);
    }
    try {
      chart.setSeriesType("area");
    } catch (error) {
      seriesError = error instanceof Error ? error.message : String(error);
    }
    return { before, after: chart.exportLayout(), importError, seriesError };
  });
  expect(intradayResult.after).toEqual(intradayResult.before);
  expect(intradayResult.importError).toContain("only line-series layouts");
  expect(intradayResult.seriesError).toContain("fixed line series type");
});

test("manages stable chart entities and publishes exact lifecycle events", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(() => {
    const chart = window.__chart;
    if (!chart) throw new Error("public chart handle missing");
    const events: Array<{ type: string; id: string }> = [];
    const unsubscribe = chart.subscribeEvents((event) => {
      if (
        event.type === "entity-created" ||
        event.type === "entity-updated" ||
        event.type === "entity-removed"
      ) {
        events.push({ type: event.type, id: event.entity.id });
      }
    });

    const indicatorId = chart.createEntity({
      kind: "indicator",
      value: {
        instanceId: "rsi-primary",
        id: "RSI",
        params: { period: 6 },
        visible: true
      }
    });
    const drawing = {
      id: "entity-support",
      type: "horizontalLine" as const,
      anchors: [{ time: Date.UTC(2026, 5, 5, 1, 30), price: 98 }],
      metadata: { alpha: 1, beta: 2 }
    };
    const drawingId = chart.createEntity({ kind: "drawing", value: drawing });
    const markId = chart.createEntity({
      kind: "mark",
      value: {
        id: "entity-event",
        time: Date.UTC(2026, 5, 5, 1, 30),
        price: 100,
        label: "E"
      }
    });

    let duplicateError = "";
    try {
      chart.createEntity({
        kind: "indicator",
        value: {
          instanceId: "rsi-primary",
          id: "RSI",
          params: { period: 14 },
          visible: true
        }
      });
    } catch (error) {
      duplicateError = error instanceof DOMException ? error.name : String(error);
    }

    chart.updateEntity({
      id: indicatorId,
      kind: "indicator",
      value: {
        instanceId: "rsi-primary",
        id: "RSI",
        params: { period: 14 },
        visible: false
      }
    });
    let mismatchError = "";
    try {
      chart.updateEntity({
        id: markId,
        kind: "drawing",
        value: {
          id: "wrong-kind",
          type: "horizontalLine",
          anchors: [{ time: Date.UTC(2026, 5, 5, 1, 30), price: 99 }]
        }
      });
    } catch (error) {
      mismatchError = error instanceof Error ? error.message : String(error);
    }
    chart.updateEntity({
      id: drawingId,
      kind: "drawing",
      value: { ...drawing, metadata: { beta: 2, alpha: 1 } }
    });
    let invalidSymbolError = "";
    try {
      chart.setSymbol({
        id: "",
        code: "bad",
        name: "bad",
        exchange: "SSE",
        kind: "stock"
      });
    } catch (error) {
      invalidSymbolError = error instanceof Error ? error.message : String(error);
    }

    const leaked = chart.getEntity(markId) as any;
    leaked.value.price = 1;
    const defensiveCopy = (chart.getEntity(markId) as any)?.value.price === 100;
    const removed = chart.removeEntity(drawingId);
    const removedAgain = chart.removeEntity(drawingId);
    const indicatorEntities = chart.getEntities("indicator");
    const missingDrawing = chart.getEntity(drawingId);
    unsubscribe();

    return {
      indicatorId,
      drawingId,
      markId,
      duplicateError,
      mismatchError,
      invalidSymbolError,
      defensiveCopy,
      removed,
      removedAgain,
      indicatorEntities,
      missingDrawing,
      events
    };
  });

  expect(result).toMatchObject({
    duplicateError: "InvalidStateError",
    defensiveCopy: true,
    removed: true,
    removedAgain: false,
    indicatorEntities: [{
      id: result.indicatorId,
      kind: "indicator",
      value: {
        instanceId: "rsi-primary",
        id: "RSI",
        params: { period: 14 },
        visible: false
      }
    }],
    missingDrawing: undefined,
    events: [
      { type: "entity-created", id: result.indicatorId },
      { type: "entity-created", id: result.drawingId },
      { type: "entity-created", id: result.markId },
      { type: "entity-updated", id: result.indicatorId },
      { type: "entity-removed", id: result.drawingId }
    ]
  });
  expect(result.indicatorId).toMatch(/^indicator:/);
  expect(result.drawingId).toMatch(/^drawing:/);
  expect(result.markId).toMatch(/^mark:/);
  expect(result.mismatchError).toContain("does not match");
  expect(result.invalidSymbolError).toContain("symbol is invalid");
});

test("creates and restores independent same-type study instances", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(() => {
    const chart = window.__chart;
    if (!chart) throw new Error("public chart handle missing");
    const firstId = chart.createStudy({
      id: "MA",
      params: { period: 5 },
      visible: true
    });
    const secondId = chart.createStudy({
      id: "MA",
      params: { period: 20 },
      visible: true
    });
    const second = chart.getEntity(secondId);
    if (second?.kind !== "indicator") throw new Error("second study missing");
    chart.updateEntity({
      ...second,
      value: { ...second.value, visible: false }
    });
    const saved = chart.exportLayout();
    const beforeRemove = chart.getAllStudies();
    const removed = chart.removeStudy(firstId);
    const afterRemove = chart.getAllStudies();
    const replacementId = chart.createStudy({
      id: "MA",
      params: { period: 50 },
      visible: true
    });
    const staleRemove = chart.removeStudy(firstId);
    chart.removeStudy(replacementId);
    chart.importLayout(saved);
    const restored = chart.getAllStudies();
    const leaked = chart.getStudyById(secondId) as any;
    leaked.params.period = 1;

    return {
      firstId,
      secondId,
      replacementId,
      beforeRemove,
      removed,
      afterRemove,
      staleRemove,
      restored,
      defensiveCopy: chart.getStudyById(secondId)?.params.period === 20
    };
  });

  expect(result.firstId).not.toBe(result.secondId);
  expect(result.replacementId).not.toBe(result.firstId);
  expect(result.beforeRemove).toEqual([
    expect.objectContaining({ id: "MA", params: { period: 5 }, visible: true }),
    expect.objectContaining({ id: "MA", params: { period: 20 }, visible: false })
  ]);
  expect(result.beforeRemove[0]?.instanceId).toMatch(/^study-[0-9a-f-]{36}$/);
  expect(result.beforeRemove[1]?.instanceId).toMatch(/^study-[0-9a-f-]{36}$/);
  expect(result.removed).toBe(true);
  expect(result.afterRemove).toEqual([result.beforeRemove[1]]);
  expect(result.staleRemove).toBe(false);
  expect(result.restored).toEqual(result.beforeRemove);
  expect(result.defensiveCopy).toBe(true);
  await page.getByTestId("indicator-manager-open").click();
  await expect(page.getByTestId(`indicator-legend-${result.beforeRemove[0]?.instanceId}`)).toBeVisible();
  await expect(page.getByTestId(`indicator-legend-${result.beforeRemove[1]?.instanceId}`))
    .toHaveAttribute("data-visible", "false");
});

test("never publishes stale state or layout after a reentrant listener", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const chart = window.__chart;
    if (!chart) throw new Error("public chart handle missing");
    const layouts: boolean[] = [];
    let resolveFinalLayout: () => void = () => undefined;
    const finalLayout = new Promise<void>((resolve) => {
      resolveFinalLayout = resolve;
    });
    const stopEvents = chart.subscribeEvents((event) => {
      if (event.type === "layout-changed") {
        const study = event.layout.indicators.find(
          (indicator) => indicator.instanceId === "reentrant-rsi"
        );
        if (study) {
          layouts.push(study.visible);
          if (!study.visible) resolveFinalLayout();
        }
        return;
      }
      if (
        event.type === "entity-created" &&
        event.entity.kind === "indicator" &&
        event.entity.value.instanceId === "reentrant-rsi"
      ) {
        chart.updateEntity({
          ...event.entity,
          value: { ...event.entity.value, visible: false }
        });
      }
    });
    chart.createEntity({
      kind: "indicator",
      value: {
        instanceId: "reentrant-rsi",
        id: "RSI",
        params: { period: 14 },
        visible: true
      }
    });
    await Promise.race([
      finalLayout,
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error("final reentrant layout was not published")), 5_000)
      )
    ]);
    stopEvents();

    const firstStates: string[] = [];
    const secondStates: string[] = [];
    let reentered = false;
    const stopFirst = chart.subscribe((state) => {
      firstStates.push(state.timeframe);
      if (!reentered && state.timeframe === "5m") {
        reentered = true;
        chart.setTimeframe("15m");
      }
    });
    const stopSecond = chart.subscribe((state) => secondStates.push(state.timeframe));
    chart.setTimeframe("5m");
    stopFirst();
    stopSecond();

    return {
      layouts,
      firstStates,
      secondStates,
      currentTimeframe: chart.getState().timeframe
    };
  });

  expect(result.layouts).toEqual([false]);
  expect(result.firstStates).toEqual(["5m", "15m"]);
  expect(result.secondStates).toEqual(["15m"]);
  expect(result.currentTimeframe).toBe("15m");
});

test("keeps entity events reentrant and entity ids isolated by their real persistence scope", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const chart = window.__chart;
    if (!chart) throw new Error("public chart handle missing");
    const reentrantEvents: string[] = [];
    const unsubscribe = chart.subscribeEvents((event) => {
      if (
        event.type !== "entity-created" &&
        event.type !== "entity-updated" &&
        event.type !== "entity-removed"
      ) return;
      reentrantEvents.push(`${event.type}:${event.entity.id}`);
      if (
        event.type === "entity-created" &&
        event.entity.kind === "indicator" &&
        event.entity.value.id === "RSI"
      ) {
        chart.updateEntity({
          ...event.entity,
          value: { ...event.entity.value, visible: false }
        });
      }
    });
    const indicatorId = chart.createEntity({
      kind: "indicator",
      value: {
        instanceId: "rsi-primary",
        id: "RSI",
        params: { period: 6 },
        visible: true
      }
    });
    unsubscribe();
    const maId = chart.createEntity({
      kind: "indicator",
      value: {
        instanceId: "ma-primary",
        id: "MA",
        params: { period: 5 },
        visible: true
      }
    });
    const batchEvents: string[] = [];
    let removedMa = false;
    const unsubscribeBatch = chart.subscribeEvents((event) => {
      if (
        event.type !== "entity-created" &&
        event.type !== "entity-updated" &&
        event.type !== "entity-removed"
      ) return;
      batchEvents.push(`${event.type}:${event.entity.id}`);
      if (
        !removedMa &&
        event.type === "entity-updated" &&
        event.entity.kind === "indicator" &&
        event.entity.value.id === "RSI"
      ) {
        removedMa = true;
        chart.removeEntity(maId);
      }
    });
    chart.setIndicators([
      {
        instanceId: "rsi-primary",
        id: "RSI",
        params: { period: 14 },
        visible: false
      },
      {
        instanceId: "ma-primary",
        id: "MA",
        params: { period: 10 },
        visible: false
      }
    ]);
    unsubscribeBatch();

    const waitForAdjustMode = (adjustMode: "forward" | "backward") =>
      new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          stop();
          reject(new Error(`adjustment ${adjustMode} did not load`));
        }, 5_000);
        const stop = chart.subscribeEvents((event) => {
          if (
            event.type !== "data-loaded" ||
            event.phase !== "initial" ||
            event.state.adjustMode !== adjustMode
          ) return;
          window.clearTimeout(timeout);
          stop();
          resolve();
        });
        chart.setAdjustMode(adjustMode);
      });

    const drawing = {
      id: "scope-support",
      type: "horizontalLine" as const,
      anchors: [{ time: Date.UTC(2026, 5, 5, 1, 30), price: 98 }]
    };
    const forwardDrawingId = chart.createEntity({ kind: "drawing", value: drawing });
    await waitForAdjustMode("backward");
    const oldDrawingMissing = chart.getEntity(forwardDrawingId) === undefined;
    const staleRemove = chart.removeEntity(forwardDrawingId);
    let staleUpdateError = "";
    try {
      chart.updateEntity({ id: forwardDrawingId, kind: "drawing", value: drawing });
    } catch (error) {
      staleUpdateError = error instanceof DOMException ? error.name : String(error);
    }
    const backwardDrawingId = chart.createEntity({ kind: "drawing", value: drawing });
    await waitForAdjustMode("forward");
    const restoredDrawingId = chart.getEntities("drawing")
      .find((entity) => entity.kind === "drawing" && entity.value.id === drawing.id)?.id;

    const mark = {
      id: "scope-event",
      time: Date.UTC(2026, 5, 5, 1, 30),
      price: 100
    };
    const markId = chart.createEntity({ kind: "mark", value: mark });
    await waitForAdjustMode("backward");
    const markSurvivesAdjustment = chart.getEntity(markId)?.id === markId;
    chart.setSymbol({
      id: "stock:SSE:slow",
      code: "600001",
      name: "慢速股票",
      exchange: "SSE",
      kind: "stock"
    });
    const oldMarkMissing = chart.getEntity(markId) === undefined;
    const otherSymbolMarkId = chart.createEntity({ kind: "mark", value: mark });
    const indicator = chart.getEntity(indicatorId);

    return {
      indicatorId,
      maId,
      indicatorVisible: indicator?.kind === "indicator"
        ? indicator.value.visible
        : undefined,
      reentrantEvents,
      batchEvents,
      maMissingAfterBatch: chart.getEntity(maId) === undefined,
      forwardDrawingId,
      backwardDrawingId,
      restoredDrawingId,
      oldDrawingMissing,
      staleRemove,
      staleUpdateError,
      markId,
      otherSymbolMarkId,
      markSurvivesAdjustment,
      oldMarkMissing
    };
  });

  expect(result.reentrantEvents).toEqual([
    `entity-created:${result.indicatorId}`,
    `entity-updated:${result.indicatorId}`
  ]);
  expect(result.indicatorVisible).toBe(false);
  expect(result.batchEvents).toEqual([
    `entity-updated:${result.indicatorId}`,
    `entity-updated:${result.maId}`,
    `entity-removed:${result.maId}`
  ]);
  expect(result.maMissingAfterBatch).toBe(true);
  expect(result.forwardDrawingId).not.toBe(result.backwardDrawingId);
  expect(result.restoredDrawingId).toBe(result.forwardDrawingId);
  expect(result.oldDrawingMissing).toBe(true);
  expect(result.staleRemove).toBe(false);
  expect(result.staleUpdateError).toBe("NotFoundError");
  expect(result.markSurvivesAdjustment).toBe(true);
  expect(result.oldMarkMissing).toBe(true);
  expect(result.markId).not.toBe(result.otherSymbolMarkId);
});

test("stops event dispatch immediately when a listener destroys the chart", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(() => {
    const chart = window.__chart!;
    const listeners: string[] = [];
    chart.subscribeEvents((event) => {
      if (event.type !== "entity-created") return;
      listeners.push("first");
      chart.destroy();
    });
    chart.subscribeEvents((event) => {
      if (event.type === "entity-created") listeners.push("second");
    });
    const id = chart.createEntity({
      kind: "indicator",
      value: {
        instanceId: "rsi-primary",
        id: "RSI",
        params: { period: 6 },
        visible: true
      }
    });
    let updateError = "";
    try {
      chart.updateEntity({
        id,
        kind: "indicator",
        value: {
          instanceId: "rsi-primary",
          id: "RSI",
          params: { period: 14 },
          visible: false
        }
      });
    } catch (error) {
      updateError = error instanceof DOMException ? error.name : String(error);
    }
    return {
      listeners,
      snapshotId: chart.getEntity(id)?.id,
      updateError,
      removeResult: chart.removeEntity(id)
    };
  });

  expect(result).toEqual({
    listeners: ["first"],
    snapshotId: expect.stringMatching(/^indicator:/),
    updateError: "InvalidStateError",
    removeResult: false
  });
});

test("does not publish or export a transient layout while a new symbol loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const result = await page.evaluate(() => new Promise<{
    layoutEvents: number;
    slowExport: string;
    repeatedExport: string;
  }>((resolve, reject) => {
    const chart = window.__chart!;
    chart.setDrawings([{
      id: "old-symbol-support",
      type: "horizontalLine",
      anchors: [{ time: Date.UTC(2026, 5, 5, 1, 30), price: 98 }]
    }]);
    let layoutEvents = 0;
    const unsubscribe = chart.subscribeEvents((event) => {
      if (event.type === "layout-changed") layoutEvents += 1;
    });
    chart.setSymbol({
      id: "stock:SSE:slow",
      code: "600001",
      name: "慢速股票",
      exchange: "SSE",
      kind: "stock"
    });
    window.setTimeout(() => {
      let slowExport = "accepted";
      try {
        chart.exportLayout();
      } catch (error) {
        slowExport = error instanceof DOMException ? error.name : String(error);
      }
      const nativeSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
      let handled = false;
      let unsubscribeState: () => void = () => undefined;
      const timeout = window.setTimeout(() => {
        unsubscribeState();
        unsubscribe();
        Storage.prototype.setItem = nativeSetItem;
        reject(new Error("repeated selection did not enter loading"));
      }, 5_000);
      unsubscribeState = chart.subscribe((state) => {
        if (handled || state.symbol.id !== "stock:SSE:600000" || !state.loading) return;
        handled = true;
        chart.setPriceScaleMode("percentage");
        let repeatedExport = "accepted";
        try {
          chart.exportLayout();
        } catch (error) {
          repeatedExport = error instanceof DOMException ? error.name : String(error);
        }
        window.clearTimeout(timeout);
        unsubscribeState();
        unsubscribe();
        Storage.prototype.setItem = nativeSetItem;
        resolve({ layoutEvents, slowExport, repeatedExport });
      });
      chart.setSymbol({
        id: "stock:SSE:600000",
        code: "600000",
        name: "浦发银行",
        exchange: "SSE",
        kind: "stock"
      });
    }, 1_200);
  }));
  expect(result).toEqual({
    layoutEvents: 0,
    slowExport: "InvalidStateError",
    repeatedExport: "InvalidStateError"
  });
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
