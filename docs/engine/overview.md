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
- public facade APIs such as `ChartEngine`, `createChartEngine`, and `ChartEngineEvent`

The engine does not import host APIs, host stores, host routes, or product-domain models. A host can pass neutral `CandleSeries`, visual outputs, drawings, settings, and commands into the engine, then listen to neutral events.
