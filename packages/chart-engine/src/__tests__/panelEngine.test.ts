import { describe, expect, it } from "vitest";
import { createPanelLayout, type PanelDefinition } from "../index";

describe("panel engine", () => {
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
});
