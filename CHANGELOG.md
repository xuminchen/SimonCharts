# Changelog

## @simoncharts/charts 1.0.0-rc.45 - 2026-07-30

- Added sparse, type-specific `ChartSeriesVisualOverrides` through initial options, runtime get/set APIs, Layout V3, and browser preferences.
- Added strict per-output Study visual overrides for line, histogram, band, and marker outputs through `ChartStudyApi`, with built-in and Custom Study output-id/type validation.
- Kept series overrides isolated to the main series, preserved explicit overrides across base-theme changes, and left the fixed intraday presentation unchanged.
- Made style-only Study changes repaint without recalculation; `visible: false` now removes that output from rendering, auto-scale, hit testing, crosshair values, and the data window.
- Added public-contract, persistence, runtime, calculation-lifecycle, and Chrome/Edge browser coverage without adding a dependency, a second renderer, or a new layout schema.
- Published the immutable eight-file package after `77 files / 1,321 tests`, combined Chrome `158/158`, Charts `22 files / 310 tests`, Charts Chrome/Edge `107/107` per browser, and packed JavaScript/TypeScript Chrome/Edge consumer checks. SHA-256: `9b48f5c9830b6d3b6dc7a41d5b2bf9f42c75d1f40b27942ace9bc4b913d957bd`; SHA-512: `ed11841f8e2835ffaa8097fa8d2f1d46656670920fea600d1c4099121390af384b9ef35ae12e87879aa3ad7d99e09fe97fd9e8176e1632c16cb7ace67ddfca12`. Final adversarial review found no remaining P0/P1/P2, and TradingReviewSystem was not modified.

## @simoncharts/charts 1.0.0-rc.44 - 2026-07-30

- Added a frozen public `ChartTimeScaleApi` with visible-range control, bounded bar spacing, plot width, exact loaded-Candle coordinate conversion, Bar-based scrolling, zoom, fit, and reset.
- Added the finite `ChartActionId` and `executeActionById()` surface for `timeScaleReset`, `chartReset`, `zoomIn`, `zoomOut`, and `fitContent`; arbitrary commands and the internal engine dispatcher remain private.
- Reused the existing paged visible-range controller and native viewport helpers, kept 1–9 day intraday fixed, preserved latest right alignment and zoom bounds, and kept viewport/command state outside Layout V3 and browser persistence.
- Made every time-scale command last-intent-wins across concurrent page reloads, kept stale failures silent, isolated loading selections from old coordinates, separated time-only reset from full price-scale reset, and invalidated retained geometry after destroy.
- Added public-contract, runtime, controller-facade, Chrome, and Edge tests for strict validation, handle identity, coordinate round trips, action parity, bounded behavior, and intraday no-ops.
- Published the immutable eight-file package after `76 files / 1,306 tests`, combined Chrome `156/156`, Charts `21 files / 295 tests`, Charts Chrome/Edge `105/105` per browser, and packed JavaScript/TypeScript Chrome/Edge consumer checks. SHA-256: `f4de89dba92174d87a2dac1765de0e253e24a6377675f3c441ff1f4ff5052c9f`; SHA-512: `650fe5b99d305bc794ff4c0cd9a185d5ede5f907e3ffcb2f3216e593f15366ab7899ff47237dcfb4726b959c20e29aefd0bd50b5eefa79895f51c4bb2144cae8`. Final adversarial review found no remaining P0/P1/P2, and TradingReviewSystem was not modified.

## @simoncharts/charts 1.0.0-rc.43 - 2026-07-30

- Added public Historical Replay state and controls through `getReplayState()`, `startReplay()`, `stepReplay()`, `playReplay()`, `pauseReplay()`, `setReplaySpeed()`, and `stopReplay()`, plus the `replay-changed` event and native advanced-workspace controls.
- Reused the accepted host Candle, bounded materialization, checkpointed calculation, compare, mark, execution, crosshair, price-scale, readiness, and event paths; no tick, calendar row, market value, or second replay engine is constructed.
- Truncated every replay presentation at the exact real Candle cursor, continued across cached materialized windows by real timestamps, restored the full current presentation on exit, and kept replay transient outside Layout V3 and browser persistence.
- Prevented future execution-range disclosure by withholding an aggregate until its optional `lastTime` maps to a revealed Candle; blocked render/calculation failures pause replay and reentrant replay listeners cannot render stale UI state.
- Added public, controller, calculation-runtime, execution, Chrome, and Edge coverage for validation, causal Custom Study/stateful-series input, timer backpressure, cross-window steps, lifecycle reset, native controls, and future-series isolation.
- Published the immutable eight-file package after `74 files / 1,289 tests`, combined Chrome `155/155`, Charts `19 files / 278 tests`, Charts Chrome/Edge `104/104` per browser, and packed JavaScript/TypeScript Chrome/Edge consumer checks. SHA-256: `c3f8222e8519df72c2e49545b6cf5bbfa84b41968f9b8c6437734857c1c53a5e`; SHA-512: `54c94bd0fee88eafaabb0fda771118dc4ef9a5db15a95b83ce36270db5d95e96524dd48d73425585117e7597dd2184d3f27d7ac2be33d67c78b1b08e38ca0c7a`.

