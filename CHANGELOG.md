# Changelog

## @simoncharts/charts 1.0.0-rc.29 - 2026-07-26

- Added stable study instances and `createStudy()`, `getStudyById()`, `getAllStudies()`, and `removeStudy()` APIs so multiple copies of one indicator definition can coexist.
- Upgraded portable layouts to `ChartLayoutV2`; every indicator now has a required `instanceId`, while legacy indicator records remain untouched in their prior namespace.
- Isolated calculation checkpoints, output IDs, panels, UI actions, and data-window rows by study instance, with regression coverage for simultaneous MA5 and MA20.
- Normalized omitted inputs before validation, generated non-reused UUID instance IDs, and moved V2 indicators to a separate browser namespace that leaves legacy records untouched.
- Closed adversarial parser and lifecycle gaps for 32-study writes, reserved panel/output names, sparse arrays, accessor-backed payloads, and reentrant state/layout notifications.
- Accepted the exact 8-file immutable package artifact after `69 files / 1,115 tests`, combined Chrome `100/100`, Charts `14 files / 139 tests`, Charts Chrome/Edge `49/49` per browser, TypeScript, public API, artifact, and external JavaScript/TypeScript consumer gates; SHA-256 is `b5efabbfa50242ccadd73911e3eccd8626583c9553a1806d005c6d484bf27097`, SHA-512 is `c8c1c57e6deb48c05cf7c18a361ebb98a5a826a228ebd4d74ab1cac8e3db8f75443daa0dff9e9ef675847731368a19fd28de62b64e9fdddf70d029b24f4cf35e`.

## @simoncharts/charts 1.0.0-rc.28 - 2026-07-26

- Added an opaque, scope-safe Entity API for incrementally creating, reading, listing, updating, and removing indicators, drawings, and host marks without replacing whole collections.
- Added exact `entity-created`, `entity-updated`, and `entity-removed` events for API, built-in UI, undo/redo, selection changes, and atomic layout imports, including deterministic reentrant dispatch.
- Rejected duplicate or invalid persisted indicator/drawing entities at the storage boundary instead of allowing ambiguous runtime state.

## @simoncharts/charts 1.0.0-rc.27 - 2026-07-25

- Added a public programmable `ChartInstance` contract for series type, price scale, indicators, drawings, drawing tools/history, grid visibility, and host-owned generic marks.
- Added JSON-safe `ChartLayoutV1` export/import with full-payload validation, defensive copies, a ready-state boundary, and one `layout-changed` event per accepted change.
- Added `mark-clicked` events and external packed-consumer plus Chrome/Edge layout round-trip coverage; market data, executions, marks, symbol selection, and visible range remain outside persisted layouts.
- Accepted the exact 8-file immutable artifact after Engine `69 files / 1,109 tests` and Chrome `95/95`, Charts `14 files / 133 tests`, Charts Chrome/Edge `44/44` per browser, TypeScript, public API, artifact, and external JavaScript/TypeScript consumer gates; SHA-256 is `2b7f186f6abd2b20d8ae7011f6bfe86e6a8d8c16ff9039584a1e15bde6b7404f`, SHA-512 is `6d317d6885f491f01be0e42f102c7b2b0a2aad82d3400121757a9720cc8d9ad80741934ddeac04e0689da3849945f77431f58f0ecac028963bdbd08aa06ba58d`.

## @simoncharts/charts 1.0.0-rc.26 - 2026-07-22

- Added opt-in, read-only host-owned execution marks with A-share red-buy/green-sell arrows, B/S/T labels, real-timeframe placement, same-candle grouping and stacking, and complete hover/click/touch details without constructing trades or inferring T classifications.
- Accepted the immutable 34-file artifact after Engine `69 files / 1,107 tests`, Charts `14 files / 131 tests`, and Charts Chrome/Edge `42/42` per browser; SHA-256 is `44fca92c30e9ef1dc200e07c56a1e90f612cead15cd4aa10fb47cb899b72f616`.

## @simoncharts/charts 1.0.0-rc.25 - 2026-07-19

