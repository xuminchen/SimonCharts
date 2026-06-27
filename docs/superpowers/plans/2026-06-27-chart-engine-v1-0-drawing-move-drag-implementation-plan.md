# Chart Engine Drawing Move Drag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Engine-owned selected drawing body drag operation flow with preview updates and one final undoable command.

**Architecture:** Add a focused `drawingMoveDrag.ts` module beside the existing handle drag and selection box modules. The module returns preview drawings derived from an immutable operation snapshot and emits a neutral `dragSelected` editor command for final commit. Playground becomes a host of this contract instead of committing body movement on every pointer move.

**Tech Stack:** TypeScript, Vitest, Playwright, Vite package build, SimonCharts package-root public API guards.

---

## File Structure

- Create `packages/chart-engine/src/drawing/drawingMoveDrag.ts`
  - Owns begin/update/finish/get-command logic for selected drawing body drags.
- Create `packages/chart-engine/src/__tests__/drawingMoveDrag.test.ts`
  - Covers operation lifecycle and preview behavior.
- Modify `packages/chart-engine/src/drawing/drawingCommands.ts`
  - Adds `dragSelected` to `DrawingEditorCommand`.
- Modify `packages/chart-engine/src/drawing/drawingEditor.ts`
  - Routes `dragSelected` through `executeCommand`.
- Modify `packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`
  - Covers command execution and undo/redo behavior.
- Modify `packages/chart-engine/src/index.ts`
  - Exports the move drag module from the package root.
- Modify `apps/playground/src/main.ts`
  - Replaces direct body-drag commits with move-drag preview and one pointer-up command.
- Modify `apps/playground/tests/drawing-editor.spec.ts`
  - Adds browser verification for multi-step body drag plus one undo.
- Modify `scripts/check-package-consumer.mjs`
  - Verifies runtime package consumption of move drag APIs.
- Modify `scripts/fixtures/package-consumer-types.ts`
  - Verifies type consumer access to move drag APIs and types.
- Modify `scripts/check-package-artifact.mjs`
  - Requires `dist/drawing/drawingMoveDrag.d.ts`.
- Modify `docs/engine/drawing-editor.md`, `docs/engine/public-api.md`, `docs/engine/release-candidate.md`, `docs/engine/testing-strategy.md`
  - Documents the new contract and updated evidence.
- Modify `packages/chart-engine/api-surface.json`, `packages/chart-engine/api-types.json`
  - Intentionally accepts new package-root public API symbols after guards fail.

## Task 1: Engine Move Drag Contract

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingMoveDrag.ts`
- Create: `packages/chart-engine/src/__tests__/drawingMoveDrag.test.ts`
- Modify: `packages/chart-engine/src/drawing/drawingCommands.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write focused failing tests**

Add tests that expect:

```ts
const operation = beginDrawingMoveDrag({
  drawings,
  selectedDrawingIds: ["a"],
  startPoint: { x: 10, y: 20 }
});

expect(updateDrawingMoveDrag(operation!, { x: 15, y: 25 })?.command).toEqual({
  type: "dragSelected",
  delta: { dx: 5, dy: 5 }
});
```

Also cover:

- `beginDrawingMoveDrag()` returns `undefined` when no selected editable drawings exist.
- repeated `updateDrawingMoveDrag()` calls derive from the original snapshot, not the previous preview.
- locked selected drawings remain unchanged in previews.
- `finishDrawingMoveDrag()` returns `undefined` for zero-distance drags.
- `DrawingEditor.executeCommand({ type: "dragSelected", delta })` moves editable selections and one `undo()` reverts the full command.

- [ ] **Step 2: Run tests to verify the contract is missing**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingMoveDrag.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts -- --reporter=dot
```

Expected: FAIL because `drawingMoveDrag.ts` and the `dragSelected` command route do not exist yet.

- [ ] **Step 3: Implement the minimal Engine module and command route**

Add:

```ts
export interface DrawingMoveDragOptions {
  drawings: DrawingObject[];
  selectedDrawingIds: string[];
  startPoint: DrawingTransformPoint;
}
```

`beginDrawingMoveDrag()` must clone drawings and selected ids. `updateDrawingMoveDrag()` must return `{ drawings, command }` from the original operation snapshot. `finishDrawingMoveDrag()` delegates to `getDrawingMoveDragCommand()`. `getDrawingMoveDragCommand()` returns `undefined` when both `dx` and `dy` are zero.

Add `| { type: "dragSelected"; delta: { dx: number; dy: number } }` to `DrawingEditorCommand` and route it to `api.dragSelected(command.delta)`.

- [ ] **Step 4: Export from package root**

Add to `packages/chart-engine/src/index.ts`:

```ts
export * from "./drawing/drawingMoveDrag";
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingMoveDrag.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts -- --reporter=dot
```

Expected: PASS.

## Task 2: Playground Body Drag Integration

**Files:**
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`

- [ ] **Step 1: Write the browser regression**

Add a Playwright test that:

1. Creates a `trendLine`.
2. Selects the line body.
3. Performs at least three `mouse.move()` calls before `mouse.up()`.
4. Confirms anchors moved by the full delta.
5. Clicks Undo once.
6. Confirms original anchors returned.

