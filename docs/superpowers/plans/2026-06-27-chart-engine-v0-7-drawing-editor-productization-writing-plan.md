# Chart Engine v0.7 Drawing Editor Productization Writing Plan

**Problem:** SimonCharts Engine has broad drawing coverage and an undoable editor, but product UIs still need to infer command availability from scattered state. Hotkeys already produce neutral `DrawingEditorCommand` values, yet the editor does not expose a command executor or a complete capability snapshot. This makes a full drawing editor harder to host safely.

**Goal:** Productize the Engine drawing editor by making command execution and command availability first-class, neutral Engine contracts. Hosts should be able to bind toolbar buttons, hotkeys, and object manager controls without importing business models or reimplementing editor rules.

**Boundary:**
- Engine code must not import TradingReviewSystem APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, or persistence services.
- Engine code must not import `apps/*`.
- Playground may demonstrate the Engine contract but must remain a neutral acceptance harness.
- v0.7 does not add collaborative persistence, accounts, server storage, or product-specific drawing semantics.

## Success Criteria

1. The editor can execute neutral `DrawingEditorCommand` values directly.
   - Verify with unit tests that hotkey-style command payloads call the same editor behavior as direct methods.
2. The editor exposes command capability state.
   - Verify capability snapshots for empty, selected, locked, hidden, clipboard, creating, undo, and redo states.
3. Lock and visibility controls are product-ready.
   - Verify selected drawings can be locked/unlocked and hidden/shown through neutral commands.
4. Playground drawing controls bind to Engine capabilities rather than guessing.
   - Verify browser drawing editor flows for copy, paste, duplicate, z-order, lock/unlock, hide/show, and disabled action state.
5. Engine boundary stays clean.
   - Verify with `npm run guard:engine-boundary`.

## Non-Goals

- No TradingReviewSystem work.
- No host persistence or server APIs.
- No DOM event types in the Engine.
- No drawing collaboration protocol.
- No visual redesign beyond neutral playground acceptance controls.

## Proposed v0.7 Scope

1. Command execution contract
   - Add `executeCommand(command)` to `DrawingEditor`.
   - Route all existing `DrawingEditorCommand` variants through existing editor methods.
   - Add `unlockSelected` and `showSelected` command variants.

2. Capability snapshot
   - Add `DrawingEditorCapabilities`.
   - Include selection, editable selection, clipboard, creation, undo, redo, z-order, lock, visibility, copy, paste, duplicate, delete, and cancel availability.
   - Return cloned/derived values only.

3. History observability
   - Extend command history with `canUndo()` and `canRedo()`.
   - Use those flags in editor capabilities.

4. Playground acceptance
   - Add neutral action buttons for copy, paste, duplicate, z-order, unlock, and show.
   - Disable buttons from `editor.getCapabilities()`.
   - Keep layout compact and testable.

5. Documentation
   - Update drawing editor docs and testing strategy with v0.7 behavior and verification commands.

## Validation Gate

Run before accepting v0.7:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