- Reissued the rc.24 runtime unchanged with a self-consistent packaged README and final package version; rc.24 remains immutable intermediate history.
- Accepted the immutable 33-file artifact after Vitest `68 files / 1,089 tests`, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, and Charts unit `13 files / 115 tests`; SHA-256 is `655aa6a0fff8ae3c755e07a41a381c956d19cb9f04dde066d730dc1dab73ce38`, SHA-512 is `e635f6e0489181daeed084f5e9dc8118df7db0db85a35eb3d7038060fb59009399565d0072b17184703761c0fa01414d7e06e4d327dd1d22df6551f5d3d582a6`.

## @simoncharts/charts 1.0.0-rc.24 - 2026-07-19

- Kept a one-day intraday percentage axis at the host's nominal daily limit while real highs and lows stay inside it; when tick-size rounding produces a real excursion beyond that limit, the axis now expands symmetrically to the next 0.1 percentage point after a 0.1-point drawing margin.
- Added direct regression coverage for the reported `9.65 → 10.62` (`+10.0518%`) case and the equivalent downside case without changing multi-day auto-scaling or fabricating market data.
- Accepted the immutable 33-file artifact after Vitest `68 files / 1,089 tests`, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, and Charts unit `13 files / 115 tests`; SHA-256 is `476b2bc2484f5fdb9583ef68fc9de123c9767811bca9828fa18da0558a9f4b26`, SHA-512 is `8e8ed08f4073ab45e6a65aebad54e7b27b2950c7982042f629c083a780699329daaa252364936ef67f246299a60bb0827cf4df574e4faa021d786a0b591ccef6`.

## @simoncharts/charts 1.0.0-rc.23 - 2026-07-19

- Fixed baseline-free intraday windows so their price line is no longer neutral: the official pre-window close remains preferred, while shorter real history uses the first real candle open solely for direction color and keeps the raw-price axis.
- Added a regression for the reported `000062`-style falling multi-day window without creating candles or a percentage baseline.
- Accepted the immutable 33-file artifact after Vitest `68 files / 1,088 tests`, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, and Charts unit `13 files / 114 tests`; SHA-256 is `461d3e607212e13f1aefe8f51f4b12beb50e6302b333f07693fec9fc8aaaa9cd`, SHA-512 is `a24dd4c8b495a85e030bb4d964b1fa2630352327ffdb943276604fa03df787a549bf464aa84b06bf4e190d4edf001c93a949022370414aaf01dc222c13f89066`.

## @simoncharts/charts 1.0.0-rc.22 - 2026-07-19

- Rebuilt real multi-day intraday presentation around equal-width trading-day slots with 242 center-aligned session slots per day, compressed lunch without overlap, real day-boundary separators, and one continuous price path; missing days or minutes are never filled.
- Added the yellow intraday average as each Shanghai trading day's reset cumulative turnover divided by cumulative volume, kept one red/green direction color for the visible price window, and made the real price, average, volume, crosshair, and symmetric percentage axis share the same coordinates.
- Accepted the immutable 33-file artifact after Vitest `68 files / 1,087 tests`, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, Charts unit `13 files / 114 tests`, Engine `162` runtime exports / `415` type symbols, and Charts `5` runtime exports / `4` declaration files; SHA-256 is `f87be50ae320476e8a9d69329f28d6d0c84bc7d30f1c1ba0b9e7cc1a24e37238`, SHA-512 is `b3e5180a7b97d1f5f8975224125f0552a42fb6fc010c3fe47e4cc0ccd8870ef39660f29a141fde1ce21b00c86246a4a87a9487dae30617d137001c4c9889f20a`.

## @simoncharts/charts 1.0.0-rc.21 - 2026-07-19

- Removed the production `fixtureDailyCandleSeries` export and implementation. The SDK now ships no market-data fixture or generator and only renders candles supplied by the host; an empty real response remains empty.
- Kept deterministic candle fixtures only in tests, scripts, and the private playground harness, outside the production package and runtime path.
- Accepted the immutable 32-file artifact after Vitest `67 files / 1,078 tests`, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, Charts unit `12 files / 110 tests`, Engine `162` runtime exports / `414` type symbols, and Charts `5` runtime exports / `4` declaration files; SHA-256 is `99951711a609c7575d84fe90d4d9195c97d8ac37dfbf3b2d982dacf25c8d9f51`, SHA-512 is `af1fb2a0100ef1b189508adb8ff1e867fb47e20a6dc250042369087af48f40ed8ea6a177d0d8c8ea6916d7456372adcb792e6682e6788b4d7979e95fc5d8f190`.

