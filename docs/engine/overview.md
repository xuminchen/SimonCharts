# SimonCharts Engine Overview

SimonCharts is a reusable chart engine kernel. It is not a host application and not a business platform.

Host applications own data loading, authentication, persistence, business workflows, and product UI. The engine owns neutral chart data contracts, rendering, interaction, drawing, commands, and neutral events.

The v0.1 engine package is `@simoncharts/chart-engine`. It exposes:

- market data contracts such as `CandleSeries`, `Candle`, `ViewportState`, and `ChartTheme`
- chart type contracts through `SeriesType` and `supportedSeriesTypes`
- canvas rendering entry points such as `renderStaticChart`, `renderOverlay`, and `resizeCanvas`
- visual extension contracts such as `IndicatorVisualOutput` and `VisualRenderer`
- panel layout contracts such as `PanelDefinition` and `PanelArea`
- drawing contracts such as `DrawingObject`, `DrawingType`, and `createDrawingEditor`
- capability diagnostics through `createEngineCapabilityManifest`
- public facade APIs such as `ChartEngine`, `createChartEngine`, and `ChartEngineEvent`

The engine does not import host APIs, host stores, host routes, or product-domain models. A host can pass neutral `CandleSeries`, visual outputs, drawings, settings, and commands into the engine, then listen to neutral events.

## Capability Manifest

`createEngineCapabilityManifest()` returns a deterministic package-root summary of the Engine feature surface. Hosts can use it for diagnostics, documentation, onboarding, and compatibility checks without reading internal package paths.

The manifest is host-independent. It reports current Engine-owned support for 17 series types, 63 built-in drawing types, 16 core indicators, built-in drawing tool metadata, visual output renderer families, drawing editor capabilities, interaction capabilities, and extension contribution types.

The manifest does not control host feature flags, product permissions, persistence, remote plugins, collaboration, routing, or business workflows.
