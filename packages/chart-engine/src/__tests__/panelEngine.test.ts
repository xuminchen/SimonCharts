import { describe, expect, it } from "vitest";
import { createPanelLayout, type PanelDefinition } from "../index";

describe("panel engine", () => {
  it("returns no layout areas for empty panels", () => {
    expect(createPanelLayout({ width: 500, height: 400, rightAxisWidth: 64, bottomAxisHeight: 28, panels: [] })).toEqual([]);
  });

  it("returns no layout areas when all panel ratios are zero or negative", () => {
    const panels: PanelDefinition[] = [
      { id: "main", kind: "main", label: "Price", heightRatio: 0 },
      { id: "macd", kind: "sub", label: "MACD", heightRatio: -1 }
    ];

    expect(createPanelLayout({ width: 500, height: 400, rightAxisWidth: 64, bottomAxisHeight: 28, panels })).toEqual([]);
  });

  it("allocates one main panel and sub panels with shared x geometry", () => {
    const panels: PanelDefinition[] = [
      { id: "main", kind: "main", label: "Price", heightRatio: 3 },
      { id: "macd", kind: "sub", label: "MACD", heightRatio: 1 }
    ];

    expect(createPanelLayout({ width: 500, height: 400, rightAxisWidth: 64, bottomAxisHeight: 28, panels })).toEqual([
      {
        id: "main",
        kind: "main",
        label: "Price",
        plotArea: { x: 0, y: 0, width: 436, height: 279 },
        priceAxisArea: { x: 436, y: 0, width: 64, height: 279 }
      },
      {
        id: "macd",
        kind: "sub",
        label: "MACD",
        plotArea: { x: 0, y: 279, width: 436, height: 93 },
        priceAxisArea: { x: 436, y: 279, width: 64, height: 93 }
      }
    ]);
  });

  it("allocates rounding remainder to the last positive-ratio panel", () => {
    const panels: PanelDefinition[] = [
      { id: "main", kind: "main", label: "Price", heightRatio: 1 },
      { id: "rsi", kind: "sub", label: "RSI", heightRatio: 1 },
      { id: "macd", kind: "sub", label: "MACD", heightRatio: 0 }
    ];

    expect(createPanelLayout({ width: 120, height: 111, rightAxisWidth: 20, bottomAxisHeight: 10, panels })).toEqual([
      {
        id: "main",
        kind: "main",
        label: "Price",
        plotArea: { x: 0, y: 0, width: 100, height: 50 },
        priceAxisArea: { x: 100, y: 0, width: 20, height: 50 }
      },
      {
        id: "rsi",
        kind: "sub",
        label: "RSI",
        plotArea: { x: 0, y: 50, width: 100, height: 51 },
        priceAxisArea: { x: 100, y: 50, width: 20, height: 51 }
      },
      {
        id: "macd",
        kind: "sub",
        label: "MACD",
        plotArea: { x: 0, y: 101, width: 100, height: 0 },
        priceAxisArea: { x: 100, y: 101, width: 20, height: 0 }
      }
    ]);
  });

  it("keeps every positive-ratio panel visible when pixels are available", () => {
    const panels: PanelDefinition[] = [
      { id: "main", kind: "main", label: "Price", heightRatio: Number.MIN_VALUE },
      { id: "macd", kind: "sub", label: "MACD", heightRatio: 100 }
    ];

    const layout = createPanelLayout({
      width: 120,
      height: 100,
      rightAxisWidth: 20,
      bottomAxisHeight: 0,
      panels
    });

    expect(layout.map((panel) => panel.plotArea.height)).toEqual([1, 99]);
  });

  it("clamps oversized axis dimensions inside chart bounds", () => {
    const panels: PanelDefinition[] = [{ id: "main", kind: "main", label: "Price", heightRatio: 1 }];

    expect(createPanelLayout({ width: 100, height: 80, rightAxisWidth: 150, bottomAxisHeight: 200, panels })).toEqual([
      {
        id: "main",
        kind: "main",
        label: "Price",
        plotArea: { x: 0, y: 0, width: 0, height: 0 },
        priceAxisArea: { x: 0, y: 0, width: 100, height: 0 }
      }
    ]);
  });

  it("clamps negative axis dimensions to zero", () => {
    const panels: PanelDefinition[] = [{ id: "main", kind: "main", label: "Price", heightRatio: 1 }];

    expect(createPanelLayout({ width: 100, height: 80, rightAxisWidth: -20, bottomAxisHeight: -10, panels })).toEqual([
      {
        id: "main",
        kind: "main",
        label: "Price",
        plotArea: { x: 0, y: 0, width: 100, height: 80 },
        priceAxisArea: { x: 100, y: 0, width: 0, height: 80 }
      }
    ]);
  });
});
