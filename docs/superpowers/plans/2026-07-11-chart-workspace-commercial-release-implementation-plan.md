# Chart Workspace Commercial Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the accepted workspace release candidate into an immutable, privately deliverable `@simoncharts/chart-workspace` `.tgz` backed by package, browser, performance, and real TradingReviewSystem evidence.

**Architecture:** Preserve the existing engine release gate and layer workspace-specific API, boundary, artifact, external-consumer, reference-host, and browser-evidence checks around it. The final pack command runs only after all gates and refuses to overwrite an existing versioned artifact.

**Tech Stack:** Node.js ESM scripts, npm pack/install, TypeScript compiler API, Vite, Vitest, Playwright, Chrome, Edge, Markdown integration docs.

## Global Constraints

- Phases 1–3 from `2026-07-11-chart-workspace-commercial-sdk-roadmap.md` must be green.
- The final public artifact is `@simoncharts/chart-workspace@1.0.0`; engine remains bundled internal implementation.
- Partner package root exports only the approved function/types and `./styles.css`.
- Tarball includes only README, package metadata, compiled JavaScript/declarations, CSS, and necessary runtime assets; no source, tests, apps, docs tree, build info, or credentials.
- Tarball has no runtime dependency or bare runtime import of `@simoncharts/chart-engine`.
- External consumers install the real `.tgz` into a repository-external temporary directory; workspace symlinks do not count.
- Browser release evidence covers desktop Chrome and Edge current and previous major versions, minimum width 1280 px.
- TradingReviewSystem acceptance uses its installed tarball and authenticated real-provider `/chart`, not the in-repo fixture.
- No runtime license key, domain/device lock, telemetry requirement, registry publish, or online validation is added.
- `npm pack` is manual/private and must refuse to overwrite an existing versioned file.
- Every task begins with a failing guard/test, ends with focused verification, and creates one reviewable commit.

---

## File Structure

### Create

- `scripts/check-workspace-boundary.mjs`
- `scripts/__tests__/check-workspace-boundary.test.mjs`
- `scripts/check-workspace-package-artifact.mjs`
- `scripts/check-workspace-package-consumer.mjs`
- `scripts/check-workspace-package-types.mjs`
- `scripts/fixtures/workspace-package-consumer-types.ts`
- `scripts/check-workspace-host-smoke.mjs`
- `scripts/check-commercial-release-gate.mjs`
- `scripts/__tests__/check-commercial-release-gate.test.mjs`
- `scripts/check-browser-evidence.mjs`
- `scripts/__tests__/check-browser-evidence.test.mjs`
- `scripts/pack-chart-workspace.mjs`
- `scripts/__tests__/pack-chart-workspace.test.mjs`
- `docs/workspace/integration.md`
- `docs/workspace/data-source-contract.md`
- `docs/workspace/testing-and-release.md`
- `docs/workspace/browser-support.md`
- `docs/workspace/release-candidate.json`

### Modify

- `package.json`, `package-lock.json`
- `.gitignore`
- `packages/chart-workspace/package.json`
- `packages/chart-workspace/README.md`
- `packages/chart-workspace/api-surface.json`
- `packages/chart-workspace/api-types.json`
- `scripts/check-public-api.mjs`
- `scripts/check-public-types.mjs`
- `scripts/check-sdk-imports.mjs`
- `scripts/__tests__/check-public-api.test.mjs`
- `scripts/__tests__/check-public-types.test.mjs`
- `scripts/__tests__/check-sdk-imports.test.mjs`
- `scripts/check-trading-review-host.mjs`
- `playwright.trading-review.config.ts`
- `tests/reference-host/trading-review-system.spec.ts`
- `README.md`, `CHANGELOG.md`
- `/Users/xuminchen/Desktop/TradingReviewSystem/package.json`, `/Users/xuminchen/Desktop/TradingReviewSystem/package-lock.json`
- `/Users/xuminchen/Desktop/TradingReviewSystem/vendor/simoncharts-chart-workspace-1.0.0.tgz`
- `/Users/xuminchen/Documents/Simon/30_Projects/SimonCharts/SimonCharts.md`

## Task 1: Workspace Boundary And Consumer Import Guards

