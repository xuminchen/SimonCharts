# Chart Engine Drawing Hit Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a package-root Engine-owned drawing body hit-test contract and replace the playground-local helper with it.

**Architecture:** Extend the existing `drawingHitTest.ts` module because it already owns drawing hit-test primitives. The new body hit-test functions delegate per-drawing geometry to `DrawingRendererRegistry`, then centralize hidden/locked filtering, distance sorting, and z-order tie behavior. Playground becomes a consumer of the Engine contract while keeping DOM events and pointer capture host-owned.

**Tech Stack:** TypeScript, Vitest, Playwright, Vite package build, SimonCharts public API/type guards.

---

## File Structure

- Modify `packages/chart-engine/src/drawing/drawingHitTest.ts`
  - Adds body hit-test types and functions while keeping anchor hit-test unchanged.
- Create or modify `packages/chart-engine/src/__tests__/drawingHitTest.test.ts`
  - Covers body hit-test filtering and ordering.
- Modify `apps/playground/src/main.ts`
  - Imports Engine `hitTestDrawing()` and removes the local helper.
- Modify `scripts/check-package-consumer.mjs`
  - Exercises runtime package hit-test consumption.
- Modify `scripts/fixtures/package-consumer-types.ts`
  - Exercises package-root hit-test types.
- Modify `packages/chart-engine/api-surface.json` and `packages/chart-engine/api-types.json`
  - Accepts intentional public API additions.
- Modify `docs/engine/drawing-editor.md`, `docs/engine/public-api.md`, `docs/engine/testing-strategy.md`, and `docs/engine/release-candidate.md`
  - Documents the new contract and final evidence.

## Task 1: Engine Drawing Hit-Test Contract

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingHitTest.ts`
- Create: `packages/chart-engine/src/__tests__/drawingHitTest.test.ts`

- [x] **Step 1: Write focused failing tests**

Add tests that expect:

```ts
const registry = createDrawingRendererRegistry();
registry.register({
  type: "trendLine",
  render() {},
  hitTest(drawing, point) {
    const distance = Number(drawing.metadata?.distance);
    return Number.isFinite(distance) ? { drawingId: drawing.id, distance } : undefined;
  }
});

expect(
  hitTestDrawing(
    [
      { id: "far", type: "trendLine", anchors: [], metadata: { distance: 8 } },
      { id: "near", type: "trendLine", anchors: [], metadata: { distance: 2 } }
    ],
    { x: 0, y: 0 },
    { registry }
  )?.drawing.id
).toBe("near");
```

Also cover:

- `hitTestDrawingAll()` excludes hidden drawings by default.
- `hitTestDrawingAll()` includes locked drawings by default.
- `hitTestDrawingAll()` excludes locked drawings when `includeLocked: false`.
- equal-distance hits prefer the later drawing in the input array.
- returned matches clone neither drawings nor hit objects; they are read-only result references for host interaction routing.

- [x] **Step 2: Run tests to verify the contract is missing**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHitTest.test.ts -- --reporter=dot
```

Expected: FAIL because `hitTestDrawing()` and `hitTestDrawingAll()` do not exist yet.

- [x] **Step 3: Implement minimal Engine functions**

Add:

```ts
export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingHitTestOptions {
  registry: DrawingRendererRegistry;
  includeHidden?: boolean;
  includeLocked?: boolean;
}

export interface DrawingHitTestMatch {
  drawing: DrawingObject;
  hit: DrawingHitTestResult;
  index: number;
}
```

Implement:

```ts
export function hitTestDrawingAll(
  drawings: DrawingObject[],
  point: DrawingPoint,
  options: DrawingHitTestOptions
): DrawingHitTestMatch[] {
  return drawings
    .map((drawing, index) => ({ drawing, index }))
    .filter(({ drawing }) => options.includeHidden === true || drawing.visible !== false)
    .filter(({ drawing }) => options.includeLocked !== false || drawing.locked !== true)
    .map(({ drawing, index }) => ({
      drawing,
      index,
      hit: options.registry.require(drawing.type).hitTest(drawing, point)
    }))
    .filter((match): match is DrawingHitTestMatch => match.hit !== undefined)
    .sort((left, right) => left.hit.distance - right.hit.distance || right.index - left.index);
}

export function hitTestDrawing(
  drawings: DrawingObject[],
  point: DrawingPoint,
  options: DrawingHitTestOptions
): DrawingHitTestMatch | undefined {
  return hitTestDrawingAll(drawings, point, options)[0];
}
```

