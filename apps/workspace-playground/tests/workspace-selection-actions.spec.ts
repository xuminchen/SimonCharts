import { expect, test, type Page } from "@playwright/test";

async function findCanvasColor(
  page: Page,
  color: readonly [number, number, number],
  xRatio = 0.35
): Promise<{ x: number; y: number }> {
  const canvas = page.locator("canvas.sc-static-canvas");
  const matches = () => canvas.evaluate((element, { color, xRatio }) => {
    const target = element as HTMLCanvasElement;
    const context = target.getContext("2d");
    if (!context) return [];
    const x = Math.floor(target.width * xRatio);
    const pixels = context.getImageData(x, 0, 1, target.height).data;
    const rows: number[] = [];
    for (let y = 0; y < target.height; y += 1) {
      const offset = y * 4;
      if (
        Math.abs(pixels[offset]! - color[0]) <= 15 &&
        Math.abs(pixels[offset + 1]! - color[1]) <= 15 &&
        Math.abs(pixels[offset + 2]! - color[2]) <= 15
      ) rows.push(y);
    }
    return rows;
  }, { color, xRatio });
  await expect.poll(async () => (await matches()).length).toBeGreaterThan(0);
  const rows = await matches();
  const rect = await canvas.boundingBox();
  if (!rect) throw new Error("chart canvas missing");
  return {
    x: rect.x + rect.width * xRatio,
    y: rect.y + rows[Math.floor(rows.length / 2)]! /
      await canvas.evaluate((element) =>
        (element as HTMLCanvasElement).height / element.getBoundingClientRect().height
      )
  };
}

test("keeps selection typed, atomic, transient, and stable across rematerialization", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const chart = window.__chart!;
    const visible = chart.getVisibleRange();
    if (!visible) throw new Error("visible range missing");
    const events: string[][] = [];
    const stop = chart.subscribeEvents((event) => {
      if (event.type === "selection-changed") events.push([...event.selection]);
    });
    chart.setDrawings([
      {
        id: "select-a",
        type: "horizontalLine",
        anchors: [{ time: visible.from, price: 98 }]
      },
      {
        id: "select-b",
        type: "horizontalLine",
        anchors: [{ time: visible.to, price: 102 }]
      },
      {
        id: "passive",
        type: "horizontalLine",
        anchors: [{ time: visible.from, price: 104 }],
        interactive: false
      }
    ]);
    const drawings = chart.getEntities("drawing");
    const drawingId = (id: string) => drawings.find(
      (entity) => entity.kind === "drawing" && entity.value.id === id
    )!.id as `drawing:${string}`;
    const first = drawingId("select-a");
    const second = drawingId("select-b");
    const passive = drawingId("passive");
    const study = chart.createStudy({
      instanceId: "selection-ma",
      id: "MA",
      params: { period: 5 },
      visible: true
    });
    const mark = chart.createEntity({
      kind: "mark",
      value: { id: "selection-mark", time: visible.from, price: 100 }
    });

    chart.setSelection([first, second]);
    const drawingSelection = chart.getSelection();
    chart.setTimeframe("5m");
    const ready = await chart.dataReady();
    const afterRematerialization = chart.getSelection();
    const firstEntity = chart.getEntity(first);
    if (!firstEntity || firstEntity.kind !== "drawing") throw new Error("drawing missing");
    chart.updateEntity({
      ...firstEntity,
      value: {
        ...firstEntity.value,
        style: { ...firstEntity.value.style, color: "#ff00ff" }
      }
    });
    const afterUpdate = chart.getSelection();
    chart.removeEntity(first);
    const afterPartialRemoval = chart.getSelection();
    const secondEntity = chart.getEntity(second);
    if (!secondEntity || secondEntity.kind !== "drawing") throw new Error("drawing missing");
    chart.updateEntity({
      ...secondEntity,
      value: { ...secondEntity.value, interactive: false }
    });
    const afterPassiveUpdate = chart.getSelection();
    const passiveSecond = chart.getEntity(second);
    if (!passiveSecond || passiveSecond.kind !== "drawing") throw new Error("drawing missing");
    chart.updateEntity({
      ...passiveSecond,
      value: { ...passiveSecond.value, interactive: true }
    });
    chart.setSelection([study]);
    const studySelection = chart.getSelection();
    chart.setSelection([second]);
    const beforeRejected = chart.getSelection();
    const eventsBeforeRejected = events.length;
    const rejected: string[] = [];
    for (const candidate of [
      [second, study],
      [mark as `drawing:${string}`],
      ["drawing:missing" as `drawing:${string}`],
      [passive]
    ]) {
      try {
        chart.setSelection(candidate);
        rejected.push("none");
      } catch (error) {
        rejected.push(error instanceof DOMException ? error.name : error instanceof TypeError ? "TypeError" : "other");
      }
    }
    const afterRejected = chart.getSelection();
    const eventsAfterRejected = events.length;
    const layout = chart.exportLayout() as unknown as Record<string, unknown>;
    chart.removeEntity(second);
    const afterRemoval = chart.getSelection();
    chart.clearSelection();
    stop();
    return {
      first,
      second,
      study,
      drawingSelection,
      ready,
      afterRematerialization,
      afterUpdate,
      afterPartialRemoval,
      afterPassiveUpdate,
      studySelection,
      beforeRejected,
      eventsBeforeRejected,
      rejected,
      afterRejected,
      eventsAfterRejected,
      layoutHasSelection: Object.hasOwn(layout, "selection"),
      afterRemoval,
      events
    };
  });

  expect(result.drawingSelection).toEqual([result.first, result.second]);
  expect(result.ready).toBe(true);
  expect(result.afterRematerialization).toEqual([result.first, result.second]);
  expect(result.afterUpdate).toEqual([result.first, result.second]);
  expect(result.afterPartialRemoval).toEqual([result.second]);
  expect(result.afterPassiveUpdate).toEqual([]);
  expect(result.studySelection).toEqual([result.study]);
  expect(result.beforeRejected).toEqual([result.second]);
  expect(result.rejected).toEqual(["TypeError", "TypeError", "NotFoundError", "TypeError"]);
  expect(result.afterRejected).toEqual([result.second]);
  expect(result.eventsAfterRejected).toBe(result.eventsBeforeRejected);
  expect(result.layoutHasSelection).toBe(false);
  expect(result.afterRemoval).toEqual([]);
  expect(result.events.at(-1)).toEqual([]);
});

