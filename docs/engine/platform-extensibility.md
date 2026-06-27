# Platform Extensibility

SimonCharts v0.9 adds a neutral extension kernel for installing Engine contributions into existing registries.

Extensions are described with `ChartExtensionManifest`:

```ts
const extension = createChartExtension(
  {
    id: "acme.tools",
    label: "ACME Tools",
    version: "1.0.0",
    capabilities: ["drawingTools"]
  },
  {
    drawingTools: [measurementBoxTool],
    drawingRenderers: [measurementBoxRenderer]
  }
);
```

Install contributions into host-owned registries:

```ts
const result = applyChartExtension(extension, {
  drawingTools,
  drawingRenderers,
  visualRenderers,
  seriesRenderers,
  figureRenderers
});
```

`ChartExtensionInstallResult` reports installed contribution counts. `createChartExtensionRegistry()` stores extension manifests and rejects duplicate extension ids.

## Local Lifecycle

Use `createChartExtensionLifecycle(context)` when a host needs local install state and uninstall behavior:

```ts
const lifecycle = createChartExtensionLifecycle({
  drawingTools,
  drawingRenderers,
  visualRenderers,
  seriesRenderers,
  figureRenderers
});

lifecycle.install(extension);
lifecycle.uninstall(extension.manifest.id);
```

The lifecycle manager:

- rejects duplicate installed extension ids
- rejects duplicate installed contribution keys such as `drawingTools:acme.measurement-box`
- exposes `isInstalled(id)`, `listInstalled()`, and `getState()`
- captures previous registry entries before install
- restores previous registry entries when an extension is uninstalled and its installed contribution is still current

Use `applyChartExtension()` for direct one-way installs when lifecycle state is not needed.

## Compatibility Preflight

Use `getChartExtensionCapabilityRequirements(extension)` to derive neutral Engine requirements from a local extension's contribution arrays. Use `checkChartExtensionCompatibility(manifest, extension)` to compare those requirements against `createEngineCapabilityManifest()` before attempting an install:

```ts
const manifest = createEngineCapabilityManifest();
const result = checkChartExtensionCompatibility(manifest, extension);
```

The helpers inspect local `ChartExtension.contributions` only. They compare supported contribution type names such as `drawingTools` and `visualRenderers` against the neutral Engine manifest. They do not load, sandbox, trust, persist, install, or distribute extensions.

Hosts still own extension loading, trust policy, persistence, product UI, and product workflows.

## Validation Diagnostics

Use `validateChartExtension(extension)` when hosts or extension authoring tools need deterministic diagnostics before registration or install. Validation inspects local extension structure, including manifest identity fields, duplicate contribution keys, and drawing contribution type names.

The validator returns issue objects instead of installing the extension or throwing. It is not a security review, sandbox, trust policy, marketplace review, persistence layer, or permission system.

## Contribution Types

Supported v0.9 contributions:

- `seriesRenderers`
- `visualRenderers`
- `drawingRenderers`
- `drawingTools`
- `figureRenderers`

These are the same neutral renderer and registry contracts used by the built-in Engine. Hosts still own when and where extension code is loaded.

## Custom Drawing Types

Custom drawing types must be namespaced lowercase strings:

```ts
const type = "acme.measurement-box";
```

Unscoped names such as `hostReview` are rejected by `parseDrawingObject()` and drawing deserialization. This keeps host business vocabulary out of the Engine while allowing third-party drawing tools to round-trip through neutral drawing serialization and editor state.

Use:

- `isBuiltInDrawingType(type)`
- `isCustomDrawingType(type)`
- `isDrawingType(type)`

`drawingTypes` remains the source of truth for built-in drawing coverage only.

## Non-Goals

v1.0 local lifecycle does not load remote plugins, execute sandboxed code, provide a marketplace, persist extensions, define trust policy, or grant extensions access to host APIs. Extension loading, trust policy, and persistence remain host responsibilities.