- [x] **Step 4: Run focused tests**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHitTest.test.ts -- --reporter=dot
```

Expected: PASS.

## Task 2: Playground Integration

**Files:**
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`

- [x] **Step 1: Replace local helper**

In `apps/playground/src/main.ts`:

- import `hitTestDrawing` from `@simoncharts/chart-engine`.
- replace the local `hitTestDrawing(point, editorState.drawings)` call with:

```ts
const hitDrawing = hitTestDrawing(editorState.drawings, point, {
  registry: drawingRendererRegistry
})?.drawing;
```

- delete the local `function hitTestDrawing(...)`.

- [x] **Step 2: Add a z-order browser regression**

Add or update a Playwright test to create two overlapping drawings and verify body click selects the topmost later drawing. Use the JSON export or property panel selection text to assert `drawing-2` is selected.

- [x] **Step 3: Run playground drawing tests**

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
- Modify: `docs/superpowers/plans/2026-06-27-chart-engine-v1-0-drawing-hit-test-implementation-plan.md`

- [x] **Step 1: Add package consumer coverage**

Runtime consumer should import and exercise:

```js
hitTestDrawing,
hitTestDrawingAll
```

Type fixture should import and use:

```ts
DrawingHitTestMatch;
DrawingHitTestOptions;
DrawingPoint;
```

- [x] **Step 2: Update public API snapshots**

Run:

```bash
npm run build -w @simoncharts/chart-engine
npm run guard:public-api
npm run guard:public-types
```

Expected: guards FAIL before snapshot updates because new exports are intentional.

Then run:

```bash
node -e 'import("@simoncharts/chart-engine").then((m)=>require("node:fs").writeFileSync("packages/chart-engine/api-surface.json", JSON.stringify(Object.keys(m).sort(), null, 2)+"\n"))'
node scripts/check-public-types.mjs --write
```

- [x] **Step 3: Document the hit-test contract**

Docs must state:

- body hit-test is DOM-free.
- hosts pass neutral drawings, a point, and a drawing renderer registry.
- Engine handles hidden/locked filtering and distance/z-order sorting.
- hosts still own pointer events, cursor UI, hover rendering, persistence, and collaboration.

Evidence recorded on 2026-06-27:

- `npm run build -w @simoncharts/chart-engine` passed.
- `npm run guard:public-api` failed before snapshot update with added exports: `hitTestDrawing`, `hitTestDrawingAll`.
- `npm run guard:public-types` failed before snapshot update with added symbols: `DrawingHitTestMatch`, `DrawingHitTestOptions`, `hitTestDrawing`, and `hitTestDrawingAll`.
- `node -e 'import("@simoncharts/chart-engine").then((m)=>require("node:fs").writeFileSync("packages/chart-engine/api-surface.json", JSON.stringify(Object.keys(m).sort(), null, 2)+"\n"))'` passed.
- `node scripts/check-public-types.mjs --write` passed and wrote 355 symbols.
- `npm run guard:public-api` passed with 138 runtime exports.
- `npm run guard:public-types` passed with 355 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.

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

- [x] **Step 5: Record evidence**

Updated this implementation plan and `docs/engine/release-candidate.md` with final counts.

### Full Release Gate Evidence

Completed on 2026-06-27:

- `npm run test` passed: 39 test files, 446 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 155 files scanned.
- `npm run guard:public-api` passed: 138 runtime exports.
- `npm run guard:public-types` passed: 355 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run check:package-artifact` passed: 119 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 119 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 39 browser tests.
