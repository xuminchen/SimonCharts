# Chart Engine v1.0 Extension Lifecycle Writing Plan

**Problem:** SimonCharts Engine has an extension kernel for local contribution installation, but it only applies contributions one way. A host can register an extension and install renderers/tools, yet the Engine does not provide an install lifecycle with duplicate install protection, contribution conflict detection, installed-state inspection, or uninstall restoration. This leaves the extension kernel short of a reusable platform primitive.

**Goal:** Add a neutral local extension lifecycle to the Engine. The lifecycle should install local contributions into existing registries, prevent duplicate extension ids and duplicate contribution keys, expose installed-state snapshots, and uninstall an extension by restoring the registry entries that existed before installation.

**Boundary:**
- Do not add remote plugin loading.
- Do not add sandbox execution.
- Do not add marketplace behavior.
- Do not add host persistence, trust policy, account state, routes, review, strategy, watchlist, AI, auth, billing, portfolio, or product workflow models.
- Keep extension lifecycle metadata neutral and Engine-owned.
- Preserve existing `applyChartExtension()` behavior for direct one-way installs.

## Success Criteria

1. Hosts can install an extension through a lifecycle manager.
   - Verify unit tests install series, visual, drawing, drawing-tool, and figure contributions into registries.
2. Duplicate extension ids and duplicate contribution keys are rejected.
   - Verify unit tests cover both failure modes.
3. Hosts can inspect installed extensions without mutating Engine internals.
   - Verify lifecycle `listInstalled()` and `getState()` return cloned snapshots.
4. Hosts can uninstall a local extension and restore previous registry entries.
   - Verify unit tests install over existing entries and uninstall back to the prior entries.
5. Public SDK guards reflect the new lifecycle APIs intentionally.
   - Verify runtime and type API snapshots, package consumers, docs, and release gates are updated.

## Proposed Scope

1. Registry removal support
   - Add `get()` and `unregister()` where missing from drawing, drawing-tool, and figure registries.
   - Add `unregister()` to series and visual registries.

2. Extension lifecycle manager
   - Add `createChartExtensionLifecycle(context)`.
   - Track installed extension ids.
   - Track contribution ownership by registry kind and contribution type.
   - Capture previous registry entries before install.
   - Restore previous registry entries on uninstall when the installed contribution is still current.

3. SDK and docs
   - Update package runtime API snapshot and type API snapshot.
   - Extend runtime and type consumer fixtures.
   - Document extension lifecycle in platform extensibility docs and release docs.

## Validation Gate

Run before accepting this phase:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartExtension.test.ts packages/chart-engine/src/__tests__/seriesRegistry.test.ts packages/chart-engine/src/__tests__/visualRegistry.test.ts packages/chart-engine/src/__tests__/drawingToolRegistry.test.ts
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
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```
