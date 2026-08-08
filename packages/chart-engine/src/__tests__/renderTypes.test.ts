import { describe, expect, it } from "vitest";
import { createChartLayout, resizeCanvas } from "../index";

interface FakeCanvasContext {
  calls: string[];
  resetTransform(): void;
  scale(x: number, y: number): void;
}

interface FakeCanvas {
  width: number;
  height: number;
  style: {
    width: string;
    height: string;
  };
  context: FakeCanvasContext;
  getContext(contextId: "2d"): FakeCanvasContext;
}

function createFakeCanvas(): FakeCanvas {
  const context: FakeCanvasContext = {
    calls: [],
    resetTransform() {
      this.calls.push("resetTransform");
    },
    scale(x: number, y: number) {
      this.calls.push(`scale:${x}:${y}`);
    }
  };

  return {
    width: 0,
    height: 0,
    style: {
      width: "",
      height: ""
    },
    context,
    getContext(contextId: "2d") {
      expect(contextId).toBe("2d");
      return context;
    }
  };
}

describe("canvas manager render contracts", () => {
  it("preserves CSS size and scales the backing store by device pixel ratio", () => {
    const canvas = createFakeCanvas();

    const context = resizeCanvas(canvas as unknown as HTMLCanvasElement, 320, 180, 2);

    expect(context).toBe(canvas.context);
    expect(canvas.style.width).toBe("320px");
    expect(canvas.style.height).toBe("180px");
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(360);
  });

  it("resets the context transform before applying device pixel ratio scaling", () => {
    const canvas = createFakeCanvas();

    resizeCanvas(canvas as unknown as HTMLCanvasElement, 320, 180, 2);

    expect(canvas.context.calls).toEqual(["resetTransform", "scale:2:2"]);
  });

  it("does not reallocate an unchanged backing store", () => {
    const canvas = createFakeCanvas();
    resizeCanvas(canvas as unknown as HTMLCanvasElement, 320, 180, 2);
    let width = canvas.width;
    let writes = 0;
    Object.defineProperty(canvas, "width", {
      configurable: true,
      get: () => width,
      set(next: number) { writes += 1; width = next; }
    });

    resizeCanvas(canvas as unknown as HTMLCanvasElement, 320, 180, 2);

    expect(writes).toBe(0);
  });

  it("falls back to a device pixel ratio of 1 for invalid values", () => {
    for (const devicePixelRatio of [0, -2, Infinity, NaN]) {
      const canvas = createFakeCanvas();

      resizeCanvas(canvas as unknown as HTMLCanvasElement, 320, 180, devicePixelRatio);

      expect(canvas.width).toBe(320);
      expect(canvas.height).toBe(180);
      expect(canvas.context.calls).toEqual(["resetTransform", "scale:1:1"]);
    }
  });

  it("separates the price plot, volume panel, and time axis", () => {
    expect(createChartLayout(320, 180)).toEqual({
      width: 320,
      height: 180,
      leftAxisWidth: 0,
      rightAxisWidth: 64,
      bottomAxisHeight: 28,
      leftPriceAxisArea: {
        x: 0,
        y: 34,
        width: 0,
        height: 92
      },
      plotArea: {
        x: 0,
        y: 34,
        width: 256,
        height: 92
      },
      priceAxisArea: {
        x: 256,
        y: 34,
        width: 64,
        height: 92
      },
      volumeArea: {
        x: 0,
        y: 134,
        width: 256,
        height: 18
      },
      timeAxisArea: {
        x: 0,
        y: 152,
        width: 256,
        height: 28
      }
    });
  });

  it("reserves a left price axis only when requested", () => {
    const layout = createChartLayout(320, 180, { leftPriceAxis: true });

    expect(layout.leftAxisWidth).toBe(64);
    expect(layout.leftPriceAxisArea).toEqual({ x: 0, y: 34, width: 64, height: 92 });
    expect(layout.plotArea).toEqual({ x: 64, y: 34, width: 192, height: 92 });
    expect(layout.priceAxisArea).toEqual({ x: 256, y: 34, width: 64, height: 92 });
    expect(layout.volumeArea).toEqual({ x: 64, y: 134, width: 192, height: 18 });
    expect(layout.timeAxisArea).toEqual({ x: 64, y: 152, width: 192, height: 28 });
  });

  it("clamps axis reservations to small layout dimensions", () => {
    expect(createChartLayout(40, 20)).toEqual({
      width: 40,
      height: 20,
      leftAxisWidth: 0,
      rightAxisWidth: 40,
      bottomAxisHeight: 20,
      leftPriceAxisArea: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      },
      plotArea: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      },
      priceAxisArea: {
        x: 0,
        y: 0,
        width: 40,
        height: 0
      },
      volumeArea: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      },
      timeAxisArea: {
        x: 0,
        y: 0,
        width: 0,
        height: 20
      }
    });
  });
});
