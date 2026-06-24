# Boundary Rules

The engine boundary is strict: `packages/chart-engine` must stay reusable and host-independent.

Allowed inside the engine:

- neutral market data such as `CandleSeries`
- chart state such as `ViewportState`, `SeriesType`, and `ChartSettings`
- rendering contracts and canvas layers
- interaction state and neutral events
- `VisualRenderer`, drawing, panel, and command contracts

Not allowed inside the engine:

- host APIs, stores, schemas, routes, and UI shell state
- authentication, account, billing, or user models
- review, strategy, watchlist, portfolio, AI, news, or order-flow business models
- persistence clients or product-specific identifiers

The repository enforces this with:

```bash
npm run guard:engine-boundary
```

The guard scans `packages/chart-engine` for forbidden imports and boundary terms. Documentation, playground code, and host integrations may describe host responsibilities, but the engine package must not import them.
