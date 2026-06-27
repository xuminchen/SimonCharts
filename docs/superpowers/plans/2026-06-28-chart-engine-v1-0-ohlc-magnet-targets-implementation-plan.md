# Chart Engine OHLC Magnet Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Engine-owned OHLC magnet target factory and wire the playground drawing snap flow to include candle OHLC points.

**Architecture:** Extend `drawingMagnet.ts` with a pure projection helper that uses existing viewport and price-range mapping functions. The helper returns neutral `MagnetSnapTarget[]`; playground remains responsible for pointer events and chooses when to collect OHLC targets alongside drawing-anchor targets.

**Tech Stack:** TypeScript, Vitest, Playwright, Vite package build, SimonCharts public API/type guards.

---

## File Structure

- Modify `packages/chart-engine/src/drawing/drawingMagnet.ts`
  - Adds `createOhlcMagnetTargetsFromSeries()` and related option/geometry types.
- Create `packages/chart-engine/src/__tests__/drawingMagnet.test.ts`
  - Focused unit coverage for OHLC target projection and snap integration.
- Modify `apps/playground/src/main.ts`
  - Includes OHLC magnet targets in drawing snap target collection.
- Modify `apps/playground/tests/drawing-editor.spec.ts`
  - Adds browser coverage for OHLC snapping.
- Modify `scripts/check-package-consumer.mjs`
  - Exercises package-root OHLC magnet target factory.
- Modify `scripts/fixtures/package-consumer-types.ts`
  - Covers new public types.
- Modify `packages/chart-engine/api-surface.json` and `packages/chart-engine/api-types.json`
  - Intentional public API snapshot updates.
- Modify `docs/engine/drawing-editor.md`, `docs/engine/public-api.md`, `docs/engine/testing-strategy.md`, and `docs/engine/release-candidate.md`
  - Documents OHLC target generation and acceptance evidence.
- Modify `docs/superpowers/plans/2026-06-28-chart-engine-v1-0-ohlc-magnet-targets-implementation-plan.md`
  - Tracks completed steps and command evidence.

## Task 1: Engine OHLC Magnet Target Factory

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingMagnet.ts`
- Create: `packages/chart-engine/src/__tests__/drawingMagnet.test.ts`

- [x] **Step 1: Add focused failing tests**

Create `packages/chart-engine/src/__tests__/drawingMagnet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createOhlcMagnetTargetsFromSeries,
  getMagnetSnapState,
  type CandleSeries,
  type ViewportState
} from "../index";

function createSeries(): CandleSeries {
  return {
    symbol: "TEST",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "test",
    candles: [
      { time: 1, open: 10, high: 14, low: 8, close: 12, volume: 1, turnover: 12 },
      { time: 2, open: 12, high: 18, low: 11, close: 17, volume: 1, turnover: 17 },
      { time: 3, open: 17, high: 20, low: 15, close: 16, volume: 1, turnover: 16 }
    ]
  };
}

const viewport: ViewportState = {
  visibleRange: { from: 1, to: 2 },
  candleWidth: 10,
  scrollOffset: 0,
  priceScaleMode: "linear"
};

describe("OHLC magnet target projection", () => {
  it("creates targets for visible candle OHLC values", () => {
    expect(
      createOhlcMagnetTargetsFromSeries({
        series: createSeries(),
        viewport,
        plotArea: { x: 100, y: 20, width: 200, height: 100 },
        priceRange: { min: 10, max: 20 },
        fields: ["high", "low"]
      })
    ).toEqual([
      { type: "ohlc", x: 105, y: 40, field: "high", dataIndex: 1 },
      { type: "ohlc", x: 105, y: 110, field: "low", dataIndex: 1 },
      { type: "ohlc", x: 115, y: 20, field: "high", dataIndex: 2 },
      { type: "ohlc", x: 115, y: 70, field: "low", dataIndex: 2 }
    ]);
  });

  it("uses visible price range when priceRange is omitted", () => {
    const targets = createOhlcMagnetTargetsFromSeries({
      series: createSeries(),
      viewport,
      plotArea: { x: 0, y: 0, width: 200, height: 100 },
      fields: ["close"]
    });

    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatchObject({ type: "ohlc", field: "close", dataIndex: 1 });
    expect(Number.isFinite(targets[0].y)).toBe(true);
  });

  it("returns no targets for empty or inverted visible ranges", () => {
    expect(
      createOhlcMagnetTargetsFromSeries({
        series: { ...createSeries(), candles: [] },
        viewport,
        plotArea: { x: 0, y: 0, width: 100, height: 100 }
      })
    ).toEqual([]);

    expect(
      createOhlcMagnetTargetsFromSeries({
        series: createSeries(),
        viewport: { ...viewport, visibleRange: { from: 4, to: 2 } },
        plotArea: { x: 0, y: 0, width: 100, height: 100 }
      })
    ).toEqual([]);
  });

  it("feeds projected targets into snap state", () => {
    const targets = createOhlcMagnetTargetsFromSeries({
      series: createSeries(),
      viewport,
      plotArea: { x: 100, y: 20, width: 200, height: 100 },
      priceRange: { min: 10, max: 20 },
      fields: ["high"]
    });

    expect(getMagnetSnapState({ point: { x: 106, y: 41 }, targets, radius: 4 }).magnet.mode).toBe(
      "ohlc"
    );
  });
});
```

- [x] **Step 2: Run focused tests to verify failure**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingMagnet.test.ts -- --reporter=dot
```

