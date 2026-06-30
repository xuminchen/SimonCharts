# Chart Engine v1.0 Extension Lifecycle Rollback Writing Plan

**Problem:** `ChartExtensionLifecycle.install()` validates duplicate ids and contribution owner conflicts before registration, but registration itself can still fail after earlier contributions in the same extension were already registered. In that partial-failure case, the lifecycle does not create an installed record, yet earlier registry mutations may remain.

**Goal:** Make lifecycle install atomic from the Engine contract perspective: either all local contribution registry mutations succeed and the extension is recorded as installed, or any already-applied registry mutations are rolled back and lifecycle state remains unchanged.

**Boundary:** This is local lifecycle hardening only. It does not add remote plugin loading, sandboxing, trust policy, marketplace review, permissions, persistence, host workflows, or TradingReviewSystem integration. It must not import host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, product persistence, or product workflow modules.

## Contract

`createChartExtensionLifecycle(context).install(extension)` should:

- preserve existing successful install behavior and result shape
- preserve existing thrown error behavior for invalid manifests, duplicate extension ids, duplicate local contributions, and installed contribution conflicts
- restore registry entries already registered by the failed install attempt
- restore previous registry entries that were temporarily replaced by the failed install attempt
- leave `records`, `contributionOwners`, and `getState()` unchanged after failed registration
- keep `validateInstall(extension)` non-mutating and diagnostic-only

## Execution Slices

1. Atomic install rollback inside lifecycle install
   - Verify: focused unit tests simulate registry failures after one or more successful contribution registrations and assert registry/lifecycle state restoration.
2. SDK and documentation coverage
   - Verify: package-root consumer still exercises lifecycle install, duplicate preflight, uninstall, and release docs state atomic local rollback semantics.
3. Release evidence
   - Verify: focused tests plus public API/type guards, package consumer gates, engine boundary, build, and release readiness pass.

## Success Criteria

- A failing lifecycle install leaves no partial contribution installed by that attempt.
- A failing lifecycle install preserves pre-existing registry entries.
- A failing lifecycle install does not mark the extension installed and does not assign contribution owners.
- Public runtime API remains unchanged unless the implementation requires a deliberate contract addition.
- Engine remains host-independent and business-model-free.
