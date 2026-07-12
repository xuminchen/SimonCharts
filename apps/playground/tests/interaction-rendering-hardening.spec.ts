import { expect, test } from "@playwright/test";

test("pointer movement updates overlay diagnostics without static redraw spam", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("chart-overlay")).toBeVisible();
  await expect
    .poll(() =>
      page.getByTestId("chart-canvas").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;

        return canvas.width > 0 && canvas.height > 0;
      })
    )
    .toBe(true);

  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  const staticBefore = Number(await page.getByTestId("static-render-count").textContent());

  for (let index = 0; index < 8; index += 1) {
    await page.mouse.move(box.x + 100 + index * 3, box.y + 180);
  }

  await expect(page.getByTestId("cursor-state")).toHaveText("crosshair");
  await expect(page.getByTestId("last-invalidation-reason")).toHaveText(
    /pointerMoved|crosshairChanged/
  );
  const staticAfter = Number(await page.getByTestId("static-render-count").textContent());
  const overlayAfter = Number(await page.getByTestId("overlay-render-count").textContent());

  expect(staticAfter - staticBefore).toBeLessThanOrEqual(1);
  expect(overlayAfter).toBeGreaterThan(0);
});

test("keyboard zoom commands update the viewport and clear stale crosshair state", async ({ page }) => {
  await page.goto("/");
  const canvas = page.getByTestId("chart-canvas");
  const candleWidth = page.getByTestId("viewport-candle-width");
  const initialWidth = Number(await candleWidth.textContent());
  const initialPixels = await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await expect(page.getByTestId("cursor-state")).toHaveText("crosshair");
  await page.evaluate(() => {
    (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ = [];
  });

  await page.keyboard.press("+");
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("zoomIn");
  await expect.poll(async () => Number(await candleWidth.textContent())).toBeGreaterThan(initialWidth);
  await expect
    .poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL()))
    .not.toBe(initialPixels);
  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as unknown as { __SIMON_CHART_EVENTS__?: Array<Record<string, unknown>> })
          .__SIMON_CHART_EVENTS__ ?? []).some(
          (event) => event.type === "crosshairMoved" && event.crosshair === undefined
        )
      )
    )
    .toBe(true);

  const zoomedInWidth = Number(await candleWidth.textContent());
  await page.keyboard.press("-");
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("zoomOut");
  await expect.poll(async () => Number(await candleWidth.textContent())).toBeLessThan(zoomedInWidth);

  await page.keyboard.press("+");
  await page.keyboard.press("0");
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("resetZoom");
  await expect.poll(async () => Number(await candleWidth.textContent())).toBe(initialWidth);
});

test("pointer leave clears cursor and keyboard diagnostics", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.keyboard.press("-");
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("zoomOut");
  await page.mouse.move(box.x + 180, box.y + 220);
  await expect(page.getByTestId("cursor-state")).toHaveText("crosshair");

  await page.evaluate(() => {
    (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ = [];
  });
  await overlay.evaluate((element) => {
    element.dispatchEvent(new PointerEvent("pointerleave", { pointerId: 1 }));
  });

  await expect(page.getByTestId("cursor-state")).toHaveText("default");
  await expect(page.getByTestId("magnet-state")).toHaveText("off");
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("none");

  const cleanupEvents = await page.evaluate(() => {
    const events =
      (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ ?? [];

    return {
      cursorDefault: events.some(
        (event) => (event as { type?: string; cursor?: string }).type === "cursorChanged" &&
          (event as { cursor?: string }).cursor === "default"
      ),
      crosshairHidden: events.some(
        (event) =>
          (event as { type?: string; crosshair?: { visible?: boolean } }).type ===
            "crosshairChanged" &&
          (event as { crosshair?: { visible?: boolean } }).crosshair?.visible === false
      )
    };
  });

  expect(cleanupEvents).toEqual({ cursorDefault: true, crosshairHidden: true });
});

test("top controls do not overlap reset at medium widths", async ({ page }) => {
  for (const width of [800, 1024]) {
    await page.setViewportSize({ width, height: 600 });
    await page.goto("/");

    const controlsBox = await page.locator(".top-controls").boundingBox();
    const resetBox = await page.getByTestId("reset-view").boundingBox();

    expect(controlsBox).not.toBeNull();
    expect(resetBox).not.toBeNull();
    expect((controlsBox?.x ?? 0) + (controlsBox?.width ?? 0)).toBeLessThanOrEqual(
      resetBox?.x ?? 0
    );
  }
});

test("keyboard shortcuts ignore modifiers and prevent chart-owned defaults", async ({ page }) => {
  await page.goto("/");

  const modifierPrevented = await page.evaluate(() =>
    [
      new KeyboardEvent("keydown", { key: "-", altKey: true, bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "-", ctrlKey: true, bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "-", metaKey: true, bubbles: true, cancelable: true })
    ].map((event) => !window.dispatchEvent(event))
  );

  expect(modifierPrevented).toEqual([false, false, false]);
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("none");

  const plainPrevented = await page.evaluate(() => {
    const event = new KeyboardEvent("keydown", {
      key: "-",
      bubbles: true,
      cancelable: true
    });

    return !window.dispatchEvent(event);
  });

  expect(plainPrevented).toBe(true);
  await expect(page.getByTestId("last-keyboard-command")).toHaveText("zoomOut");
});

test("selecting an existing drawing records drawing drag mode", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");

  await page.getByTestId("drawing-tool-select").click();
  await page.mouse.move(box.x + 180, box.y + 210);
  await page.mouse.down();
  await expect(page.getByTestId("cursor-state")).toHaveText("drawing");
  await page.mouse.up();
});

