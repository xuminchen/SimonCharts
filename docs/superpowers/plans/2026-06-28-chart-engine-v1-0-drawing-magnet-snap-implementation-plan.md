# Chart Engine Drawing Magnet Snap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a package-root Engine-owned magnet snap state contract and wire the playground drawing editor to use it for drawing creation and anchor-handle snapping.

**Architecture:** Extend the existing `drawingMagnet.ts` module with a small snap-state helper that converts existing `MagnetSnapTarget` matches into snapped points plus neutral `InteractionSession` magnet state. Playground remains the host of pointer events and render invalidation: it builds neutral targets, calls the Engine helper before drawing creation/anchor drag, and forwards the returned magnet state to `InteractionSession`.

**Tech Stack:** TypeScript, Vitest, Playwright, Vite package build, SimonCharts public API/type guards.

---

## File Structure

- Modify `packages/chart-engine/src/drawing/drawingMagnet.ts`
  - Adds pure `getMagnetSnapState()` and exported state/options types.
- Modify `packages/chart-engine/src/__tests__/drawingHotkeys.test.ts`
  - Adds focused magnet snap state unit tests beside existing magnet target tests.
- Modify `apps/playground/src/main.ts`
  - Builds neutral magnet targets and applies snapped points to drawing creation and anchor-handle drag.
- Modify `apps/playground/tests/drawing-editor.spec.ts`
  - Adds browser coverage for snapping and magnet diagnostics.
- Modify `scripts/check-package-consumer.mjs`
  - Exercises the package-root magnet snap state API.
- Modify `scripts/fixtures/package-consumer-types.ts`
  - Covers new public types.
- Modify `packages/chart-engine/api-surface.json` and `packages/chart-engine/api-types.json`
  - Intentional public API snapshot updates.
- Modify `docs/engine/drawing-editor.md`, `docs/engine/public-api.md`, `docs/engine/testing-strategy.md`, and `docs/engine/release-candidate.md`
  - Documents the snap state contract and acceptance evidence.
- Modify `docs/superpowers/plans/2026-06-28-chart-engine-v1-0-drawing-magnet-snap-implementation-plan.md`
  - Tracks completed steps and command evidence.

## Task 1: Engine Magnet Snap State Contract

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingMagnet.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingHotkeys.test.ts`

- [x] **Step 1: Add focused failing tests**

Add tests under `describe("drawing magnet targets", () => { ... })`:

```ts
it("returns snapped point and neutral magnet state for an OHLC target", () => {
  expect(
    getMagnetSnapState({
      point: { x: 10, y: 10 },
      targets: [{ type: "ohlc", x: 11, y: 10, field: "close", dataIndex: 2 }],
      radius: 4
    })
  ).toEqual({
    point: { x: 11, y: 10 },
    target: { type: "ohlc", x: 11, y: 10, field: "close", dataIndex: 2 },
    magnet: {
      mode: "ohlc",
      target: {
        id: "ohlc:2:close",
        mode: "ohlc",
        point: { x: 11, y: 10 },
        distance: 1
      }
    }
  });
});

it("returns off magnet state and original point when no target is in radius", () => {
  expect(
    getMagnetSnapState({
      point: { x: 10, y: 10 },
      targets: [{ type: "visualPoint", x: 40, y: 40, visualId: "v", pointIndex: 0 }],
      radius: 2
    })
  ).toEqual({
    point: { x: 10, y: 10 },
    magnet: { mode: "off" }
  });
});
```

Also cover `drawingAnchor` and `visualPoint` target id generation:

```ts
expect(getMagnetSnapState({
  point: { x: 0, y: 0 },
  targets: [{ type: "drawingAnchor", x: 1, y: 0, drawingId: "drawing-1", anchorIndex: 0 }],
  radius: 2
}).magnet).toEqual({
  mode: "drawingAnchor",
  target: {
    id: "drawingAnchor:drawing-1:0",
    mode: "drawingAnchor",
    point: { x: 1, y: 0 },
    distance: 1
  }
});