## @simoncharts/charts 1.0.0-rc.42 - 2026-07-30

- Added public host-owned Symbol Compare through `ChartComparison`, `ChartOptions.comparisons`, `getComparisons()`, and atomic `setComparisons()` replacement, with at most four distinct non-main symbols and defensive snapshots.
- Reused the existing host datafeed, capability negotiation, bounded cursor paging, cancellation, retry, and readiness lifecycle for every comparison; no market data, calendar row, interpolation, forward fill, or backfill is constructed.
- Kept the main series as the sole time-axis owner and aligned comparison values only at exact timestamps. Ordinary periods normalize each comparison from its first visible real value; intraday uses that comparison's trusted `previousClose`.
- Switched a non-empty comparison presentation to percentage display and restored the prior price-scale mode after the final comparison is removed.
- Added comparison rows to the native header, data window, crosshair snapshot, and keyboard-operable advanced symbol-search flow without creating a second chart, tooltip, or persistence model.
- Kept comparisons host-owned and excluded from `ChartLayoutV3`, layout export/import, and automatic browser persistence snapshots. A visible comparison that is empty, unsupported, failed, superseded, or unable to satisfy the requested range makes the current `dataReady()` resolve `false`.
- Accepted the exact 8-file immutable package after `74 files / 1,280 tests`, combined Chrome `154/154`, Charts `19 files / 269 tests`, Charts Chrome/Edge `103/103` per browser, and packed JavaScript/TypeScript Chrome/Edge consumer execution; SHA-256 is `e23c8aa287c74bf1f9a72a10e7ef8d9592e741053b6bcff38f4bedd1f380c97e`, SHA-512 is `89bc969ade897f023232de5e9b0d7cfe3b5f95907335af769c39034e330b1c0e39d2040c1854f605f32f34df604ba35350e6ce3fcf2e6ad4667d08c6061946e7`. Final adversarial review found no remaining P0/P1/P2, and TradingReviewSystem was not modified.

## @simoncharts/charts 1.0.0-rc.41 - 2026-07-30

- Added a browser performance gate over a lazy one-million-candle fixture that navigates through at least 50,000 exact fixture candles, then exercises crosshair, pan, and zoom with 63 non-interactive Drawings plus MA, RSI, and MACD in Chrome and Edge.
- Replaced arbitrary frame timing with `dataReady()`-bound first-paint timing and interaction frames scheduled after the measured event; empty samples fail closed.
- Skipped the unused dynamic render pass and reduced layout work to one reconciliation per static frame while preserving dynamic price-axis width across scale, precision, Drawing autoscale, Study, pane, and viewport changes.
- Invalidated stale same-selection readiness before history rematerialization, so deep range requests, unavailable recovery, and reset-to-latest wait for the exact current presentation; failed requested ranges settle `dataReady()` as `false`.
- Released paged-store payloads, materialized candles, calculated visual data, and chart-engine copies on idempotent or reentrant destruction, including host callback failure.
- Added a 2,000-page descriptor-chain test that preserves reload metadata and version isolation while payload count and estimated bytes remain bounded.
- Kept the public API, market-data ownership, package allowlist, and dependencies unchanged.
- Accepted the exact 8-file immutable package after `70 files / 1,235 tests`, combined Chrome `150/150`, Charts `15 files / 226 tests`, Charts Chrome/Edge `99/99` per browser, and packed JavaScript/TypeScript Chrome/Edge consumer execution; SHA-256 is `46a062ed41434d465ca4c236d79fdb35f67519a1b1f4a0041dbb277b9f22ae87`, SHA-512 is `6288b8e5dba12c8e58c7cbed7b8aa53e7c535a2c0357adfd80fd484eca1f374d6371a07a6c5e4383fea050568c044d031f055e00ec16fb5b82603e6aa1c65df2`. Independent lifecycle and performance adversarial reviews found no remaining P0/P1/P2, and TradingReviewSystem was not modified.

