# SimonCharts Commercial Workspace SDK Implementation Roadmap

> 2026-07-19 状态：当前 `@simoncharts/charts@1.0.0-rc.22` 将真实多日分时收敛为等宽交易日、242 个中心对齐时段槽、无重叠午休、真实日分隔和连续价格线；黄色分时均线按上海交易日重置累计成交额/累计成交量，窗口价格线统一按方向着红绿，价格、均线、量柱、十字光标与对称涨跌幅轴共用坐标。生产 SDK 不 mock、补点或构造行情。33 文件候选已通过 Vitest 68 文件/1,087 项、合并 Chrome 92/92、Charts Chrome/Edge 各 41/41、Charts unit 13 文件/114 项、Engine 162 runtime exports/415 type symbols、Charts 5 runtime exports/4 declarations；SHA-256 为 `f87be50ae320476e8a9d69329f28d6d0c84bc7d30f1c1ba0b9e7cc1a24e37238`，SHA-512 为 `b3e5180a7b97d1f5f8975224125f0552a42fb6fc010c3fe47e4cc0ccd8870ef39660f29a141fde1ce21b00c86246a4a87a9487dae30617d137001c4c9889f20a`。既有 Engine、数据一致性、cutoff、持久化和发布证据任务继续有效，旧包名/API 不再有效。

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
- Engine/Workspace retain the complete technical matrix. Each real host declares an exact per-timeframe adjustment subset through `getCapabilities`; host acceptance covers every declared real combination, not an assumed Cartesian product or mandatory full data matrix.
- Product capability: 17 chart types, 16 built-in indicators, and all 63 built-in drawing tools.
- Price scales: `linear`, `log`, and `percentage`; default is `linear`.
- Intraday scale metadata is host-owned and cutoff-specific: `previousClose` supplies `0%`; optional `priceLimitPercent` fixes the one-day symmetric range, while omission keeps the axis automatic for unrestricted symbols.
- Intraday day count is 1–9 over real `1m` trading-day keys. Multi-day uses the close before the earliest selected day, fits the complete available window, and never fabricates missing days or candles.
- Data must come from the host data source exactly as requested; never synthesize, interpolate, repair, or fill candles.
- Host adapters use the public safe `ChartDataSourceError` contract when configuration, authorization, quota, no-data, or availability details should survive SDK normalization; unknown upstream failures remain generic.
- History is cursor-paged and continuously accessible; candle payload cache and engine materialization remain bounded.
- Persistence is browser `localStorage` only for layout, UI preferences, indicators, and drawings; drawings require an additional host data-context identity so different revisions/cutoffs cannot share annotations. Never persist candle history or credentials.
- UI layout: compact top toolbar, fixed drawing rail, one uninterrupted chart area, collapsed right object/property/data inspector, and compact status bar.
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

Required result: the public API, data coordinator, bounded store, persistence, runtime, complete UI, 17/16/63 capability matrix, host-defined intraday scales, 1–9 day real-data materialization, error states, and performance fixtures work in the in-repo harness.

### Phase 3: TradingReviewSystem Reference Host

Plan: `docs/superpowers/plans/2026-07-11-chart-workspace-trading-review-system-implementation-plan.md`

Entry condition: a Phase 2 release-candidate `.tgz` exists; the host must install that artifact, not a source directory. The operator must also supply an authorized provider/snapshot service that covers the host's declared exact subset and can honor one immutable/revision-addressable snapshot across cursor pages.

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

Required result: authenticated chart capabilities, `/api/chart/symbols`, `/api/chart/series`, and full-screen `/chart` consume the packed workspace with real provider data and no engine/source imports. Automated acceptance exercises every host-declared exact combination and verifies unsupported combinations stay absent; browser expansion does not require the host to license the Engine's full data matrix.

### Phase 4: Commercial Artifact And Release Gate

Plan: `docs/superpowers/plans/2026-07-11-chart-workspace-commercial-release-implementation-plan.md`

Entry condition: Phases 1–3 are green and the TradingReviewSystem host has completed preliminary real-provider acceptance.

Exit gate:

```bash
npm run pack:workspace
```

Required result: clean build, all engine/workspace tests, capability and performance matrices, Chrome/Edge current/previous evidence, isolated `.tgz` runtime/type consumers, automated TradingReviewSystem host checks, artifact allowlist, and immutable SemVer metadata all pass before the final versioned `.tgz` is created.

The `1.0.0-rc.1` package gate runs the complete workspace suite against the installed current Chrome and Edge channels, then creates an overwrite-safe tarball with SHA-256 and SHA-512 sidecars under `dist/packages/`. Stable `1.0.0` promotion still requires the separate current/previous-browser evidence and real TradingReviewSystem provider acceptance defined above; the RC artifact does not claim those stable gates prematurely.

Commercial automation is split deliberately: `check:commercial-package-gate` composes the Engine full gate and Workspace gate before an RC is packed; `check:commercial-release-gate` adds the authenticated TradingReviewSystem check after that exact candidate has been installed by the host.

## Specification Coverage Index

| Approved specification area | Implementation ownership |
|---|---|
| Product boundary, private distribution, stable artifact | Roadmap constraints; Commercial Release Tasks 1–10 |
| Engine timeframes, scales, checkpointed calculations, commands, drawing lifecycle/projection | Engine Readiness Tasks 1–8 |
| Public workspace API, intraday day control, and lifecycle | Workspace Tasks 1, 9, 13; rc.11 delta gate |
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
- Stop Phase 2 if multi-day intraday fills missing trading days, applies a one-day limit to a multi-day window, or cannot fit every accepted selected-day candle into its reset viewport.
- Stop Phase 2 if any initial or cursor page contains a candle later than `dataCutoffTime`; the SDK must reject the whole page without changing trusted data.
- Stop Phase 3 if the configured market provider cannot return the exact requested timeframe/adjustment; return a safe capability error instead of fabricating data.
- Stop Phase 3 if provider pages cannot remain bound to one revision/cutoff for the full cursor chain.
- Stop Phase 4 if the configured and commercially authorized provider set does not cover every combination the host declares through `getCapabilities`.
- Stop Phase 4 if the host imports `@simoncharts/chart-engine`, a package internal subpath, or a SimonCharts source path.
- Do not advance a phase on partial test success or manual visual confidence alone.