## @simoncharts/charts 1.0.0-rc.20 - 2026-07-19

- Bounded ordinary K-line zoom-out to a responsive maximum of `floor(plotWidth / 2)` visible candles and a minimum two-pixel candle width, preventing negative range indexes, virtual blank dates, and compressed full-history plots.
- Fitted the first and last actual candle/date edges to the plot boundaries at the zoom-out limit and made further zoom-out idempotent; wheel, keyboard, time-axis drag, resize, and public `setVisibleRange` now share the same constraint, while one-to-nine-day intraday remains fully fitted and zoom-locked.
- Accepted the immutable 32-file artifact after Vitest `67 files / 1,078 tests`, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, five runtime exports, four declaration files, TypeScript, artifact and external-consumer gates; SHA-256 is `2d3e22295144ee828119269689e73bf9c04e8230a152c6587e6d57ceadbbc3a6`, SHA-512 is `50db22816ddcd456677070044a6573cfd886ef394bd328236b0d465b9b92807e52c33f0c832faafb799cbef7138c642091c262c4520fd8d6ac94b887f92d406f`.

## @simoncharts/charts 1.0.0-rc.19 - 2026-07-19

- Limited persistent period shortcuts to four in fixed product order and display `最多固定 4 个周期，请先取消一个` when a fifth is requested; unsupported pinned rows remain visible so users can unpin them.
- Fixed intraday and 2–9 day intraday to line views while ordinary periods default to candles, and gave all 17 bilingual series choices visible semantic SVG icons.
- Extended the vertical crosshair through the separate volume region, added change data to ordinary K-line headers, and expanded the localized candle hover panel with date, OHLC, change, amplitude, position, volume, and turnover.
- Added visible semantic SVG icons and bilingual grouped menus for all 63 real drawing tools, without advertising tools that the engine cannot create, edit, serialize, and restore; also propagated locale consistently through the shell and chart region.
- Accepted the immutable 32-file artifact after Vitest `67 files / 1,074 tests`, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, five runtime exports, four declaration files, TypeScript, artifact and external-consumer gates; SHA-256 is `617512f5f9ce17ca5d4dea08e68ba7fcbf66d0cf1e3664579d8b309290993c45`, SHA-512 is `8ac7d11bb640fa2a21adc530970fa81766b4da13adf53683d8d9e812c6095fa44ec52c23ed91e99396326b21ccdf53f31f98756f134e7db9c723e9b922420eb0`.

## @simoncharts/charts 1.0.0-rc.18 - 2026-07-18

- Added a complete period dropdown with persistent starred shortcuts rendered in fixed product order; defaults remain `15m / 60m / 1d / intraday`.
- Kept intraday and 2–9 day intraday as line views while ordinary periods default to candles, and localized all 17 chart types as Chinese names followed by English names.
- Accepted the immutable 32-file artifact after `67 files / 1,072` repository tests, focused Charts tests, TypeScript, runtime/declaration API, artifact and external-consumer gates; SHA-256 is `5dcf23227e5280182539457db75579d258443dc6b33f75eef5bddb6289f29d93`, SHA-512 is `b1453e8d6c7127c555cacea547ce5cef89f3e3d75ba439ec3446f1cb4e3cab860319dde3d409a41dce69d27235cddd1db25ed296b7c7b5a0e7e9d52adba2a24a`.

## @simoncharts/charts 1.0.0-rc.17 - 2026-07-18

- Reserved a 34 px plot inset below the chart header so intraday boundary-axis labels remain complete without overlapping the OHLC header.
- Kept latest-viewport zoom at `to = lastIndex` and `scrollOffset = 0`; anchor-based zoom now applies only after the user pans into historical data.
- Accepted the immutable 32-file artifact after `67 files / 1,070` repository tests, `12 files / 106` Charts tests, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, five runtime exports, four public declaration files, external consumer and byte-identical TradingReviewSystem packed-host gates; SHA-256 is `8f6a1be2e255d845da1a7d809c4a994a359c14a1798d52a92c117d7f076dba71`, SHA-512 is `dc3a3c526b2b10688f64984562e5f7612f4e1440ca4240d5581080c60b36c11260aa8972e98d8a197de57ba0b0f750a4bd33e356acba5779d35c6354610d6c88`.