## @simoncharts/charts 1.0.0-rc.40 - 2026-07-30 (rejected candidate)

- Preserved the immutable 8-file candidate without accepting or overwriting it after adversarial review found that a failed requested history range could leave `dataReady()` pending.
- SHA-256 remains `b805c7561cd69ea07e83791dbd49d4bcc649b2e47048ab206e0f32e37d306daa`; SHA-512 remains `36fe3a5b24f96c65f37c1d995a522713324e544e66c3c8684197131727683fe4080378cee5b976469231fbaedf76a9f01daa71d0e5aa77979c7a2701847331e4`. TradingReviewSystem was not modified.

## @simoncharts/charts 1.0.0-rc.39 - 2026-07-29

- Added optional `ChartSymbol.pricePrecision` with strict integer validation from 0 through 8, defensive cloning across initial options, search, state, and `SeriesRequest`, and same-ID metadata replacement.
- Applied explicit precision to main raw-price axes, current/crosshair labels, OHLC/change displays, the data window, and execution prices while preserving raw Candle/events, two-decimal percentages, non-price values, Study panes, Layout V3, and rc.38 defaults.
- Expanded the main price-axis width for long formatted labels without changing sub-pane geometry or scale data.
- Rebuilt advanced symbol search as a keyboard-operable ARIA combobox with active-descendant navigation, IME-safe debouncing, stale-request cancellation, loading/result/empty/error announcements, safe text rendering, retry focus, and 320 px reflow.
- Kept the public surface to one optional symbol field, reused the existing datafeed/controller/render paths, and added no dependency, market rule, global formatter, second search system, or fabricated data.
- Accepted the exact 8-file immutable package artifact after `70 files / 1,234 tests`, combined Chrome `148/148`, Charts `15 files / 225 tests`, Charts Chrome/Edge `97/97` per browser, and exact packed JavaScript/TypeScript Chrome/Edge consumer execution; SHA-256 is `fbe50bf9fcc31d5a775e09d8a81b8fdf52ea6ec25ef08c9dcad3007394f07e29`, SHA-512 is `cba7994f4fe351c6aa0d0d55d00f2f8f5a9ad5c8d82a2cbb5ffc945fd835b4b4cb245d386c0db607c5bbd6d5a5a3322d0e32c478382884c5947b265a42d44579`. Independent adversarial review found no remaining P0/P1/P2, and TradingReviewSystem was not modified.

## @simoncharts/charts 1.0.0-rc.38 - 2026-07-29

- Added live `getPanes()`, `getPaneById()`, and `getPaneApi()` contracts for the fixed main pane and existing separate Study panes, including height, collapse, ordering, and per-pane price-scale control.
- Gave Study panes independent linear auto/manual and inverted scales while retaining linear, log, and percentage modes on the main pane; native right-axis drag and double-click use the same public state.
- Replaced overlapping Study-panel geometry with one ordered pane layout shared by rendering, axes, grid, crosshair, hit testing, and pointer interaction.
- Added strict `ChartLayoutV3` pane persistence with defensive snapshots, atomic import, exact pane-set validation, and deterministic V2 migration. Export and `layout-changed` events now always emit V3.
- Reset manual price ranges to automatic when the market presentation changes, while preserving pane order, ratios, collapse, and inversion; intraday keeps its fixed percentage scale.
- Preserved existing Study, Entity, Selection, Drawing, execution, readiness, browser persistence, and real-data-only contracts without adding a second pane engine or chart dependency.
- Accepted the exact 8-file immutable package artifact after `69 files / 1,213 tests`, combined Chrome `137/137`, Charts `14 files / 207 tests`, Charts Chrome/Edge `86/86` per browser, and packed Chrome/Edge consumer execution; SHA-256 is `9bba2f18c7bf0a7819cbdcd1c72f50929c6bb4a5f237b6fb4a8a6a29d0454019`, SHA-512 is `7c1d46525a6351c23fc64f59c637e1a191c063a298414059b5a99382076aec0085202844418144cf64ac4abcce2c1fbbc21573f6a8d42b47164c96013ca91459`. Independent adversarial review found no remaining P0/P1, and TradingReviewSystem was not modified.

## @simoncharts/charts 1.0.0-rc.37 - 2026-07-28

