import { expect, test } from "@playwright/test";

test("gates pane state until the current selection is ready", async ({ page }) => {
  await page.goto("/?latency=100");

  expect(await page.evaluate(() => {
    try {
      window.__chart!.getPanes();
      return "accepted";
    } catch (error) {
      return error instanceof DOMException ? error.name : String(error);
    }
  })).toBe("InvalidStateError");

  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__chart!.getPanes()))
    .toEqual([
      expect.objectContaining({
        id: "main",
        kind: "main",
        visible: true,
        collapsed: false,
        priceScale: expect.objectContaining({
          mode: "linear",
          autoScale: true,
          inverted: false
        })
      })
    ]);
});

test("programs real pane geometry, independent scales, and Layout V3", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const chart = window.__chart!;
    const frame = () => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    const canvas = document.querySelector<HTMLCanvasElement>("canvas.sc-static-canvas")!;
    const hash = () => canvas.toDataURL();
    const events: unknown[] = [];
    chart.subscribeEvents((event) => {
      if (event.type === "layout-changed") events.push(structuredClone(event.layout));
    });
    chart.createStudy({
      instanceId: "pane-macd",
      id: "MACD",
      params: { fast: 12, slow: 26, signal: 9 },
      visible: true
    });
    chart.createStudy({
      instanceId: "pane-rsi",
      id: "RSI",
      params: { period: 6 },
      visible: true
    });
    await chart.dataReady();
    await frame();

    const initial = chart.getPanes();
    const macd = chart.getPaneApi("study:pane-macd")!;
    const rsi = chart.getPaneApi("study:pane-rsi")!;
    const main = chart.getPaneApi("main")!;
    const initialHash = hash();

    events.length = 0;
    macd.setHeightRatio(2);
    await frame();
    const heightHash = hash();
    const heightEvents = events.length;
    const afterHeight = macd.getState();

    events.length = 0;
    macd.setCollapsed(true);
    await frame();
    const collapsedHash = hash();
    macd.setCollapsed(false);
    rsi.moveTo(1);
    await frame();
    const orderedHash = hash();
    const afterOrder = chart.getPanes().map((pane) => pane.id);

    const mainScale = main.getPriceScale();
    mainScale.setVisibleRange({ from: 50, to: 150 });
    await frame();
    const manualHash = hash();
    mainScale.setInverted(true);
    await frame();
    const invertedHash = hash();

    const macdScale = macd.getPriceScale();
    macdScale.setVisibleRange({ from: -5, to: 5 });
    macdScale.setInverted(true);
    const saved = chart.exportLayout();
    const leaked = chart.getPanes() as any;
    leaked[0].heightRatio = 99;
    leaked[0].priceScale.inverted = false;
    const defensiveCopy = chart.getPaneById("main")?.heightRatio !== 99 &&
      chart.getPaneById("main")?.priceScale.inverted === true;

    const beforeInvalid = chart.exportLayout();
    let invalidError = "";
    try {
      chart.importLayout({
        ...beforeInvalid,
        panes: [beforeInvalid.panes[0], beforeInvalid.panes[0]]
      });
    } catch (error) {
      invalidError = error instanceof Error ? error.message : String(error);
    }
    const afterInvalid = chart.exportLayout();

    main.setHeightRatio(5);
    macdScale.setAutoScale(true);
    chart.importLayout(saved);
    const restored = chart.exportLayout();

    chart.importLayout({
      schemaVersion: 2,
      seriesType: saved.seriesType,
      ...(saved.seriesProperties === undefined
        ? {}
        : { seriesProperties: saved.seriesProperties }),
      priceScaleMode: saved.priceScaleMode,
      indicators: saved.indicators,
      drawings: saved.drawings,
      gridVisible: saved.gridVisible
    });
    const migrated = chart.exportLayout();

    return {
      initial,
      afterHeight,
      afterOrder,
      heightEvents,
      hashesChanged: {
        height: initialHash !== heightHash,
        collapse: heightHash !== collapsedHash,
        order: collapsedHash !== orderedHash,
        manual: orderedHash !== manualHash,
        inverted: manualHash !== invertedHash
      },
      saved,
      defensiveCopy,
      invalidError,
      atomic: JSON.stringify(beforeInvalid) === JSON.stringify(afterInvalid),
      restored: JSON.stringify(saved) === JSON.stringify(restored),
      migrated
    };
  });

  expect(result.initial.map((pane) => pane.id)).toEqual([
    "main",
    "study:pane-macd",
    "study:pane-rsi"
  ]);
  expect(result.afterHeight.heightRatio).toBe(2);
  expect(result.afterOrder).toEqual([
    "main",
    "study:pane-rsi",
    "study:pane-macd"
  ]);
  expect(result.heightEvents).toBe(1);
  expect(result.hashesChanged).toEqual({
    height: true,
    collapse: true,
    order: true,
    manual: true,
    inverted: true
  });
  expect(result.saved.schemaVersion).toBe(3);
  expect(result.saved.panes.find((pane) => pane.id === "main")).toMatchObject({
    priceScale: {
      autoScale: false,
      inverted: true,
      visibleRange: { from: 50, to: 150 }
    }
  });
  expect(result.saved.panes.find((pane) => pane.id === "study:pane-macd"))
    .toMatchObject({
      priceScale: {
        autoScale: false,
        inverted: true,
        visibleRange: { from: -5, to: 5 }
      }
    });
  expect(result.defensiveCopy).toBe(true);
  expect(result.invalidError).toContain("duplicated");
  expect(result.atomic).toBe(true);
  expect(result.restored).toBe(true);
  expect(result.migrated.schemaVersion).toBe(3);
  expect(result.migrated.panes.find((pane) => pane.id === "main")).toMatchObject({
    heightRatio: 3,
    collapsed: false,
    priceScale: { autoScale: true, inverted: false }
  });
  expect(result.migrated.panes.slice(1).every((pane) =>
    pane.heightRatio === 1 &&
    pane.collapsed === false &&
    pane.priceScale.autoScale === true &&
    pane.priceScale.inverted === false
  )).toBe(true);
  expect(errors).toEqual([]);
});