**Files:**
- Create: `scripts/check-workspace-boundary.mjs`
- Create: `scripts/__tests__/check-workspace-boundary.test.mjs`
- Modify: `scripts/check-sdk-imports.mjs`
- Modify: `scripts/__tests__/check-sdk-imports.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `guard:workspace-boundary` and expanded `guard:sdk-imports`.
- Consumed by: commercial release gate.

- [ ] **Step 1: Write failing guard fixture tests**

Test the checker against temporary source strings and require these violations:

```js
expect(checkWorkspaceSource('import x from "../../../apps/playground/src/main"')).toContain("leaves packages/chart-workspace/src");
expect(checkWorkspaceSource('import x from "@/review/store"')).toContain("blocked business vocabulary");
expect(checkWorkspaceSource('import { createChartEngine } from "@simoncharts/chart-engine"')).toEqual([]);
expect(checkConsumerSource('import x from "@simoncharts/chart-workspace/internal"', "workspace")).toContain("workspace internal subpath");
expect(checkConsumerSource('import x from "packages/chart-workspace/src"', "workspace")).toContain("workspace source path");
expect(checkConsumerSource('import x from "@simoncharts/chart-engine"', "workspace")).toContain("engine import in workspace consumer");
expect(checkConsumerSource('import x from "@simoncharts/chart-engine"', "engine")).toEqual([]);
```

- [ ] **Step 2: Run and verify the guards are absent/incomplete**

```bash
npm run test -- scripts/__tests__/check-workspace-boundary.test.mjs scripts/__tests__/check-sdk-imports.test.mjs
```

Expected: FAIL because no workspace boundary checker exists and SDK guard only knows engine paths.

- [ ] **Step 3: Implement workspace source boundary rules**

Scan `.ts` files below `packages/chart-workspace/src`. Allow relative imports that remain under that root and the package-root engine import. Reject imports containing `apps/`, SimonCharts source paths outside the package, TradingReviewSystem, review, strategy, candidate, watchlist, auth, portfolio, provider SDKs, or package app names. Reuse the existing engine boundary scanner's source-location reporting rather than adding a parser dependency.

- [ ] **Step 4: Expand consumer import guard**

Use path-sensitive consumer profiles. The workspace-partner profile applies only to `apps/workspace-playground`, `scripts/fixtures/workspace-package-consumer-types.ts`, and `tests/reference-host`; it rejects:

```text
@simoncharts/chart-workspace/
packages/chart-workspace/src
@simoncharts/chart-engine
packages/chart-engine/src
```

Permit only the exact CSS specifier `@simoncharts/chart-workspace/styles.css` as an exception to the workspace subpath rule.

The engine profile applies to existing `apps/playground` and engine package-consumer fixtures: it may import `@simoncharts/chart-engine` from the package root, but still rejects engine source paths and workspace internal paths. Do not apply workspace-partner rules blindly to every app or fixture.

- [ ] **Step 5: Run guards**

```bash
npm run test -- scripts/__tests__/check-workspace-boundary.test.mjs scripts/__tests__/check-sdk-imports.test.mjs
npm run guard:workspace-boundary
npm run guard:sdk-imports
```

Expected: PASS with file/line/column diagnostics on injected failures.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-workspace-boundary.mjs scripts/__tests__/check-workspace-boundary.test.mjs scripts/check-sdk-imports.mjs scripts/__tests__/check-sdk-imports.test.mjs package.json
git commit -m "test(workspace): guard commercial package boundaries"
```

## Task 2: Freeze Workspace Runtime And Type API Snapshots

**Files:**
- Modify: `scripts/check-public-api.mjs`
- Modify: `scripts/check-public-types.mjs`
- Modify: `scripts/__tests__/check-public-api.test.mjs`
- Modify: `scripts/__tests__/check-public-types.test.mjs`
- Modify: `packages/chart-workspace/api-surface.json`
- Modify: `packages/chart-workspace/api-types.json`

**Interfaces:**
- Consumes: built package and source root entry.
- Produces: guarded public runtime/type names for engine and workspace.

- [ ] **Step 1: Write failing descriptor-loop tests**

Export package descriptors from both scripts and assert:

```js
expect(publicApiPackages.map((item) => item.name)).toEqual([
  "@simoncharts/chart-engine",
  "@simoncharts/chart-workspace"
]);
expect(publicTypePackages.map((item) => item.entry)).toContain("packages/chart-workspace/src/index.ts");
```

