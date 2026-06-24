# SimonCharts Chart Engine v0.2 Interaction and Rendering Hardening Design

Date: 2026-06-24

## Status

Approved for implementation planning.

## Context

SimonCharts v0.1 is a reusable chart engine kernel with neutral market data contracts, 17 chart types, visual outputs, panels, drawings, commands, a public facade, playground coverage, documentation, and boundary guards.

v0.2 should not expand host business scope. The next step is to harden professional interaction behavior and rendering lifecycle so the engine is easier to integrate into future host applications without coupling to TradingReviewSystem or any other business product.

## Goal

v0.2 focuses on **Interaction Hardening** and **Rendering Hardening**.

The engine should provide stable, neutral primitives for:

- pointer, wheel, keyboard, crosshair, tooltip, cursor, and magnet interaction state
- render invalidation, render scheduling, render pass ordering, and render metrics
- playground demonstration of professional interaction and performance behavior
- host integration through neutral input, command, state, and event contracts

## Non-Goals

v0.2 does not include:

- TradingReviewSystem integration
- host business data loading or persistence
- review, strategy, watchlist, AI, auth, account, billing, portfolio, news, or order-flow models
- new chart types beyond v0.1
- a drawing property panel or drawing layer manager
- dirty rectangle rendering
- DOM event types in `packages/chart-engine`

## Architecture

v0.2 adds two independent engine subsystems:

1. `interactionSession`
   - normalizes neutral input into interaction state
   - emits neutral interaction events
   - owns pointer, wheel, keyboard, crosshair, tooltip, cursor, and magnet state

2. `renderScheduler`
   - accepts render invalidation requests
   - merges invalidations within one animation frame
   - executes ordered render passes
   - records render metrics

The playground remains a host-like demonstration layer. It translates browser events into neutral engine inputs and observes engine outputs. It must not become a business product.

## Interaction Model

### State

`InteractionSessionState` should include:

- `pointer`: `idle | hover | dragPan | drawing | resize | canceled`
- `crosshair`: visible or hidden, with optional index, time, price, OHLCV payload
- `tooltip`: visible or hidden, with optional source type and rows
- `cursor`: `default | crosshair | grab | grabbing | drawing | resize`
- `magnet`: `off | ohlc | drawingAnchor | visualPoint`
- `keyboard`: active modifiers and the latest command-style key input

### Input

`InteractionInput` should be neutral and DOM-free. Expected input families:

- pointer move, pointer down, pointer drag, pointer up, pointer cancel
- wheel zoom or pan input
- keyboard down and keyboard up input
- leave or blur input

The playground maps browser events into these neutral inputs. Future hosts use the same input protocol.

### Events

`InteractionSessionEvent` should include:

- `pointerMoved`
- `pointerDragStarted`
- `pointerDragged`
- `pointerDragEnded`
- `wheelZoomed`
- `crosshairChanged`
- `tooltipChanged`
- `cursorChanged`
- `magnetTargetChanged`
- `keyboardCommand`

Events should be serializable plain objects and should not contain DOM objects, host store references, or host model objects.

### Magnet

Magnet behavior should start with extension points, not a large feature set.

v0.2 should support neutral magnet modes:

- `off`
- `ohlc`
- `drawingAnchor`
- `visualPoint`

The session can report the active magnet target. Actual advanced drawing snapping rules can stay in later drawing-focused work.

## Rendering Lifecycle

### Layer IDs

`RenderLayerId` should cover existing engine layers:

- `grid`
- `axis`
- `series`
- `volume`
- `indicators`
- `visuals`
- `drawings`
- `crosshair`
- `tooltip`

### Render Passes

`RenderPass` should be:

- `static`: grid, axis, series, volume, moving average, visual outputs, persisted drawings
- `dynamic`: in-progress drawing, drag affordance, hover or selection affordance
- `overlay`: crosshair, tooltip, cursor hints

### Invalidation

`RenderInvalidation` should include:

- dirty layer ids
- reason
- whether layout recalculation is required
- optional timestamp

