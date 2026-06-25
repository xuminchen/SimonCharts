# Chart Engine v0.3 Visual Drawing Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the SimonCharts visual and drawing gap by adding a figure primitive kernel, expanded drawing coverage, a complete neutral drawing editor, and a playground acceptance workbench.

**Architecture:** Keep `packages/chart-engine` as the only engine package and keep `apps/playground` as a neutral engine harness. Drawing tools are defined through an engine-owned registry, drawing renderers produce reusable figure primitives, and the editor emits neutral events without importing host APIs, host stores, host schemas, host routes, review models, strategy models, watchlist models, AI models, auth models, or account models.

**Tech Stack:** TypeScript, CanvasRenderingContext2D, Vitest, Playwright, Vite, npm workspaces.

---

## Source Documents

- Design spec: `docs/superpowers/specs/2026-06-25-chart-engine-v0-3-visual-drawing-platform-design.md`
- Platform baseline: `docs/superpowers/specs/2026-06-23-chart-engine-platform-design.md`
- v0.1 baseline: `docs/superpowers/specs/2026-06-24-chart-engine-v0-1-full-engine-design.md`
- v0.2 baseline: `docs/superpowers/specs/2026-06-24-chart-engine-v0-2-interaction-rendering-hardening-design.md`

## Scope Check

This plan covers one engine release area: visual and drawing platform completeness. It intentionally includes figure primitives, drawing tools, editor interactions, indicator visual coverage, and the playground acceptance surface because those pieces must work together for the same user-facing outcome: a complete chart drawing and visual-extension engine.

## File Structure

### New Engine Files

- Create: `packages/chart-engine/src/figures/figureTypes.ts` - neutral figure contracts, styles, bounds, and hit-test result types.
- Create: `packages/chart-engine/src/figures/figureRegistry.ts` - registry for figure renderers and hit testers.
- Create: `packages/chart-engine/src/figures/figureGeometry.ts` - pure bounds and distance helpers.
- Create: `packages/chart-engine/src/figures/builtInFigures.ts` - built-in canvas renderers for line, polyline, polygon, rect, rotated rect, circle, ellipse, arc, curve, text, label, arrow, band, and marker.
- Create: `packages/chart-engine/src/drawing/drawingToolDefinitions.ts` - built-in drawing tool metadata and target drawing type list.
- Create: `packages/chart-engine/src/drawing/drawingToolRegistry.ts` - registry for tool definitions.
- Create: `packages/chart-engine/src/drawing/drawingSchema.ts` - versioned serialized drawing schema.
- Create: `packages/chart-engine/src/drawing/drawingMigrations.ts` - deterministic migration helpers.
- Create: `packages/chart-engine/src/drawing/drawingStyle.ts` - style patching and defaults.
- Create: `packages/chart-engine/src/drawing/drawingEditState.ts` - editor state, handles, z-order, clipboard, object manager snapshot types.
- Create: `packages/chart-engine/src/drawing/drawingHotkeys.ts` - neutral drawing command bindings.
- Create: `packages/chart-engine/src/drawing/drawingFigures.ts` - drawing-to-figure conversion for built-in drawing types.
- Create: `packages/chart-engine/src/indicators/indicatorDefinitions.ts` - indicator definition registry data.
- Create: `packages/chart-engine/src/indicators/coreIndicators.ts` - deterministic fixture-grade indicator calculations for v0.3 target indicators.

### Modified Engine Files

- Modify: `packages/chart-engine/src/drawing/drawingTypes.ts` - add v0.3 drawing types and typed style fields.
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts` - replace hard-coded tool logic with registry-driven creation and complete editing operations.
- Modify: `packages/chart-engine/src/drawing/drawingCommands.ts` - add style, text, z-order, duplicate, copy, paste, group selection, and hotkey command payloads.
- Modify: `packages/chart-engine/src/drawing/drawingRegistry.ts` - route render and hit-test work through figure conversion for every drawing type returned by `createFiguresForDrawing`.
- Modify: `packages/chart-engine/src/drawing/drawingSerialization.ts` - use versioned schema and migration helpers.
- Modify: `packages/chart-engine/src/drawing/drawingMagnet.ts` - add deterministic policies for OHLC, drawing anchor, and visual point snapping.
- Modify: `packages/chart-engine/src/render/drawing/renderers/defaultDrawingRenderers.ts` - register v0.3 drawing renderers.
- Modify: `packages/chart-engine/src/render/drawing/renderers/drawingRendererHelpers.ts` - delegate shared drawing operations to figure helpers.
- Modify: `packages/chart-engine/src/engine/chartEngine.ts` - expose neutral snapshots for tool definitions, object manager state, and indicator definitions.
- Modify: `packages/chart-engine/src/index.ts` - export new public engine contracts.

### Tests

- Create: `packages/chart-engine/src/__tests__/figurePrimitives.test.ts`
- Create: `packages/chart-engine/src/__tests__/drawingToolRegistry.test.ts`
- Create: `packages/chart-engine/src/__tests__/drawingSchema.test.ts`
- Create: `packages/chart-engine/src/__tests__/drawingCoverage.test.ts`
- Create: `packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`
- Create: `packages/chart-engine/src/__tests__/drawingHotkeys.test.ts`
- Create: `packages/chart-engine/src/__tests__/coreIndicators.test.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingEditor.test.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingRenderers.test.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingModel.test.ts`

### Playground

- Modify: `apps/playground/src/drawingToolbar.ts` - render grouped tool palettes from engine tool definitions.
- Modify: `apps/playground/src/main.ts` - wire object manager, property panel, import/export, all tool groups, and indicator selector.
- Modify: `apps/playground/src/styles.css` - keep the workbench dense, readable, and responsive.
- Modify: `apps/playground/tests/drawing-editor.spec.ts` - cover complete editor workflows.
- Create: `apps/playground/tests/drawing-coverage.spec.ts` - create one drawing from each built-in tool.
- Create: `apps/playground/tests/indicator-workbench.spec.ts` - verify indicator selection and visual output panels.

### Documentation

- Modify: `docs/engine/drawing-editor.md`
- Modify: `docs/engine/visual-outputs.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`
- Create: `docs/engine/drawing-tool-coverage.md`

## Task 1: Lock The Capability Matrix

**Files:**
- Create: `docs/engine/drawing-tool-coverage.md`
- Modify: `docs/engine/drawing-editor.md`
- Test: `docs/superpowers/plans/2026-06-25-chart-engine-v0-3-visual-drawing-platform.md`

- [ ] **Step 1: Write the drawing coverage document**

Create `docs/engine/drawing-tool-coverage.md` with this structure:

```markdown
# Drawing Tool Coverage

## Built-In Tool List

