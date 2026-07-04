# Chart Engine v1.0 Release Evidence Refresh Writing Plan

**Problem:** The current RC acceptance evidence still says it was refreshed on 2026-07-01. After adding the release gate orchestrator, the evidence should be refreshed from the single gate on 2026-07-04.

**Goal:** Run `npm run check:release-gate` and update the current acceptance evidence to the latest verified date and gate shape.

**Boundary:** Documentation and evidence only. Do not change Engine runtime APIs, chart behavior, drawing behavior, extension behavior, package metadata, package publication, host workflows, or TradingReviewSystem integration.

## Contract

The refreshed evidence should:

- keep the expanded command results visible
- state that `npm run check:release-gate` passed
- use the 2026-07-04 date for the current acceptance evidence
- keep historical focused evidence sections unchanged

## Success Criteria

- `npm run check:release-gate` passes.
- `docs/engine/release-candidate.md` current evidence reflects 2026-07-04 and the release gate orchestrator.
- No public API/type snapshots change.
- Engine boundary remains clean.
