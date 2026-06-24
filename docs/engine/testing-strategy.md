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
