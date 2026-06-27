# Chart Engine v1.0 Package Artifact Integrity Writing Plan

**Problem:** The v1.0 release gate runs `npm pack --dry-run`, but the tarball contents are reviewed manually. The Engine package needs a machine-checkable artifact gate that proves the package contains the expected runtime and declaration files while excluding source, tests, app code, and workspace-only files.

**Goal:** Add a package artifact integrity gate for `@simoncharts/chart-engine`. The gate should parse `npm pack --dry-run --json`, verify required files, reject forbidden paths, and become part of the release candidate validation path.

**Boundary:**
- Do not publish to npm.
- Do not add release automation.
- Do not change Engine runtime behavior.
- Do not include host app code, TradingReviewSystem code, app routes, stores, schemas, review, strategy, watchlist, AI, auth, account, billing, portfolio, or persistence services.
- Keep the package root as the only public SDK entrypoint.

## Success Criteria

1. Package artifact contents are machine-checkable.
   - Verify `npm run check:package-artifact` parses npm pack JSON and passes.
2. Required package files are enforced.
   - Verify the gate requires `README.md`, `package.json`, `dist/index.js`, `dist/index.d.ts`, and representative declaration files for extension lifecycle, registries, rendering, drawing, series, and visuals.
3. Forbidden package files are rejected.
   - Verify the gate rejects source files, tests, app files, docs outside package README, scripts, node_modules, and workspace config.
4. Release readiness includes the artifact gate.
   - Verify release docs, README files, testing strategy, and `check-release-readiness` include `check:package-artifact`.
5. Existing Engine validation remains green.
   - Verify full release gate still passes.

## Proposed Scope

1. Artifact script
   - Add `scripts/check-package-artifact.mjs`.
   - Run `npm pack --dry-run --json -w @simoncharts/chart-engine`.
   - Assert package name/version and required files.
   - Assert every file is `README.md`, `package.json`, or under `dist/`.
   - Reject source/test/workspace-only paths.

2. Release integration
   - Add `check:package-artifact` to root scripts.
   - Add it to `check-release-readiness` required scripts.
   - Add it to documented release gates.

3. Acceptance evidence
   - Record artifact file count and validation command results.

## Validation Gate

Run before accepting this phase:

```bash
npm run build
npm run check:package-artifact
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
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```
