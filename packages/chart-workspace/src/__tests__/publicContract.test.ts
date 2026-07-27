import { describe, expect, expectTypeOf, it } from "vitest";
import {
  advancedChartFeatures,
  ChartDatafeedError,
  createChartError,
  defaultChartFeatures
} from "../index";
import type {
  ChartDatafeed,
  ChartCrosshairEvent,
  ChartCrosshairSnapshot,
  ChartCrosshairStudyOutput,
  ChartDrawing,
  ChartDrawingTool,
  ChartEntity,
  ChartEntityId,
  ChartEntityInput,
  ChartEntityKind,
  ChartError,
  ChartEvent,
  ChartExecution,
  ChartFeature,
  ChartIndicator,
  ChartIndicatorEntityId,
  ChartIndicatorInput,
  ChartInstance,
  ChartIntradayScale,
  ChartLayoutV2,
  ChartLocale,
  ChartMark,
  ChartOptions,
  ChartStateListener,
  ChartTheme,
  ChartView,
  IntradayDayCount,
  SeriesPage,
  SeriesRequest
} from "../index";
import {
  fromEngineDrawings,
  parseDrawings,
  parseIndicatorInput,
  parseLayout,
  toEngineDrawings,
  toEntityId
} from "../programmableApi";

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
    expectTypeOf<ChartInstance["exportLayout"]>().toEqualTypeOf<() => ChartLayoutV2>();
    expectTypeOf<ChartInstance["importLayout"]>().toEqualTypeOf<(layout: unknown) => void>();
    expectTypeOf<ChartInstance["setIndicators"]>()
      .toEqualTypeOf<(indicators: readonly ChartIndicator[]) => void>();
    expectTypeOf<ChartInstance["setDrawings"]>()
      .toEqualTypeOf<(drawings: readonly ChartDrawing[]) => void>();
    expectTypeOf<Pick<ChartDrawing, "interactive" | "affectsPriceScale">>()
      .toEqualTypeOf<{
        readonly interactive?: boolean;
        readonly affectsPriceScale?: boolean;
      }>();
    expectTypeOf<ChartInstance["setMarks"]>()
      .toEqualTypeOf<(marks: readonly ChartMark[]) => void>();
    expectTypeOf<ChartInstance["createStudy"]>()
      .toEqualTypeOf<(indicator: ChartIndicatorInput) => ChartIndicatorEntityId>();
    expectTypeOf<ChartInstance["getStudyById"]>()
      .toEqualTypeOf<(entityId: ChartIndicatorEntityId) => ChartIndicator | undefined>();
    expectTypeOf<ChartInstance["getAllStudies"]>()
      .toEqualTypeOf<() => readonly ChartIndicator[]>();
    expectTypeOf<ChartInstance["removeStudy"]>()
      .toEqualTypeOf<(entityId: ChartIndicatorEntityId) => boolean>();
    expectTypeOf<ChartInstance["setDrawingTool"]>()
      .toEqualTypeOf<(tool: ChartDrawingTool) => void>();
    expectTypeOf<ChartInstance["createEntity"]>()
      .toEqualTypeOf<(entity: ChartEntityInput) => ChartEntityId>();
    expectTypeOf<ChartInstance["getEntity"]>()
      .toEqualTypeOf<(entityId: ChartEntityId) => ChartEntity | undefined>();
    expectTypeOf<ChartInstance["getEntities"]>()
      .toEqualTypeOf<(kind?: ChartEntityKind) => readonly ChartEntity[]>();
    expectTypeOf<ChartInstance["updateEntity"]>()
      .toEqualTypeOf<(entity: ChartEntity) => void>();
    expectTypeOf<ChartInstance["removeEntity"]>()
      .toEqualTypeOf<(entityId: ChartEntityId) => boolean>();
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
    expectTypeOf<ChartInstance>().toHaveProperty("subscribeCrosshair");
    expectTypeOf<ChartInstance>().toHaveProperty("destroy");
    expectTypeOf<ChartOptions>().toHaveProperty("chartId");
    expectTypeOf<ChartOptions>().toHaveProperty("persistenceScopeId");
    expectTypeOf<ChartOptions>().toHaveProperty("dataContextId");
    expectTypeOf<ChartOptions>().toHaveProperty("datafeed");
    expectTypeOf<ChartOptions>().toHaveProperty("features");
    expectTypeOf<ChartOptions>().toHaveProperty("theme");
    expectTypeOf<ChartOptions>().toHaveProperty("locale");
    expectTypeOf<ChartOptions>().toHaveProperty("executions");
    expectTypeOf<ChartOptions>().toHaveProperty("marks");
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
    expectTypeOf<Extract<ChartEvent, { type: "layout-changed" }>["layout"]>()
      .toEqualTypeOf<Readonly<ChartLayoutV2>>();
    expectTypeOf<Extract<ChartEvent, { type: "mark-clicked" }>["mark"]>()
      .toEqualTypeOf<Readonly<ChartMark>>();
    expectTypeOf<Extract<ChartEvent, { type: "entity-created" }>["entity"]>()
      .toEqualTypeOf<Readonly<ChartEntity>>();
    expectTypeOf<Extract<ChartEvent, { type: "entity-updated" }>["entity"]>()
      .toEqualTypeOf<Readonly<ChartEntity>>();
    expectTypeOf<Extract<ChartEvent, { type: "entity-removed" }>["entity"]>()
      .toEqualTypeOf<Readonly<ChartEntity>>();
    expectTypeOf<Extract<ChartCrosshairEvent, { type: "crosshair-moved" }>["crosshair"]>()
      .toEqualTypeOf<Readonly<ChartCrosshairSnapshot>>();
    expectTypeOf<Extract<ChartCrosshairEvent, { type: "crosshair-left" }>["type"]>()
      .toEqualTypeOf<"crosshair-left">();
    expectTypeOf<ChartCrosshairSnapshot["referencePrice"]>().toEqualTypeOf<number | null>();
    expectTypeOf<ChartCrosshairSnapshot["change"]>().toEqualTypeOf<number | null>();
    expectTypeOf<ChartCrosshairSnapshot["candle"]>().toEqualTypeOf<
      Readonly<import("../index").Candle>
    >();
    expectTypeOf<ChartCrosshairStudyOutput>().toMatchTypeOf<
      | {
          readonly id: string;
          readonly title: string;
          readonly type: "line" | "histogram" | "marker";
          readonly value: number | null;
        }
      | {
          readonly id: string;
          readonly title: string;
          readonly type: "band";
          readonly upper: number | null;
          readonly lower: number | null;
        }
    >();
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

  it("parses a JSON-safe layout as one validated defensive copy", () => {
    const source = {
      schemaVersion: 2,
      seriesType: "candles",
      priceScaleMode: "percentage",
      indicators: [{
        instanceId: "macd-primary",
        id: "MACD",
        params: { fast: 12, slow: 26, signal: 9 },
        visible: true
      }],
      drawings: [{
        id: "range",
        type: "datePriceRange",
        anchors: [{ time: 1, price: 10 }, { time: 2, price: 12 }],
        interactive: false,
        affectsPriceScale: true,
        metadata: { rangeLabel: "计划区间", levels: [1, 2] }
      }],
      gridVisible: false
    } as const;

    const layout = parseLayout(source);
    expect(layout).toEqual(source);
    expect(() => parseLayout({
      ...source,
      indicators: [{
        instanceId: "macd-primary",
        id: "MACD",
        params: { fast: 30, slow: 20, signal: 9 },
        visible: true
      }]
    })).toThrow("fast must be less than slow");
    expect(() => parseLayout({ ...source, extra: true })).toThrow("unsupported fields");
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => parseLayout({
      ...source,
      drawings: [{ ...source.drawings[0], metadata: cyclic }]
    })).toThrow("must be JSON-safe");
    expect(() => parseLayout({
      ...source,
      indicators: [{
        instanceId: "ma-5",
        id: "MA",
        params: new Map([["period", 5]]),
        visible: true
      }]
    })).toThrow("must be a plain object");
    expect(() => parseLayout({
      ...source,
      drawings: [{
        id: "oversized-brush",
        type: "brush",
        anchors: Array.from({ length: 10_001 }, (_, index) => ({ time: index + 1, price: 1 }))
      }]
    })).toThrow("anchor count is invalid");
    expect(() => parseLayout({
      ...source,
      drawings: [{
        ...source.drawings[0],
        metadata: { holes: Array(50_001) }
      }]
    })).toThrow("dense JSON-safe array");
    const accessorLayout = { ...source };
    Object.defineProperty(accessorLayout, "gridVisible", {
      enumerable: true,
      get: () => false
    });
    expect(() => parseLayout(accessorLayout)).toThrow("only data properties");
    const prototypeKey = parseLayout({
      ...source,
      drawings: [{
        ...source.drawings[0],
        metadata: JSON.parse('{"__proto__":{"safe":true}}')
      }]
    }).drawings[0]?.metadata;
    expect(Object.hasOwn(prototypeKey ?? {}, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(prototypeKey)).toBe(Object.prototype);
  });

  it("validates and defensively converts drawing interaction and scale flags", () => {
    const source = [{
      id: "range",
      type: "datePriceRange",
      anchors: [{ time: 1, price: 10 }, { time: 2, price: 12 }],
      interactive: false,
      affectsPriceScale: true
    }] as const;
    const parsed = parseDrawings(source);
    const engine = toEngineDrawings(parsed);
    const restored = fromEngineDrawings(engine);

    expect(restored).toEqual(source);
    expect(parseDrawings([{
      id: "default",
      type: "datePriceRange",
      anchors: [{ time: 1, price: 10 }, { time: 2, price: 12 }]
    }])[0]).not.toHaveProperty("interactive");
    expect(parseDrawings([{
      id: "default",
      type: "datePriceRange",
      anchors: [{ time: 1, price: 10 }, { time: 2, price: 12 }]
    }])[0]).not.toHaveProperty("affectsPriceScale");
    expect(() => parseDrawings([{ ...source[0], interactive: "false" }]))
      .toThrow("interaction state must be boolean");
    expect(() => parseDrawings([{ ...source[0], affectsPriceScale: 1 }]))
      .toThrow("price scale state must be boolean");

    engine[0]!.anchors[0]!.price = 999;
    engine[0]!.interactive = true;
    expect(parsed[0]).toEqual(source[0]);
  });

  it("keeps same-type study instances independent", () => {
    const source = {
      schemaVersion: 2,
      seriesType: "candles",
      priceScaleMode: "linear",
      indicators: [
        { instanceId: "ma-5", id: "MA", params: { period: 5 }, visible: true },
        { instanceId: "ma-20", id: "MA", params: { period: 20 }, visible: true }
      ],
      drawings: [],
      gridVisible: true
    } as const;

    expect(parseLayout(source).indicators).toEqual(source.indicators);
    expect(() => parseLayout({
      ...source,
      indicators: source.indicators.map((indicator) => ({
        ...indicator,
        instanceId: "ma-duplicate"
      }))
    })).toThrow("instance ma-duplicate is duplicated");
    expect(parseIndicatorInput({
      id: "MACD",
      params: { fast: 12 },
      visible: true
    })).toEqual({
      id: "MACD",
      params: { fast: 12, slow: 26, signal: 9 },
      visible: true
    });
    expect(() => parseIndicatorInput({
      id: "MACD",
      params: { fast: 30 },
      visible: true
    })).toThrow("fast must be less than slow");
  });

  it("scopes opaque entity ids to their owning chart data context", () => {
    const state = {
      symbol: { id: "stock:SSE:600000", code: "600000", name: "浦发银行", exchange: "SSE", kind: "stock" },
      timeframe: "1d",
      view: "timeframe",
      intradayDays: 1,
      adjustMode: "forward",
      loading: false
    } as const;
    const drawing = {
      kind: "drawing",
      value: {
        id: "support",
        type: "horizontalLine",
        anchors: [{ time: 1, price: 10 }]
      }
    } as const;
    const first = toEntityId(drawing, state, ["chart-a", "user-a", "snapshot-a"]);
    const otherOwner = toEntityId(drawing, state, ["chart-b", "user-b", "snapshot-b"]);
    const otherAdjustment = toEntityId(
      drawing,
      { ...state, adjustMode: "backward" },
      ["chart-a", "user-a", "snapshot-a"]
    );

    expect(new Set([first, otherOwner, otherAdjustment]).size).toBe(3);
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