- Added typed `getSelection()`, `setSelection()`, and `clearSelection()` APIs for multiple interactive Drawings or exactly one Study, reusing existing opaque Entity IDs.
- Added defensive `selection-changed`, `drawing-clicked`, `study-clicked`, and grouped `execution-clicked` events through the existing chart event stream.
- Kept selection transient and outside `ChartLayoutV2` and browser persistence; invalid, mixed, mark, missing, and non-interactive selections are rejected atomically.
- Unified primary-pointer Canvas click/tap slop so right clicks, secondary pointers, Drawing edits, and chart pans cannot also emit actions; execution actions wait for a completed click/touch gesture, while source replacement or synchronous selection reentry cancels stale pending actions.
- Made Study actions hit-test rendered line segments, histogram bodies, and band fills inside the active panel, resolve overlaps to the topmost output, and preserve marker geometry, hidden-study behavior, and existing Canvas renderers.
- Preserved Drawing selection across rematerialization and entity updates, retained surviving selected Drawings after removal, and removed Drawings changed to `interactive: false` without adding a second selection, action, tooltip, or persistence system.
- Accepted the exact 8-file immutable package artifact after `69 files / 1,197 tests`, combined Chrome `130/130`, Charts `14 files / 195 tests`, Charts Chrome/Edge `79/79` per browser, and byte-identical packed Chrome/Edge consumer execution; SHA-256 is `a5c2d85d778dd1717691f6c6c527e74367244a24356f4ef7f5df8c201ced54a7`, SHA-512 is `5f3d7ce8a5e4aec738de962f9034ff1fe1a3908f03550e137050bffbaa8459631e56ce2a5927d351cbf06b66510f81db3183940c7cdf623740f47455d642fa4a`.

## @simoncharts/charts 1.0.0-rc.36 - 2026-07-28

- Added public `ChartThemeOverrides`, optional `ChartOptions.themeOverrides`, and runtime `getTheme()`, `setTheme()`, `getThemeOverrides()`, and `setThemeOverrides()` APIs over the existing Workspace color tokens.
- Added strict plain-object validation for 11 bounded concrete CSS colors. Unknown fields, accessors, indirect `var(...)`/`currentColor`, CSS-wide keywords, invalid browser colors, and partial invalid replacements are rejected atomically.
- Made runtime overrides whole-object replacements with `{}` reset, defensive reads, and preservation across dark/light base-theme switches.
- Reused the existing CSS variables and render scheduler so DOM and every Canvas layer repaint together without recalculating data, studies, or synthetic series.
- Kept theme mode and overrides host-owned and outside `ChartLayoutV2`, layout events, browser persistence, data requests, and `dataReady()` selection lifecycle.
- Accepted the exact 8-file immutable package artifact after `69 files / 1,194 tests`, combined Chrome `126/126`, Charts `14 files / 193 tests`, Charts Chrome/Edge `75/75` per browser, and exact packed Chrome/Edge consumer execution; SHA-256 is `a03f26f4b2fa5fd9833cedfbeec191485daf78b9e005990a956d9332f72b333f`, SHA-512 is `9c9cf25b29f26c376c4ba004c1fdc9d93d15f01e2138341e36c587ec83b7f6d859704bb9757ac7947f69fda6e0c64d6fb66aa0bbb34176abea72586903eff273`.

## @simoncharts/charts 1.0.0-rc.35 - 2026-07-28

- Added public `ChartSeriesProperties`, `getSeriesProperties()`, `setSeriesProperties()`, and optional `ChartOptions.seriesProperties` for Renko brick size, Line Break count, Kagi reversal amount, and Point & Figure box/reversal settings.
- Kept property state independent from the active series type: inactive updates persist without calculation, while active synthetic updates abort stale generations and keep `dataReady()` pending until the latest result paints.
- Preserved sparse non-default properties through `ChartLayoutV2` and browser preferences with strict plain-object validation, defensive clones, atomic replacement, option-over-preference precedence, and rc.34 defaults for legacy layouts.
- Bounded Line Break counts and total synthetic output, rejected non-finite Point & Figure expansion, and included normalized properties in checkpoint keys without adding a second transform or cache.
- Fixed sparse synthetic models to render at their source Candle indices, so configured Renko, Line Break, Kagi, and Point & Figure results remain visible in a source-indexed viewport.
- Kept intraday fixed to the real close line and added no style schema, ATR/percentage sizing, new dependency, layout version, or synthetic market data.
- Accepted the exact 8-file immutable package artifact after `69 files / 1,191 tests`, combined Chrome `124/124`, Charts `14 files / 190 tests`, Charts Chrome/Edge `73/73` per browser, and exact packed Chrome/Edge consumer execution; SHA-256 is `7ad247707677deb2a3c55bcc7a331c95af21d6c0946fd5f0d89203c8cc3b70a1`, SHA-512 is `f947301b1bb2d37fc31be0cacc42c4663f08a6778c7283d111626223c3645448f749745819b9237f427105e3f7bcf7aad029eea0c21c06fca52538f5a994c796`.