test("emits one drawing action for a true Canvas click and none for a drag", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const drawingId = await page.evaluate(() => {
    const chart = window.__chart!;
    const visible = chart.getVisibleRange();
    if (!visible) throw new Error("visible range missing");
    chart.setDrawings([{
      id: "action-line",
      type: "trendLine",
      anchors: [
        { time: visible.from, price: 100 },
        { time: visible.to, price: 100 }
      ],
      style: { color: "#ff00ff", lineWidth: 3 }
    }]);
    const id = chart.getEntities("drawing")[0]!.id;
    (window as typeof window & { __actionEvents?: string[] }).__actionEvents = [];
    chart.subscribeEvents((event) => {
      if (event.type === "selection-changed") {
        (window as typeof window & { __actionEvents: string[] }).__actionEvents.push(
          `selection:${event.selection.join(",")}`
        );
      } else if (event.type === "drawing-clicked") {
        (window as typeof window & { __actionEvents: string[] }).__actionEvents.push(
          `drawing:${event.entity.id}`
        );
      }
    });
    return id;
  });
  const point = await findCanvasColor(page, [255, 0, 255]);

  await page.mouse.click(point.x, point.y);
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { __actionEvents?: string[] }).__actionEvents ?? []
  )).toEqual([`selection:${drawingId}`, `drawing:${drawingId}`]);
  const before = await page.evaluate(() => window.__chart!.getDrawings());
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 60, point.y + 20);
  await page.mouse.up();
  const after = await page.evaluate(() => ({
    drawings: window.__chart!.getDrawings(),
    events: (window as typeof window & { __actionEvents?: string[] }).__actionEvents ?? []
  }));

  expect(after.drawings).not.toEqual(before);
  expect(after.events.filter((event) => event.startsWith("drawing:"))).toEqual([
    `drawing:${drawingId}`
  ]);

  await page.evaluate(() => {
    window.__chart!.clearSelection();
    (window as typeof window & { __reentrantDrawingEvents?: string[] })
      .__reentrantDrawingEvents = [];
    window.__chart!.subscribeEvents((event) => {
      const events = (window as typeof window & { __reentrantDrawingEvents: string[] })
        .__reentrantDrawingEvents;
      if (event.type === "selection-changed" && event.selection.length === 1) {
        events.push(`selection:${event.selection[0]}`);
        window.__chart!.clearSelection();
      } else if (event.type === "drawing-clicked") {
        events.push(`drawing:${event.entity.id}`);
      }
    });
  });
  const movedPoint = await findCanvasColor(page, [255, 0, 255]);
  await page.mouse.click(movedPoint.x, movedPoint.y);
  const reentrant = await page.evaluate(() => ({
    selection: window.__chart!.getSelection(),
    events: (window as typeof window & { __reentrantDrawingEvents?: string[] })
      .__reentrantDrawingEvents ?? []
  }));
  expect(reentrant.events.some((event) => event.startsWith("selection:"))).toBe(true);
  expect(reentrant.events.some((event) => event.startsWith("drawing:"))).toBe(false);
  expect(reentrant.selection).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("selects a native rendered study on click, ignores drag, and clears on blank click", async ({ page }) => {
  await page.goto("/?customStudies=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.evaluate(() => {
    (window as typeof window & { __actionEvents?: string[] }).__actionEvents = [];
    window.__chart!.subscribeEvents((event) => {
      if (event.type === "selection-changed") {
        (window as typeof window & { __actionEvents: string[] }).__actionEvents.push(
          `selection:${event.selection.join(",")}`
        );
      } else if (event.type === "study-clicked") {
        (window as typeof window & { __actionEvents: string[] }).__actionEvents.push(
          `study:${event.entity.id}`
        );
      }
    });
    const visible = window.__chart!.getVisibleRange();
    if (!visible) throw new Error("visible range missing");
    window.__chart!.setDrawings([{
      id: "preselected",
      type: "horizontalLine",
      anchors: [{ time: visible.from, price: 98 }]
    }]);
    const drawing = window.__chart!.getEntities("drawing")[0]!.id as `drawing:${string}`;
    window.__chart!.setSelection([drawing]);
    (window as typeof window & { __actionEvents: string[] }).__actionEvents.splice(0);
  });
  const point = await findCanvasColor(page, [124, 58, 237]);

  await page.mouse.click(point.x, point.y);
  const clicked = await page.evaluate(() => ({
    selection: window.__chart!.getSelection(),
    events: (window as typeof window & { __actionEvents?: string[] }).__actionEvents ?? []
  }));
  expect(clicked.selection).toHaveLength(1);
  expect(clicked.events).toEqual([
    `selection:${clicked.selection[0]}`,
    `study:${clicked.selection[0]}`
  ]);

  await page.mouse.move(point.x, point.y);
  const beforeDragRange = await page.evaluate(() => window.__chart!.getVisibleRange());
  await page.mouse.down();
  await page.mouse.move(point.x + 100, point.y);
  await page.mouse.up();
  const afterDrag = await page.evaluate(() => ({
    range: window.__chart!.getVisibleRange(),
    events: (window as typeof window & { __actionEvents?: string[] }).__actionEvents ?? []
  }));
  expect(afterDrag.range).not.toEqual(beforeDragRange);
  expect(afterDrag.events).toEqual(clicked.events);

  const overlay = page.locator("canvas.sc-overlay-canvas");
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay missing");
  await page.mouse.click(box.x + box.width * 0.85, box.y + 70);
  await expect.poll(() => page.evaluate(() => window.__chart!.getSelection())).toEqual([]);
});

