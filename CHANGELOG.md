# Changelog

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
