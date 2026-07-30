import { expect, test } from "@playwright/test";

test("programs the native time scale and keeps intraday fixed", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => window.__chart!.dataReady())).toBe(true);

  const initial = await page.evaluate(() => {
    const chart = window.__chart!;
    const first = chart.getTimeScale();
    const second = chart.getTimeScale();
    const range = first.getVisibleRange();
    if (range === undefined) throw new Error("visible range missing");
    const coordinate = first.timeToCoordinate(range.from);
    if (coordinate === undefined) throw new Error("visible time coordinate missing");
    return {
      stable: first === second,
      frozen: Object.isFrozen(first),
      range,
      spacing: first.getBarSpacing(),
      width: first.getWidth(),
      coordinate,
      roundTrip: first.coordinateToTime(coordinate)
    };
  });
  expect(initial.stable).toBe(true);
  expect(initial.frozen).toBe(true);
  expect(initial.width).toBeGreaterThan(0);
  expect(initial.spacing).toBeGreaterThan(0);
  expect(initial.coordinate).toBeGreaterThanOrEqual(0);
  expect(initial.coordinate).toBeLessThanOrEqual(initial.width);
  expect(initial.roundTrip).toBe(initial.range.from);

  const direct = await page.evaluate(() => {
    const scale = window.__chart!.getTimeScale();
    const beforeSpacing = scale.getBarSpacing();
    scale.setBarSpacing(beforeSpacing * 1.5);
    const setSpacing = scale.getBarSpacing();
    scale.zoomIn();
    const zoomedInSpacing = scale.getBarSpacing();
    scale.zoomOut();
    const zoomedOutSpacing = scale.getBarSpacing();
    const beforeScroll = scale.getVisibleRange();
    scale.scrollByBars(5);
    const afterScroll = scale.getVisibleRange();
    scale.scrollByBars(-5);
    const restoredScroll = scale.getVisibleRange();
    scale.setBarSpacing(20);
    const beforeFit = scale.getVisibleRange();
    scale.fitContent();
    return {
      beforeSpacing,
      setSpacing,
      zoomedInSpacing,
      zoomedOutSpacing,
      beforeScroll,
      afterScroll,
      restoredScroll,
      beforeFit,
      fitted: scale.getVisibleRange()
    };
  });
  expect(direct.setSpacing).toBeGreaterThan(direct.beforeSpacing);
  expect(direct.zoomedInSpacing).toBeGreaterThan(direct.setSpacing);
  expect(direct.zoomedOutSpacing).toBeLessThan(direct.zoomedInSpacing);
  expect(direct.afterScroll!.to).toBeLessThan(direct.beforeScroll!.to);
  expect(direct.restoredScroll).toEqual(direct.beforeScroll);
  expect(direct.fitted!.from).toBeLessThan(direct.beforeFit!.from);
  expect(direct.fitted!.to).toBe(initial.range.to);

  await page.evaluate(() => {
    const scale = window.__chart!.getTimeScale();
    scale.setBarSpacing(20);
    scale.reset();
  });
  await expect.poll(() => page.evaluate(() => {
    const scale = window.__chart!.getTimeScale();
    return { range: scale.getVisibleRange(), spacing: scale.getBarSpacing() };
  })).toEqual({ range: initial.range, spacing: initial.spacing });

  const actionZoom = await page.evaluate(() => {
    const chart = window.__chart!;
    const scale = chart.getTimeScale();
    const before = scale.getBarSpacing();
    chart.executeActionById("zoomIn");
    const zoomedIn = scale.getBarSpacing();
    chart.executeActionById("zoomOut");
    return { before, zoomedIn, zoomedOut: scale.getBarSpacing() };
  });
  expect(actionZoom.zoomedIn).toBeGreaterThan(actionZoom.before);
  expect(actionZoom.zoomedOut).toBeLessThan(actionZoom.zoomedIn);

  await page.evaluate(() => window.__chart!.executeActionById("fitContent"));
  expect((await page.evaluate(() =>
    window.__chart!.getTimeScale().getVisibleRange()
  ))!.from).toBeLessThan(initial.range.from);

  for (const actionId of ["timeScaleReset", "chartReset"] as const) {
    await page.evaluate((id) => {
      const chart = window.__chart!;
      chart.getTimeScale().setBarSpacing(20);
      chart.executeActionById(id);
    }, actionId);
    await expect.poll(() => page.evaluate(() => {
      const scale = window.__chart!.getTimeScale();
      return { range: scale.getVisibleRange(), spacing: scale.getBarSpacing() };
    })).toEqual({ range: initial.range, spacing: initial.spacing });
  }

  const manualPriceRange = { from: 8, to: 12 };
  await page.evaluate((range) => {
    window.__chart!.getPaneApi("main")!.getPriceScale().setVisibleRange(range);
    window.__chart!.getTimeScale().reset();
  }, manualPriceRange);
  await expect.poll(() => page.evaluate(() =>
    window.__chart!.getPaneApi("main")!.getPriceScale().getState()
  )).toEqual({
    mode: "linear",
    autoScale: false,
    inverted: false,
    visibleRange: manualPriceRange
  });

  await page.evaluate(() => window.__chart!.resetToLatest());
  await expect.poll(() => page.evaluate(() =>
    window.__chart!.getPaneApi("main")!.getPriceScale().getState()
  )).toEqual({
    mode: "linear",
    autoScale: true,
    inverted: false
  });

  await page.evaluate((range) => {
    const chart = window.__chart!;
    chart.getPaneApi("main")!.getPriceScale().setVisibleRange(range);
    chart.executeActionById("chartReset");
  }, manualPriceRange);
  await expect.poll(() => page.evaluate(() =>
    window.__chart!.getPaneApi("main")!.getPriceScale().getState()
  )).toEqual({
    mode: "linear",
    autoScale: true,
    inverted: false
  });

  expect(await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.setView("intraday");
    return chart.dataReady();
  })).toBe(true);
  const intraday = await page.evaluate(async () => {
    const chart = window.__chart!;
    const scale = chart.getTimeScale();
    const before = {
      range: scale.getVisibleRange(),
      spacing: scale.getBarSpacing()
    };
    const snapshots: Array<typeof before> = [];
    const capture = () => snapshots.push({
      range: scale.getVisibleRange(),
      spacing: scale.getBarSpacing()
    });
    if (before.range === undefined) throw new Error("intraday visible range missing");
    const errorsBeforeRange = window.__hostCounters.errors;
    scale.setVisibleRange(before.range);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    const rangeReady = await chart.dataReady();
    capture();
    scale.setBarSpacing(before.spacing * 2);
    capture();
    scale.scrollByBars(5);
    capture();
    scale.zoomIn();
    capture();
    scale.zoomOut();
    capture();
    scale.fitContent();
    capture();
    scale.reset();
    capture();
    for (const actionId of [
      "zoomIn",
      "zoomOut",
      "fitContent",
      "timeScaleReset",
      "chartReset"
    ] as const) {
      chart.executeActionById(actionId);
      capture();
    }
    await chart.dataReady();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    return {
      before,
      rangeReady,
      rangeErrors: window.__hostCounters.errors - errorsBeforeRange,
      snapshots,
      after: {
        range: scale.getVisibleRange(),
        spacing: scale.getBarSpacing()
      }
    };
  });
  expect(intraday.rangeReady).toBe(true);
  expect(intraday.rangeErrors).toBe(0);
  expect(intraday.snapshots.every((snapshot) =>
    JSON.stringify(snapshot) === JSON.stringify(intraday.before)
  )).toBe(true);
  expect(intraday.after).toEqual(intraday.before);
  expect(errors).toEqual([]);
});