Expected: FAIL because `createOhlcMagnetTargetsFromSeries()` is missing.

- [x] **Step 3: Implement the factory**

In `drawingMagnet.ts`, import only neutral Engine modules:

```ts
import type { CandleSeries } from "../model/market";
import type { ViewportState } from "../model/runtime";
import { computeVisiblePriceRange } from "../viewport/priceRange";
import { indexToX, priceToY } from "../viewport/viewport";
```

Add:

```ts
export interface MagnetPlotArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MagnetPriceRange {
  min: number;
  max: number;
}

export interface OhlcMagnetTargetOptions {
  series: CandleSeries;
  viewport: ViewportState;
  plotArea: MagnetPlotArea;
  priceRange?: MagnetPriceRange;
  fields?: readonly OhlcMagnetField[];
}
```

Implement:

```ts
const defaultOhlcMagnetFields: readonly OhlcMagnetField[] = ["open", "high", "low", "close"];

export function createOhlcMagnetTargetsFromSeries(
  options: OhlcMagnetTargetOptions
): MagnetSnapTarget[] {
  const lastIndex = options.series.candles.length - 1;

  if (lastIndex < 0 || options.viewport.visibleRange.from > options.viewport.visibleRange.to) {
    return [];
  }

  const from = Math.max(0, options.viewport.visibleRange.from);
  const to = Math.min(lastIndex, options.viewport.visibleRange.to);

  if (from > to) {
    return [];
  }

  const fields = options.fields ?? defaultOhlcMagnetFields;
  const priceRange =
    options.priceRange ?? computeVisiblePriceRange(options.series, options.viewport.visibleRange);
  const points: OhlcMagnetPoint[] = [];

  for (let index = from; index <= to; index += 1) {
    const candle = options.series.candles[index];
    const x = indexToX(index, options.viewport, options.plotArea.x);

    for (const field of fields) {
      const price = candle[field];
      const y = priceToY(
        price,
        priceRange,
        options.plotArea.y,
        options.plotArea.height,
        options.viewport.priceScaleMode
      );

      points.push({ x, y, field, dataIndex: index });
    }
  }

  return createOhlcMagnetTargets(points);
}
```

- [x] **Step 4: Run focused tests**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingMagnet.test.ts -- --reporter=dot
npm run typecheck -w @simoncharts/chart-engine
npm run guard:engine-boundary
```

Expected: all PASS.

## Task 2: Playground OHLC Snap Integration

**Files:**
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`

- [x] **Step 1: Include OHLC targets in snap collection**

In `apps/playground/src/main.ts`, import:

```ts
createOhlcMagnetTargetsFromSeries
```

Update the drawing magnet target helper to include OHLC targets before drawing-anchor targets so existing Engine priority rules prefer `ohlc` ties:

```ts
function getDrawingMagnetTargets(exclude?: {
  drawingId: string;
  anchorIndex: number;
}): MagnetSnapTarget[] {
  const drawingTargets = createDrawingAnchorMagnetTargets(drawingEditor.getState().drawings);
  const filteredDrawingTargets = exclude
    ? drawingTargets.filter(
        (target) =>
          target.drawingId !== exclude.drawingId || target.anchorIndex !== exclude.anchorIndex
      )
    : drawingTargets;

  const ohlcTargets =
    layout && viewport
      ? createOhlcMagnetTargetsFromSeries({
          series: fixtureDailyCandleSeries,
          viewport,
          plotArea: getMainPanelLayout().plotArea
        })
      : [];

  return [...ohlcTargets, ...filteredDrawingTargets];
}
```