## @simoncharts/charts 1.0.0-rc.16 - 2026-07-18

- Constrained the center position of intraday dual-axis boundary labels so the top and bottom price/percentage extremes remain fully inside the chart instead of being clipped.
- Preserved the rc.15 crosshair time-label collision fix and the existing public contract.
- Accepted the immutable 32-file artifact after `67 files / 1,069` repository tests, `12 files / 106` Charts tests, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, five runtime exports, four public declaration files, external consumer and byte-identical TradingReviewSystem packed-host gates; SHA-256 is `5e9f805c10eafa1fca09dfcee9850985aad1df6e116eea50a11963951a055baa`, SHA-512 is `92750a05e7cdc2f03f0a646200e17dd612c77fed0e5501b6f9c5c8f53fd1eb88d1b130a86433c7d44efab9fde09ee62f97eb04f6e8959e9bcaf26fc09e0b0cee`.

## @simoncharts/charts 1.0.0-rc.15 - 2026-07-18

- Finalized the rc.12 Advanced Charts layout and interaction scope without changing its public contract.
- Shared the selected time-axis label layout between static and crosshair rendering, then cleared every complete static date label that overlaps the crosshair time badge so zoomed K-line dates cannot leave partial neighboring fragments.
- Accepted the immutable 32-file artifact after `67 files / 1,069` repository tests, `12 files / 106` Charts tests, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, five runtime exports, four public declaration files, external consumer and byte-identical TradingReviewSystem packed-host gates; SHA-256 is `08f6c652dab93c3aeb8ab832049218e78e387b1d7f6c7bc1d1797ff7a4a3bb87`, SHA-512 is `28a538f9556f5522bac437aba4b0384ff7e5e72bb52123f74c1fae0b01f3e776d6c973ba75fc33079c7e066538848abba50c3946cae258f5c81989ccfb7959b8`.

## @simoncharts/charts 1.0.0-rc.12 - 2026-07-18

- Split price and volume into dedicated canvas regions for every series type, and added a true dual intraday axis with raw price on the left and change percentage on the right.
- Locked one-to-nine-day intraday windows against wheel, drag, axis, keyboard, resize, and programmatic range zoom while preserving crosshair and drawing interactions.
- Right-aligned the latest K-line when zoom reveals more slots than loaded candles, fixed subpixel multi-day hit testing, and removed colliding bottom-axis labels with Shanghai-aware compact intraday labels.
- Colored the intraday line from its official interval baseline, kept bullish/bearish volume bars, and added the latest trading day's high/open/low/close summary with per-value direction colors.
- Reorganized the advanced toolbar around `15分 / 60分 / 日 / 分时 / 更多`, moved the 1–9 day selector into the chart header, and replaced the native series select with an accessible 17-type chart menu.
- Accepted the immutable 32-file artifact after `67 files / 1,068` repository tests, `12 files / 106` Charts tests, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, external consumer and byte-identical TradingReviewSystem packed-host gates; SHA-256 is `683050ed196ab30a757cfa863f823826872d373bf8f690125c1c4001d31e83e5`, SHA-512 is `fed1ffa05049cfacc04f2d9d0863399b68095fe662ad4ea1db05a70967f5caee4b2fb2530a65b5ef98da941e02ed41a0148a4a628250deb935ad86f716ec82fd`.

## @simoncharts/charts 1.0.0-rc.11 - 2026-07-17

- Preserved the preceding reference-day close while multi-day pages are reloaded through a one-page cache, so 2–9 day percentage axes cannot silently fall back to a price axis after eviction.
- Lowered the bounded subpixel spacing used by fitted intraday windows and added a 390 px regression for all 2,169 candles in a nine-day A-share window.
- Added focused controller coverage for the evicted reference-day baseline and advanced the immutable candidate without overwriting rc.10.
- Accepted the immutable 32-file artifact after `67 files / 1,058` repository tests, `12 files / 104` Charts tests, combined Chrome `92/92`, Charts Chrome/Edge `41/41` per browser, external consumer and TradingReviewSystem packed-host gates; SHA-256 is `9b1243b1841448f34a49b100ad2ec8e4276a1a7002b07a69bc4bb9dee5986062`.

## @simoncharts/charts 1.0.0-rc.10 - 2026-07-17