| Category | Drawing Type | Anchors | Drawing Mode | Editor Coverage |
| --- | --- | ---: | --- | --- |
| Basic overlay | trendLine | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Basic overlay | ray | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Basic overlay | extendedLine | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Basic overlay | horizontalLine | 1 | step | create, select, drag, style, hide, lock, delete, undo, redo |
| Basic overlay | verticalLine | 1 | step | create, select, drag, style, hide, lock, delete, undo, redo |
| Basic overlay | crossLine | 1 | step | create, select, drag, style, hide, lock, delete, undo, redo |
| Basic overlay | segment | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Basic overlay | straightLine | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Basic overlay | rayLine | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Basic overlay | horizontalRayLine | 1 | step | create, select, drag, style, hide, lock, delete, undo, redo |
| Basic overlay | horizontalSegment | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Basic overlay | horizontalStraightLine | 1 | step | create, select, drag, style, hide, lock, delete, undo, redo |
| Basic overlay | verticalRayLine | 1 | step | create, select, drag, style, hide, lock, delete, undo, redo |
| Basic overlay | verticalSegment | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Basic overlay | verticalStraightLine | 1 | step | create, select, drag, style, hide, lock, delete, undo, redo |
| Channel | parallelChannel | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Channel | regressionChannel | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Channel | priceChannelLine | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Fibonacci | fibonacciRetracement | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Fibonacci | fibonacciExtension | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Fibonacci | fibTrendBasedExtension | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Fibonacci | fibTimeZone | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Fibonacci | fibFan | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Fibonacci | fibArc | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Fibonacci | fibChannel | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Fibonacci | fibWedge | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Annotation | text | 1 | step | create, select, drag, style, text, hide, lock, delete, undo, redo |
| Annotation | callout | 2 | step | create, select, drag, edit anchors, style, text, hide, lock, delete, undo, redo |
| Annotation | simpleAnnotation | 1 | step | create, select, drag, style, text, hide, lock, delete, undo, redo |
| Annotation | simpleTag | 1 | step | create, select, drag, style, text, hide, lock, delete, undo, redo |
| Shape | rectangle | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Shape | rotatedRectangle | 3 | step | create, select, drag, edit anchors, rotate, style, hide, lock, delete, undo, redo |
| Shape | circle | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Shape | ellipse | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Shape | polygon | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Shape | triangle | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Shape | arc | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Shape | curve | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Path | path | 3 | continuous | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Path | brush | 3 | continuous | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Path | arrow | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Position | longPosition | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Position | shortPosition | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Position | profitLossRange | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Measurement | datePriceRange | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Measurement | dateRange | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Measurement | priceRange | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Measurement | measure | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Measurement | trendAngle | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Gann | gannFan | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Gann | gannBox | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Gann | gannSquare | 2 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Pitchfork | pitchfork | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Pitchfork | schiffPitchfork | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Pitchfork | modifiedSchiffPitchfork | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Pitchfork | insidePitchfork | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Pattern | elliottImpulseWave | 5 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Pattern | elliottCorrectionWave | 3 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Pattern | xabcdPattern | 5 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Pattern | cypherPattern | 5 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Pattern | headAndShouldersPattern | 5 | step | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
| Forecast | forecastPath | 3 | continuous | create, select, drag, edit anchors, style, hide, lock, delete, undo, redo |
```

- [ ] **Step 2: Verify the document has every target type**

Run:

```bash
rg -n "fibWedge|insidePitchfork|headAndShouldersPattern|forecastPath" docs/engine/drawing-tool-coverage.md
```

Expected: each name appears exactly once in the coverage table.

- [ ] **Step 3: Commit**

```bash
git add docs/engine/drawing-tool-coverage.md docs/engine/drawing-editor.md
git commit -m "docs: define drawing tool coverage matrix"
```

## Task 2: Add Figure Primitive Kernel

**Files:**
- Create: `packages/chart-engine/src/figures/figureTypes.ts`
- Create: `packages/chart-engine/src/figures/figureRegistry.ts`
- Create: `packages/chart-engine/src/figures/figureGeometry.ts`
- Create: `packages/chart-engine/src/figures/builtInFigures.ts`
- Create: `packages/chart-engine/src/__tests__/figurePrimitives.test.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing primitive tests**

Create `packages/chart-engine/src/__tests__/figurePrimitives.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createFigureRendererRegistry,
  createBuiltInFigureRenderers,
  getFigureBounds,
  hitTestFigure,
  type FigureObject
} from "../index";

describe("figure primitives", () => {
  it("registers all built-in figure renderers", () => {
    const registry = createFigureRendererRegistry();

    for (const renderer of createBuiltInFigureRenderers()) {
      registry.register(renderer);
    }

    expect(registry.list().map((renderer) => renderer.type)).toEqual([
      "line",
      "polyline",
      "polygon",
      "rect",
      "rotatedRect",
      "circle",
      "ellipse",
      "arc",
      "curve",
      "text",
      "label",
      "arrow",
      "band",
      "marker"
    ]);
  });

  it("computes bounds for geometry figures", () => {
    const figure: FigureObject = {
      id: "line-1",
      type: "line",
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 60 }
      ]
    };

    expect(getFigureBounds(figure)).toEqual({ minX: 10, minY: 20, maxX: 40, maxY: 60 });
  });

  it("hit-tests line geometry by pixel distance", () => {
    const figure: FigureObject = {
      id: "line-1",
      type: "line",
      points: [
        { x: 10, y: 10 },
        { x: 50, y: 10 }
      ]
    };

    expect(hitTestFigure(figure, { x: 30, y: 13 }, 4)).toEqual({
      figureId: "line-1",
      distance: 3
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm run test -- packages/chart-engine/src/__tests__/figurePrimitives.test.ts
```

Expected: FAIL because `figures` exports do not exist.

- [ ] **Step 3: Add the public figure types**

Create `packages/chart-engine/src/figures/figureTypes.ts`:

```ts
export type FigureType =
  | "line"
  | "polyline"
  | "polygon"
  | "rect"
  | "rotatedRect"
  | "circle"
  | "ellipse"
  | "arc"
  | "curve"
  | "text"
  | "label"
  | "arrow"
  | "band"
  | "marker";

export interface FigurePoint {
  x: number;
  y: number;
}

export interface FigureStyle {
  color?: string;
  fill?: string;
  lineWidth?: number;
  lineDash?: number[];
  textColor?: string;
  fontSize?: number;
}

export interface FigureObject {
  id: string;
  type: FigureType;
  points: FigurePoint[];
  text?: string;
  style?: FigureStyle;
}

export interface FigureBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FigureHitTestResult {
  figureId: string;
  distance: number;
}

export interface FigureRenderContext {
  context: CanvasRenderingContext2D;
  figure: FigureObject;
}

export interface FigureRenderer {
  type: FigureType;
  render(context: FigureRenderContext): void;
}
```

- [ ] **Step 4: Add registry and geometry helpers**

Create `figureRegistry.ts` and `figureGeometry.ts` with deterministic helpers:

```ts
import type { FigureRenderer, FigureType } from "./figureTypes";

export interface FigureRendererRegistry {
  register(renderer: FigureRenderer): void;
  require(type: FigureType): FigureRenderer;
  list(): FigureRenderer[];
}

export function createFigureRendererRegistry(): FigureRendererRegistry {
  const renderers = new Map<FigureType, FigureRenderer>();

  return {
    register(renderer) {
      renderers.set(renderer.type, renderer);
    },
    require(type) {
      const renderer = renderers.get(type);

      if (!renderer) {
        throw new Error(`Figure renderer is not registered: ${type}`);
      }

      return renderer;
    },
    list() {
      return [...renderers.values()];
    }
  };
}
```