test("keeps pane handles live and rejects invalid or intraday scale mutations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const chart = window.__chart!;
    const entityId = chart.createStudy({
      instanceId: "pane-live-rsi",
      id: "RSI",
      params: { period: 6 },
      visible: true
    });
    await chart.dataReady();
    const handle = chart.getPaneApi("study:pane-live-rsi")!;
    const errors: Record<string, string> = {};
    const capture = (key: string, action: () => void) => {
      try {
        action();
      } catch (error) {
        errors[key] = error instanceof DOMException
          ? error.name
          : error instanceof Error ? error.message : String(error);
      }
    };
    capture("ratio", () => handle.setHeightRatio(Number.NaN));
    capture("order", () => handle.moveTo(0));
    capture("mode", () => handle.getPriceScale().setMode("log"));
    capture("range", () => handle.getPriceScale().setVisibleRange({ from: 1, to: 1 }));
    chart.removeStudy(entityId);
    capture("stale", () => handle.getState());
    const missing = chart.getPaneApi("study:pane-live-rsi");

    chart.getPaneApi("main")!.getPriceScale().setVisibleRange({ from: 50, to: 150 });
    chart.setTimeframe("5m");
    await chart.dataReady();
    const resetScale = chart.getPaneApi("main")!.getPriceScale().getState();
    chart.setView("intraday");
    await chart.dataReady();
    const intraday = chart.getPaneApi("main")!;
    capture("intraday", () => intraday.getPriceScale().setInverted(true));
    const beforeIntradayImport = chart.exportLayout();
    capture("intradayImport", () => chart.importLayout({
      ...beforeIntradayImport,
      panes: beforeIntradayImport.panes.map((pane) => pane.id === "main"
        ? {
            ...pane,
            priceScale: {
              autoScale: false,
              inverted: true,
              visibleRange: { from: 1, to: 2 }
            }
          }
        : pane)
    }));
    return {
      errors,
      missing: missing === undefined,
      resetScale,
      intradayState: intraday.getPriceScale().getState(),
      intradayImportAtomic:
        JSON.stringify(beforeIntradayImport) === JSON.stringify(chart.exportLayout())
    };
  });

  expect(result.errors).toMatchObject({
    ratio: expect.stringContaining("height ratio"),
    order: expect.stringContaining("cannot precede"),
    mode: expect.stringContaining("only a linear"),
    range: expect.stringContaining("ascending"),
    stale: "NotFoundError",
    intraday: expect.stringContaining("fixed price scale"),
    intradayImport: expect.stringContaining("fixed price scale")
  });
  expect(result.missing).toBe(true);
  expect(result.resetScale).toMatchObject({
    autoScale: true,
    inverted: false
  });
  expect(result.intradayState).toMatchObject({
    mode: "percentage",
    autoScale: true,
    inverted: false
  });
  expect(result.intradayImportAtomic).toBe(true);
});

