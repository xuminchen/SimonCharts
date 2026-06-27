# Chart Engine v0.5 TradingReviewSystem Pilot Implementation Plan

**Goal:** Prove `@simoncharts/chart-engine` can be consumed by the first host app, TradingReviewSystem, without coupling the engine to host business models.

**Boundary:** All TradingReviewSystem changes live in `/Users/xuminchen/Desktop/TradingReviewSystem`. `packages/chart-engine` must not import TradingReviewSystem APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, or persistence services.

## Task 1: Host Dependency

**Files:**
- Create: `/Users/xuminchen/Desktop/TradingReviewSystem/.npmrc`
- Modify: `/Users/xuminchen/Desktop/TradingReviewSystem/package.json`
- Modify: `/Users/xuminchen/Desktop/TradingReviewSystem/package-lock.json`

**Steps:**
1. Add `@simoncharts/chart-engine` as a local file dependency pointing at the built SimonCharts package.
2. Configure npm to install local file dependencies as regular packages instead of symlinks.
3. Keep TradingReviewSystem imports limited to the package root.

**Verification:**
- `npm install`
- `rg '@simoncharts/chart-engine/' /Users/xuminchen/Desktop/TradingReviewSystem/src` returns no matches.

## Task 2: Market Page Pilot Adapter

**Files:**
- Create: `/Users/xuminchen/Desktop/TradingReviewSystem/src/components/SimonChartsMarketPanel.tsx`
- Modify: `/Users/xuminchen/Desktop/TradingReviewSystem/src/components/MarketReviewContent.tsx`
- Modify: `/Users/xuminchen/Desktop/TradingReviewSystem/src/app/globals.css`

**Steps:**
1. Add a client component that adapts `MarketSummary` into neutral `CandleSeries`.
2. Render the chart with `resizeCanvas()`, `createChartLayout()`, `createInitialViewport()`, and `renderStaticChart()`.
3. Use `serializeChartLayoutSnapshot()` to verify the host can persist neutral layout state without engine access to host persistence.
4. Insert the panel into the market review page without changing backend APIs.

**Verification:**
- `npm run lint`
- `npm run build`
- Browser check: `/market` displays a nonblank SimonCharts canvas and no console errors.

## Task 3: Boundary And Acceptance

**Files:**
- Modify: this plan with acceptance evidence.

**Steps:**
1. Re-run SimonCharts engine boundary guard after host changes.
2. Verify TradingReviewSystem builds with the package dependency.
3. Verify UI at desktop and mobile widths.

**Verification:**
- `npm run guard:engine-boundary` in `/Users/xuminchen/Desktop/SimonCharts`
- `npm run build` in `/Users/xuminchen/Desktop/TradingReviewSystem`
- Browser canvas pixel check on TradingReviewSystem `/market`

## Acceptance Evidence

Completed on 2026-06-27:

- TradingReviewSystem `npm install` completed with `@simoncharts/chart-engine` local package dependency.
- `.npmrc` uses `install-links=true`, so `node_modules/@simoncharts/chart-engine` installs as a package copy with `dist/index.js` and `dist/index.d.ts` instead of a symlink.
- TradingReviewSystem `npm run lint` passed.
- TradingReviewSystem `npm run build` passed.
- SimonCharts `npm run guard:engine-boundary` passed: 139 engine files scanned.
- TradingReviewSystem source imports `@simoncharts/chart-engine` only from the package root.
- Production browser check on `http://127.0.0.1:3000/market` passed after login:
  - SimonCharts canvas rendered at 998 x 260.
  - Canvas non-white pixel count was 27902.
  - Desktop page overflow was 0.
  - Mobile 390px page overflow was 0.
  - Console/page errors were 0.
