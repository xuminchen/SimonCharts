# Chart Engine v1.0 Type API Freeze Writing Plan

**Problem:** SimonCharts Engine has a runtime public API snapshot (`api-surface.json`) and an external type consumer fixture, but there is no complete snapshot of package-root TypeScript symbols. A type-only export can be added or removed without changing runtime exports, and a narrow fixture may not cover the affected symbol.

**Goal:** Add a dedicated type API freeze gate for `@simoncharts/chart-engine`. The gate should snapshot all package-root TypeScript symbols resolved by the TypeScript checker, fail on unintentional drift, and become part of the v1.0 RC release gate.

**Boundary:**
- Do not add, remove, or rename Engine runtime APIs in this phase.
- Do not import host application APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, or persistence services.
- Do not replace the runtime API guard; this adds type-symbol coverage beside it.
- Do not make internal package subpaths public.

## Success Criteria

1. Public type symbols are snapshotted.
   - Verify `packages/chart-engine/api-types.json` exists and is sorted.
2. Public type drift is machine-checkable.
   - Verify `npm run guard:public-types` compares TypeScript checker exports against the snapshot.
3. Runtime and type API guards are both part of the release gate.
   - Verify docs and release readiness include `guard:public-types`.
4. Existing SDK behavior remains intact.
   - Verify tests, typecheck, runtime API guard, type guard, SDK import guard, consumer checks, release readiness, build, pack, and e2e still pass.

## Proposed Scope

1. Type export snapshot
   - Add `packages/chart-engine/api-types.json`.
   - Include package-root symbols resolved from `packages/chart-engine/src/index.ts`.

2. Type API guard
   - Add `scripts/check-public-types.mjs`.
   - Use the TypeScript compiler API to resolve exported symbols.
   - Support an explicit `--write` mode for intentional snapshot updates.

3. Release integration
   - Add `guard:public-types` to root scripts.
   - Add the script to release readiness required scripts.
   - Update public API, testing, README, package README, and release docs.

## Validation Gate

Run before accepting this phase:

```bash
npm run guard:public-types
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-types
npm run check:performance
npm run check:release-readiness
npm run build
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```
