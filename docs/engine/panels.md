# Panels

Panels are described with `PanelDefinition` and resolved into `PanelArea`:

```ts
const panels: PanelDefinition[] = [
  { id: "main", kind: "main", label: "Main", heightRatio: 3 },
  { id: "volume", kind: "sub", label: "Volume", heightRatio: 1 }
];

const areas = createPanelLayout({
  width,
  height,
  rightAxisWidth: 48,
  bottomAxisHeight: 24,
  panels
});
```

`PanelDefinition` is layout metadata only. It does not identify a host page, feature, user workflow, strategy, or persisted dashboard.

Panel scales are computed through `createPanelScales()` and related helpers. Renderers receive panel geometry through `LayerRenderContext` and `RenderState.panels`.

The built-in playground uses one main panel and one sub panel to verify visual output isolation and canvas rendering across panels.
