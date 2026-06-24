# Testing Strategy

The v0.1 test strategy has three layers.

Unit tests cover engine contracts and behavior:

```bash
npm run test
```

Focused examples include model validation, series transforms, renderer registries, autoscale, hit-test, visual outputs, drawing editor operations, command history, `ChartEngine`, and static rendering.

Type and boundary verification:

```bash
npm run typecheck
npm run guard:engine-boundary
```

`typecheck` validates the package and playground TypeScript projects. The boundary guard validates that the chart engine stays independent from host application code and business vocabulary.

Browser acceptance uses Playwright:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Playwright coverage verifies static canvas rendering, interaction, every v0.1 chart type, visual panels, drawing editor flows, and settings/action controls.

Before a release candidate, run:

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

## v0.2 Interaction And Rendering Verification

`InteractionSession` verification covers neutral idle state, pointer and drag lifecycle, crosshair, tooltip, magnet, keyboard zoom commands, cleanup on leave or blur, and cloned event/state payloads:

```bash
npm run test -- packages/chart-engine/src/__tests__/interactionSession.test.ts
```

`RenderScheduler` verification covers `RenderInvalidation` coalescing, render pass order, pending dirty layers, follow-up invalidations, `RenderMetrics`, slow frame counts, and destroy cleanup:

```bash
npm run test -- packages/chart-engine/src/__tests__/renderScheduler.test.ts
```

`ChartEngine` facade verification covers neutral interaction and render snapshots through `setInteractionState()`, `setRenderState()`, `getState()`, and facade events:

```bash
npm run test -- packages/chart-engine/src/__tests__/chartEngine.test.ts
```

Playground integration exercises playground browser input translation and verifies diagnostics and behavior, including high-frequency pointer movement without static redraw spam and keyboard zoom commands through neutral interaction events:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/interaction-rendering-hardening.spec.ts
```

Boundary verification confirms engine TypeScript files do not import app or host modules through forbidden paths and do not contain blocked host or business vocabulary:

```bash
npm run guard:engine-boundary
```