- [ ] **Step 2: Run and verify scripts only cover engine**

```bash
npm run test -- scripts/__tests__/check-public-api.test.mjs scripts/__tests__/check-public-types.test.mjs
```

Expected: FAIL because current scripts hard-code one engine descriptor.

- [ ] **Step 3: Refactor both scripts to iterate exact descriptors**

Use:

```js
export const publicApiPackages = [
  { name: "@simoncharts/chart-engine", snapshot: "packages/chart-engine/api-surface.json" },
  { name: "@simoncharts/chart-workspace", snapshot: "packages/chart-workspace/api-surface.json" }
];

export const publicTypePackages = [
  { entry: "packages/chart-engine/src/index.ts", snapshot: "packages/chart-engine/api-types.json" },
  { entry: "packages/chart-workspace/src/index.ts", snapshot: "packages/chart-workspace/api-types.json" }
];
```

Keep `--write`, sorted output, added/removed diagnostics, and nonzero exit behavior per package.

- [ ] **Step 4: Write intentional workspace snapshots and inspect them**

```bash
npm run build
node scripts/check-public-api.mjs --write
node scripts/check-public-types.mjs --write
```

Expected workspace runtime snapshot contains exactly `createChartWorkspace` plus any intentionally exported runtime error-code constants; type snapshot contains only approved specification contracts and no engine/internal names.

- [ ] **Step 5: Run guards**

```bash
npm run guard:public-api
npm run guard:public-types
```

Expected: PASS for both packages.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-public-api.mjs scripts/check-public-types.mjs scripts/__tests__/check-public-api.test.mjs scripts/__tests__/check-public-types.test.mjs packages/chart-workspace/api-surface.json packages/chart-workspace/api-types.json
git commit -m "test(workspace): freeze the partner API surface"
```

## Task 3: Tarball File And Metadata Integrity

**Files:**
- Create: `scripts/check-workspace-package-artifact.mjs`
- Modify: `package.json`
- Test: add focused assertions in `scripts/__tests__/check-release-readiness.test.mjs`

**Interfaces:**
- Consumes: `npm pack --dry-run --json` for workspace.
- Produces: `check:workspace-package-artifact`.

- [ ] **Step 1: Write failing metadata assertions**

Require:

```js
expect(packageJson.name).toBe("@simoncharts/chart-workspace");
expect(packageJson.version).toBe("1.0.0-rc.0");
expect(packageJson.license).toBe("UNLICENSED");
expect(packageJson.dependencies).toBeUndefined();
expect(packageJson.exports["./styles.css"]).toBe("./dist/styles.css");
```

- [ ] **Step 2: Implement exact artifact allowlist**

Run `npm pack --dry-run --json -w @simoncharts/chart-workspace` and require:

```js
const requiredFiles = new Set([
  "README.md",
  "package.json",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/styles.css"
]);
```

Every other file must be under `dist/` and must not contain `src/`, `__tests__`, `apps/`, `scripts/`, `docs/`, `node_modules`, source `.ts` other than `.d.ts`, source maps unless explicitly enabled, or `.tsbuildinfo`. Assert `bundled` is empty, runtime/declaration/CSS are nonempty, and the tarball has no runtime dependencies.

Read `dist/index.js` and assert it contains neither `from "@simoncharts/chart-engine"` nor `require("@simoncharts/chart-engine")`.

- [ ] **Step 3: Run the artifact check**

```bash
npm run build -w @simoncharts/chart-workspace
npm run check:workspace-package-artifact
npm pack --dry-run -w @simoncharts/chart-workspace
```

Expected: PASS with package/version/file count summary.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-workspace-package-artifact.mjs scripts/__tests__/check-release-readiness.test.mjs package.json
git commit -m "test(workspace): verify commercial tarball contents"
```

## Task 4: Real Tarball Type Consumer

**Files:**
- Create: `scripts/fixtures/workspace-package-consumer-types.ts`
- Create: `scripts/check-workspace-package-types.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: workspace root declarations from a temporary installed tarball.
- Produces: `check:workspace-package-types`.

- [ ] **Step 1: Create the complete external type fixture**

The fixture imports only package root types and implements:

```ts
import {
  createChartWorkspace,
  type ChartSymbol,
  type ChartWorkspaceDataSource,
  type SeriesPage,
  type SeriesRequest
} from "@simoncharts/chart-workspace";