test("lost pointer capture cancels active chart drag", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  const point = { x: box.x + 180, y: box.y + 220 };

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.evaluate(() => {
    (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ = [];
  });
  await overlay.evaluate((element, input) => {
    element.dispatchEvent(
      new PointerEvent("lostpointercapture", {
        bubbles: true,
        pointerId: 1,
        clientX: input.x,
        clientY: input.y
      })
    );
  }, point);
  await page.mouse.move(point.x + 120, point.y);
  await page.mouse.up();

  const viewportEvents = await page.evaluate(
    () => {
      const events =
        (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ ?? [];

      return events.filter(
        (event) => (event as { type?: string } | null)?.type === "viewportChanged"
      ).length;
    }
  );

  expect(viewportEvents).toBe(0);
});

test("wheel zoom invalidates chart layers and records render reason", async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.getByTestId("chart-canvas").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;

        return canvas.width > 0 && canvas.height > 0;
      })
    )
    .toBe(true);
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  const staticBefore = Number(await page.getByTestId("static-render-count").textContent());

  await page.mouse.move(box.x + 180, box.y + 220);
  await page.mouse.wheel(0, -180);

  await expect
    .poll(async () => Number(await page.getByTestId("static-render-count").textContent()))
    .toBe(staticBefore + 1);
  await expect(page.getByTestId("last-invalidation-reason")).toHaveText("viewportChanged");
});

test("step drawing hover previews before the final anchor commits", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const canvas = page.getByTestId("chart-canvas");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 140, box.y + 180);
  await expect(page.getByTestId("drawing-count")).toHaveText("0 drawings");
  const firstAnchorPixels = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).toDataURL()
  );

  await page.mouse.move(box.x + 260, box.y + 240);

  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as unknown as {
          __SIMON_CHART_EVENTS__?: Array<{
            type?: string;
            drawing?: { anchors?: unknown[] };
          }>;
        }).__SIMON_CHART_EVENTS__ ?? []).some(
          (event) =>
            event.type === "drawingPreviewChanged" && event.drawing?.anchors?.length === 2
        )
      )
    )
    .toBe(true);
  await expect
    .poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL()))
    .not.toBe(firstAnchorPixels);
  await expect(page.getByTestId("drawing-count")).toHaveText("0 drawings");

  await page.mouse.click(box.x + 260, box.y + 240);
  await expect(page.getByTestId("drawing-count")).toHaveText("1 drawing");
});

test("lost capture, blur, and tool cancellation clear active creation", async ({ page }) => {
  const cancelActiveBrush = async (source: "lostCapture" | "blur") => {
    await page.goto("/");
    const overlay = page.getByTestId("chart-overlay");
    const box = await overlay.boundingBox();

    if (!box) {
      throw new Error("overlay missing");
    }

    await page.getByTestId("drawing-tool-brush").click();
    await page.mouse.move(box.x + 140, box.y + 180);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 220);
    await page.evaluate(() => {
      (window as Window & { __SIMON_CHART_EVENTS__?: unknown[] }).__SIMON_CHART_EVENTS__ = [];
    });

    if (source === "lostCapture") {
      await overlay.evaluate((element, point) => {
        element.dispatchEvent(
          new PointerEvent("lostpointercapture", {
            bubbles: true,
            pointerId: 1,
            clientX: point.x,
            clientY: point.y
          })
        );
      }, { x: box.x + 200, y: box.y + 220 });
    } else {
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    }

    await page.mouse.up();
    await expect(page.getByTestId("drawing-count")).toHaveText("0 drawings");
    await expect(page.getByTestId("undo")).toBeDisabled();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const events =
            (window as unknown as { __SIMON_CHART_EVENTS__?: Array<Record<string, unknown>> })
              .__SIMON_CHART_EVENTS__ ?? [];

          return events.some((event) => event.type === "creationCanceled");
        })
      )
      .toBe(true);
  };

  await cancelActiveBrush("lostCapture");
  await cancelActiveBrush("blur");

  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 140, box.y + 180);
  await page.getByTestId("drawing-tool-select").click();
  await expect(page.getByTestId("drawing-count")).toHaveText("0 drawings");
  await expect(page.getByTestId("undo")).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as unknown as { __SIMON_CHART_EVENTS__?: Array<Record<string, unknown>> })
          .__SIMON_CHART_EVENTS__ ?? []).some((event) => event.type === "creationCanceled")
      )
    )
    .toBe(true);
});
