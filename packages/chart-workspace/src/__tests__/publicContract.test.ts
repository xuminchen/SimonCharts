import { describe, expect, expectTypeOf, it } from "vitest";
import {
  advancedChartFeatures,
  ChartDatafeedError,
  createChartError,
  defaultChartFeatures
} from "../index";
import type {
  ChartDatafeed,
  ChartError,
  ChartEvent,
  ChartExecution,
  ChartFeature,
  ChartInstance,
  ChartIntradayScale,
  ChartLocale,
  ChartOptions,
  ChartStateListener,
  ChartTheme,
  ChartView,
  IntradayDayCount,
  SeriesPage,
  SeriesRequest
} from "../index";

describe("charts public contract", () => {
  it("keeps the approved datafeed signatures", () => {
    expectTypeOf<ChartDatafeed["searchSymbols"]>().toEqualTypeOf<(
      query: string,
      signal: AbortSignal
    ) => Promise<readonly import("../index").ChartSymbol[]>>();
    expectTypeOf<ChartDatafeed["getCapabilities"]>().toEqualTypeOf<(
      symbol: import("../index").ChartSymbol,
      signal: AbortSignal
    ) => Promise<import("../index").ChartDataCapabilities>>();
    expectTypeOf<ChartDatafeed["loadSeries"]>().toEqualTypeOf<(
      request: SeriesRequest,
      signal: AbortSignal
    ) => Promise<SeriesPage>>();
  });

  it("keeps the approved chart handle and options", () => {
    expectTypeOf<ChartInstance>().toHaveProperty("getState");
    expectTypeOf<ChartInstance>().toHaveProperty("getVisibleRange");
    expectTypeOf<ChartInstance>().toHaveProperty("setSymbol");
    expectTypeOf<ChartInstance>().toHaveProperty("setTimeframe");
    expectTypeOf<ChartInstance>().toHaveProperty("setView");
    expectTypeOf<ChartInstance>().toHaveProperty("setIntradayDays");
    expectTypeOf<ChartInstance["setIntradayDays"]>()
      .toEqualTypeOf<(days: IntradayDayCount) => void>();
    expectTypeOf<ChartInstance>().toHaveProperty("setAdjustMode");
    expectTypeOf<ChartInstance["setExecutions"]>()
      .toEqualTypeOf<(executions: readonly ChartExecution[]) => void>();
    expectTypeOf<ChartInstance["setExecutionsVisible"]>()
      .toEqualTypeOf<(visible: boolean) => void>();
    expectTypeOf<ChartInstance>().toHaveProperty("setVisibleRange");
    expectTypeOf<ChartInstance>().toHaveProperty("resetToLatest");
    expectTypeOf<ChartInstance>().toHaveProperty("retry");
    expectTypeOf<ChartInstance>().toHaveProperty("subscribe");
    expectTypeOf<ChartInstance>().toHaveProperty("subscribeEvents");
    expectTypeOf<ChartInstance>().toHaveProperty("destroy");
    expectTypeOf<ChartOptions>().toHaveProperty("chartId");
    expectTypeOf<ChartOptions>().toHaveProperty("persistenceScopeId");
    expectTypeOf<ChartOptions>().toHaveProperty("dataContextId");
    expectTypeOf<ChartOptions>().toHaveProperty("datafeed");
    expectTypeOf<ChartOptions>().toHaveProperty("features");
    expectTypeOf<ChartOptions>().toHaveProperty("theme");
    expectTypeOf<ChartOptions>().toHaveProperty("locale");
    expectTypeOf<ChartOptions>().toHaveProperty("executions");
    expectTypeOf<ChartExecution>().toEqualTypeOf<{
      readonly id: string;
      readonly time: number;
      readonly side: "buy" | "sell";
      readonly price: number;
      readonly quantity: number;
      readonly label?: string;
      readonly amount?: number;
      readonly fee?: number;
      readonly tQuantity?: number;
    }>();
    expectTypeOf<ChartStateListener>().toEqualTypeOf<(
      state: Readonly<import("../index").ChartState>
    ) => void>();
    expectTypeOf<import("../index").ChartState["view"]>().toEqualTypeOf<ChartView>();
    expectTypeOf<import("../index").ChartState["intradayDays"]>().toEqualTypeOf<IntradayDayCount>();
    expectTypeOf<ChartView>().toEqualTypeOf<"intraday" | "timeframe">();
    expectTypeOf<IntradayDayCount>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9>();
    expectTypeOf<ChartIntradayScale>().toEqualTypeOf<{
      readonly previousClose: number;
      readonly priceLimitPercent?: number;
    }>();
    expectTypeOf<import("../index").ChartDataCapabilities>()
      .toHaveProperty("intradayScale");
    expectTypeOf<Extract<ChartEvent, { type: "data-loaded" }>["dataVersion"]>()
      .toEqualTypeOf<string>();
    expectTypeOf<Extract<ChartEvent, { type: "data-loaded" }>["phase"]>()
      .toEqualTypeOf<"initial" | "history">();
    expectTypeOf<ChartError>().toHaveProperty("recoverable");
    expectTypeOf<ChartFeature>().toEqualTypeOf<
      | "symbol-search"
      | "timeframes"
      | "adjustment"
      | "series-type"
      | "price-scale"
      | "indicators"
      | "drawing-tools"
      | "drawing-history"
      | "settings"
      | "bottom-panel"
      | "executions"
    >();
    expectTypeOf<ChartTheme>().toEqualTypeOf<"dark" | "light">();
    expectTypeOf<ChartLocale>().toEqualTypeOf<"zh-CN" | "en-US">();
    expect(true).toBe(true);
  });

  it("uses a minimal default and an explicit advanced feature set", () => {
    expect(defaultChartFeatures).toEqual(["timeframes", "adjustment", "indicators"]);
    expect(advancedChartFeatures).toEqual([
      "symbol-search",
      "timeframes",
      "adjustment",
      "series-type",
      "price-scale",
      "indicators",
      "drawing-tools",
      "drawing-history",
      "settings",
      "bottom-panel"
    ]);
    expect(Object.isFrozen(defaultChartFeatures)).toBe(true);
    expect(Object.isFrozen(advancedChartFeatures)).toBe(true);
  });

  it("copies and freezes safe error context", () => {
    const source = { symbolId: "SSE:600000" };
    const error = createChartError(
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

  it("provides a typed safe data-source failure for host adapters", () => {
    const error = new ChartDatafeedError("RATE_LIMITED", "行情请求额度已用尽", true);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "ChartDatafeedError",
      code: "RATE_LIMITED",
      message: "行情请求额度已用尽",
      recoverable: true
    });
  });
});