const symbol: ChartSymbol = {
  id: "stock:SSE:600000",
  code: "600000",
  name: "浦发银行",
  exchange: "SSE",
  kind: "stock"
};

const dataSource: ChartWorkspaceDataSource = {
  async searchSymbols(query, signal) {
    signal.throwIfAborted();
    return query ? [symbol] : [];
  },
  async loadSeries(request: SeriesRequest, signal): Promise<SeriesPage> {
    signal.throwIfAborted();
    return {
      candles: [{ time: 1, open: 10, high: 11, low: 9, close: 10.5, volume: 1, turnover: 10.5 }],
      hasMoreBefore: false,
      dataVersion: `${request.symbol.id}:${request.timeframe}:${request.adjustMode}`
    };
  }
};

declare const container: HTMLElement;
const workspace = createChartWorkspace(container, { workspaceId: "consumer", initialSymbol: symbol, dataSource });
workspace.setTimeframe("1m");
workspace.setAdjustMode("backward");
workspace.destroy();
```

- [ ] **Step 2: Implement tarball install and isolated `tsc`**

The script packs to an OS temp directory, creates a temp host `package.json`, installs the tarball with scripts/audit/fund disabled, copies the fixture, and invokes the repository TypeScript binary with `--strict --moduleResolution Bundler --target ES2022 --noEmit`. Assert installed workspace path is not a symlink and no engine package is installed.

- [ ] **Step 3: Run the check**

```bash
npm run check:workspace-package-types
```

Expected: PASS and temp directory is removed in `finally`.

- [ ] **Step 4: Commit**

```bash
git add scripts/fixtures/workspace-package-consumer-types.ts scripts/check-workspace-package-types.mjs package.json
git commit -m "test(workspace): compile an isolated tarball consumer"
```

## Task 5: Real Tarball Browser Host Smoke

**Files:**
- Create: `scripts/check-workspace-package-consumer.mjs`
- Create: `scripts/check-workspace-host-smoke.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: packed artifact, root Vite and Playwright installations.
- Produces: isolated build smoke and live browser smoke using installed package JS/CSS.

- [ ] **Step 1: Implement isolated Vite build consumer**

Pack/install into a temp host. Generate `index.html` and `src/main.ts` from fixed strings. `main.ts` imports package root and CSS, creates a deterministic one-page data source, and mounts the workspace. Invoke the root `node_modules/vite/bin/vite.js build` with temp cwd.

Assert build output contains JS and CSS and source files contain no engine/import-internal path.

- [ ] **Step 2: Implement browser smoke on the same temp host**

Start Vite preview on an available loopback port. Launch Playwright Chromium, navigate, wait for `.sc-workspace[data-state="ready"]`, and assert:

```js
await page.locator(".sc-workspace").waitFor();
if (await page.locator(".sc-chart-region canvas").count() !== 2) throw new Error("expected two chart canvases");
if ((await page.locator(".sc-right-sidebar").count()) !== 0) throw new Error("unexpected right sidebar");
if (pageErrors.length > 0 || consoleErrors.length > 0) throw new Error("browser errors detected");
```

Call the exposed smoke destroy action and assert `.sc-workspace` is removed. Stop preview and remove temp directory in `finally`.

- [ ] **Step 3: Run both smoke checks**

```bash
npm run check:workspace-package-consumer
npm run check:workspace-host-smoke
```

Expected: PASS from a non-symlink real tarball installation.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-workspace-package-consumer.mjs scripts/check-workspace-host-smoke.mjs package.json
git commit -m "test(workspace): smoke test the installed tarball"
```

## Task 6: Expand The Automated TradingReviewSystem Reference Host Gate

**Files:**
- Modify: `playwright.trading-review.config.ts`
- Modify: `tests/reference-host/trading-review-system.spec.ts`
- Modify: `scripts/check-trading-review-host.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: externally running authenticated TRS frontend/backend and environment credentials.
- Produces: `check:trading-review-host`.

- [ ] **Step 1: Extend the Phase 3 config for release executables**

Use:

```ts
const baseURL = process.env.TRADING_REVIEW_FRONTEND_URL;
if (!baseURL) throw new Error("TRADING_REVIEW_FRONTEND_URL is required");

export default defineConfig({
  testDir: "tests/reference-host",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : process.env.PLAYWRIGHT_CHANNEL
        ? { channel: process.env.PLAYWRIGHT_CHANNEL }
        : {})
  }
});
```

Keep the Phase 3 environment validation and do not start or mutate the host from this config.

- [ ] **Step 2: Expand authenticated core assertions to the full matrix**

Require `TRADING_REVIEW_USERNAME` and `TRADING_REVIEW_PASSWORD`; log in through the real login form, navigate `/chart`, and assert the installed package UI. Use host API responses/request logs to cover search, initial page, earlier cursor, all eight stock timeframes under `none/forward/backward`, all eight index timeframes under `none`, index adjustment normalization, and safe unsupported-combination errors outside that approved matrix. Exercise one chart of each 17 types, all 16 indicators, all 63 drawing tools, all 3 scales, persistence reload, and navigation away cleanup. Any approved combination returning `CHART_COMBINATION_UNAVAILABLE` fails the release gate.

Collect `pageerror` and console `error`; final assertion requires both arrays empty. Verify no network request contains `fake`, `fixture`, or a SimonCharts source path.

- [ ] **Step 3: Implement the wrapper command**

Keep `check-trading-review-host.mjs` as the single wrapper; extend its validation for channel/executable selection, then spawn:

```text
npx playwright test --config=playwright.trading-review.config.ts
```

It exits with the child status and prints no credentials.

- [ ] **Step 4: Run against the local real host**

```bash
TRADING_REVIEW_FRONTEND_URL=http://127.0.0.1:3000 \
TRADING_REVIEW_USERNAME="$TRADING_REVIEW_USERNAME" \
TRADING_REVIEW_PASSWORD="$TRADING_REVIEW_PASSWORD" \
PLAYWRIGHT_CHANNEL=chrome \
npm run check:trading-review-host
```

Expected: PASS with real provider data and zero browser errors. If the configured provider lacks a required exact combination, this gate remains red; do not substitute fixture data.

- [ ] **Step 5: Commit**

```bash
git add playwright.trading-review.config.ts tests/reference-host/trading-review-system.spec.ts scripts/check-trading-review-host.mjs package.json
git commit -m "test(workspace): add the real host acceptance gate"
```

## Task 7: Chrome And Edge Current/Previous Evidence

**Files:**
- Create: `docs/workspace/browser-support.md`
- Modify: `scripts/check-commercial-release-gate.mjs` in Task 8.

**Interfaces:**
- Produces: four browser-version evidence entries tied to the exact workspace package version.

- [ ] **Step 1: Create the evidence schema**

Use a Markdown table with exact columns:

```markdown
| Browser | Major | Channel/Executable | Package | Workspace E2E | TRS Host | Date |
|---|---:|---|---|---|---|---|
```

Required rows are Chrome current, Chrome previous, Edge current, Edge previous. No `latest`, `N/A`, or “manual smoke” value passes.

- [ ] **Step 2: Run current installed channels**

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:workspace:e2e
PLAYWRIGHT_CHANNEL=msedge npm run test:workspace:e2e
```

Expected: PASS; record detected major versions.

- [ ] **Step 3: Run previous-major executables supplied by release environment**

```bash
PLAYWRIGHT_EXECUTABLE_PATH="$CHROME_PREVIOUS_EXECUTABLE" npm run test:workspace:e2e
PLAYWRIGHT_EXECUTABLE_PATH="$EDGE_PREVIOUS_EXECUTABLE" npm run test:workspace:e2e
```

Update Playwright config to use `executablePath` when this environment variable is set. Expected: PASS; record exact majors and executable identifiers without machine secrets.

- [ ] **Step 4: Run TRS host gate for the same four browsers**

Repeat `check:trading-review-host` with current channels and previous executable paths. Read the expected version from `packages/chart-workspace/package.json`; record PASS only when the evidence package value and installed host dependency both equal that exact current version. Task 9 reruns and replaces the RC evidence after the stable bump.

- [ ] **Step 5: Commit evidence**

```bash
git add docs/workspace/browser-support.md playwright.config.ts playwright.trading-review.config.ts
git commit -m "test(workspace): record supported browser evidence"
```

## Task 8: Deterministic Commercial Release Orchestrator

**Files:**
- Create: `scripts/check-commercial-release-gate.mjs`
- Create: `scripts/__tests__/check-commercial-release-gate.test.mjs`
- Create: `scripts/check-browser-evidence.mjs`
- Create: `scripts/__tests__/check-browser-evidence.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: every prior engine/workspace/host/browser check.
- Produces: one `check:commercial-release-gate` command.

