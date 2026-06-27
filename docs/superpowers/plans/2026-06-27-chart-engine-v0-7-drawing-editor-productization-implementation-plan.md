# Chart Engine v0.7 Drawing Editor Productization Implementation Plan

**Goal:** Make the SimonCharts drawing editor product-ready as a reusable Engine subsystem by adding neutral command execution, command capabilities, and playground acceptance controls.

## Task 1: History Capability State

**Files:**
- Modify: `packages/chart-engine/src/commands/history.ts`
- Modify: `packages/chart-engine/src/__tests__/commands.test.ts`

**Steps:**
1. Add `canUndo()` and `canRedo()` to `CommandHistory`.
2. Keep existing `apply()`, `undo()`, `redo()`, and `current()` behavior unchanged.
3. Add tests that prove redo clears after a new apply and flags update across undo/redo.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/commands.test.ts`

## Task 2: Drawing Editor Commands And Capabilities

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingCommands.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditState.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingHotkeys.test.ts`

**Steps:**
1. Add `unlockSelected` and `showSelected` command variants.
2. Add `executeCommand(command)` to the editor.
3. Add `getCapabilities()` to the editor.
4. Keep geometry/style/delete/reorder operations locked-object safe.
5. Add tests for capability snapshots, command execution, lock/unlock, hide/show, clipboard, undo, redo, and cloned state isolation.

**Verification:**
- `npm run test -- packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts packages/chart-engine/src/__tests__/drawingHotkeys.test.ts`
- `npm run typecheck`

## Task 3: Playground Product Controls

**Files:**
- Modify: `apps/playground/src/drawingToolbar.ts`
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`

**Steps:**
1. Add action controls for copy, paste, duplicate, forward, backward, unlock, and show.
2. Drive disabled state from `drawingEditor.getCapabilities()`.
3. Route action buttons through `drawingEditor.executeCommand()`.
4. Add browser coverage for command controls and disabled states.

**Verification:**
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts`

## Task 4: Documentation And Acceptance Evidence

**Files:**
- Modify: `docs/engine/drawing-editor.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: this plan with acceptance evidence

**Steps:**
1. Document command execution and capability snapshots.
2. Document focused v0.7 verification commands.
3. Run the full validation gate and record evidence.

**Verification:**
- `npm run test`
- `npm run typecheck`
- `npm run guard:engine-boundary`
- `npm run guard:public-api`
- `npm run build`
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`

## Acceptance Evidence

Completed on 2026-06-27:

- Focused v0.7 unit tests passed: 3 test files, 23 tests.
- Focused drawing editor browser tests passed: 4 tests.
- `npm run test` passed: 31 test files, 381 tests.
- `npm run typecheck` passed.
- `npm run guard:engine-boundary` passed: 139 engine files scanned.
- `npm run guard:public-api` passed: 103 runtime exports.
- `npm run check:package-consumer` passed.
- `npm run build` passed for `@simoncharts/chart-engine` and `@simoncharts/playground`.
- `@simoncharts/chart-engine` package version was advanced to `0.7.0`.
- `npm pack --dry-run -w @simoncharts/chart-engine` passed for `@simoncharts/chart-engine@0.7.0` and included `dist/index.js`, `dist/index.d.ts`, and declaration files.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` passed: 32 browser tests.