## @simoncharts/charts 1.0.0-rc.34 - 2026-07-28

- Added chart-scoped, versioned `ChartCustomStudyDefinition` contracts with bounded numeric input schemas and fixed line, histogram, band, and marker outputs.
- Reused the existing chronological checkpoint runtime, native visual renderers, automatic panes, crosshair values, live Study handle, Entity API, and `ChartLayoutV2`; custom instances preserve exact `definitionVersion`, inputs, visibility, and stable identity.
- Made custom calculation input and output boundaries defensive and fail-closed: dense finite-or-null arrays, exact output keys and lengths, bounded JSON-safe state, no accessor execution, atomic version validation, and no cancelled-generation checkpoint writes.
- Kept `dataReady()` pending until concurrent indicator and stateful-series calculations both settle and the presentation paints; calculation failure and `retry()` continue through the existing lifecycle.
- Kept definitions, callback functions, market data, and custom instances out of automatic browser indicator persistence. Hosts own definition code and explicit layout storage; the built-in UI shows titles and supports visibility/removal without adding a code editor or second Study system.
- Preserved the extendable `ChartIndicator` and `ChartIndicatorInput` interfaces, existing built-in defaults, and rc.33 behavior; no new runtime dependency or global mutable registry was added.
- Accepted the exact 8-file immutable package artifact after `69 files / 1,176 tests`, combined Chrome `121/121`, Charts `14 files / 178 tests`, Charts Chrome/Edge `70/70` per browser, and exact packed Chrome/Edge consumer execution; SHA-256 is `1f6fe992c8f147eae17612e4123061b05b6b2bb2b932383d5202ebc805875665`, SHA-512 is `7b9c4dae591076c62a6b247af3849ff2f3e83de8e53dc6bf2bc4549c1eab6b0a6f96014b80f1db08933828a6bd829adc1dd6546cba42a86aeda4fed8e000a1af`.

## @simoncharts/charts 1.0.0-rc.33 - 2026-07-28

- Added optional paired `ChartExecution.firstTime` and `ChartExecution.lastTime` fields for host-confirmed aggregated execution ranges without changing the existing marker anchor `time`.
- Reused the existing execution validation boundary for initial options and `setExecutions()`: both endpoints must be supplied together, must be finite valid times, and must satisfy `firstTime <= time <= lastTime`; invalid batches remain atomic.
- Reused the native execution tooltip rows for hover and mouse/touch pinned details. Legacy data shows `time`, equal endpoints show one time, and distinct endpoints show a compact localized range; each grouped execution retains its own range.
- Preserved marker grouping, coordinates, price, shape, color, hit testing, lifecycle clearing, defensive cloning, layout exclusion, and host-owned execution semantics.
- Added the same-second formatter fallback so distinct millisecond endpoints cannot collapse to one displayed value after locale formatting.
- Accepted the exact 8-file immutable package artifact after `69 files / 1,161 tests`, combined Chrome `118/118`, Charts `14 files / 163 tests`, Charts Chrome/Edge `67/67` per browser, and exact packed Chrome/Edge consumer execution; SHA-256 is `f622e5fd1e8554ec0c47579012d17651ffd52b568c1003865987f59721e8efa0`, SHA-512 is `2e88fe783c8f6e86e2e01d0b0cdaf75d855ce44743782ebcf631813b1cf71808d758d2c9f24dea93425daa75c3c6637cf1a5574a4928caed6b6edcf24bd044b7`.

## @simoncharts/charts 1.0.0-rc.32 - 2026-07-27