- [ ] **Step 1: Write the failing exact-sequence test**

Assert this order:

```js
expect(commercialReleaseSteps.map(formatStep)).toEqual([
  "npm run check:release-gate",
  "npm run guard:workspace-boundary",
  "npm run guard:public-api",
  "npm run guard:public-types",
  "npm run guard:sdk-imports",
  "npm run test -- packages/chart-workspace/src/__tests__",
  "npm run build",
  "PLAYWRIGHT_CHANNEL=chrome npm run test:workspace:e2e",
  "PLAYWRIGHT_CHANNEL=msedge npm run test:workspace:e2e",
  "npm run check:workspace-package-types",
  "npm run check:workspace-package-consumer",
  "npm run check:workspace-host-smoke",
  "npm run check:workspace-package-artifact",
  "npm pack --dry-run -w @simoncharts/chart-workspace",
  "PLAYWRIGHT_CHANNEL=chrome npm run check:trading-review-host",
  "node scripts/check-browser-evidence.mjs"
]);
```

- [ ] **Step 2: Add the missing browser-evidence checker**

Create `scripts/check-browser-evidence.mjs` that parses the table, requires exactly the four browser/major combinations, requires all result columns `PASS`, reads the expected package version from `packages/chart-workspace/package.json`, and requires every row date to equal the required `RELEASE_RUN_DATE=YYYY-MM-DD` environment value. Export a pure parser for focused tests; do not hard-code an RC/stable version or infer the date from local timezone.

- [ ] **Step 3: Implement fail-fast orchestration**

Follow the existing `check-release-gate.mjs` spawn pattern. Print numbered commands, inherit stdio/environment, stop at first nonzero child, and print `[commercial-release-gate] passed.` only after all steps.

- [ ] **Step 4: Run sequence tests and the RC gate**

```bash
npm run test -- scripts/__tests__/check-commercial-release-gate.test.mjs scripts/__tests__/check-browser-evidence.test.mjs
RELEASE_RUN_DATE="$RELEASE_RUN_DATE" npm run check:commercial-release-gate
```

Expected: sequence tests pass; full gate passes only with a valid release date, host credentials/provider, and four-browser evidence available.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-commercial-release-gate.mjs scripts/check-browser-evidence.mjs scripts/__tests__/check-commercial-release-gate.test.mjs scripts/__tests__/check-browser-evidence.test.mjs package.json
git commit -m "build(workspace): orchestrate the commercial release gate"
```

## Task 9: Partner Documentation And Stable Version

**Files:**
- Create: `docs/workspace/integration.md`
- Create: `docs/workspace/data-source-contract.md`
- Create: `docs/workspace/testing-and-release.md`
- Modify: `packages/chart-workspace/README.md`
- Modify: `packages/chart-workspace/package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: all release-check expected versions and browser evidence package column.
- Create: `docs/workspace/release-candidate.json`
- Create: `/Users/xuminchen/Desktop/TradingReviewSystem/vendor/simoncharts-chart-workspace-1.0.0.tgz`
- Delete: `/Users/xuminchen/Desktop/TradingReviewSystem/vendor/simoncharts-chart-workspace-1.0.0-rc.0.tgz` after the lockfile no longer references it.
- Modify: `/Users/xuminchen/Desktop/TradingReviewSystem/package.json`
- Modify: `/Users/xuminchen/Desktop/TradingReviewSystem/package-lock.json`
- Modify: `/Users/xuminchen/Documents/Simon/30_Projects/TradingReviewSystem/TradingReviewSystem.md`

**Interfaces:**
- Produces: partner installation/integration/data/error/lifecycle documentation, stable `1.0.0` metadata, and a real stable candidate installed by the reference host.

- [ ] **Step 1: Write partner quick start from the approved API**