test("persists native price-axis drag and resets it on double click", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  const x = box.x + box.width - 20;
  const y = box.y + 200;

  await page.mouse.click(x, y);
  expect(await page.evaluate(() =>
    window.__chart!.getPaneById("main")?.priceScale.autoScale
  )).toBe(true);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 80, { steps: 4 });
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() =>
    window.__chart!.getPaneById("main")?.priceScale
  )).toMatchObject({
    autoScale: false,
    visibleRange: {
      from: expect.any(Number),
      to: expect.any(Number)
    }
  });
  expect(await page.evaluate(() => window.__chart!.exportLayout().panes[0]?.priceScale.autoScale))
    .toBe(false);

  await page.mouse.dblclick(x, y);
  await expect.poll(() => page.evaluate(() =>
    window.__chart!.getPaneById("main")?.priceScale
  )).toEqual({
    mode: "linear",
    autoScale: true,
    inverted: false
  });
});

test("keeps the connected crosshair active inside a study pane", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.createStudy({
      instanceId: "pane-crosshair-rsi",
      id: "RSI",
      params: { period: 6 },
      visible: true
    });
    await chart.dataReady();
    (window as any).__paneCrosshairEvents = [];
    chart.subscribeCrosshair((event) => {
      (window as any).__paneCrosshairEvents.push(structuredClone(event));
    });
  });
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");

  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.8);

  await expect.poll(() => page.evaluate(() =>
    (window as any).__paneCrosshairEvents.at(-1)
  )).toMatchObject({
    type: "crosshair-moved",
    crosshair: {
      offsetY: expect.any(Number),
      studies: expect.arrayContaining([
        expect.objectContaining({ indicatorId: "RSI" })
      ])
    }
  });
  expect(await page.evaluate(() =>
    (window as any).__paneCrosshairEvents.at(-1).crosshair.offsetY
  )).toBeCloseTo(box.height * 0.8, 0);
});

test("preserves a manual pane scale while historical pages materialize", async ({ page }) => {
  await page.goto("/?history=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.evaluate(() => {
    const chart = window.__chart!;
    chart.getPaneApi("main")!.getPriceScale().setVisibleRange({ from: 50, to: 150 });
    const origin = Date.UTC(2026, 5, 5, 1, 30);
    chart.setVisibleRange({ from: origin, to: origin + 499 * 60_000 });
  });
  await expect.poll(() => page.evaluate(() =>
    (window.__workspaceRequests ?? []).filter(
      (request) => request.hasCursor === true && request.status === "resolved"
    ).length
  )).toBeGreaterThan(0);

  await expect.poll(() => page.evaluate(() =>
    window.__chart!.getPaneById("main")?.priceScale
  )).toEqual({
    mode: "linear",
    autoScale: false,
    inverted: false,
    visibleRange: { from: 50, to: 150 }
  });
});

test("rejects overflowing percentage pane state atomically", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const result = await page.evaluate(async () => {
    const chart = window.__chart!;
    const origin = Date.UTC(2026, 5, 5, 1, 30);
    const target = origin + 118 * 60_000;
    const applied = new Promise<void>((resolve) => {
      const stop = chart.subscribeEvents((event) => {
        if (event.type !== "visible-range" || event.range.to !== target) return;
        stop();
        resolve();
      });
    });
    chart.setVisibleRange({ from: target, to: target });
    await applied;
    chart.setPriceScaleMode("percentage");
    const before = chart.exportLayout();
    const errors: string[] = [];
    try {
      chart.getPaneApi("main")!.getPriceScale().setVisibleRange({
        from: 0,
        to: Number.MAX_VALUE
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    const afterDirect = chart.exportLayout();
    try {
      chart.importLayout({
        ...before,
        seriesType: "bars",
        panes: before.panes.map((pane) => pane.id === "main"
          ? {
              ...pane,
              priceScale: {
                autoScale: false,
                inverted: false,
                visibleRange: { from: 0, to: Number.MAX_VALUE }
              }
            }
          : pane)
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    return {
      errors,
      directAtomic: JSON.stringify(before) === JSON.stringify(afterDirect),
      importAtomic: JSON.stringify(before) === JSON.stringify(chart.exportLayout())
    };
  });

  expect(result.errors).toEqual([
    expect.stringContaining("price range"),
    expect.stringContaining("price range")
  ]);
  expect(result.directAtomic).toBe(true);
  expect(result.importAtomic).toBe(true);
});
