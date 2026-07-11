# SimonCharts Commercial Workspace SDK Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each linked plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved private commercial `@simoncharts/chart-workspace` `.tgz`, with a complete browser workbench and TradingReviewSystem `/chart` as the first real host.

**Architecture:** Complete the host-neutral engine contracts first, build the framework-neutral workspace package second, integrate only the packed artifact into TradingReviewSystem third, then freeze the commercial artifact and release evidence. Each phase has its own acceptance gate and must leave working, reviewable software before the next phase starts.

**Tech Stack:** TypeScript 5.5, Canvas 2D, Vite 5, Vitest 1.6, Playwright, npm workspaces, Next.js 16, React 19, FastAPI, SQLAlchemy, Pydantic, pytest.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-11-chart-workspace-commercial-sdk-design.md`.
- Partner-facing package: `@simoncharts/chart-workspace`; partners must not import engine internals.
- Market scope: A-share stocks plus major indexes; no ETF or other asset classes.
- Timeframes: `1m`, `5m`, `15m`, `30m`, `60m`, `1d`, `1w`, `1mo`.
- Stock adjustment modes: `none`, `forward`, `backward`; stock default is `forward`.
- Index adjustment mode: `none` only; invalid index adjustment is normalized without a request or error.
- Product capability: 17 chart types, 16 built-in indicators, and all 63 built-in drawing tools.
- Price scales: `linear`, `log`, and `percentage`; default is `linear`.
- Data must come from the host data source exactly as requested; never synthesize, interpolate, repair, or fill candles.
- History is cursor-paged and continuously accessible; candle payload cache and engine materialization remain bounded.
- Persistence is browser `localStorage` only for layout, UI preferences, indicators, and drawings; never persist candle history or credentials.
- UI layout: compact top toolbar, one uninterrupted chart area, floating draggable/collapsible drawing palette, horizontal bottom object/property/data panel, no permanent right sidebar.
- Styling: no Shadow DOM; root `.sc-workspace`, internal `sc-` class prefix, documented CSS variables, dark terminal defaults.
- Browser scope: desktop Chrome and Edge current and previous major versions; minimum width 1280 px.
- Performance: response-to-usable-frame at most 100 ms excluding network; pan/zoom/crosshair p95 at most 16.7 ms; crosshair movement must not redraw static layers.
- Distribution: manually delivered immutable versioned `.tgz`, `UNLICENSED`, no runtime key, domain lock, device lock, or online license check.
- Preserve unrelated worktree changes. In particular, do not modify `/Users/xuminchen/Desktop/TradingReviewSystem/src/app/globals.css` while its current user change is uncommitted.
- Every implementation task follows red-green-refactor, ends with focused verification, and creates one reviewable commit.

---

## Execution Sequence

### Phase 1: Engine Product Readiness

Plan: `docs/superpowers/plans/2026-07-11-chart-workspace-engine-readiness-implementation-plan.md`

Exit gate:

```bash
npm run test -- packages/chart-engine/src/__tests__
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run check:release-gate
```

Required result: all eight timeframes, three price scales, complete chart commands, exact chunk checkpoints for 16 indicators and five stateful derived chart types, continuous drawing lifecycle, and domain/screen drawing projection pass the existing engine release gate.

### Phase 2: Complete Workspace Package

Plan: `docs/superpowers/plans/2026-07-11-chart-workspace-sdk-implementation-plan.md`

Entry condition: Phase 1 commit is green.

Exit gate:

```bash
npm run test -- packages/chart-workspace/src/__tests__
npm run typecheck
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:workspace:e2e
```

Required result: the public API, data coordinator, bounded store, persistence, runtime, complete UI, 17/16/63 capability matrix, error states, and performance fixtures work in the in-repo harness.

### Phase 3: TradingReviewSystem Reference Host

Plan: `docs/superpowers/plans/2026-07-11-chart-workspace-trading-review-system-implementation-plan.md`

Entry condition: a Phase 2 release-candidate `.tgz` exists; the host must install that artifact, not a source directory. The operator must also supply an authorized provider/snapshot service that covers the approved exact matrix and can honor one immutable/revision-addressable snapshot across cursor pages.

Exit gate:

```bash
cd /Users/xuminchen/Desktop/TradingReviewSystem
PYTHONPATH=backend pytest backend/tests/test_chart_api.py -q
npm run test:backend
npx tsc --noEmit
npm run lint
npx next build --webpack
cd /Users/xuminchen/Desktop/SimonCharts
TRADING_REVIEW_FRONTEND_URL=http://127.0.0.1:3000 TRADING_REVIEW_USERNAME="$TRADING_REVIEW_USERNAME" TRADING_REVIEW_PASSWORD="$TRADING_REVIEW_PASSWORD" PLAYWRIGHT_CHANNEL=chrome npm run check:trading-review-host
```

Required result: authenticated `/api/chart/symbols`, `/api/chart/series`, and full-screen `/chart` consume the packed workspace with real provider data and no engine/source imports. Phase 3 runs an automated authenticated Chrome core path; Phase 4 expands the same spec to the complete capability and four-browser gate.

### Phase 4: Commercial Artifact And Release Gate

Plan: `docs/superpowers/plans/2026-07-11-chart-workspace-commercial-release-implementation-plan.md`

Entry condition: Phases 1–3 are green and the TradingReviewSystem host has completed preliminary real-provider acceptance.

Exit gate:

```bash
npm run pack:workspace
```

Required result: clean build, all engine/workspace tests, capability and performance matrices, Chrome/Edge current/previous evidence, isolated `.tgz` runtime/type consumers, automated TradingReviewSystem host checks, artifact allowlist, and immutable SemVer metadata all pass before the final versioned `.tgz` is created.

## Specification Coverage Index

| Approved specification area | Implementation ownership |
|---|---|
| Product boundary, private distribution, stable artifact | Roadmap constraints; Commercial Release Tasks 1–10 |
| Engine timeframes, scales, checkpointed calculations, commands, drawing lifecycle/projection | Engine Readiness Tasks 1–8 |
| Public workspace API and lifecycle | Workspace Tasks 1, 9, 13 |
| Atomic cursor data, bounded history, warmup/materialization | Workspace Tasks 2–5 |
| Persistence, errors, retry, teardown | Workspace Tasks 6–8, 13–14 |
| Top/full-chart/floating-palette/bottom-panel UI | Workspace Tasks 9–12 |
| 17 chart types, 16 indicators, 63 drawings, 8 timeframes, 3 scales | Workspace Tasks 10–12, 14 |
| Performance and Chrome/Edge browser scope | Workspace Task 14; Commercial Release Tasks 5, 7–10 |
| TradingReviewSystem search, exact provider data, cursor API, `/chart` | TradingReviewSystem Tasks 1–9 |
| Partner docs, package contents, external consumers | Commercial Release Tasks 2–5, 8–10 |

## Stop Conditions

- Stop Phase 1 if an engine capability still has a declared UI or command surface with no real effect.
- Stop Phase 2 if any displayed candle was not supplied by `ChartWorkspaceDataSource` or if candle history is written to storage.
- Stop Phase 3 if the configured market provider cannot return the exact requested timeframe/adjustment; return a safe capability error instead of fabricating data.
- Stop Phase 3 if provider pages cannot remain bound to one revision/cutoff for the full cursor chain.
- Stop Phase 4 if the configured and commercially authorized provider set does not cover the approved exact host acceptance matrix.
- Stop Phase 4 if the host imports `@simoncharts/chart-engine`, a package internal subpath, or a SimonCharts source path.
- Do not advance a phase on partial test success or manual visual confidence alone.