Document only local tarball install, CSS import, `ChartWorkspaceDataSource`, `createChartWorkspace`, and `destroy`. Use a complete copy/paste example with one real host fetch adapter; no engine imports, registry publish, license key, or provider recommendation.

- [ ] **Step 2: Document exact data and error contracts**

Include atomic page rules, cursor progression, version restart, A-share/index adjustment rules, safe errors, no synthetic candles, storage namespaces, drawing scope, and AbortSignal behavior. Include the official provider limitation links only as reference-host evidence, not as SDK dependencies.

- [ ] **Step 3: Bump only the partner package to stable**

Change workspace version to `1.0.0`, update the SimonCharts lockfile and any literal artifact/readiness expectations, and keep version-reading guards dynamic. Do not publish or modify the engine package version in this task. Clear the RC browser evidence rows now; stale RC results must not pass as stable evidence.

- [ ] **Step 4: Pack the stable candidate directly into TradingReviewSystem**

Run:

```bash
cd /Users/xuminchen/Desktop/SimonCharts
npm install --package-lock-only
npm run build -w @simoncharts/chart-workspace
npm pack -w @simoncharts/chart-workspace --pack-destination /Users/xuminchen/Desktop/TradingReviewSystem/vendor

cd /Users/xuminchen/Desktop/TradingReviewSystem
npm install ./vendor/simoncharts-chart-workspace-1.0.0.tgz --save-exact
node -e 'const p=require("./node_modules/@simoncharts/chart-workspace/package.json"); if(p.version!=="1.0.0") process.exit(1)'
test ! -L node_modules/@simoncharts/chart-workspace
if rg -n '1\.0\.0-rc\.0' package.json package-lock.json; then exit 1; fi
```

Expected: package/lock reference only `file:vendor/simoncharts-chart-workspace-1.0.0.tgz`; the final `rg` returns no matches. Only then remove the earlier plan-created `vendor/simoncharts-chart-workspace-1.0.0-rc.0.tgz`. Preserve and never stage `src/app/globals.css`.

Commit the host artifact transition separately:

```bash
git add vendor/simoncharts-chart-workspace-1.0.0.tgz package.json package-lock.json
git add -u vendor/simoncharts-chart-workspace-1.0.0-rc.0.tgz
git commit -m "build(chart): install stable workspace candidate"
```

Compute `candidateSha512` from `shasum -a 512` and `hostCommit` from `git rev-parse HEAD`. Using `apply_patch`, create `docs/workspace/release-candidate.json` as the JSON serialization of this execution-time object:

```js
const evidence = {
  package: "@simoncharts/chart-workspace",
  version: "1.0.0",
  filename: "simoncharts-chart-workspace-1.0.0.tgz",
  candidatePath: "/Users/xuminchen/Desktop/TradingReviewSystem/vendor/simoncharts-chart-workspace-1.0.0.tgz",
  sha512: candidateSha512,
  tradingReviewSystemCommit: hostCommit
};
```

Reject the committed JSON if either execution-time value is absent or not the expected fixed-length lowercase hex.

- [ ] **Step 5: Rebuild stable browser and real-host evidence**

Repeat all four workspace E2E and all four authenticated TRS host runs from Task 7 using Chrome current/previous and Edge current/previous. Every row must report package `1.0.0`, the host must resolve installed version `1.0.0`, and the configured authorized provider must cover the approved exact matrix; otherwise stop with the release gate red. Replace, rather than append to, the RC evidence rows.

Then run:

```bash
cd /Users/xuminchen/Desktop/SimonCharts
npm run build
npm run check:workspace-package-artifact
npm run check:workspace-package-types
npm run check:workspace-host-smoke
node scripts/check-browser-evidence.mjs
npm run check:commercial-release-gate
rg -n '@simoncharts/chart-engine|npm publish|license key' packages/chart-workspace/README.md docs/workspace
```

Expected: stable package, external consumer, four-browser evidence, and real host all pass. The final documentation search has no matches except explicit statements that engine imports, registry publication, and runtime license keys are not required.

Update the TradingReviewSystem vault document with the stable installed filename/version, exact browser evidence, provider capabilities, and preserved `globals.css` change. The vault file is outside both Git repositories.

- [ ] **Step 6: Commit SimonCharts stable metadata and documentation**

