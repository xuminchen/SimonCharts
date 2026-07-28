import { expect, test } from "@playwright/test";

test("runs chart-scoped custom studies through the native Study, Entity, Layout and UI chain", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?customStudies=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => window.__chart!.dataReady())).toBe(true);

  const snapshot = await page.evaluate(() => {
    const chart = window.__chart!;
    return {
      studies: chart.getAllStudies(),
      layout: chart.exportLayout(),
      entities: chart.getEntities("indicator"),
      stored: Object.values(localStorage).join("\n")
    };
  });
  expect(snapshot.studies).toEqual([
    {
      instanceId: "fixture-average",
      id: "custom:fixture.average",
      definitionVersion: "1",
      params: { factor: 1 },
      visible: true
    },
    {
      instanceId: "fixture-range",
      id: "custom:fixture.range",
      definitionVersion: "1",
      params: {},
      visible: true
    }
  ]);
  expect(snapshot.layout.indicators).toEqual(snapshot.studies);
  expect(snapshot.entities.map((entity) => entity.value)).toEqual(snapshot.studies);
  expect(snapshot.stored).not.toContain("custom:fixture");
  await expect(page.getByTestId("indicator-legend-fixture-average"))
    .toContainText("Fixture Average");
  await expect(page.getByTestId("indicator-legend-fixture-range"))
    .toContainText("Fixture Range");
  await expect(page.getByRole("button", { name: "Edit custom:fixture.average" }))
    .toHaveCount(0);
  const pixels = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas.sc-static-canvas")!;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let purple = 0;
    let orange = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] === 124 && data[index + 1] === 58 && data[index + 2] === 237) purple += 1;
      if (
        data[index] > 180 &&
        data[index + 1] >= 60 &&
        data[index + 1] <= 130 &&
        data[index + 2] < 60
      ) orange += 1;
    }
    return { purple, orange };
  });
  expect(pixels.purple).toBeGreaterThan(0);
  expect(pixels.orange).toBeGreaterThan(0);

  const before = await page.evaluate(() => {
    const chart = window.__chart!;
    const layout = chart.exportLayout();
    expectThrows(() => chart.importLayout({
      ...layout,
      indicators: layout.indicators.map((study) => (
        study.id === "custom:fixture.average"
          ? { ...study, definitionVersion: "missing" }
          : study
      ))
    }));
    return chart.exportLayout();

    function expectThrows(run: () => void) {
      try {
        run();
      } catch {
        return;
      }
      throw new Error("version mismatch was accepted");
    }
  });
  expect(before).toEqual(snapshot.layout);
  const roundtrip = await page.evaluate(async () => {
    const chart = window.__chart!;
    const averageId = window.__customStudyIds![0] as import("@simoncharts/charts").ChartEntityId;
    const rangeId = window.__customStudyIds![1] as import("@simoncharts/charts").ChartEntityId;
    const average = chart.getEntity(averageId)!;
    if (average.kind !== "indicator") throw new Error("custom study entity missing");
    chart.updateEntity({
      ...average,
      value: { ...average.value, params: { factor: 2 } }
    });
    await chart.dataReady();
    const updated = chart.exportLayout();
    try {
      const current = chart.getEntity(averageId)!;
      if (current.kind !== "indicator") throw new Error("custom study entity missing");
      chart.updateEntity({
        ...current,
        value: {
          ...current.value,
          definitionVersion: "missing"
        }
      });
      throw new Error("entity version mutation was accepted");
    } catch (error) {
      if (error instanceof Error && error.message === "entity version mutation was accepted") throw error;
    }
    const afterRejectedUpdate = chart.exportLayout();
    chart.removeEntity(rangeId);
    const countAfterRemove = chart.getAllStudies().length;
    chart.importLayout(updated);
    await chart.dataReady();
    return {
      updated,
      afterRejectedUpdate,
      countAfterRemove,
      restored: chart.getAllStudies()
    };
  });
  expect(roundtrip.updated.indicators[0]).toMatchObject({
    definitionVersion: "1",
    params: { factor: 2 }
  });
  expect(roundtrip.afterRejectedUpdate).toEqual(roundtrip.updated);
  expect(roundtrip.countAfterRemove).toBe(1);
  expect(roundtrip.restored).toEqual(roundtrip.updated.indicators);
  expect(errors).toEqual([]);
});

test("publishes custom outputs through crosshair and recalculates only for data or inputs", async ({ page }) => {
  await page.goto("/?customStudies=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => window.__chart!.dataReady())).toBe(true);
  await page.evaluate(() => {
    const events: unknown[] = [];
    window.__chart!.subscribeCrosshair((event) => events.push(structuredClone(event)));
    (window as typeof window & { __customCrosshairEvents?: unknown[] }).__customCrosshairEvents = events;
  });
  const callsBeforeCrosshair = await page.evaluate(() => window.__customStudyCalls);
  const canvas = page.locator("canvas.sc-overlay-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await expect.poll(() => page.evaluate(() => {
    const events = (window as typeof window & {
      __customCrosshairEvents?: Array<{
        type?: string;
        crosshair?: { studies?: Array<{ indicatorId?: string; title?: string; outputs?: unknown[] }> };
      }>;
    }).__customCrosshairEvents;
    return events
      ?.filter((event) => event.type === "crosshair-moved")
      .at(-1)
      ?.crosshair
      ?.studies
      ?.filter((study) => study.indicatorId?.startsWith("custom:"))
      .map((study) => [study.indicatorId, study.title, study.outputs?.length]);
  })).toEqual([
    ["custom:fixture.average", "Fixture Average 1", 1],
    ["custom:fixture.range", "Fixture Range", 1]
  ]);
  expect(await page.evaluate(() => window.__customStudyCalls)).toBe(callsBeforeCrosshair);

  const readiness = await page.evaluate(async () => {
    const id = window.__customStudyIds![0] as import("@simoncharts/charts").ChartIndicatorEntityId;
    window.__chart!.getStudyApi(id)!.setInputs({ factor: 2 });
    const ready = window.__chart!.dataReady();
    const first = await Promise.race([
      ready.then(() => "ready"),
      new Promise<string>((resolve) => requestAnimationFrame(() => resolve("frame")))
    ]);
    return { first, ready: await ready };
  });
  expect(readiness).toEqual({ first: "frame", ready: true });
  expect(await page.evaluate(() =>
    window.__chart!.getStudyById(
      window.__customStudyIds![0] as import("@simoncharts/charts").ChartIndicatorEntityId
    )?.params
  )).toEqual({ factor: 2 });
});

test("fails closed and recovers the same custom study generation through retry", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/?customStudies=1&customStudyFailure=once");
  await expect(page.locator('.sc-workspace[data-state="blocked"]')).toBeVisible();
  expect(await page.evaluate(() => window.__chart!.dataReady())).toBe(false);
  const recovered = await page.evaluate(async () => {
    const chart = window.__chart!;
    chart.retry();
    return chart.dataReady();
  });
  expect(recovered).toBe(true);
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => window.__chart!.getAllStudies().length)).toBe(2);
  expect(pageErrors).toEqual([]);
});
