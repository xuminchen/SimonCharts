import { expect, test } from "@playwright/test";

test("controls historical replay without revealing the full future series", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.evaluate(() => {
    const target = window as typeof window & { __replayEvents?: string[] };
    target.__replayEvents = [];
    window.__chart?.subscribeEvents((event) => {
      if (event.type === "replay-changed") target.__replayEvents!.push(event.replay.status);
    });
  });
  expect(await page.evaluate(() => {
    try {
      window.__chart?.setReplaySpeed(3 as never);
      return "accepted";
    } catch (error) {
      return error instanceof RangeError ? "RangeError" : "unexpected";
    }
  })).toBe("RangeError");

  await page.getByTestId("chart-replay-toggle").click();
  await expect(page.getByTestId("replay-controls")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__chart?.getReplayState()))
    .toMatchObject({ status: "paused", speed: 1 });
  const initialTime = await page.evaluate(
    () => window.__chart?.getReplayState().cursorTime ?? 0
  );
  expect(await page.evaluate(() => {
    const chart = window.__chart;
    const cursor = chart?.getReplayState().cursorTime ?? 0;
    return (chart?.getVisibleRange()?.to ?? Number.POSITIVE_INFINITY) <= cursor;
  })).toBe(true);

  await page.getByTestId("replay-step-forward").click();
  await expect.poll(() =>
    page.evaluate(() => window.__chart?.getReplayState().cursorTime ?? 0)
  ).toBeGreaterThan(initialTime);

  await page.getByTestId("replay-speed").selectOption("8");
  await page.getByTestId("replay-play-toggle").click();
  await expect.poll(() => page.evaluate(() => window.__chart?.getReplayState().status))
    .toBe("playing");
  await page.getByTestId("replay-play-toggle").click();
  await expect.poll(() => page.evaluate(() => window.__chart?.getReplayState().status))
    .toBe("paused");

  await page.getByTestId("replay-exit").click();
  await expect(page.getByTestId("replay-controls")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__chart?.getReplayState()))
    .toEqual({ status: "inactive", speed: 8 });
  expect(await page.evaluate(
    () => (window as typeof window & { __replayEvents?: string[] }).__replayEvents
  )).toEqual(expect.arrayContaining(["paused", "playing", "inactive"]));
  expect(errors).toEqual([]);
});

test("recovers the exact next replay candle after its page was evicted", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/?million=1&latency=100");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  const origin = Date.UTC(2026, 5, 5, 1, 30);
  const timeAt = (position: number) => origin + position * 60_000;

  expect(await page.evaluate(async ({ from, to }) => {
    window.__chart!.setVisibleRange({ from, to });
    return window.__chart!.dataReady();
  }, { from: timeAt(934_500), to: timeAt(934_999) })).toBe(true);
  expect(await page.evaluate(async ({ from, to }) => {
    window.__chart!.setVisibleRange({ from, to });
    return window.__chart!.dataReady();
  }, { from: timeAt(998_000), to: timeAt(998_499) })).toBe(true);
  await page.evaluate(() => {
    const target = window as typeof window & { __replayHistoryLoads?: number };
    target.__replayHistoryLoads = 0;
    window.__chart!.subscribeEvents((event) => {
      if (event.type === "data-loaded" && event.phase === "history") {
        target.__replayHistoryLoads! += 1;
      }
    });
  });

  const reloadsBefore = await page.evaluate(() =>
    (window.__workspaceRequests ?? []).filter(
      (request) => request.cursor === "page:998500" && request.status === "resolved"
    ).length
  );
  const requested = await page.evaluate((cursorTime) => {
    const chart = window.__chart!;
    return {
      started: chart.startReplay(cursorTime),
      stepped: chart.stepReplay(),
      immediate: chart.getReplayState(),
      visibleRange: chart.getVisibleRange()
    };
  }, timeAt(998_499));
  expect(requested).toMatchObject({
    started: true,
    stepped: true,
    immediate: { status: "paused", cursorTime: timeAt(998_499) }
  });
  expect(requested.visibleRange?.to).toBeLessThanOrEqual(timeAt(998_499));

  expect(await page.evaluate(async (cursorTime) => {
    const chart = window.__chart!;
    const started = chart.startReplay(cursorTime);
    const ready = await Promise.race([
      chart.dataReady(),
      new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 2_000))
    ]);
    return { started, ready, replay: chart.getReplayState() };
  }, timeAt(998_498))).toEqual({
    started: true,
    ready: true,
    replay: { status: "paused", speed: 1, cursorTime: timeAt(998_498) }
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__chart!.getReplayState().cursorTime))
    .toBe(timeAt(998_498));

  expect(await page.evaluate(() => window.__chart!.stepReplay(2))).toBe(true);
  await expect.poll(() =>
    page.evaluate(() => window.__chart!.getReplayState().cursorTime)
  ).toBe(timeAt(998_500));
  expect(await page.evaluate(() => window.__chart!.getVisibleRange()?.to))
    .toBeLessThanOrEqual(timeAt(998_500));
  expect(await page.evaluate(() =>
    (window.__workspaceRequests ?? []).filter(
      (request) => request.cursor === "page:998500" && request.status === "resolved"
    ).length
  )).toBe(reloadsBefore + 1);
  expect(await page.evaluate(() =>
    (window as typeof window & { __replayHistoryLoads?: number }).__replayHistoryLoads
  )).toBe(1);
  expect(errors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => window.__hostCounters.errors)).toBe(0);
});