expect(getMagnetSnapState({
  point: { x: 0, y: 0 },
  targets: [{ type: "visualPoint", x: 0, y: 1, visualId: "visual-1", pointIndex: 3 }],
  radius: 2
}).magnet).toEqual({
  mode: "visualPoint",
  target: {
    id: "visualPoint:visual-1:3",
    mode: "visualPoint",
    point: { x: 0, y: 1 },
    distance: 1
  }
});
```

- [x] **Step 2: Run focused tests to verify failure**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHotkeys.test.ts -- --reporter=dot
```

Expected: FAIL because `getMagnetSnapState` is not defined.

- [x] **Step 3: Implement the pure helper**

Add these exports in `drawingMagnet.ts`:

```ts
import type { MagnetSessionState } from "../interaction/sessionTypes";

export interface MagnetSnapState {
  point: MagnetPoint;
  target?: MagnetSnapTarget;
  magnet: MagnetSessionState;
}

export interface MagnetSnapStateOptions {
  point: MagnetPoint;
  targets: readonly MagnetSnapTarget[];
  radius: number;
}
```

Implement:

```ts
export function getMagnetSnapState(options: MagnetSnapStateOptions): MagnetSnapState {
  const target = findNearestMagnetTarget(options.point, options.targets, options.radius);

  if (!target) {
    return {
      point: { ...options.point },
      magnet: { mode: "off" }
    };
  }

  return {
    point: { x: target.x, y: target.y },
    target,
    magnet: {
      mode: toMagnetMode(target.type),
      target: {
        id: createMagnetTargetId(target),
        mode: toMagnetMode(target.type),
        point: { x: target.x, y: target.y },
        distance: Math.hypot(options.point.x - target.x, options.point.y - target.y)
      }
    }
  };
}
```

Use deterministic id strings:

- OHLC with `dataIndex` and `field`: `ohlc:${dataIndex}:${field}`
- OHLC without `dataIndex`: `ohlc:${field}:${x}:${y}`
- drawing anchor with id/index: `drawingAnchor:${drawingId}:${anchorIndex}`
- visual point with id/index: `visualPoint:${visualId}:${pointIndex}`
- fallback includes type and coordinates: `${type}:${x}:${y}`

- [x] **Step 4: Run focused tests**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHotkeys.test.ts -- --reporter=dot
```

Expected: PASS.

## Task 2: Playground Drawing Snap Integration

**Files:**
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`

- [x] **Step 1: Build neutral snap targets in playground**

In `apps/playground/src/main.ts`, import:

```ts
createDrawingAnchorMagnetTargets,
getMagnetSnapState
```

Add constants:

```ts
const drawingMagnetRadius = 10;
```

Add helper:

```ts
function getDrawingSnapPoint(point: { x: number; y: number }): { x: number; y: number } {
  const snap = getMagnetSnapState({
    point,
    targets: createDrawingAnchorMagnetTargets(drawingEditor.getState().drawings),
    radius: drawingMagnetRadius
  });

  interactionSession.handleInput({ type: "magnet", magnet: snap.magnet });
  return snap.point;
}
```

If snapping to the same selected anchor during an anchor drag causes self-snap, add an optional `exclude` object and filter targets where `drawingId` and `anchorIndex` match the dragged handle.

- [x] **Step 2: Apply snapping to drawing creation**

In `handleDrawingPointerDown(point, options)`, for non-select drawing tools pass `getDrawingSnapPoint(point)` into:

```ts
drawingEditor.pointerDown(snappedPoint);
```

Keep `InteractionSession` and DOM pointer handling in the playground only.

- [x] **Step 3: Apply snapping to selected anchor-handle drag**

When `drawingHandleDragOperation?.kind === "anchor"`, call `getDrawingSnapPoint(point)` before `updateDrawingHandleDrag()` and `finishDrawingHandleDrag()`. For resize/rotate handles, keep raw pointer points to avoid surprising transforms.

- [x] **Step 4: Clear magnet state**

Ensure `clearTransientInteraction()`, `cancelPointerInteraction()`, completed pointer-up paths, and no-target pointer moves send:

```ts
interactionSession.handleInput({ type: "magnet", magnet: { mode: "off" } });
```

Existing leave/blur handling already clears interaction session state; this step makes non-leave drawing transitions deterministic.

- [x] **Step 5: Add browser coverage**

Add a Playwright test:

```ts
test("drawing magnet snaps creation and anchor drag to drawing anchors", async ({ page }) => {
  await page.goto("/");
  const overlay = page.getByTestId("chart-overlay");
  const box = await overlay.boundingBox();

  if (!box) {
    throw new Error("overlay missing");
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 120, box.y + 180);
  await page.mouse.click(box.x + 260, box.y + 240);
  await page.getByTestId("drawing-tool-trendLine").click();
  await page.mouse.click(box.x + 124, box.y + 183);
  await expect(page.getByTestId("magnet-state")).toHaveText("drawingAnchor");
  await page.mouse.click(box.x + 300, box.y + 260);

  const payload = JSON.parse(await page.getByTestId("drawing-json-export").inputValue()) as {
    drawings: Array<{ anchors: Array<{ x: number; y: number }> }>;
  };

  expect(payload.drawings[1].anchors[0]).toEqual({ x: 120, y: 180 });
});
```

If anchor drag snapping is added in the same test, select the second drawing, drag its first anchor near the first drawing's second anchor, and assert the exported anchor equals `{ x: 260, y: 240 }`.

- [x] **Step 6: Run drawing e2e**

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
- Modify: `docs/superpowers/plans/2026-06-28-chart-engine-v1-0-drawing-magnet-snap-implementation-plan.md`

- [x] **Step 1: Add package consumer coverage**

Runtime consumer should import and exercise:

```js
getMagnetSnapState
```

Type fixture should import and use:

```ts
MagnetSnapState;
MagnetSnapStateOptions;
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

- [x] **Step 3: Document the magnet snap contract**

Docs must state:

- snap state is DOM-free.
- hosts pass neutral point, targets, and radius.
- Engine returns snapped point, matched target, and neutral magnet session state.
- hosts still own pointer events, target collection timing, render invalidation, persistence, collaboration, and UI toggles.

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
git commit -m "Add drawing magnet snap state"
git push origin codex/v0.1-full-engine
```

## Task Evidence

Completed on 2026-06-28:

- `npm run test -- packages/chart-engine/src/__tests__/drawingHotkeys.test.ts -- --reporter=dot` passed: 12 tests.
- `npm run typecheck -w @simoncharts/chart-engine` passed.
- `npm run guard:engine-boundary` passed: 157 files scanned.
- `npm run typecheck` passed.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts` passed: 14 browser tests.
- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `getMagnetSnapState`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `MagnetSnapState`, `MagnetSnapStateOptions`, and `getMagnetSnapState`.
- Runtime API snapshot was refreshed to 140 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 363 type symbols.
- `npm run guard:public-api` passed: 140 runtime exports.
- `npm run guard:public-types` passed: 363 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:release-readiness` passed.
- `git diff --check` passed.

## Full Release Gate Evidence

Completed on 2026-06-28:

- `npm run test` passed: 40 test files, 460 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 157 files scanned.
- `npm run guard:public-api` passed: 140 runtime exports.
- `npm run guard:public-types` passed: 363 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run check:package-artifact` passed: 120 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed; tarball contained 120 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 42 browser tests.

### Task 3 Scoped Evidence

Completed on 2026-06-28:

- `npm run build -w @simoncharts/chart-engine` passed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `getMagnetSnapState`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `MagnetSnapState`, `MagnetSnapStateOptions`, and `getMagnetSnapState`.
- Runtime API snapshot was intentionally refreshed from sorted package-root `Object.keys` to 140 runtime exports.
- `node scripts/check-public-types.mjs --write` refreshed the type snapshot to 363 type symbols.
- `npm run guard:public-api` passed: 140 runtime exports.
- `npm run guard:public-types` passed: 363 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `git diff --check` passed.