- Added the host-owned `intradayScale` capability with an official cutoff-specific `previousClose` and an optional `priceLimitPercent`; Charts does not infer exchange-board or listing rules.
- Added a fixed symmetric percentage axis for one-day intraday charts when a daily limit is supplied, and automatic percentage scaling when the limit is omitted for a new or otherwise unrestricted symbol.
- Added `IntradayDayCount`, `ChartState.intradayDays`, `ChartInstance.setIntradayDays()`, and a visible 1–9 day selector while keeping the underlying data contract on the same real `1m` revision.
- Multi-day intraday selects the latest 2–9 real trading days, uses the close before the earliest selected day as the percentage baseline, fits the complete available window, and displays fewer real days when history is shorter instead of filling or fabricating candles.
- rc.10 was packed immutably but superseded before final TradingReviewSystem acceptance after the cache-eviction and narrow-window review findings above; rc.11 is the accepted-candidate line.

## @simoncharts/charts 1.0.0-rc.9 - 2026-07-17

- Rebuilt the explicit advanced workbench around a professional chart-first shell: compact top toolbar, fixed drawing rail, central chart, collapsed right inspector, and status bar; the default embedded shell remains minimal.
- Added persistent OHLC/volume HUDs, watermark, denser price/time axes, current-price and crosshair axis labels, a chart/price/time context menu, and native fullscreen control.
- Added continuous captured pan, wheel and keyboard zoom/pan, draggable price and time axes, double-click reset, drawing selection/body/handle editing, and direct overlay data-window updates without rerendering the shell.
- Kept watchlists, news, broker/order/account surfaces, and multi-chart layouts outside Charts; those remain Trading Platform concerns.
- Fixed valid defaults for all five stateful series transforms and made advanced indicator visibility reversible from the compact manager.
- Advanced the immutable candidate without overwriting rc.8.

## @simoncharts/charts 1.0.0-rc.8 - 2026-07-17

- Added viewport-driven cursor paging across trading days while preserving candle width and the user's visible anchor when older history is prepended.
- Added `setView`, `getVisibleRange`, `setVisibleRange`, `resetToLatest`, and typed `data-loaded` / `visible-range` events for host coordination.
- Kept intraday and ordinary `1m` views on the same accepted revision, materialized the complete latest available Shanghai trading day for intraday, and kept ordinary minute candles continuous across days.
- Guarded asynchronous selection, range, page-reload, cutoff, millisecond-time, and `dataVersion` boundaries so stale results cannot enter the active chart.
- Advanced the immutable candidate without overwriting rc.7.

## @simoncharts/charts 1.0.0-rc.7 - 2026-07-17

- Prevented programmatic drawing hydration from emitting a user-change callback or writing empty adjustment namespaces.
- Preserved drawing history reset and real user create, edit, and delete persistence semantics.
- Advanced the immutable candidate without overwriting rc.6.

## @simoncharts/charts 1.0.0-rc.6 - 2026-07-17

- Kept timeframe switches safe while a new selection has not received its first page descriptor yet.
- Added an empty-store materialization regression and advanced the immutable candidate without overwriting rc.5.

## @simoncharts/charts 1.0.0-rc.5 - 2026-07-17

- Added a capability-gated intraday close-line preset beside the ordinary 1-minute candle control without expanding the public timeframe contract.
- Kept the transient intraday line out of minimal-mode preferences while preserving explicit advanced series-type persistence.
- Made the nine-view timeframe strip horizontally scrollable in narrow host containers and cleared the preset safely when a new symbol lacks 1-minute capability.
- Advanced the immutable Charts candidate without overwriting the accepted rc.4 artifact.

## @simoncharts/charts 1.0.0-rc.4 - 2026-07-17

- Colored each volume bar with the same bullish or bearish theme color as its corresponding candle.
- Advanced the immutable Charts candidate without overwriting the accepted rc.3 artifact.

## @simoncharts/charts 1.0.0-rc.3 - 2026-07-16

- Prevented the default minimal feature set from reading or writing the drawings persistence namespace when no drawing surface is enabled.
- Preserved drawing persistence for charts that explicitly enable `drawing-tools`, `drawing-history`, or `bottom-panel`.
- Advanced the immutable Charts candidate without overwriting the existing rc.2 artifact.

## @simoncharts/charts 1.0.0-rc.2 - 2026-07-16