This proves one body drag creates one undoable Engine command.

- [ ] **Step 2: Run the regression before implementation**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
```

Expected: FAIL or expose the old multi-commit behavior.

- [ ] **Step 3: Replace direct pointer-move commits**

In `apps/playground/src/main.ts`:

- import `beginDrawingMoveDrag`, `updateDrawingMoveDrag`, and `finishDrawingMoveDrag`.
- replace `drawingDragStart` with `drawingMoveDragOperation`.
- on drawing body pointer down, select the hit drawing, then call `beginDrawingMoveDrag()` with the current editor snapshot and start point.
- on pointer move, call `updateDrawingMoveDrag()` and assign `drawingPreviewDrawings`.
- on pointer up, clear preview state and execute the command from `finishDrawingMoveDrag()`.
- on leave/blur/cancel, clear move drag operation and preview state.

- [ ] **Step 4: Run browser regression**

Run:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
```

Expected: PASS.

## Task 3: SDK, Docs, Evidence, and Release Gate

**Files:**
- Modify: `scripts/check-package-consumer.mjs`
- Modify: `scripts/fixtures/package-consumer-types.ts`
- Modify: `scripts/check-package-artifact.mjs`
- Modify: `packages/chart-engine/api-surface.json`
- Modify: `packages/chart-engine/api-types.json`
- Modify: `docs/engine/drawing-editor.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/release-candidate.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/superpowers/plans/2026-06-27-chart-engine-v1-0-drawing-move-drag-implementation-plan.md`

- [x] **Step 1: Add SDK consumer coverage**

Runtime consumer must import and exercise:

```js
beginDrawingMoveDrag,
updateDrawingMoveDrag,
finishDrawingMoveDrag
```

Type fixture must import and use:

```ts
DrawingMoveDragOperation;
DrawingMoveDragPreview;
```

- [x] **Step 2: Update package artifact expectation**

Add:

```js
"dist/drawing/drawingMoveDrag.d.ts"
```

to the required artifact files.

- [x] **Step 3: Run public API guards and accept intentional changes**

Run:

```bash
npm run guard:public-api
npm run guard:public-types
```

Expected: FAIL because new package-root exports are intentional.

Then update snapshots:

```bash
node -e 'import("@simoncharts/chart-engine").then((m)=>require("node:fs").writeFileSync("packages/chart-engine/api-surface.json", JSON.stringify(Object.keys(m).sort(), null, 2)+"\n"))'
node scripts/check-public-types.mjs --write
```

- [x] **Step 4: Document the new contract**

Update docs to state:

- Move drag is DOM-free.
- Hosts pass neutral drawing snapshots and selected ids.
- Engine returns preview drawings from the original snapshot.
- Finish returns one `dragSelected` command.
- Hosts still own pointer capture, cursor UI, render invalidation, persistence, and collaboration.

- [x] **Step 5: Run the full release gate**

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

- [ ] **Step 6: Record evidence and commit**

Update this implementation plan and `docs/engine/release-candidate.md` with final test counts and package artifact counts.

Commit:

```bash
git add packages/chart-engine/src packages/chart-engine/api-surface.json packages/chart-engine/api-types.json apps/playground scripts docs
git commit -m "Add drawing move drag flow"
git push origin codex/v0.1-full-engine
```

### Task 3 Focused Evidence

Completed on 2026-06-27:

- `npm run build -w @simoncharts/chart-engine` passed.
- `npm run guard:public-api` failed before snapshot update with expected added exports: `beginDrawingMoveDrag`, `updateDrawingMoveDrag`, `finishDrawingMoveDrag`, and `getDrawingMoveDragCommand`.
- `npm run guard:public-types` failed before snapshot update with expected added symbols: `DrawingMoveDragCommand`, `DrawingMoveDragOperation`, `DrawingMoveDragOptions`, `DrawingMoveDragPreview`, `beginDrawingMoveDrag`, `updateDrawingMoveDrag`, `finishDrawingMoveDrag`, and `getDrawingMoveDragCommand`.
- Runtime public API snapshot was regenerated from the built package root.
- `node scripts/check-public-types.mjs --write` passed and wrote 351 symbols.
- `npm run guard:public-api` passed: 136 runtime exports.
- `npm run guard:public-types` passed: 351 type symbols.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:package-artifact` passed: 119 package files.

Not completed in this Task 3 pass:

- Step 6 commit was not run because this task requested no commit.

### Full Release Gate Evidence

Completed on 2026-06-27:

- `npm run test` passed: 38 test files, 439 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 154 files scanned.
- `npm run guard:public-api` passed: 136 runtime exports.
- `npm run guard:public-types` passed: 351 type symbols.
- `npm run guard:sdk-imports` passed.
- `npm run check:package-consumer` passed.
- `npm run check:package-types` passed.
- `npm run check:performance` passed: 1 test file, 2 performance scenarios.
- `npm run check:release-readiness` passed for `@simoncharts/chart-engine@1.0.0-rc.0`.
- `npm run build` passed for the Engine package and playground.
- `npm run check:package-artifact` passed: 119 package files.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@1.0.0-rc.0`; tarball contained 119 files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 38 browser tests.
