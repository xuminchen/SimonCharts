import { describe, expect, it } from "vitest";
import {
  chooseNearestVisualHit,
  createVisualRendererRegistry,
  formatVisualValue,
  mergeVisualAutoscaleRanges,
  type VisualHitTestResult,
  type VisualRenderer
} from "../index";

describe("visual renderer registry", () => {
  it("registers and retrieves a renderer by visual output type", () => {
    const registry = createVisualRendererRegistry();
    const renderer: VisualRenderer = {
      type: "line",
      render() {},
      getAutoscale() {
        return undefined;
      },
      hitTest() {
        return undefined;
      },
      getTooltipRows() {
        return [];
      }
    };

    registry.register(renderer);

    expect(registry.get("line")).toBe(renderer);
    expect(registry.require("line")).toBe(renderer);
  });

  it("throws a clear error for missing visual renderer", () => {
    const registry = createVisualRendererRegistry();

    expect(registry.get("band")).toBeUndefined();
    expect(() => registry.require("band")).toThrow("Visual renderer is not registered: band");
  });

  it("lists registered visual renderers in insertion order", () => {
    const registry = createVisualRendererRegistry();
    const lineRenderer = createRenderer("line");
    const bandRenderer = createRenderer("band");

    registry.register(lineRenderer);
    registry.register(bandRenderer);

    expect(registry.list()).toEqual([lineRenderer, bandRenderer]);
  });

  it("unregisters visual renderers by type", () => {
    const registry = createVisualRendererRegistry();
    const lineRenderer = createRenderer("line");

    registry.register(lineRenderer);

    expect(registry.unregister("line")).toBe(lineRenderer);
    expect(registry.get("line")).toBeUndefined();
    expect(registry.list()).toEqual([]);
    expect(registry.unregister("line")).toBeUndefined();
  });
});

describe("visual helpers", () => {
  it("formats integer values without decimals and decimal values with two decimals", () => {
    expect(formatVisualValue(12)).toBe("12");
    expect(formatVisualValue(-4)).toBe("-4");
    expect(formatVisualValue(12.345)).toBe("12.35");
  });

  it("merges only finite autoscale ranges", () => {
    expect(
      mergeVisualAutoscaleRanges([
        undefined,
        { min: 5, max: 8 },
        { min: Number.NEGATIVE_INFINITY, max: 9 },
        { min: -2, max: 6 },
        { min: 0, max: Number.POSITIVE_INFINITY }
      ])
    ).toEqual({ min: -2, max: 8 });
  });

  it("returns undefined when there are no valid autoscale ranges", () => {
    expect(
      mergeVisualAutoscaleRanges([
        undefined,
        { min: Number.NaN, max: 4 },
        { min: 1, max: Number.POSITIVE_INFINITY }
      ])
    ).toBeUndefined();
  });

  it("chooses the nearest defined visual hit", () => {
    const farHit = createHit("far", 12);
    const nearHit = createHit("near", 3);

    expect(chooseNearestVisualHit([undefined, farHit, nearHit])).toBe(nearHit);
  });

  it("ignores visual hits with non-finite distances", () => {
    const validHit = createHit("valid", 4);

    expect(chooseNearestVisualHit([createHit("nan", Number.NaN), validHit])).toBe(validHit);
    expect(
      chooseNearestVisualHit([createHit("infinite", Number.POSITIVE_INFINITY)])
    ).toBeUndefined();
  });

  it("returns undefined when there are no visual hits", () => {
    expect(chooseNearestVisualHit([undefined])).toBeUndefined();
  });
});

function createRenderer(type: VisualRenderer["type"]): VisualRenderer {
  return {
    type,
    render() {},
    getAutoscale() {
      return undefined;
    },
    hitTest() {
      return undefined;
    },
    getTooltipRows() {
      return [];
    }
  };
}

function createHit(outputId: string, distance: number): VisualHitTestResult {
  return {
    outputId,
    outputType: "line",
    time: 1,
    value: 10,
    distance
  };
}