Example:

```ts
scheduler.invalidate({
  layers: ["crosshair"],
  reason: "pointerMoved"
});

scheduler.invalidate({
  layers: ["series", "axis"],
  reason: "viewportChanged",
  layoutRequired: true
});
```

### Scheduler

`RenderScheduler` should:

- merge multiple invalidations in one animation frame
- execute render passes in deterministic order
- avoid redundant static redraw during high-frequency pointer movement
- expose state and metrics for tests and playground display

The first implementation should use dirty layer scheduling and pass-level redraw. Dirty rectangle rendering is intentionally deferred.

### Metrics

`RenderMetrics` should include:

- total render count
- render count by pass
- last render duration
- dirty layer count
- last invalidation reasons
- slow frame count, using a default 16.7 ms threshold unless a test supplies another threshold

Metrics are for diagnostics and tests. They are not business analytics.

## Public API

New exports from `@simoncharts/chart-engine`:

- `createInteractionSession`
- `InteractionInput`
- `InteractionSessionState`
- `InteractionSessionEvent`
- `createRenderScheduler`
- `RenderInvalidation`
- `RenderSchedulerState`
- `RenderMetrics`

Existing facade behavior should remain neutral:

- `ChartEngine.dispatch(command)` handles neutral commands
- `ChartEngine.subscribe(listener)` emits neutral events
- `ChartEngine.getState()` may expose interaction and render state, but not DOM or host objects

## Data Flow

Browser or host event flow:

1. Host receives native input.
2. Host maps it to `InteractionInput`.
3. `interactionSession` updates state and emits neutral events.
4. Events or commands invalidate render layers.
5. `renderScheduler` merges invalidations.
6. Scheduler calls render passes in order.
7. Metrics are updated and can be observed by playground or tests.

## Error Handling

The engine should prefer deterministic no-op behavior for invalid interaction input:

- ignored pointer up without active drag
- ignored keyboard up for an inactive key
- ignored unknown magnet target
- ignored render invalidation with no layers

Development-time errors are acceptable for invalid configuration, such as duplicate layer ids or missing render callbacks.

## Boundary Rules

`packages/chart-engine` must remain independent. It must not import:

- playground code
- TradingReviewSystem code
- host APIs, stores, schemas, routes, or persistence
- review, strategy, watchlist, AI, auth, account, billing, portfolio, news, or order-flow business models

The existing boundary guard must continue to pass.

## Playground Demonstration

The playground should demonstrate v0.2 behavior without becoming a product UI:

- crosshair, tooltip, cursor, and magnet state visible through compact diagnostics
- keyboard command proof for `zoomIn`, `zoomOut`, and `resetZoom` neutral command events
- render metrics visible through stable test ids for total render count, static pass count, overlay pass count, and last invalidation reason
- high-frequency mouse move should update overlay state without forcing static redraw every event
- wheel zoom should invalidate only necessary layers

## Testing Strategy

Unit tests:

- pointer input state transitions
- wheel input state and invalidation behavior
- keyboard modifier and command handling
- crosshair, tooltip, cursor, and magnet event emission
- render invalidation merging
- same-frame scheduler coalescing
- render pass order
- render metrics

E2E tests:

- continuous mouse movement does not repeatedly redraw static layers
- wheel zoom invalidates required chart layers
- keyboard `+`, `-`, and `0` inputs trigger neutral zoom command events
- crosshair, tooltip, cursor, and render metrics are observable in playground through stable test ids

Verification commands:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

## Acceptance Criteria

- Interaction session exists as a neutral engine subsystem.
- Render scheduler exists as a neutral engine subsystem.
- No v0.2 engine module imports host or playground code.
- Pointer, wheel, keyboard, crosshair, tooltip, cursor, and magnet state are unit-tested.
- Render invalidation, render pass order, coalescing, and metrics are unit-tested.
- Playground demonstrates the interaction and render lifecycle behavior.
- Full test, typecheck, boundary, build, and E2E verification pass.