test("drops a stale study action when a selection listener removes the Study", async ({ page }) => {
  await page.goto("/?customStudies=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.evaluate(() => {
    (window as typeof window & { __reentrantStudyEvents?: string[] }).__reentrantStudyEvents = [];
    window.__chart!.subscribeEvents((event) => {
      const events = (window as typeof window & { __reentrantStudyEvents: string[] })
        .__reentrantStudyEvents;
      if (event.type === "selection-changed" && event.selection.length === 1) {
        events.push(`selection:${event.selection[0]}`);
        window.__chart!.removeEntity(event.selection[0]!);
      } else if (event.type === "entity-removed") {
        events.push(`removed:${event.entity.id}`);
      } else if (event.type === "study-clicked") {
        events.push(`study:${event.entity.id}`);
      }
    });
  });
  const point = await findCanvasColor(page, [124, 58, 237]);
  await page.mouse.click(point.x, point.y);
  const events = await page.evaluate(() =>
    (window as typeof window & { __reentrantStudyEvents?: string[] }).__reentrantStudyEvents ?? []
  );
  expect(events.some((event) => event.startsWith("selection:"))).toBe(true);
  expect(events.some((event) => event.startsWith("removed:"))).toBe(true);
  expect(events.some((event) => event.startsWith("study:"))).toBe(false);
  expect(await page.evaluate(() => window.__chart!.getSelection())).toEqual([]);
});