Use this combined target list in the existing `getDrawingSnapPoint()`.

- [x] **Step 2: Add browser coverage for OHLC snapping**

Add a Playwright test that computes the first visible candle high point from the exported playground state where possible, or uses the existing chart geometry with deterministic fixture data. The assertion must prove:

- `magnet-state` becomes `ohlc` when clicking near a candle OHLC point.
- The created drawing anchor does not equal the raw near-click point.
- The snapped anchor is stable after JSON export.

Suggested shape:

```ts
test("snaps drawing creation to visible candle OHLC targets", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 105, box.y + 70);
  await expect(page.getByTestId("magnet-state")).toHaveText("ohlc");
  await page.mouse.click(box.x + 220, box.y + 220);

  const payload = JSON.parse(await page.getByTestId("drawing-json-export").inputValue()) as {
    drawings: Array<{ anchors: Array<{ x: number; y: number }> }>;
  };

  expect(payload.drawings[0].anchors[0]).not.toEqual({ x: 105, y: 70 });
});
```

If the hard-coded point is unstable, compute a deterministic OHLC target in the test by evaluating package-root functions in the page is not required; instead, use the existing exported fixture behavior and adjust the click after observing the current viewport.

- [x] **Step 3: Run drawing e2e**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
```

Expected: PASS.

## Task 3: SDK, Docs, API Snapshots, and Release Gate

**Files:**
- Modify: `scripts/check-package-consumer.mjs`
- Modify: `scripts/fixtures/package-consumer-types.ts`
- Modify: `packages/chart-engine/api-surface.json`
- Modify: `packages/chart-engine/api-types.json`
- Modify: `docs/engine/drawing-editor.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/superpowers/plans/2026-06-28-chart-engine-v1-0-ohlc-magnet-targets-implementation-plan.md`

- [x] **Step 1: Add package consumer coverage**

Runtime consumer should import and exercise:

```js
createOhlcMagnetTargetsFromSeries
```

Type fixture should import and use:

```ts
OhlcMagnetTargetOptions;
MagnetPlotArea;
MagnetPriceRange;
```

- [x] **Step 2: Update public API snapshots**

Run:

```bash
npm run build -w @simoncharts/chart-engine
npm run guard:public-api
npm run guard:public-types
```

Expected: guards FAIL before snapshot updates because new exports are intentional.

Then update snapshots:

```bash
node -e 'import("@simoncharts/chart-engine").then((m)=>import("node:fs").then((fs)=>fs.writeFileSync("packages/chart-engine/api-surface.json", JSON.stringify(Object.keys(m).sort(), null, 2)+"\n")))'
node scripts/check-public-types.mjs --write
```

- [x] **Step 3: Document the OHLC magnet target factory**

Docs must state:

- OHLC target creation is DOM-free.
- hosts pass neutral candle series, viewport, plot area, optional price range, and optional fields.
- Engine returns visible candle OHLC `MagnetSnapTarget[]`.
- hosts still own pointer events, magnet toggles, target collection timing, persistence, collaboration, and render invalidation.

- [x] **Step 4: Run the full release gate**

Run:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run check:performance
npm run check:release-readiness
npm run build
npm run check:package-artifact
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Expected: all PASS.

- [x] **Step 5: Record evidence and commit**

Update this implementation plan and `docs/engine/release-candidate.md` with final counts from the commands above.

Commit:

```bash
git add packages/chart-engine/src packages/chart-engine/api-surface.json packages/chart-engine/api-types.json apps/playground scripts docs
git commit -m "Add OHLC magnet target projection"
git push origin codex/v0.1-full-engine
```

Task 3 evidence recorded on 2026-06-28:

- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `createOhlcMagnetTargetsFromSeries`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `MagnetPlotArea`, `MagnetPriceRange`, `OhlcMagnetTargetOptions`, and `createOhlcMagnetTargetsFromSeries`.
- Runtime API snapshot was intentionally refreshed to 141 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 367 type symbols.
- `npm run guard:public-api` passed: 141 runtime exports.
- `npm run guard:public-types` passed: 367 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `git diff --check` passed.

Full release gate evidence recorded on 2026-06-28:

- `npm run test` passed: 41 test files, 466 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 158 files scanned.
- `npm run guard:public-api` passed: 141 runtime exports.
- `npm run guard:public-types` passed: 367 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run check:package-artifact` passed: 120 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 120 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 43 browser tests.
