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
  ChartCustomStudyDefinition,
  ChartCustomStudyId,
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
  ChartStudyApi,
  ChartStudyDefinitionId,
  ChartTheme,
  ChartView,
  IntradayDayCount,
  SeriesPage,
  SeriesRequest
} from "../index";
import {
  fromEngineDrawings,
  parseDrawings,
  mergeIndicatorInputs,
  parseStudyDefinitions,
  parseIndicatorInput,
  parseIndicators,
  parseLayout,
  toEngineDrawings,
  toEntityId
} from "../programmableApi";

const customStudyDefinition = {
  id: "custom:acme.spread",
  version: "1",
  title: "ACME Spread",
  pane: "separate",
  inputs: [{
    id: "multiplier",
    title: "Multiplier",
    defaultValue: 2,
    minValue: 1,
    maxValue: 10,
    integer: true
  }],
  outputs: [{
    id: "spread",
    title: "Spread",
    type: "histogram",
    color: "#2563eb"
  }],
  calculate: ({ candles, inputs }) => ({
    outputs: {
      spread: candles.map((candle) => (candle.high - candle.low) * inputs.multiplier)
    },
    state: { complete: true }
  })
} satisfies ChartCustomStudyDefinition;

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

  it("keeps the legacy study interfaces extendable", () => {
    interface PartnerStudy extends ChartIndicator {
      readonly partnerTag: string;
    }
    interface PartnerStudyInput extends ChartIndicatorInput {
      readonly partnerTag?: string;
    }
    const study: PartnerStudy = {
      instanceId: "partner-ma",
      id: "MA",
      params: { period: 5 },
      visible: true,
      partnerTag: "partner"
    };
    const input: PartnerStudyInput = {
      id: "MA",
      params: { period: 5 },
      visible: true
    };
    expect(study.partnerTag).toBe("partner");
    expect(input.id).toBe("MA");
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
    expectTypeOf<ChartInstance["getStudyApi"]>()
      .toEqualTypeOf<(entityId: ChartIndicatorEntityId) => ChartStudyApi | undefined>();
    expectTypeOf<ChartInstance["removeStudy"]>()
      .toEqualTypeOf<(entityId: ChartIndicatorEntityId) => boolean>();
    expectTypeOf<ChartInstance["dataReady"]>()
      .toEqualTypeOf<() => Promise<boolean>>();
    expectTypeOf<ChartStudyApi["entityId"]>().toEqualTypeOf<ChartIndicatorEntityId>();
    expectTypeOf<ChartStudyApi["getInputs"]>()
      .toEqualTypeOf<() => Readonly<Record<string, number>>>();
    expectTypeOf<ChartStudyApi["setInputs"]>()
      .toEqualTypeOf<(inputs: Readonly<Record<string, number>>) => void>();
    expectTypeOf<ChartStudyApi["isVisible"]>().toEqualTypeOf<() => boolean>();
    expectTypeOf<ChartStudyApi["setVisible"]>()
      .toEqualTypeOf<(visible: boolean) => void>();
    expectTypeOf<ChartStudyApi["remove"]>().toEqualTypeOf<() => boolean>();
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
    expectTypeOf<ChartOptions>().toHaveProperty("studyDefinitions");
    expectTypeOf<ChartCustomStudyId>().toMatchTypeOf<`custom:${string}`>();
    expectTypeOf<ChartStudyDefinitionId>().toMatchTypeOf<
      import("../index").ChartIndicatorId | ChartCustomStudyId
    >();
    expectTypeOf<ChartCustomStudyDefinition["calculate"]>().toBeFunction();
    expectTypeOf<ChartExecution>().toEqualTypeOf<{
      readonly id: string;
      readonly time: number;
      readonly firstTime?: number;
      readonly lastTime?: number;
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
    })).toThrow("must contain");
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

  it("validates versioned chart-scoped custom study definitions and instances", () => {
    const definitions = parseStudyDefinitions([customStudyDefinition]);
    const parsed = parseIndicatorInput({
      id: "custom:acme.spread",
      definitionVersion: "1",
      params: {},
      visible: true
    }, definitions);

    expect(parsed).toEqual({
      id: "custom:acme.spread",
      definitionVersion: "1",
      params: { multiplier: 2 },
      visible: true
    });
    expect(parseIndicators([{
      ...parsed,
      instanceId: "spread-primary"
    }], definitions)).toEqual([{
      ...parsed,
      instanceId: "spread-primary"
    }]);
    expect(() => parseIndicatorInput({
      id: "custom:acme.spread",
      params: {},
      visible: true
    }, definitions)).toThrow("definitionVersion");
    expect(() => parseIndicatorInput({
      id: "custom:acme.spread",
      definitionVersion: "2",
      params: {},
      visible: true
    }, definitions)).toThrow("unsupported");
    expect(() => parseIndicatorInput({
      id: "custom:acme.spread",
      definitionVersion: "1",
      params: { multiplier: 1.5 },
      visible: true
    }, definitions)).toThrow("invalid");

    const independentFastSlow = {
      ...customStudyDefinition,
      id: "custom:acme.fast-slow",
      inputs: [
        { id: "fast", title: "Fast", defaultValue: 10 },
        { id: "slow", title: "Slow", defaultValue: 5 }
      ]
    } satisfies ChartCustomStudyDefinition;
    expect(parseIndicatorInput({
      id: independentFastSlow.id,
      definitionVersion: "1",
      params: {},
      visible: true
    }, parseStudyDefinitions([independentFastSlow]))).toMatchObject({
      params: { fast: 10, slow: 5 }
    });
  });

  it("keeps custom study versions in Layout V2 and rejects missing definitions", () => {
    const definitions = parseStudyDefinitions([customStudyDefinition]);
    const layout = {
      schemaVersion: 2,
      seriesType: "candles",
      priceScaleMode: "linear",
      indicators: [{
        instanceId: "spread-primary",
        id: "custom:acme.spread",
        definitionVersion: "1",
        params: { multiplier: 3 },
        visible: true
      }],
      drawings: [],
      gridVisible: true
    } as const;

    expect(parseLayout(layout, definitions)).toEqual(layout);
    expect(() => parseLayout(layout)).toThrow("unsupported");
    expect(() => parseLayout({
      ...layout,
      indicators: [
        { instanceId: "ma", id: "MA", params: { period: 5 }, visible: true },
        { ...layout.indicators[0], definitionVersion: "2" }
      ]
    }, definitions)).toThrow("unsupported");
  });

  it("rejects malformed custom study schemas without executing accessors", () => {
    expect(() => parseStudyDefinitions([
      customStudyDefinition,
      customStudyDefinition
    ])).toThrow("duplicated");
    expect(() => parseStudyDefinitions([{
      ...customStudyDefinition,
      id: "MA"
    }])).toThrow("custom:");
    expect(() => parseStudyDefinitions([{
      ...customStudyDefinition,
      inputs: [{
        id: "period",
        title: "Period",
        defaultValue: 5,
        minValue: 10
      }]
    }])).toThrow("defaultValue");
    expect(() => parseStudyDefinitions([{
      ...customStudyDefinition,
      outputs: [
        customStudyDefinition.outputs[0],
        customStudyDefinition.outputs[0]
      ]
    }])).toThrow("duplicated");

    let getterCalls = 0;
    const accessor = { ...customStudyDefinition };
    Object.defineProperty(accessor, "title", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "unsafe";
      }
    });
    expect(() => parseStudyDefinitions([accessor])).toThrow("only data properties");
    expect(getterCalls).toBe(0);

    const accessorInputs: unknown[] = [];
    Object.defineProperty(accessorInputs, "0", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return customStudyDefinition.inputs[0];
      }
    });
    expect(() => parseStudyDefinitions([{
      ...customStudyDefinition,
      inputs: accessorInputs
    }])).toThrow("dense data array");
    expect(getterCalls).toBe(0);
  });

  it("keeps definition versions isolated from later host mutation", () => {
    const mutable = structuredClone({
      ...customStudyDefinition,
      calculate: undefined
    }) as unknown as {
      id: ChartCustomStudyId;
      version: string;
      title: string;
      pane: "main" | "separate";
      inputs: Array<{
        id: string;
        title: string;
        defaultValue: number;
        minValue?: number;
        maxValue?: number;
        integer?: boolean;
      }>;
      outputs: ChartCustomStudyDefinition["outputs"];
      calculate?: ChartCustomStudyDefinition["calculate"];
    };
    mutable.calculate = customStudyDefinition.calculate;
    const definitions = parseStudyDefinitions([
      mutable as ChartCustomStudyDefinition,
      { ...customStudyDefinition, version: "2" }
    ]);
    mutable.title = "Changed";
    mutable.inputs[0]!.defaultValue = 9;

    expect(definitions.get("custom:acme.spread\u00001")).toMatchObject({
      title: "ACME Spread",
      inputs: [{ defaultValue: 2 }]
    });
    expect(parseIndicatorInput({
      id: "custom:acme.spread",
      definitionVersion: "2",
      params: {},
      visible: true
    }, definitions)).toMatchObject({
      definitionVersion: "2",
      params: { multiplier: 2 }
    });
  });

  it("merges partial study inputs through the approved indicator validator", () => {
    const current = {
      instanceId: "macd-primary",
      id: "MACD",
      params: { fast: 12, slow: 26, signal: 9 },
      visible: true
    } as const;

    expect(mergeIndicatorInputs(current, { fast: 10 })).toEqual({
      ...current,
      params: { fast: 10, slow: 26, signal: 9 }
    });
    expect(() => mergeIndicatorInputs(current, { fast: 30 })).toThrow(
      "fast must be less than slow"
    );
    expect(() => mergeIndicatorInputs(current, null)).toThrow("must be an object");

    let getterCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "fast", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 10;
      }
    });
    expect(() => mergeIndicatorInputs(current, accessor)).toThrow("only data properties");
    expect(getterCalls).toBe(0);
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
