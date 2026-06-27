# Interaction And Rendering Lifecycle

SimonCharts v0.2 adds two neutral engine subsystems: `InteractionSession` and `RenderScheduler`.

`InteractionSession` accepts DOM-free `InteractionInput` objects. Hosts translate browser or native input into these values. The session owns pointer, crosshair, tooltip, cursor, magnet, and keyboard state, then emits neutral session events.

`RenderScheduler` accepts `RenderInvalidation` objects. It merges invalidations within one frame, runs render passes in deterministic order, and records `RenderMetrics`.

SimonCharts v0.6 hardens render diagnostics. `RenderMetrics.lastFrame` records a neutral frame snapshot with frame id, timestamp, duration, dirty layers, invalidation reasons, layout flag, and pass-level diagnostics. Scheduler state returns cloned diagnostics so host inspection cannot mutate engine state.

Typical flow:

1. Host receives input outside the engine.
2. Host maps that input into `InteractionInput`.
3. `InteractionSession.handleInput()` updates `InteractionSessionState`.
4. `InteractionSession` emits neutral session events.
5. Host maps those events into `RenderInvalidation`.
6. `RenderScheduler.invalidate()` receives them and coalesces dirty layers.
7. Scheduler runs `static`, `dynamic`, and `overlay` passes as needed.
8. `RenderMetrics` are exposed for diagnostics and tests.

Canvas rendering keeps clear behavior explicit. `renderStaticChart()` does not clear by default, because some hosts paint or compose the static surface themselves. It can clear and paint `theme.colors.background` through options. `renderOverlay()` clears by default, because crosshair and tooltip surfaces are typically transient, and can opt out when a host owns overlay clearing.

The host owns native or browser event handling and canvas drawing calls. The engine owns only neutral chart input, interaction state, invalidation, pass scheduling, and metrics.

The engine must stay independent from TradingReviewSystem and other host applications. It does not import DOM events, host APIs, stores, schemas, routes, review, strategy, watchlist, AI, or other product business models.
