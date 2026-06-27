# Chart Engine v1.0 Drawing Property Schema Writing Plan

**Problem:** SimonCharts Engine already owns drawing tools, drawing objects, commands, serialization, renderers, and editor operations, but it does not expose an Engine-owned property schema for drawing editor UIs. Hosts can call `updateSelectedStyle()` and `updateSelectedText()`, yet they still have to hardcode which controls apply to each drawing type. That keeps the drawing editor short of a complete reusable Engine contract.

**Goal:** Add a neutral drawing property schema that lets hosts build drawing property panels from Engine metadata. The schema should describe style, content, and state controls for built-in drawing types without importing or naming any host business concepts.

**Boundary:**
- Do not add TradingReviewSystem integration.
- Do not import host APIs, stores, schemas, routes, review, strategy, watchlist, AI, auth, account, billing, portfolio, persistence, or product workflow modules.
- Do not add DOM UI components to the Engine package.
- Do not add remote plugin loading, sandboxing, marketplace behavior, or cloud persistence.
- Keep property metadata declarative and command-oriented.
- Preserve existing drawing editor methods and `DrawingEditorCommand` payloads.

## Success Criteria

1. Every built-in `DrawingType` has a property schema.
   - Verify unit tests compare `drawingTypes` with `getDrawingPropertySchema(type)`.
2. Property schemas expose common style controls, text controls for annotation drawings, and state commands for visibility and locking.
   - Verify unit tests inspect line, shape, annotation, and state property definitions.
3. Property schema results are safe for hosts to consume without mutating Engine internals.
   - Verify unit tests mutate returned arrays/definitions and re-read stable definitions.
4. Public SDK users can import and typecheck the property schema from `@simoncharts/chart-engine`.
   - Verify runtime API guard, type API guard, package consumer, and package type consumer.
5. Documentation explains the Engine-owned property schema and keeps UI rendering and persistence as host responsibilities.
   - Verify docs mention property schema APIs and boundaries.

## Proposed Scope

1. Drawing property schema module
   - Add property definition types.
   - Add built-in property groups for style, text, visibility, and locking.
   - Add `getDrawingPropertySchema(type)` and helper predicates for text/fill-capable drawings.

2. Public API and consumers
   - Export schema APIs from the package root.
   - Update runtime and type API snapshots.
   - Exercise schema imports from runtime and type consumer fixtures.

3. Docs and playground alignment
   - Document the property schema in drawing editor and public API docs.
   - Use the schema in the playground property panel so the visible demo follows the Engine contract.

## Validation Gate

Run before accepting this phase:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingPropertySchema.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts
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
