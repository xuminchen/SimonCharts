# Chart Engine Drawing Hover Intent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a package-root Engine-owned drawing hover intent contract and wire the playground to use it for hovered drawing render state and neutral cursor diagnostics.

**Architecture:** Create a focused drawing hover module beside the hit-test and drag operation modules. The module stays pure: it accepts neutral drawings, selected edit handles, a point, and a drawing renderer registry, then returns a small hover state object. Playground consumes that state to set `hoveredDrawingId` and feed cursor intent into `InteractionSession` without moving DOM behavior into Engine.

**Tech Stack:** TypeScript, Vitest, Playwright, Vite package build, SimonCharts public API/type guards.

---

## File Structure

- Create `packages/chart-engine/src/drawing/drawingHover.ts`
  - Owns pure hover target and cursor intent calculation.
- Create `packages/chart-engine/src/__tests__/drawingHover.test.ts`
  - Covers handle/body/no-hit/active-target behavior.
- Modify `packages/chart-engine/src/index.ts`
  - Exports the hover module.
- Modify `packages/chart-engine/src/interaction/sessionTypes.ts` and `packages/chart-engine/src/interaction/interactionSession.ts`
  - Adds an optional neutral cursor input if playground needs to feed Engine cursor intent directly.
- Modify `apps/playground/src/main.ts`
  - Tracks `hoveredDrawingId` and passes it into render state.
- Modify `apps/playground/tests/drawing-editor.spec.ts` or `interaction-rendering-hardening.spec.ts`
  - Adds browser coverage for hover handles/cursor diagnostics.
- Modify SDK docs, consumers, and API snapshots.

## Task 1: Engine Drawing Hover Contract

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingHover.ts`
- Create: `packages/chart-engine/src/__tests__/drawingHover.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [x] **Step 1: Write focused failing tests**

Add tests that expect:

```ts
const state = getDrawingHoverState({
  drawings: [drawing("body")],
  point: { x: 0, y: 0 },
  handles: [],
  registry
});

expect(state).toMatchObject({
  target: { kind: "body", drawingId: "body" },
  hoveredDrawingId: "body",
  cursor: "drawing"
});
```

Also cover:

- edit handle hit wins over body hit.
- resize handle returns `cursor: "resize"`.
- anchor and rotate handles return `cursor: "drawing"`.
- no hit returns `cursor: "crosshair"` and no `hoveredDrawingId`.
- active target returns that target's cursor without recomputing body hits.

- [x] **Step 2: Run tests to verify contract is missing**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHover.test.ts -- --reporter=dot
```

Expected: FAIL because `drawingHover.ts` does not exist yet.

- [x] **Step 3: Implement minimal pure helper**

Create:

```ts
export type DrawingHoverCursor = "crosshair" | "drawing" | "resize";

export type DrawingHoverTarget =
  | { kind: "handle"; drawingId: string; handleId: string; handleKind: DrawingEditHandleKind }
  | { kind: "body"; drawingId: string };

export interface DrawingHoverState {
  target?: DrawingHoverTarget;
  hoveredDrawingId?: string;
  cursor: DrawingHoverCursor;
}
```

`getDrawingHoverState(options)` should:

1. return active target state first when supplied.
2. call `hitTestDrawingEditHandle(handles, point, handleHitTestOptions)` first.
3. call `hitTestDrawing(drawings, point, bodyHitTestOptions)` if no handle hit.
4. return no-hit state otherwise.

- [x] **Step 4: Export from package root**

Add:

```ts
export * from "./drawing/drawingHover";
```

- [x] **Step 5: Run focused tests**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHover.test.ts -- --reporter=dot
```

Expected: PASS.

## Task 2: Playground Hover Integration

**Files:**
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`

- [x] **Step 1: Add hover state wiring**

In `apps/playground/src/main.ts`:

- import `getDrawingHoverState`.
- add `let drawingHoveredDrawingId: string | undefined`.
- pass `hoveredDrawingId: drawingHoveredDrawingId` in `createRenderContext()`.
- on pointer move when no drag/operation is active, call `getDrawingHoverState()` with current drawings, selected handles, point, and `drawingRendererRegistry`.
- update `drawingHoveredDrawingId`.
- feed the returned cursor into diagnostics through `InteractionSession` only if a neutral cursor input is available; otherwise update a host-side diagnostic field without DOM mutation.
- clear hover on leave/blur/cancel.

- [x] **Step 2: Add browser coverage**

Add a Playwright test:

1. Create a trend line.
2. Switch to select.
3. Move over the line body without clicking.
4. Assert `drawing-handle-count` becomes visible for hovered drawing or cursor diagnostic becomes `drawing`.
5. Move away.
6. Assert hover handles/cursor clears.

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
- Modify: `docs/superpowers/plans/2026-06-27-chart-engine-v1-0-drawing-hover-intent-implementation-plan.md`

- [x] **Step 1: Add package consumer coverage**

Runtime consumer should import and exercise:

```js
getDrawingHoverState
```

Type fixture should import and use:

```ts
DrawingHoverState;
DrawingHoverTarget;
DrawingHoverCursor;
DrawingHoverStateOptions;
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

- [x] **Step 3: Document the hover contract**

Docs must state:

- hover intent is DOM-free.
- hosts pass neutral drawings, selected handles, point, and renderer registry.
- Engine returns target, hovered drawing id, and cursor intent.
- hosts still own DOM cursor styling, pointer events, hover rendering invalidation, persistence, and collaboration.

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
git commit -m "Add drawing hover intent contract"
git push origin codex/v0.1-full-engine
```

Final evidence was recorded after the full release gate passed on 2026-06-28.

## Task 3 Evidence

Completed on 2026-06-28:

- `npm run build -w @simoncharts/chart-engine` passed; Vite built 117 modules and `tsc -b --force` completed.
- Pre-snapshot `npm run guard:public-api` failed as expected with added runtime export `getDrawingHoverState`.
- Pre-snapshot `npm run guard:public-types` failed as expected with added symbols `DrawingHoverCursor`, `DrawingHoverState`, `DrawingHoverStateOptions`, `DrawingHoverTarget`, and `getDrawingHoverState`.
- Runtime API snapshot was written from sorted package-root `Object.keys`; result: 139 runtime exports.
- `node scripts/check-public-types.mjs --write` passed and wrote 360 type symbols.
- `npm run guard:public-api` passed: 139 runtime exports.
- `npm run guard:public-types` passed: 360 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.

## Full Release Gate Evidence

Completed on 2026-06-28:

- `npm run test` passed: 40 test files, 455 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 157 files scanned.
- `npm run guard:public-api` passed: 139 runtime exports.
- `npm run guard:public-types` passed: 360 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run check:package-artifact` passed: 120 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed; tarball contained 120 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 40 browser tests.
