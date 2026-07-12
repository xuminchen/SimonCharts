import { describe, expect, expectTypeOf, it } from "vitest";
import { createWorkspaceError } from "../index";
import type {
  ChartWorkspace,
  ChartWorkspaceDataSource,
  ChartWorkspaceError,
  ChartWorkspaceOptions,
  SeriesPage,
  SeriesRequest
} from "../index";

describe("workspace public contract", () => {
  it("keeps the approved data source signatures", () => {
    expectTypeOf<ChartWorkspaceDataSource["searchSymbols"]>().toEqualTypeOf<(
      query: string,
      signal: AbortSignal
    ) => Promise<readonly import("../index").ChartSymbol[]>>();
    expectTypeOf<ChartWorkspaceDataSource["loadSeries"]>().toEqualTypeOf<(
      request: SeriesRequest,
      signal: AbortSignal
    ) => Promise<SeriesPage>>();
  });

  it("keeps the approved workspace handle", () => {
    expectTypeOf<ChartWorkspace>().toHaveProperty("getState");
    expectTypeOf<ChartWorkspace>().toHaveProperty("setSymbol");
    expectTypeOf<ChartWorkspace>().toHaveProperty("setTimeframe");
    expectTypeOf<ChartWorkspace>().toHaveProperty("setAdjustMode");
    expectTypeOf<ChartWorkspace>().toHaveProperty("retry");
    expectTypeOf<ChartWorkspace>().toHaveProperty("destroy");
    expectTypeOf<ChartWorkspaceOptions>().toHaveProperty("workspaceId");
    expectTypeOf<ChartWorkspaceError>().toHaveProperty("recoverable");
    expect(true).toBe(true);
  });

  it("copies and freezes safe error context", () => {
    const source = { symbolId: "SSE:600000" };
    const error = createWorkspaceError(
      "INVALID_DATA",
      "initial-data",
      false,
      "Invalid candle page",
      source
    );

    source.symbolId = "changed";
    expect(error.context).toEqual({ symbolId: "SSE:600000" });
    expect(Object.isFrozen(error.context)).toBe(true);
  });
});