```bash
git add packages/chart-workspace/README.md packages/chart-workspace/package.json package-lock.json README.md CHANGELOG.md docs/workspace
git commit -m "docs(workspace): prepare the 1.0.0 partner release"
```

## Task 10: Immutable Manual `.tgz` Creation And Final Evidence

**Files:**
- Create: `scripts/pack-chart-workspace.mjs`
- Create: `scripts/__tests__/pack-chart-workspace.test.mjs`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `/Users/xuminchen/Documents/Simon/30_Projects/SimonCharts/SimonCharts.md`

**Interfaces:**
- Consumes: stable metadata, the committed/TRS-tested candidate evidence, and a green commercial release gate.
- Produces: a byte-identical promotion at `dist/packages/simoncharts-chart-workspace-1.0.0.tgz` without registry publication.

- [ ] **Step 1: Write pack-script refusal tests**

Export `assertArtifactDoesNotExist(path)` and test that an existing path throws:

```js
await expect(assertArtifactDoesNotExist(existingTarball)).rejects.toThrow("Refusing to overwrite existing artifact");
```

- [ ] **Step 2: Implement build-gate-pack flow**

`pack-chart-workspace.mjs` must:

1. Read package name/version and require `@simoncharts/chart-workspace@1.0.0`.
2. Parse `docs/workspace/release-candidate.json`; verify package/version, candidate filename/SHA-512, `git -C /Users/xuminchen/Desktop/TradingReviewSystem ls-files --error-unmatch` for the candidate, a clean candidate diff against the recorded TRS commit, and that the commit equals/descends from the recorded evidence commit.
3. Derive the exact final destination and refuse immediately if that versioned file already exists.
4. Run `npm run check:commercial-release-gate` with no bypass flag.
5. Pack the current workspace into an OS temporary directory, extract both temporary tarball and TRS candidate, and compare sorted entry paths plus SHA-512 of every extracted file. Any difference fails and removes the temporary pack; it never promotes untested bytes.
6. Create `dist/packages` and copy the already host-tested candidate bytes to the exact final destination with exclusive-create semantics.
7. Verify final SHA-512 equals the recorded candidate SHA-512 and final bytes equal the candidate.
8. Print the absolute artifact path and hash; never publish or copy it elsewhere.

Add `dist/packages/` to `.gitignore` and root script `pack:workspace`.

- [ ] **Step 3: Run the pack-script tests**

After TRS has installed the stable tarball candidate and browser evidence is updated:

```bash
npm run test -- scripts/__tests__/pack-chart-workspace.test.mjs
```

Expected: PASS for evidence/version validation, exact filename calculation, normalized tar-content comparison, hash mismatch failure, and refusal on an existing artifact.

- [ ] **Step 4: Create the immutable artifact**

```bash
npm run pack:workspace
```

Expected: the command first reruns the complete stable commercial gate, proves current source-pack content equals the committed/TRS-tested candidate, then promotes those exact candidate bytes to `dist/packages/simoncharts-chart-workspace-1.0.0.tgz`; a second identical command fails before packing rather than overwriting it.

- [ ] **Step 5: Update SimonCharts vault document**

Record stable version, absolute artifact path, completed gate commands, exact browser majors, TRS host version/provider capability evidence, distribution boundary, and the fact that no runtime license system was added.

- [ ] **Step 6: Commit scripts/docs, not the generated tarball**

```bash
git add scripts/pack-chart-workspace.mjs scripts/__tests__/pack-chart-workspace.test.mjs .gitignore package.json
git commit -m "build(workspace): finalize private tgz delivery"
```

The vault file is outside the repository; update it separately and stage only the four repository paths above. Confirm `git status --short` contains no unexpected source changes and the ignored tarball is not staged.

## Final Acceptance

- Engine and workspace gates pass from a clean checkout.
- Real tarball JS, declarations, CSS, and browser runtime pass outside the monorepo with no symlink or engine installation.
- TRS `/chart` consumes bytes whose SHA-512 is identical to the final stable artifact and uses real provider data.
- Chrome/Edge current and previous major evidence is recorded for the exact stable version.
- The artifact contains only allowed partner files, is `UNLICENSED`, and has no online/runtime licensing mechanism.
- Re-running the pack command cannot overwrite the delivered version.
- Final output is the manually distributable `dist/packages/simoncharts-chart-workspace-1.0.0.tgz`.
