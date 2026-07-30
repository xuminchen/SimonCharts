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
