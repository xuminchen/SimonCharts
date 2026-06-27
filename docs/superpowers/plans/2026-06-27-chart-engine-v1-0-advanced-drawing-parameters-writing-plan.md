# Chart Engine v1.0 Advanced Drawing Parameters Writing Plan

**Problem:** SimonCharts Engine now exposes generic drawing property metadata for style, content, and state controls. Advanced tools such as Fibonacci, Gann, position, and range drawings still rely on hardcoded constants or free-form `metadata` without an Engine-owned schema or editor command. Hosts therefore cannot build a complete drawing editor for those tools from Engine metadata alone.

**Goal:** Add neutral advanced drawing parameter metadata and editor support. Advanced drawing types should expose parameter controls through the same property schema API, update selected drawing metadata through a neutral editor command, and have figure/render output consume supported metadata where it already affects geometry or labels.

**Boundary:**
- Do not add TradingReviewSystem integration.
- Do not import host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, persistence, or product workflow modules.
- Do not add DOM UI code to the Engine package.
- Do not add collaboration, cloud persistence, marketplace behavior, plugin sandboxing, or remote plugin loading.
- Do not build a full parameter expression language.
- Keep metadata keys generic and Engine-owned.

## Success Criteria

1. Advanced drawing types expose parameter definitions through `getDrawingPropertySchema()`.
   - Verify unit tests inspect Fibonacci levels, Gann ratios, and range/position label properties.
2. Drawing editor can update selected drawing metadata through neutral commands.
   - Verify unit tests cover `updateSelectedMetadata`, history, locked-drawing behavior, and cloning.
3. Figure/render output consumes supported advanced parameters.
   - Verify Fibonacci and Gann figure tests use metadata-provided levels/ratios.
   - Verify range/position labels can come from metadata without host logic.
4. Package-root SDK consumers can use the new parameter contract.
   - Verify public runtime/type API guards and package consumer checks.
5. Documentation explains advanced parameters and keeps host UI/persistence/business workflows outside Engine scope.
   - Verify docs mention metadata parameter schema and command boundaries.

## Proposed Scope

1. Property schema extension
   - Add a parameter property scope backed by drawing `metadata`.
   - Add `numberList` support for level/ratio lists.
   - Add parameter definitions for Fibonacci levels, Gann fan ratios, range labels, and position labels.

2. Drawing editor metadata command
   - Add `updateSelectedMetadata(metadata)` to `DrawingEditor`.
   - Add `updateSelectedMetadata` to `DrawingEditorCommand`.
   - Apply updates only to editable selected drawings and keep undo/redo behavior.

3. Figure and renderer consumption
   - Read finite numeric level/ratio arrays from metadata.
   - Read string labels from metadata for range/position labels.
   - Preserve current defaults when metadata is missing or invalid.

4. SDK, docs, and demo
   - Update package snapshots and consumer fixtures.
   - Let playground render parameter controls from schema.
   - Update docs and release evidence.

## Validation Gate

Run before accepting this phase:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingPropertySchema.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts packages/chart-engine/src/__tests__/drawingCoverage.test.ts
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-editor.spec.ts
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run guard:public-api
npm run guard:public-types
npm run guard:sdk-imports
npm run check:package-consumer
npm run check:package-artifact
npm run check:package-types
npm run check:performance
npm run check:release-readiness
npm run build
npm pack --dry-run -w @simoncharts/chart-engine
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```