```ts
import type { FigureBounds, FigureHitTestResult, FigureObject, FigurePoint } from "./figureTypes";

export function getFigureBounds(figure: FigureObject): FigureBounds | undefined {
  if (figure.points.length === 0) {
    return undefined;
  }

  return figure.points.reduce<FigureBounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: figure.points[0].x,
      minY: figure.points[0].y,
      maxX: figure.points[0].x,
      maxY: figure.points[0].y
    }
  );
}

export function hitTestFigure(
  figure: FigureObject,
  point: FigurePoint,
  tolerance: number
): FigureHitTestResult | undefined {
  const distance = getMinimumSegmentDistance(figure.points, point);
  return distance <= tolerance ? { figureId: figure.id, distance } : undefined;
}

function getMinimumSegmentDistance(points: FigurePoint[], point: FigurePoint): number {
  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (points.length === 1) {
    return getPointDistance(points[0], point);
  }

  return points.slice(1).reduce((best, current, index) => {
    const previous = points[index];
    return Math.min(best, getSegmentDistance(previous, current, point));
  }, Number.POSITIVE_INFINITY);
}

function getPointDistance(a: FigurePoint, b: FigurePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getSegmentDistance(a: FigurePoint, b: FigurePoint, point: FigurePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return getPointDistance({ x: a.x + t * dx, y: a.y + t * dy }, point);
}
```

- [ ] **Step 5: Add built-in figure renderers and exports**

Create `builtInFigures.ts` with this renderer factory, then export all figure APIs from `packages/chart-engine/src/index.ts`:

```ts
import type { FigureObject, FigureRenderer, FigureType } from "./figureTypes";

const builtInFigureTypes: FigureType[] = [
  "line",
  "polyline",
  "polygon",
  "rect",
  "rotatedRect",
  "circle",
  "ellipse",
  "arc",
  "curve",
  "text",
  "label",
  "arrow",
  "band",
  "marker"
];

export function createBuiltInFigureRenderers(): FigureRenderer[] {
  return builtInFigureTypes.map((type) => ({
    type,
    render({ context, figure }) {
      renderFigure(context, figure);
    }
  }));
}

function renderFigure(context: CanvasRenderingContext2D, figure: FigureObject): void {
  context.save();
  context.strokeStyle = figure.style?.color ?? "#111827";
  context.fillStyle = figure.style?.fill ?? "rgba(17,24,39,0.12)";
  context.lineWidth = figure.style?.lineWidth ?? 2;
  context.setLineDash(figure.style?.lineDash ?? []);

  if (figure.type === "text" || figure.type === "label") {
    const point = figure.points[0];
    if (point) {
      context.fillStyle = figure.style?.textColor ?? figure.style?.color ?? "#111827";
      context.font = `${figure.style?.fontSize ?? 12}px system-ui`;
      context.fillText(figure.text ?? "", point.x, point.y);
    }
    context.restore();
    return;
  }

  drawPathFigure(context, figure);
  context.restore();
}

function drawPathFigure(context: CanvasRenderingContext2D, figure: FigureObject): void {
  if (figure.points.length === 0) {
    return;
  }

  context.beginPath();
  context.moveTo(figure.points[0].x, figure.points[0].y);

  for (const point of figure.points.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  if (figure.type === "polygon" || figure.type === "rect" || figure.type === "rotatedRect" || figure.type === "band") {
    context.closePath();
    context.fill();
  }

  context.stroke();
}
```

Validation command:

```bash
npm run test -- packages/chart-engine/src/__tests__/figurePrimitives.test.ts
npm run typecheck
```

Expected: test and typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/figures packages/chart-engine/src/__tests__/figurePrimitives.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add figure primitive kernel"
```

## Task 3: Add Drawing Tool Definition Registry

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingToolDefinitions.ts`
- Create: `packages/chart-engine/src/drawing/drawingToolRegistry.ts`
- Create: `packages/chart-engine/src/__tests__/drawingToolRegistry.test.ts`
- Modify: `packages/chart-engine/src/drawing/drawingTypes.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing registry tests**

Create `packages/chart-engine/src/__tests__/drawingToolRegistry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  builtInDrawingToolDefinitions,
  createDrawingToolRegistry,
  drawingTypes
} from "../index";