- Added `getStudyApi()` with a live `ChartStudyApi` handle for defensive input reads, atomic validated partial input updates, visibility control, and removal through the existing study Entity engine.
- Added `dataReady()` for imperative host workflows. The Promise is scoped to the exact current symbol, timeframe, adjustment mode, view, and intraday-day selection plus its first scheduled paint, and resolves `false` when that presentation is replaced, cannot be materialized, becomes blocked, or is destroyed.
- Made recoverable initial-data retries re-enter loading before requesting again, so `retry(); await dataReady()` follows the new attempt without inheriting the failed state.
- Made range, render, indicator, and stateful-series retries settle only after their real replacement result is materialized and painted; concurrent calculation failures are all retried before readiness returns.
- Aborted superseded indicator and stateful-series calculations so delayed page reloads cannot write stale checkpoints after a selection or view replacement.
- Kept recovery ownership on the current calculation across stateful-series replacement and queued Canvas retries, preventing stale types or pending calculations from reporting a false ready state.
- Added the public `CALCULATION_FAILED` / `calculation` error classification with `context.calculationKind`, instead of reporting indicator or stateful-series failures as Canvas render failures.
- Strengthened the release gate so the exact packed, non-workspace installation executes its public workflow in both Chrome and Edge, while workspace browser runs always use isolated current-worktree servers.
- Migration: TypeScript hosts with exhaustive `ChartErrorCode` or `ChartErrorScope` switches must handle the new calculation members.
- Kept the public surface minimal: no second study store, no duplicate series handle, no speculative style schema, no new dependency, and no layout-version change.
- Accepted the exact 8-file immutable package artifact after `69 files / 1,159 tests`, combined Chrome `116/116`, Charts `14 files / 161 tests`, Charts Chrome/Edge `65/65` per browser, and exact packed Chrome/Edge consumer execution; SHA-256 is `21d7b1565d925fca87e61d3c1ae38bef0bda3391093e14fd38ea749df965e2d7`, SHA-512 is `e7a1b873391f68f989d3149c33a53ca7b4a355fa5ab6e77cfd3d4de2357ebbc5c8b35ae9a83c67394c37a71748eb21f113ff5f91d233c2dfc69be8316b755e24`.

## @simoncharts/charts 1.0.0-rc.31 - 2026-07-27

- Added public `ChartDrawing.interactive?: boolean` and `ChartDrawing.affectsPriceScale?: boolean` controls without materializing defaults in existing layouts.
- Made `interactive: false` drawings render and remain fully programmable while excluding them from hover, hit testing, handles, selection, pointer capture, drag helpers, and keyboard mutation; `locked` remains an independent edit constraint.
- Allowed visible, finite, time-intersecting `datePriceRange` and `priceRange` drawings with `affectsPriceScale: true` to extend linear, logarithmic, percentage, and fixed intraday automatic price scales without changing market, indicator, or execution data.
- Preserved both fields through batch replacement, Entity API, layout export/import, browser persistence, defensive clones, and strict public JSON validation.
- Accepted the exact 8-file immutable package artifact after `69 files / 1,143 tests`, combined Chrome `103/103`, Charts `14 files / 145 tests`, and Charts Chrome/Edge `52/52` per browser; SHA-256 is `5a32813bbd0c56d69d8ee84d30118723b9ad3336bcf77c1876899fb6fb73f218`, SHA-512 is `be80c274e39490dcbb14fe67d9d645d8b95ddc75b2b046c583d040c64c46425af600feb0a215e0b179f59774e9ba98fe259c0bf42f905bb1f334e8382e7c43bc`.

## @simoncharts/charts 1.0.0-rc.30 - 2026-07-27

- Added dedicated public `crosshair-moved` and `crosshair-left` subscriptions without adding per-pointer work to unrelated lifecycle listeners.
- Published the accepted symbol/timeframe/adjustment/data revision, exact host candles, raw crosshair price, nullable real-reference change values, canvas-local offsets, and every output of each visible study instance without fabricating or formatting data.
- Coalesced pointer bursts to the latest position once per animation frame while preserving same-candle vertical movement.
- Cleared crosshair state across leave, selection replacement, cancellation, and destroy boundaries, retained the first real move after fast rematerialization, and isolated every listener with a defensive event snapshot.
- Accepted the exact 8-file immutable package artifact after `69 files / 1,116 tests`, combined Chrome `102/102`, Charts `14 files / 140 tests`, and Charts Chrome/Edge `51/51` per browser; SHA-256 is `a837f0a39c13595d3959c5c6a8b90804b69373326a236c0162c397bd220bd02c`, SHA-512 is `33af89105f88c813be383f5861fa15775a086a00c0e29fe6fd8e5e5d95b6eedd42ef85ecf403842c347a865338078744ba288ccf578881413c64fe32a24539f4`.

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
