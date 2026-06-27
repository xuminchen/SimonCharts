# Chart Engine v1.0 Release Candidate Writing Plan

**Problem:** SimonCharts Engine now has a broad independent kernel: chart series, static canvas rendering, interaction, drawing editor, persistence contracts, SDK guards, and extension registration. The remaining gap is release readiness. The package is still versioned as `0.9.0`, root-level documentation is missing, release evidence is spread across phase plans, and there is no single guard that verifies the package is ready to be consumed as a v1.0 release candidate.

**Goal:** Prepare `@simoncharts/chart-engine` as a host-independent `1.0.0-rc.0` package with clear package metadata, public documentation, release notes, a release readiness guard, and acceptance evidence. The RC must preserve the existing Engine boundary: no host app imports and no TradingReviewSystem business models.

**Boundary:**
- Engine code must not import TradingReviewSystem APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, or persistence services.
- Engine code must not import `apps/*`.
- Release metadata and documentation must describe SimonCharts Engine as an independent chart kernel, not as a TradingReviewSystem feature.
- v1.0 RC should not expand runtime feature scope unless needed to make the current Engine package consumable and verifiable.
- v1.0 RC should not add remote plugin loading, collaboration services, account persistence, cloud publishing, marketplace behavior, or host workflows.

## Success Criteria

1. The package clearly identifies itself as a v1.0 release candidate.
   - Verify `packages/chart-engine/package.json`, `apps/playground/package.json`, and `package-lock.json` use `1.0.0-rc.0` where appropriate.
2. External consumers can understand package purpose and root-import usage without reading phase plans.
   - Verify root `README.md` and package `packages/chart-engine/README.md` exist and document install, root imports, scope, and validation.
3. Release history and RC scope are explicit.
   - Verify `CHANGELOG.md` and `docs/engine/release-candidate.md` document `1.0.0-rc.0`, included capabilities, non-goals, gates, and residual risks.
4. Release readiness is machine-checkable.
   - Verify `npm run check:release-readiness` fails on missing required package metadata/docs/scripts and passes on the RC state.
5. Existing Engine contracts remain intact.
   - Verify the full release gate: tests, typecheck, boundary guard, public API guard, SDK import guard, consumer checks, build, package dry-run, and browser e2e.

## Proposed v1.0 RC Scope

1. Package identity
   - Advance `@simoncharts/chart-engine` to `1.0.0-rc.0`.
   - Add package metadata that does not claim an open-source license unless one exists.
   - Keep the package root as the only public SDK entrypoint.

2. Consumer documentation
   - Add root README for repository orientation.
   - Add package README for SDK consumers.
   - Keep examples neutral and free of host business objects.

3. Release documentation
   - Add changelog entry for `1.0.0-rc.0`.
   - Add release-candidate documentation that gathers scope, gates, and evidence.
   - Update testing strategy so the release readiness check is part of the RC gate.

4. Release readiness guard
   - Add a script that checks package version, metadata, root exports, required docs, and required root scripts.
   - Add the script to the root package scripts.

5. Acceptance evidence
   - Run the full gate.
   - Record final evidence in the implementation plan and release-candidate document.

## Validation Gate

Run before accepting v1.0 RC:

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
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```