describe("drawing tool registry", () => {
  it("has one tool definition for every drawing type", () => {
    const registry = createDrawingToolRegistry();

    for (const definition of builtInDrawingToolDefinitions) {
      registry.register(definition);
    }

    expect(registry.list().map((definition) => definition.type)).toEqual([...drawingTypes]);
  });

  it("describes step count and anchor count without editor hard-coding", () => {
    const registry = createDrawingToolRegistry();

    for (const definition of builtInDrawingToolDefinitions) {
      registry.register(definition);
    }

    expect(registry.require("horizontalLine")).toMatchObject({
      type: "horizontalLine",
      totalStep: 2,
      anchorCount: 1,
      drawingMode: "step"
    });
    expect(registry.require("elliottImpulseWave")).toMatchObject({
      type: "elliottImpulseWave",
      totalStep: 6,
      anchorCount: 5,
      drawingMode: "step"
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingToolRegistry.test.ts
```

Expected: FAIL because tool registry exports do not exist.

- [ ] **Step 3: Extend `DrawingType`**

Modify `packages/chart-engine/src/drawing/drawingTypes.ts` so `drawingTypes` contains the existing 23 values plus these values in this exact order:

```ts
"segment",
"straightLine",
"rayLine",
"horizontalRayLine",
"horizontalSegment",
"horizontalStraightLine",
"verticalRayLine",
"verticalSegment",
"verticalStraightLine",
"priceLine",
"priceChannelLine",
"simpleAnnotation",
"simpleTag",
"triangle",
"arc",
"curve",
"dateRange",
"priceRange",
"measure",
"trendAngle",
"profitLossRange",
"fibTrendBasedExtension",
"fibTimeZone",
"fibFan",
"fibArc",
"fibChannel",
"fibWedge",
"gannFan",
"gannBox",
"gannSquare",
"pitchfork",
"schiffPitchfork",
"modifiedSchiffPitchfork",
"insidePitchfork",
"elliottImpulseWave",
"elliottCorrectionWave",
"xabcdPattern",
"cypherPattern",
"headAndShouldersPattern",
"forecastPath"
```

- [ ] **Step 4: Add the registry contracts**

Create `drawingToolDefinitions.ts`:

```ts
import type { DrawingStyle, DrawingType } from "./drawingTypes";

export type DrawingToolCategory =
  | "basic"
  | "channel"
  | "fibonacci"
  | "annotation"
  | "shape"
  | "path"
  | "position"
  | "measurement"
  | "gann"
  | "pitchfork"
  | "pattern"
  | "forecast";

export type DrawingMode = "step" | "continuous";

export interface DrawingToolDefinition {
  type: DrawingType;
  label: string;
  category: DrawingToolCategory;
  totalStep: number;
  anchorCount: number;
  drawingMode: DrawingMode;
  defaultStyle: DrawingStyle;
  hotkeyId: string;
}

export const builtInDrawingToolDefinitions: DrawingToolDefinition[] = [
  tool("trendLine", "Trend Line", "basic", 2),
  tool("ray", "Ray", "basic", 2),
  tool("extendedLine", "Extended Line", "basic", 2),
  tool("horizontalLine", "Horizontal Line", "basic", 1),
  tool("verticalLine", "Vertical Line", "basic", 1),
  tool("crossLine", "Cross Line", "basic", 1),
  tool("segment", "Segment", "basic", 2),
  tool("straightLine", "Straight Line", "basic", 2),
  tool("rayLine", "Ray Line", "basic", 2),
  tool("horizontalRayLine", "Horizontal Ray", "basic", 1),
  tool("horizontalSegment", "Horizontal Segment", "basic", 2),
  tool("horizontalStraightLine", "Horizontal Straight Line", "basic", 1),
  tool("verticalRayLine", "Vertical Ray", "basic", 1),
  tool("verticalSegment", "Vertical Segment", "basic", 2),
  tool("verticalStraightLine", "Vertical Straight Line", "basic", 1),
  tool("parallelChannel", "Parallel Channel", "channel", 3),
  tool("regressionChannel", "Regression Channel", "channel", 3),
  tool("priceChannelLine", "Price Channel", "channel", 3),
  tool("fibonacciRetracement", "Fibonacci Retracement", "fibonacci", 2),
  tool("fibonacciExtension", "Fibonacci Extension", "fibonacci", 2),
  tool("fibTrendBasedExtension", "Trend-Based Extension", "fibonacci", 3),
  tool("fibTimeZone", "Fibonacci Time Zone", "fibonacci", 2),
  tool("fibFan", "Fibonacci Fan", "fibonacci", 2),
  tool("fibArc", "Fibonacci Arc", "fibonacci", 2),
  tool("fibChannel", "Fibonacci Channel", "fibonacci", 3),
  tool("fibWedge", "Fibonacci Wedge", "fibonacci", 3),
  tool("text", "Text", "annotation", 1),
  tool("callout", "Callout", "annotation", 2),
  tool("simpleAnnotation", "Annotation", "annotation", 1),
  tool("simpleTag", "Tag", "annotation", 1),
  tool("rectangle", "Rectangle", "shape", 2),
  tool("rotatedRectangle", "Rotated Rectangle", "shape", 3),
  tool("circle", "Circle", "shape", 2),
  tool("ellipse", "Ellipse", "shape", 2),
  tool("polygon", "Polygon", "shape", 3),
  tool("triangle", "Triangle", "shape", 3),
  tool("arc", "Arc", "shape", 3),
  tool("curve", "Curve", "shape", 3),
  tool("path", "Path", "path", 3, "continuous"),
  tool("brush", "Brush", "path", 3, "continuous"),
  tool("arrow", "Arrow", "path", 2),
  tool("longPosition", "Long Position", "position", 2),
  tool("shortPosition", "Short Position", "position", 2),
  tool("profitLossRange", "Profit/Loss Range", "position", 2),
  tool("datePriceRange", "Date Price Range", "measurement", 2),
  tool("dateRange", "Date Range", "measurement", 2),
  tool("priceRange", "Price Range", "measurement", 2),
  tool("measure", "Measure", "measurement", 2),
  tool("trendAngle", "Trend Angle", "measurement", 2),
  tool("gannFan", "Gann Fan", "gann", 2),
  tool("gannBox", "Gann Box", "gann", 2),
  tool("gannSquare", "Gann Square", "gann", 2),
  tool("pitchfork", "Pitchfork", "pitchfork", 3),
  tool("schiffPitchfork", "Schiff Pitchfork", "pitchfork", 3),
  tool("modifiedSchiffPitchfork", "Modified Schiff Pitchfork", "pitchfork", 3),
  tool("insidePitchfork", "Inside Pitchfork", "pitchfork", 3),
  tool("elliottImpulseWave", "Elliott Impulse Wave", "pattern", 5),
  tool("elliottCorrectionWave", "Elliott Correction Wave", "pattern", 3),
  tool("xabcdPattern", "XABCD Pattern", "pattern", 5),
  tool("cypherPattern", "Cypher Pattern", "pattern", 5),
  tool("headAndShouldersPattern", "Head And Shoulders", "pattern", 5),
  tool("forecastPath", "Forecast Path", "forecast", 3, "continuous")
];

function tool(
  type: DrawingType,
  label: string,
  category: DrawingToolCategory,
  anchorCount: number,
  drawingMode: DrawingMode = "step"
): DrawingToolDefinition {
  return {
    type,
    label,
    category,
    totalStep: anchorCount + 1,
    anchorCount,
    drawingMode,
    defaultStyle: { color: "#2563eb", lineWidth: 2, fill: "rgba(37,99,235,0.12)" },
    hotkeyId: `drawing.${type}`
  };
}
```

- [ ] **Step 5: Replace editor anchor-count hard-coding**

Modify `createDrawingEditor` so it accepts a registry option and calls `registry.require(activeTool).anchorCount` for creation completion.

Validation:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingToolRegistry.test.ts packages/chart-engine/src/__tests__/drawingEditor.test.ts
npm run typecheck
```

Expected: both test files pass and typecheck passes.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/drawing/drawingTypes.ts packages/chart-engine/src/drawing/drawingToolDefinitions.ts packages/chart-engine/src/drawing/drawingToolRegistry.ts packages/chart-engine/src/drawing/drawingEditor.ts packages/chart-engine/src/__tests__/drawingToolRegistry.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add drawing tool definition registry"
```

## Task 4: Add Versioned Drawing Schema

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingSchema.ts`
- Create: `packages/chart-engine/src/drawing/drawingMigrations.ts`
- Create: `packages/chart-engine/src/__tests__/drawingSchema.test.ts`
- Modify: `packages/chart-engine/src/drawing/drawingSerialization.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing schema tests**

Create `packages/chart-engine/src/__tests__/drawingSchema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  deserializeDrawingObject,
  serializeDrawingObject,
  migrateSerializedDrawing
} from "../index";

describe("drawing schema", () => {
  it("serializes with schema version", () => {
    const serialized = serializeDrawingObject({
      id: "d1",
      type: "trendLine",
      anchors: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
      style: { color: "#111827", lineWidth: 2 },
      visible: true,
      locked: false
    });

    expect(serialized.schemaVersion).toBe(1);
    expect(serialized.type).toBe("trendLine");
  });

  it("migrates legacy drawings without mutating the input", () => {
    const legacy = {
      id: "legacy",
      type: "horizontalLine",
      anchors: [{ x: 12, y: 30 }]
    };

    const migrated = migrateSerializedDrawing(legacy);

    expect(migrated).toMatchObject({ schemaVersion: 1, id: "legacy", type: "horizontalLine" });
    expect(legacy).not.toHaveProperty("schemaVersion");
  });

  it("round-trips drawing state", () => {
    const drawing = deserializeDrawingObject(
      serializeDrawingObject({
        id: "d2",
        type: "text",
        anchors: [{ x: 10, y: 20 }],
        text: "Breakout",
        visible: false,
        locked: true
      })
    );

    expect(drawing).toEqual({
      id: "d2",
      type: "text",
      anchors: [{ x: 10, y: 20 }],
      text: "Breakout",
      visible: false,
      locked: true
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingSchema.test.ts
```

Expected: FAIL because schema helpers do not exist or return the legacy shape.

- [ ] **Step 3: Add schema and migration contracts**

Create `drawingSchema.ts`:

```ts
import type { DrawingAnchor, DrawingObject, DrawingStyle, DrawingType } from "./drawingTypes";

export const currentDrawingSchemaVersion = 1 as const;

export interface SerializedDrawingObjectV1 {
  schemaVersion: typeof currentDrawingSchemaVersion;
  id: string;
  type: DrawingType;
  anchors: DrawingAnchor[];
  style?: DrawingStyle;
  text?: string;
  visible?: boolean;
  locked?: boolean;
  zIndex?: number;
  metadata?: Record<string, unknown>;
}

export type SerializedDrawingObject = SerializedDrawingObjectV1;

export function toSerializedDrawingV1(drawing: DrawingObject): SerializedDrawingObjectV1 {
  return {
    schemaVersion: currentDrawingSchemaVersion,
    id: drawing.id,
    type: drawing.type,
    anchors: JSON.parse(JSON.stringify(drawing.anchors)) as DrawingAnchor[],
    style: drawing.style ? JSON.parse(JSON.stringify(drawing.style)) as DrawingStyle : undefined,
    text: drawing.text,
    visible: drawing.visible,
    locked: drawing.locked,
    zIndex: drawing.zIndex,
    metadata: drawing.metadata ? JSON.parse(JSON.stringify(drawing.metadata)) as Record<string, unknown> : undefined
  };
}
```

Add `zIndex?: number` to `DrawingObject`.

- [ ] **Step 4: Update serialization**

Update `drawingSerialization.ts` so `serializeDrawingObject` returns `SerializedDrawingObject` and `deserializeDrawingObject` accepts legacy objects or schema v1 objects.

Validation:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingSchema.test.ts packages/chart-engine/src/__tests__/drawingModel.test.ts
npm run typecheck
```

Expected: schema and drawing model tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/chart-engine/src/drawing/drawingSchema.ts packages/chart-engine/src/drawing/drawingMigrations.ts packages/chart-engine/src/drawing/drawingSerialization.ts packages/chart-engine/src/drawing/drawingTypes.ts packages/chart-engine/src/__tests__/drawingSchema.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: version drawing serialization"
```

## Task 5: Add Basic Overlay Drawing Families

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingFigures.ts`
- Create: `packages/chart-engine/src/__tests__/drawingCoverage.test.ts`
- Modify: `packages/chart-engine/src/render/drawing/renderers/defaultDrawingRenderers.ts`
- Modify: `packages/chart-engine/src/render/drawing/renderers/drawingRendererHelpers.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingRenderers.test.ts`

- [ ] **Step 1: Write failing coverage tests for basic overlays**

Create `packages/chart-engine/src/__tests__/drawingCoverage.test.ts` with a shared helper that asserts every drawing type can produce at least one figure:

```ts
import { describe, expect, it } from "vitest";
import { createFiguresForDrawing, type DrawingObject, type DrawingType } from "../index";

const baseAnchors = [
  { x: 20, y: 30 },
  { x: 120, y: 90 },
  { x: 180, y: 50 },
  { x: 220, y: 120 },
  { x: 280, y: 80 }
];

function drawing(type: DrawingType, anchorCount: number): DrawingObject {
  return {
    id: `${type}-1`,
    type,
    anchors: baseAnchors.slice(0, anchorCount),
    text: "Label",
    style: { color: "#2563eb", lineWidth: 2, fill: "rgba(37,99,235,0.12)" }
  };
}

describe("drawing figure coverage", () => {
  it.each([
    ["segment", 2],
    ["straightLine", 2],
    ["rayLine", 2],
    ["horizontalRayLine", 1],
    ["horizontalSegment", 2],
    ["horizontalStraightLine", 1],
    ["verticalRayLine", 1],
    ["verticalSegment", 2],
    ["verticalStraightLine", 1],
    ["priceLine", 1],
    ["priceChannelLine", 3],
    ["simpleAnnotation", 1],
    ["simpleTag", 1],
    ["triangle", 3],
    ["arc", 3],
    ["curve", 3]
  ] satisfies Array<[DrawingType, number]>)("creates figures for %s", (type, anchorCount) => {
    expect(createFiguresForDrawing(drawing(type, anchorCount))).not.toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the failing coverage test**

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingCoverage.test.ts
```

Expected: FAIL because `createFiguresForDrawing` does not exist.

- [ ] **Step 3: Implement drawing-to-figure conversion**

Create `drawingFigures.ts` with a single public entry point:

```ts
import type { FigureObject } from "../figures/figureTypes";
import type { DrawingObject } from "./drawingTypes";

export function createFiguresForDrawing(drawing: DrawingObject): FigureObject[] {
  const points = drawing.anchors
    .filter((anchor): anchor is typeof anchor & { x: number; y: number } => typeof anchor.x === "number" && typeof anchor.y === "number")
    .map((anchor) => ({ x: anchor.x, y: anchor.y }));

  if (points.length === 0) {
    return [];
  }

  switch (drawing.type) {
    case "simpleAnnotation":
    case "simpleTag":
    case "text":
      return [{ id: `${drawing.id}:label`, type: "label", points: [points[0]], text: drawing.text ?? drawing.type, style: drawing.style }];
    case "triangle":
      return points.length >= 3 ? [{ id: `${drawing.id}:triangle`, type: "polygon", points: points.slice(0, 3), style: drawing.style }] : [];
    default:
      return points.length >= 2 ? [{ id: `${drawing.id}:line`, type: "line", points: points.slice(0, 2), style: drawing.style }] : [];
  }
}
```

Use explicit switch groups for all basic overlay drawing types in the test:

```ts
case "segment":
case "straightLine":
case "rayLine":
case "horizontalSegment":
case "verticalSegment":
case "priceLine":
  return points.length >= 2 ? [{ id: `${drawing.id}:line`, type: "line", points: points.slice(0, 2), style: drawing.style }] : [];
case "horizontalLine":
case "horizontalRayLine":
case "horizontalStraightLine":
case "verticalLine":
case "verticalRayLine":
case "verticalStraightLine":
  return [{ id: `${drawing.id}:axis-line`, type: "line", points: createAxisLinePoints(drawing.type, points[0]), style: drawing.style }];
case "priceChannelLine":
  return points.length >= 3 ? createChannelFigures(drawing.id, points.slice(0, 3), drawing.style) : [];
case "simpleAnnotation":
case "simpleTag":
  return [{ id: `${drawing.id}:label`, type: "label", points: [points[0]], text: drawing.text ?? drawing.type, style: drawing.style }];
case "triangle":
  return points.length >= 3 ? [{ id: `${drawing.id}:triangle`, type: "polygon", points: points.slice(0, 3), style: drawing.style }] : [];
case "arc":
  return points.length >= 3 ? [{ id: `${drawing.id}:arc`, type: "arc", points: points.slice(0, 3), style: drawing.style }] : [];
case "curve":
  return points.length >= 3 ? [{ id: `${drawing.id}:curve`, type: "curve", points: points.slice(0, 3), style: drawing.style }] : [];
```

- [ ] **Step 4: Route default drawing renderers through figures**

Modify drawing renderer helpers so rendering calls `createFiguresForDrawing(drawing)` and draws each figure through `createBuiltInFigureRenderers()` when the drawing type has figure output.

Validation:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingCoverage.test.ts packages/chart-engine/src/__tests__/drawingRenderers.test.ts
npm run typecheck
```

Expected: coverage and renderer tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/chart-engine/src/drawing/drawingFigures.ts packages/chart-engine/src/render/drawing/renderers packages/chart-engine/src/__tests__/drawingCoverage.test.ts packages/chart-engine/src/__tests__/drawingRenderers.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add basic overlay drawing figures"
```

## Task 6: Add Advanced Drawing Families

**Files:**
- Modify: `packages/chart-engine/src/drawing/drawingFigures.ts`
- Modify: `packages/chart-engine/src/drawing/drawingToolDefinitions.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingCoverage.test.ts`
- Modify: `packages/chart-engine/src/__tests__/drawingRenderers.test.ts`

- [ ] **Step 1: Extend failing coverage tests for advanced families**

Add these cases to `drawingCoverage.test.ts`:

```ts
it.each([
  ["fibTrendBasedExtension", 3],
  ["fibTimeZone", 2],
  ["fibFan", 2],
  ["fibArc", 2],
  ["fibChannel", 3],
  ["fibWedge", 3],
  ["gannFan", 2],
  ["gannBox", 2],
  ["gannSquare", 2],
  ["pitchfork", 3],
  ["schiffPitchfork", 3],
  ["modifiedSchiffPitchfork", 3],
  ["insidePitchfork", 3],
  ["elliottImpulseWave", 5],
  ["elliottCorrectionWave", 3],
  ["xabcdPattern", 5],
  ["cypherPattern", 5],
  ["headAndShouldersPattern", 5],
  ["forecastPath", 3]
] satisfies Array<[DrawingType, number]>)("creates advanced figures for %s", (type, anchorCount) => {
  expect(createFiguresForDrawing(drawing(type, anchorCount))).not.toHaveLength(0);
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingCoverage.test.ts
```

Expected: FAIL for the advanced drawing families that do not produce figures.

- [ ] **Step 3: Add deterministic figure output for each advanced family**

Use these figure rules in `createFiguresForDrawing`:

- Fibonacci tools return level lines and labels derived from fixed ratios `[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]`.
- Gann fan returns fan lines with fixed ratios `[1 / 8, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 8]`.
- Gann box and square return rect plus diagonal lines.
- Pitchfork tools return a median line and two parallel channel lines.
- Elliott and harmonic pattern tools return a polyline plus point labels.
- Forecast path returns a polyline plus an arrow on the final segment.

- [ ] **Step 4: Verify advanced rendering**

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingCoverage.test.ts packages/chart-engine/src/__tests__/drawingRenderers.test.ts
npm run typecheck
```

Expected: advanced coverage and renderer tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/chart-engine/src/drawing/drawingFigures.ts packages/chart-engine/src/drawing/drawingToolDefinitions.ts packages/chart-engine/src/__tests__/drawingCoverage.test.ts packages/chart-engine/src/__tests__/drawingRenderers.test.ts
git commit -m "feat: add advanced drawing families"
```

## Task 7: Complete Drawing Editor State And Commands

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingEditState.ts`
- Create: `packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Modify: `packages/chart-engine/src/drawing/drawingCommands.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing editor completion tests**

Create `packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDrawingEditor } from "../index";

describe("complete drawing editor", () => {
  it("supports multi-select, z-order, duplicate, copy, and paste", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "a", type: "trendLine", anchors: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
        { id: "b", type: "rectangle", anchors: [{ x: 20, y: 20 }, { x: 40, y: 40 }] }
      ]
    });

    editor.selectDrawings(["a", "b"]);
    editor.bringSelectedForward();
    editor.copySelected();
    editor.pasteCopied({ dx: 5, dy: 5 });

    const state = editor.getState();
    expect(state.selectedDrawingIds).toHaveLength(2);
    expect(state.drawings).toHaveLength(4);
    expect(new Set(state.drawings.map((drawing) => drawing.id)).size).toBe(4);
  });

  it("updates style and text through undoable commands", () => {
    const editor = createDrawingEditor({
      drawings: [{ id: "text-1", type: "text", anchors: [{ x: 10, y: 20 }], text: "A" }]
    });

    editor.selectDrawing("text-1");
    editor.updateSelectedStyle({ color: "#dc2626", fontSize: 16 });
    editor.updateSelectedText("Breakout");
    expect(editor.getState().drawings[0]).toMatchObject({
      text: "Breakout",
      style: { color: "#dc2626", fontSize: 16 }
    });

    editor.undo();
    expect(editor.getState().drawings[0].text).toBe("A");
  });

  it("does not mutate locked drawings during group operations", () => {
    const editor = createDrawingEditor({
      drawings: [
        { id: "locked", type: "trendLine", locked: true, anchors: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
        { id: "free", type: "trendLine", anchors: [{ x: 20, y: 20 }, { x: 30, y: 30 }] }
      ]
    });

    editor.selectDrawings(["locked", "free"]);
    editor.dragSelected({ dx: 10, dy: 10 });

    expect(editor.getState().drawings.find((drawing) => drawing.id === "locked")?.anchors[0]).toEqual({ x: 0, y: 0 });
    expect(editor.getState().drawings.find((drawing) => drawing.id === "free")?.anchors[0]).toEqual({ x: 30, y: 30 });
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts
```

Expected: FAIL because complete editor methods do not exist.

- [ ] **Step 3: Add editor state contracts**

Create `drawingEditState.ts`:

```ts
import type { DrawingObject } from "./drawingTypes";

export type DrawingHandleKind = "anchor" | "rotate" | "resize";

export interface DrawingActiveHandle {
  drawingId: string;
  kind: DrawingHandleKind;
  anchorIndex?: number;
}

export interface DrawingObjectManagerItem {
  id: string;
  type: DrawingObject["type"];
  visible: boolean;
  locked: boolean;
  selected: boolean;
  zIndex: number;
}

export interface DrawingClipboard {
  drawings: DrawingObject[];
}
```

- [ ] **Step 4: Add complete editor commands**

Extend the `DrawingEditor` interface with:

```ts
selectDrawings(ids: string[]): void;
bringSelectedForward(): void;
sendSelectedBackward(): void;
copySelected(): void;
pasteCopied(offset: { dx: number; dy: number }): void;
duplicateSelected(offset: { dx: number; dy: number }): void;
updateSelectedStyle(style: DrawingStyle): void;
updateSelectedText(text: string): void;
getObjectManagerItems(): DrawingObjectManagerItem[];
```

Implement each method through `commitSnapshot` so undo and redo preserve drawing order, selected ids, style, text, and clipboard behavior.

- [ ] **Step 5: Verify editor completion**

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts packages/chart-engine/src/__tests__/drawingEditor.test.ts packages/chart-engine/src/__tests__/commands.test.ts
npm run typecheck
```

Expected: editor and command tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/drawing/drawingEditState.ts packages/chart-engine/src/drawing/drawingEditor.ts packages/chart-engine/src/drawing/drawingCommands.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts packages/chart-engine/src/__tests__/drawingEditor.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: complete drawing editor commands"
```

## Task 8: Add Style, Text, Magnet, And Hotkey Models

**Files:**
- Create: `packages/chart-engine/src/drawing/drawingStyle.ts`
- Create: `packages/chart-engine/src/drawing/drawingHotkeys.ts`
- Create: `packages/chart-engine/src/__tests__/drawingHotkeys.test.ts`
- Modify: `packages/chart-engine/src/drawing/drawingMagnet.ts`
- Modify: `packages/chart-engine/src/drawing/drawingEditor.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/chart-engine/src/__tests__/drawingHotkeys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  defaultDrawingHotkeyBindings,
  getDrawingCommandForHotkey,
  mergeDrawingStyle
} from "../index";

describe("drawing style and hotkeys", () => {
  it("merges style patches without dropping existing fields", () => {
    expect(
      mergeDrawingStyle(
        { color: "#111827", lineWidth: 2, fill: "rgba(0,0,0,0.1)" },
        { lineWidth: 4 }
      )
    ).toEqual({ color: "#111827", lineWidth: 4, fill: "rgba(0,0,0,0.1)" });
  });

  it("maps hotkeys to neutral drawing commands", () => {
    expect(getDrawingCommandForHotkey(defaultDrawingHotkeyBindings, "Backspace")).toEqual({
      type: "deleteSelected"
    });
    expect(getDrawingCommandForHotkey(defaultDrawingHotkeyBindings, "Meta+ArrowUp")).toEqual({
      type: "bringSelectedForward"
    });
  });
});
```

- [ ] **Step 2: Run the failing tests**

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHotkeys.test.ts
```

Expected: FAIL because style and hotkey helpers do not exist.

- [ ] **Step 3: Add style helper**

Create `drawingStyle.ts`:

```ts
import type { DrawingStyle } from "./drawingTypes";

export function mergeDrawingStyle(current: DrawingStyle | undefined, patch: DrawingStyle): DrawingStyle {
  return {
    ...(current ?? {}),
    ...patch
  };
}
```

- [ ] **Step 4: Add hotkey bindings**

Create `drawingHotkeys.ts`:

```ts
import type { DrawingEditorCommand } from "./drawingCommands";

export interface DrawingHotkeyBinding {
  key: string;
  command: DrawingEditorCommand;
}

export const defaultDrawingHotkeyBindings: DrawingHotkeyBinding[] = [
  { key: "Backspace", command: { type: "deleteSelected" } },
  { key: "Delete", command: { type: "deleteSelected" } },
  { key: "Meta+c", command: { type: "copySelected" } },
  { key: "Meta+v", command: { type: "pasteCopied", offset: { dx: 12, dy: 12 } } },
  { key: "Meta+d", command: { type: "duplicateSelected", offset: { dx: 12, dy: 12 } } },
  { key: "Meta+ArrowUp", command: { type: "bringSelectedForward" } },
  { key: "Meta+ArrowDown", command: { type: "sendSelectedBackward" } },
  { key: "Escape", command: { type: "cancelCreation" } }
];

export function getDrawingCommandForHotkey(
  bindings: DrawingHotkeyBinding[],
  key: string
): DrawingEditorCommand | undefined {
  return bindings.find((binding) => binding.key === key)?.command;
}
```

Extend `DrawingEditorCommand` with the command payloads used above.

- [ ] **Step 5: Harden magnet policies**

Update `drawingMagnet.ts` so it supports:

- OHLC snap candidates
- drawing anchor snap candidates
- visual point snap candidates
- deterministic nearest-candidate selection
- stable tie-breaking by candidate type order: OHLC, drawing anchor, visual point

Validation:

```bash
npm run test -- packages/chart-engine/src/__tests__/drawingHotkeys.test.ts packages/chart-engine/src/__tests__/drawingEditorComplete.test.ts packages/chart-engine/src/__tests__/drawingModel.test.ts
npm run typecheck
```

Expected: hotkey, editor, model, and typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chart-engine/src/drawing/drawingStyle.ts packages/chart-engine/src/drawing/drawingHotkeys.ts packages/chart-engine/src/drawing/drawingMagnet.ts packages/chart-engine/src/drawing/drawingCommands.ts packages/chart-engine/src/drawing/drawingEditor.ts packages/chart-engine/src/__tests__/drawingHotkeys.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: add drawing style hotkey and magnet models"
```

## Task 9: Expand Indicator And Visual Coverage

**Files:**
- Create: `packages/chart-engine/src/indicators/indicatorDefinitions.ts`
- Create: `packages/chart-engine/src/indicators/coreIndicators.ts`
- Create: `packages/chart-engine/src/__tests__/coreIndicators.test.ts`
- Modify: `packages/chart-engine/src/model/visual.ts`
- Modify: `packages/chart-engine/src/visuals/visualTypes.ts`
- Modify: `packages/chart-engine/src/index.ts`

- [ ] **Step 1: Write failing indicator tests**

Create `packages/chart-engine/src/__tests__/coreIndicators.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  coreIndicatorDefinitions,
  calculateCoreIndicator,
  fixtureDailyCandles
} from "../index";

describe("core indicators", () => {
  it("exposes v0.3 indicator definitions", () => {
    expect(coreIndicatorDefinitions.map((definition) => definition.id)).toEqual([
      "MA",
      "EMA",
      "SMA",
      "VOL",
      "MACD",
      "BOLL",
      "KDJ",
      "RSI",
      "BIAS",
      "CCI",
      "DMI",
      "OBV",
      "VR",
      "WR",
      "MTM",
      "SAR"
    ]);
  });

  it("calculates MACD as visual outputs routed to a sub panel", () => {
    const result = calculateCoreIndicator("MACD", fixtureDailyCandles);

    expect(result.outputs.map((output) => output.type)).toEqual(["line", "line", "histogram"]);
    expect(result.outputs.every((output) => output.panelId === "MACD")).toBe(true);
  });

  it("calculates BOLL as main-panel band plus middle line", () => {
    const result = calculateCoreIndicator("BOLL", fixtureDailyCandles);

    expect(result.outputs.map((output) => output.type)).toEqual(["band", "line"]);
    expect(result.outputs.every((output) => output.panelId === "main")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm run test -- packages/chart-engine/src/__tests__/coreIndicators.test.ts
```

Expected: FAIL because v0.3 indicator definitions do not exist.

- [ ] **Step 3: Add neutral indicator definitions**

Create `indicatorDefinitions.ts`:

```ts
export interface CoreIndicatorDefinition {
  id: string;
  label: string;
  panelId: string;
  params: Array<{ id: string; defaultValue: number }>;
}

export const coreIndicatorDefinitions: CoreIndicatorDefinition[] = [
  { id: "MA", label: "Moving Average", panelId: "main", params: [{ id: "period", defaultValue: 5 }] },
  { id: "EMA", label: "Exponential Moving Average", panelId: "main", params: [{ id: "period", defaultValue: 6 }] },
  { id: "SMA", label: "Smoothed Moving Average", panelId: "main", params: [{ id: "period", defaultValue: 12 }] },
  { id: "VOL", label: "Volume", panelId: "VOL", params: [{ id: "period", defaultValue: 5 }] },
  { id: "MACD", label: "MACD", panelId: "MACD", params: [{ id: "fast", defaultValue: 12 }, { id: "slow", defaultValue: 26 }, { id: "signal", defaultValue: 9 }] },
  { id: "BOLL", label: "Bollinger Bands", panelId: "main", params: [{ id: "period", defaultValue: 20 }, { id: "deviation", defaultValue: 2 }] },
  { id: "KDJ", label: "KDJ", panelId: "KDJ", params: [{ id: "period", defaultValue: 9 }] },
  { id: "RSI", label: "RSI", panelId: "RSI", params: [{ id: "period", defaultValue: 6 }] },
  { id: "BIAS", label: "BIAS", panelId: "BIAS", params: [{ id: "period", defaultValue: 6 }] },
  { id: "CCI", label: "CCI", panelId: "CCI", params: [{ id: "period", defaultValue: 13 }] },
  { id: "DMI", label: "DMI", panelId: "DMI", params: [{ id: "period", defaultValue: 14 }] },
  { id: "OBV", label: "OBV", panelId: "OBV", params: [{ id: "period", defaultValue: 30 }] },
  { id: "VR", label: "VR", panelId: "VR", params: [{ id: "period", defaultValue: 24 }] },
  { id: "WR", label: "WR", panelId: "WR", params: [{ id: "period", defaultValue: 6 }] },
  { id: "MTM", label: "MTM", panelId: "MTM", params: [{ id: "period", defaultValue: 6 }] },
  { id: "SAR", label: "SAR", panelId: "main", params: [{ id: "step", defaultValue: 2 }, { id: "max", defaultValue: 20 }] }
];
```

- [ ] **Step 4: Add deterministic calculations**

Create `coreIndicators.ts` with `calculateCoreIndicator(id, series)` returning existing `IndicatorResult` output shapes. Reuse the current moving-average helper for `MA`, and implement the remaining formulas as pure functions over `CandleSeries.candles`.

Validation:

```bash
npm run test -- packages/chart-engine/src/__tests__/coreIndicators.test.ts packages/chart-engine/src/__tests__/visualRenderers.test.ts packages/chart-engine/src/__tests__/panelEngine.test.ts
npm run typecheck
```

Expected: indicator, visual renderer, panel, and typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add packages/chart-engine/src/indicators/indicatorDefinitions.ts packages/chart-engine/src/indicators/coreIndicators.ts packages/chart-engine/src/model/visual.ts packages/chart-engine/src/visuals/visualTypes.ts packages/chart-engine/src/__tests__/coreIndicators.test.ts packages/chart-engine/src/index.ts
git commit -m "feat: expand core indicator coverage"
```

## Task 10: Build Playground Drawing Workbench

**Files:**
- Modify: `apps/playground/src/drawingToolbar.ts`
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/src/styles.css`
- Create: `apps/playground/tests/drawing-coverage.spec.ts`
- Modify: `apps/playground/tests/drawing-editor.spec.ts`

- [ ] **Step 1: Write failing Playwright coverage**

Create `apps/playground/tests/drawing-coverage.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const tools = [
  "trendLine",
  "segment",
  "horizontalLine",
  "priceLine",
  "priceChannelLine",
  "fibonacciRetracement",
  "fibFan",
  "gannFan",
  "pitchfork",
  "text",
  "rectangle",
  "triangle",
  "longPosition",
  "datePriceRange",
  "elliottImpulseWave",
  "forecastPath"
];

test("playground exposes drawing tool categories and creates representative tools", async ({ page }) => {
  await page.goto("/");

  for (const tool of tools) {
    await expect(page.getByTestId(`drawing-tool-${tool}`)).toBeVisible();
  }

  await page.getByTestId("drawing-tool-trendLine").click();
  await page.locator("canvas").first().click({ position: { x: 160, y: 160 } });
  await page.locator("canvas").first().click({ position: { x: 260, y: 220 } });

  await expect(page.getByTestId("drawing-count")).toContainText("1");
  await expect(page.getByTestId("drawing-object-manager")).toContainText("trendLine");
});
```

- [ ] **Step 2: Run the failing E2E test**

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-coverage.spec.ts
```

Expected: FAIL because the workbench does not expose every representative tool or object manager.

- [ ] **Step 3: Render grouped toolbar from engine definitions**

Update `drawingToolbar.ts` so it accepts `DrawingToolDefinition[]` and renders grouped buttons with stable test ids:

```ts
export interface DrawingToolbarOptions extends DrawingToolbarActions {
  tools: DrawingToolDefinition[];
}
```

Each button must use:

```ts
button.dataset.testid = `drawing-tool-${item.type}`;
button.title = item.label;
button.textContent = item.label;
```

- [ ] **Step 4: Add object manager and property panel**

Update `main.ts` to render:

- `data-testid="drawing-object-manager"`
- `data-testid="drawing-property-panel"`
- `data-testid="drawing-json-export"`
- `data-testid="drawing-json-import"`

These controls must read and write only neutral engine drawing state.

- [ ] **Step 5: Verify playground workbench**

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/drawing-coverage.spec.ts apps/playground/tests/drawing-editor.spec.ts
npm run build
```

Expected: representative drawing coverage tests pass and build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/playground/src/drawingToolbar.ts apps/playground/src/main.ts apps/playground/src/styles.css apps/playground/tests/drawing-coverage.spec.ts apps/playground/tests/drawing-editor.spec.ts
git commit -m "feat: add drawing workbench playground"
```

## Task 11: Build Playground Indicator Workbench

**Files:**
- Modify: `apps/playground/src/main.ts`
- Modify: `apps/playground/src/styles.css`
- Create: `apps/playground/tests/indicator-workbench.spec.ts`

- [ ] **Step 1: Write failing indicator workbench E2E**

Create `apps/playground/tests/indicator-workbench.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("playground exposes v0.3 indicator definitions", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("indicator-selector").selectOption("MACD");
  await expect(page.getByTestId("visual-output-count")).toContainText("visuals");
  await expect(page.getByTestId("panel-title-MACD")).toBeVisible();

  await page.getByTestId("indicator-selector").selectOption("BOLL");
  await expect(page.getByTestId("panel-title-main")).toBeVisible();
});
```

- [ ] **Step 2: Run the failing E2E test**

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/indicator-workbench.spec.ts
```

Expected: FAIL because the indicator selector does not expose v0.3 indicator definitions.

- [ ] **Step 3: Wire indicator selector**

Update `main.ts` to render `data-testid="indicator-selector"` from `coreIndicatorDefinitions`, call `calculateCoreIndicator`, and route outputs into the existing visual layer.

- [ ] **Step 4: Verify indicator workbench**

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- apps/playground/tests/indicator-workbench.spec.ts apps/playground/tests/visual-panels.spec.ts
npm run build
```

Expected: indicator workbench and existing visual panel tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/playground/src/main.ts apps/playground/src/styles.css apps/playground/tests/indicator-workbench.spec.ts
git commit -m "feat: add indicator workbench playground"
```

## Task 12: Documentation And Final Acceptance

**Files:**
- Modify: `docs/engine/drawing-editor.md`
- Modify: `docs/engine/visual-outputs.md`
- Modify: `docs/engine/public-api.md`
- Modify: `docs/engine/testing-strategy.md`
- Modify: `docs/engine/drawing-tool-coverage.md`

- [ ] **Step 1: Update engine docs**

Document:

- figure primitive kernel
- drawing tool registry
- full built-in drawing list
- versioned drawing schema
- object manager state
- style and text editing
- hotkeys
- magnet policies
- indicator definitions
- playground acceptance harness

- [ ] **Step 2: Verify boundary language**

Run:

```bash
rg -n "TradingReviewSystem|review|strategy|watchlist|AI|auth|account|billing|route|store|schema" packages/chart-engine docs/engine
```

Expected: any matches in `docs/engine` describe forbidden host concepts only as boundary examples. There must be no matches in `packages/chart-engine`.

- [ ] **Step 3: Run final acceptance**

```bash
npm run test
npm run typecheck
npm run guard:engine-boundary
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Expected:

- all Vitest tests pass
- TypeScript project references pass
- engine boundary guard passes
- package and playground builds pass
- Playwright E2E tests pass

- [ ] **Step 4: Commit**

```bash
git add docs/engine/drawing-editor.md docs/engine/visual-outputs.md docs/engine/public-api.md docs/engine/testing-strategy.md docs/engine/drawing-tool-coverage.md
git commit -m "docs: document visual drawing platform"
```

## Self-Review

### Spec Coverage

- Figure primitive kernel is covered by Task 2.
- Drawing tool registry is covered by Task 3.
- Versioned drawing schema is covered by Task 4.
- Basic overlays are covered by Task 5.
- Advanced drawing families are covered by Task 6.
- Complete editor commands are covered by Task 7.
- Style, text, magnet, and hotkeys are covered by Task 8.
- Indicator and visual expansion is covered by Task 9.
- Playground drawing workbench is covered by Task 10.
- Playground indicator workbench is covered by Task 11.
- Docs and final boundary acceptance are covered by Task 12.

### Placeholder Scan

The plan avoids undefined task references and defines every target drawing type, command group, and validation command directly in the relevant task.

### Type Consistency

The plan consistently uses `DrawingType`, `DrawingObject`, `DrawingStyle`, `DrawingToolDefinition`, `FigureObject`, `FigureRenderer`, `SerializedDrawingObjectV1`, and `DrawingEditorCommand` across tasks.