- Replaced the partner-facing Workspace API with the breaking `createChart(container, options)` Advanced Charts contract and renamed the package to `@simoncharts/charts`.
- Added stable feature construction with a minimal `timeframes`, `adjustment`, and `indicators` default plus explicit `advancedChartFeatures` for the complete workbench.
- Added responsive container mounting, real light/dark Canvas themes, `zh-CN`/`en-US` configuration, and human-readable labels for all 17 series types.
- Renamed public data and error contracts to `ChartDatafeed`, `ChartOptions`, `ChartState`, `ChartInstance`, `ChartDatafeedError`, and `ChartError` without an RC compatibility layer.
- Preserved exact capability negotiation, cutoff enforcement, versioned paging, persistence isolation, cancellation, safe errors, and teardown behavior.

## @simoncharts/chart-workspace 1.0.0-rc.1 - 2026-07-16

- Added exact per-timeframe provider capability negotiation and removed unsupported market-data controls and requests.
- Added request cutoff propagation plus atomic future-candle rejection, user persistence isolation, explicit drawing data-context isolation, and public state subscriptions with teardown cleanup.
- Added a typed safe `ChartDataSourceError` contract so host adapters can preserve actionable configuration, authorization, quota, no-data, and availability messages without exposing raw provider failures.
- Bound pending cursors to their request generation/controller and blocked history loading until the current initial page is accepted, preventing stale late completions from opening duplicate requests across symbol changes.
- Added Workspace runtime API and emitted declaration-signature snapshots, artifact allowlisting, external packed JavaScript/TypeScript consumers, Chrome/Edge browser gates, explicit package-only/final commercial orchestration, and overwrite-safe tarball generation with SHA-256/SHA-512 evidence.
- Changed real-host acceptance from a mandatory full market-data matrix to the exact real subset declared by each host; the Engine technical matrix remains complete.

## 1.0.0-rc.1 - 2026-07-11

- Published exact manifest claims for eight timeframes, three price scale modes, drawing preview, continuous drawing, and checkpointed calculations.
- Accepted percentage layout snapshots and tightened candle validation for finite values, price/volume signs, and OHLC bounds.
- Routed Playground timeframe changes through new candle series and `setSeries()`, and routed all price scale choices through the canonical chart command.
- Connected step and continuous pointer lifecycle, preview rendering, cancellation cleanup, shared magnet/pointer conversion, and canonical drawing projection in the Playground.
- Added a clone-isolated drawing coordinate adapter so creation, body/anchor edits, resize, rotate, paste, duplicate, preview, hit-testing, and undo/redo share the current projection while history and persistence remain canonical.
- Refreshed current package, consumer, host-smoke, release, and public API contracts for workspace readiness.

## 1.0.0-rc.0 - 2026-06-27

- Added exact bounded JSON checkpoints for all 16 core indicators and five stateful synthetic series transforms.
- Added explicit terminal indicator finalization and BASE-characterized golden coverage for every checkpointed formula.
- Added Point & Figure provisional-tail replacement and precomputed bounded render models with global source-index offsets.
- Completed step and continuous drawing pointer lifecycles with isolated creation previews and one-entry gesture history.
- Prepared `@simoncharts/chart-engine` as the first v1.0 release candidate.
- Documented package usage, root-only SDK imports, release scope, and release validation.
- Added package metadata for external consumption without adding host app coupling.
- Added `npm run check:release-readiness` to verify required package metadata, docs, exports, and release scripts.
- Preserved the Engine boundary: no host API, store, schema, route, TradingReviewSystem, review, strategy, watchlist, AI, auth, account, billing, portfolio, or product persistence imports.

## 0.9.0 - 2026-06-27

- Added the neutral extension kernel for chart, visual, drawing, and figure contributions.
- Added namespaced custom drawing type validation.
- Added SDK consumer checks for extension APIs.

## 0.8.0 - 2026-06-27

- Hardened package-root SDK consumption.
- Added runtime and type consumer checks.
- Added SDK import boundary guard.

## 0.7.0 - 2026-06-27

- Productized drawing editor command execution and capability snapshots.
- Added toolbar-ready command state for copy, paste, duplicate, z-order, lock, hide, undo, and redo.

## 0.6.0 - 2026-06-27

- Hardened render scheduler diagnostics and static renderer clear behavior.
- Added deterministic performance baseline coverage.
