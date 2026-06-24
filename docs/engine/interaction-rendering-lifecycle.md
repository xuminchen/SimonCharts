# Interaction And Rendering Lifecycle

SimonCharts v0.2 adds two neutral engine subsystems: `InteractionSession` and `RenderScheduler`.

`InteractionSession` accepts DOM-free `InteractionInput` objects. Hosts translate browser or native input into these values. The session owns pointer, crosshair, tooltip, cursor, magnet, and keyboard state, then emits neutral session events.

`RenderScheduler` accepts `RenderInvalidation` objects. It merges invalidations within one frame, runs render passes in deterministic order, and records `RenderMetrics`.

Typical flow:

1. Host receives input outside the engine.
2. Host maps that input into `InteractionInput`.
3. `InteractionSession.handleInput()` updates `InteractionSessionState`.
4. Session events produce `RenderInvalidation`.
5. `RenderScheduler.invalidate()` coalesces dirty layers.
6. Scheduler runs `static`, `dynamic`, and `overlay` passes as needed.
7. `RenderMetrics` are exposed for diagnostics and tests.

The host owns native or browser event handling and canvas drawing calls. The engine owns only neutral chart input, interaction state, invalidation, pass scheduling, and metrics.

The engine must stay independent from TradingReviewSystem and other host applications. It does not import DOM events, host APIs, stores, schemas, routes, review, strategy, watchlist, AI, or other product business models.
