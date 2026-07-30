import { describe, expect, expectTypeOf, it } from "vitest";
import {
  advancedChartFeatures,
  ChartDatafeedError,
  createChartError,
  defaultChartFeatures
} from "../index";
import type {
  ChartActionId,
  ChartDatafeed,
  ChartComparison,
  ChartCrosshairComparisonValue,
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
  ChartLayoutV3,
  ChartLocale,
  ChartMark,
  ChartOptions,
  ChartPane,
  ChartPaneApi,
  ChartPaneId,
  ChartPriceRange,
  ChartPriceScaleApi,
  ChartPriceScaleState,
  ChartReplaySpeed,
  ChartReplayState,
  ChartSeriesProperties,
  ChartSeriesType,
  ChartSeriesVisualOverrides,
  ChartSelectableEntityId,
  ChartStateListener,
  ChartStudyApi,
  ChartStudyOutputVisualOverride,
  ChartStudyDefinitionId,
  ChartSymbol,
  ChartTheme,
  ChartThemeOverrides,
  ChartTimeScaleApi,
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
  parseSeriesVisualOverrides,
  toLayoutV3,
  parseSeriesProperties,
  resolveSeriesProperties,
  parseThemeOverrides,
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
  it("exposes the finite chart action and time-scale API contracts", () => {
    expectTypeOf<ChartActionId>().toEqualTypeOf<
      "timeScaleReset" | "chartReset" | "zoomIn" | "zoomOut" | "fitContent"
    >();
    expectTypeOf<ChartTimeScaleApi["getVisibleRange"]>()
      .toEqualTypeOf<() => Readonly<import("../index").ChartVisibleRange> | undefined>();
    expectTypeOf<ChartTimeScaleApi["setVisibleRange"]>()
      .toEqualTypeOf<(range: import("../index").ChartVisibleRange) => void>();
    expectTypeOf<ChartTimeScaleApi["timeToCoordinate"]>()
      .toEqualTypeOf<(time: number) => number | undefined>();
    expectTypeOf<ChartTimeScaleApi["coordinateToTime"]>()
      .toEqualTypeOf<(coordinate: number) => number | undefined>();
    expectTypeOf<ChartTimeScaleApi["getBarSpacing"]>().toEqualTypeOf<() => number>();
    expectTypeOf<ChartTimeScaleApi["setBarSpacing"]>()
      .toEqualTypeOf<(spacing: number) => void>();
    expectTypeOf<ChartTimeScaleApi["getWidth"]>().toEqualTypeOf<() => number>();
    expectTypeOf<ChartTimeScaleApi["scrollByBars"]>()
      .toEqualTypeOf<(bars: number) => void>();
    expectTypeOf<ChartTimeScaleApi["zoomIn"]>().toEqualTypeOf<() => void>();
    expectTypeOf<ChartTimeScaleApi["zoomOut"]>().toEqualTypeOf<() => void>();
    expectTypeOf<ChartTimeScaleApi["fitContent"]>().toEqualTypeOf<() => void>();
    expectTypeOf<ChartTimeScaleApi["reset"]>().toEqualTypeOf<() => void>();
    expectTypeOf<ChartInstance["getTimeScale"]>()
      .toEqualTypeOf<() => ChartTimeScaleApi>();
    expectTypeOf<ChartInstance["executeActionById"]>()
      .toEqualTypeOf<(actionId: ChartActionId) => void>();
  });

  it("exposes optional symbol-owned price precision", () => {
    expectTypeOf<ChartSymbol["pricePrecision"]>().toEqualTypeOf<number | undefined>();
  });

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

  it("exposes strict configurable series properties without widening ordinary series", () => {
    expectTypeOf<ChartSeriesProperties>().toEqualTypeOf<
      | { readonly type: "renko"; readonly brickSize: number }
      | { readonly type: "lineBreak"; readonly lineCount: number }
      | { readonly type: "kagi"; readonly reversalAmount: number }
      | {
          readonly type: "pointAndFigure";
          readonly boxSize: number;
          readonly reversalBoxes: number;
        }
    >();
    expectTypeOf<ChartOptions["seriesProperties"]>()
      .toEqualTypeOf<readonly ChartSeriesProperties[] | undefined>();
    expectTypeOf<ChartOptions["comparisons"]>()
      .toEqualTypeOf<readonly ChartComparison[] | undefined>();
    expectTypeOf<ChartInstance["setSeriesProperties"]>()
      .toEqualTypeOf<(properties: ChartSeriesProperties) => void>();
  });

  it("exposes strict sparse series and study visual override contracts", () => {
    expectTypeOf<ChartOptions["seriesVisualOverrides"]>()
      .toEqualTypeOf<readonly ChartSeriesVisualOverrides[] | undefined>();
    expectTypeOf<ChartInstance["getSeriesVisualOverrides"]>()
      .toEqualTypeOf<<T extends ChartSeriesType>(
        type: T
      ) => Readonly<ChartSeriesVisualOverrides<T>>>();
    expectTypeOf<ChartInstance["setSeriesVisualOverrides"]>()
      .toEqualTypeOf<(overrides: ChartSeriesVisualOverrides) => void>();
    expectTypeOf<ChartIndicator["visualOverrides"]>()
      .toEqualTypeOf<readonly ChartStudyOutputVisualOverride[] | undefined>();
    expectTypeOf<ChartStudyApi["getVisualOverrides"]>()
      .toEqualTypeOf<() => readonly ChartStudyOutputVisualOverride[]>();
    expectTypeOf<ChartStudyApi["setVisualOverrides"]>()
      .toEqualTypeOf<(overrides: readonly ChartStudyOutputVisualOverride[]) => void>();
  });

  it("parses series visual overrides as one strict defensive table", () => {
    const source = [
      { type: "candles", upColor: "#ff3355", downColor: "#00aa88", lineWidth: 2 },
      { type: "line", color: "#5566ff", lineWidth: 3 },
      { type: "area", lineColor: "#112233", fillColor: "rgba(1, 2, 3, 0.2)", lineWidth: 2 },
      { type: "baseline", upColor: "#ff0000", downColor: "#00ff00", lineWidth: 2 },
      { type: "columns", upColor: "#aa0000", downColor: "#00aa00" }
    ] satisfies readonly ChartSeriesVisualOverrides[];
    const parsed = parseSeriesVisualOverrides(source);
    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);

    for (const invalid of [
      [{ type: "line", color: "#fff" }, { type: "line", color: "#000" }],
      [{ type: "line", color: "var(--host-color)" }],
      [{ type: "line", lineWidth: 0 }],
      [{ type: "line", lineWidth: Number.NaN }],
      [{ type: "line", lineWidth: Number.POSITIVE_INFINITY }],
      [{ type: "line", lineWidth: 11 }],
      [{ type: "columns", color: "#fff" }],
      [{ type: "area", upColor: "#fff" }],
      [{ type: "unknown" }]
    ]) {
      expect(() => parseSeriesVisualOverrides(invalid)).toThrow();
    }
    expect(() => parseSeriesVisualOverrides(Array(1))).toThrow("dense");
    const accessor = { type: "line" };
    Object.defineProperty(accessor, "color", {
      enumerable: true,
      get: () => "#ffffff"
    });
    expect(() => parseSeriesVisualOverrides([accessor])).toThrow("only data properties");
  });

  it("exposes strict host-owned theme overrides", () => {
    expectTypeOf<ChartThemeOverrides>().toEqualTypeOf<{
      readonly backgroundColor?: string;
      readonly surfaceColor?: string;
      readonly surfaceHoverColor?: string;
      readonly borderColor?: string;
      readonly gridColor?: string;
      readonly textColor?: string;
      readonly mutedTextColor?: string;
      readonly accentColor?: string;
      readonly upColor?: string;
      readonly downColor?: string;
      readonly intradayAverageColor?: string;
    }>();
    expectTypeOf<ChartOptions["themeOverrides"]>()
      .toEqualTypeOf<ChartThemeOverrides | undefined>();
    expectTypeOf<ChartInstance["getTheme"]>()
      .toEqualTypeOf<() => ChartTheme>();
    expectTypeOf<ChartInstance["setTheme"]>()
      .toEqualTypeOf<(theme: ChartTheme) => void>();
    expectTypeOf<ChartInstance["getThemeOverrides"]>()
      .toEqualTypeOf<() => Readonly<ChartThemeOverrides>>();
    expectTypeOf<ChartInstance["setThemeOverrides"]>()
      .toEqualTypeOf<(overrides: ChartThemeOverrides) => void>();
  });

  it("parses theme overrides as one strict defensive replacement", () => {
    const source = {
      backgroundColor: "#123456",
      surfaceColor: "rgb(1 2 3)",
      surfaceHoverColor: "hsl(120 50% 50%)",
      borderColor: "#abcdef",
      gridColor: "rgba(4, 5, 6, 0.2)",
      textColor: "white",
      mutedTextColor: "#8899aa",
      accentColor: "#5566ff",
      upColor: "#ff3355",
      downColor: "#00aa88",
      intradayAverageColor: "#d6a700"
    } satisfies ChartThemeOverrides;
    const parsed = parseThemeOverrides(source);
    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    source.backgroundColor = "#000000";
    expect(parsed.backgroundColor).toBe("#123456");

    for (const invalid of [
      [],
      { backgroundColor: "" },
      { backgroundColor: 1 },
      { backgroundColor: "var(--host-color)" },
      { backgroundColor: "currentColor" },
      { backgroundColor: "definitely-not-a-color" },
      { backgroundColor: "url(theme.png)" },
      { backgroundColor: "rgb(///)" },
      { backgroundColor: "hsl(1)" },
      { unsupportedColor: "#ffffff" }
    ]) {
      expect(() => parseThemeOverrides(invalid)).toThrow();
    }
    const accessor = {};
    Object.defineProperty(accessor, "backgroundColor", {
      enumerable: true,
      get: () => "#ffffff"
    });
    expect(() => parseThemeOverrides(accessor)).toThrow("only data properties");

    Object.defineProperty(Object.prototype, "backgroundColor", {
      configurable: true,
      value: "#ffffff"
    });
    try {
      expect(parseThemeOverrides({})).toEqual({});
    } finally {
      delete (Object.prototype as { backgroundColor?: string }).backgroundColor;
    }
  });

  it("parses series properties atomically and resolves rc.34 defaults", () => {
    const source = [
      { type: "renko", brickSize: 2 },
      { type: "lineBreak", lineCount: 4 },
      { type: "kagi", reversalAmount: 3 },
      { type: "pointAndFigure", boxSize: 0.5, reversalBoxes: 2 }
    ] as const;
    const parsed = parseSeriesProperties(source);
    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(resolveSeriesProperties("renko", [])).toEqual({ type: "renko", brickSize: 1 });
    expect(resolveSeriesProperties("lineBreak", [])).toEqual({ type: "lineBreak", lineCount: 3 });
    expect(resolveSeriesProperties("kagi", [])).toEqual({ type: "kagi", reversalAmount: 2 });
    expect(resolveSeriesProperties("pointAndFigure", [])).toEqual({
      type: "pointAndFigure",
      boxSize: 1,
      reversalBoxes: 3
    });
    expect(resolveSeriesProperties("renko", parsed)).toEqual(source[0]);
    expect(() => resolveSeriesProperties("candles" as never, [])).toThrow("unsupported");

    for (const invalid of [
      [{ type: "renko", brickSize: 1 }, { type: "renko", brickSize: 2 }],
      [{ type: "renko", brickSize: 0 }],
      [{ type: "renko", brickSize: Number.NaN }],
      [{ type: "renko", brickSize: Number.POSITIVE_INFINITY }],
      [{ type: "lineBreak", lineCount: 1.5 }],
      [{ type: "lineBreak", lineCount: 501 }],
      [{ type: "lineBreak", lineCount: 10_001 }],
      [{ type: "pointAndFigure", boxSize: 1, reversalBoxes: 10_001 }],
      [{ type: "kagi", reversalAmount: 2, brickSize: 1 }],
      [{ type: "candles" }]
    ]) {
      expect(() => parseSeriesProperties(invalid)).toThrow();
    }
    expect(() => parseSeriesProperties(Array(1))).toThrow("dense");
    const accessor = { type: "renko" };
    Object.defineProperty(accessor, "brickSize", {
      enumerable: true,
      get: () => 1
    });
    expect(() => parseSeriesProperties([accessor])).toThrow("only data properties");
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
    expectTypeOf<ChartInstance["exportLayout"]>().toEqualTypeOf<() => ChartLayoutV3>();
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
    expectTypeOf<ChartReplaySpeed>().toEqualTypeOf<1 | 2 | 4 | 8>();
    expectTypeOf<ChartReplayState>().toEqualTypeOf<{
      readonly status: "inactive" | "paused" | "playing";
      readonly speed: ChartReplaySpeed;
      readonly cursorTime?: number;
    }>();
    expectTypeOf<ChartInstance["getReplayState"]>()
      .toEqualTypeOf<() => Readonly<ChartReplayState>>();
    expectTypeOf<ChartInstance["startReplay"]>()
      .toEqualTypeOf<(time: number) => boolean>();
    expectTypeOf<ChartInstance["stepReplay"]>()
      .toEqualTypeOf<(steps?: number) => boolean>();
    expectTypeOf<ChartInstance["playReplay"]>()
      .toEqualTypeOf<() => void>();
    expectTypeOf<ChartInstance["pauseReplay"]>()
      .toEqualTypeOf<() => void>();
    expectTypeOf<ChartInstance["setReplaySpeed"]>()
      .toEqualTypeOf<(speed: ChartReplaySpeed) => void>();
    expectTypeOf<ChartInstance["stopReplay"]>()
      .toEqualTypeOf<() => void>();
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
    expectTypeOf<ChartInstance["getSelection"]>()
      .toEqualTypeOf<() => readonly ChartSelectableEntityId[]>();
    expectTypeOf<ChartInstance["setSelection"]>()
      .toEqualTypeOf<(entityIds: readonly ChartSelectableEntityId[]) => void>();
    expectTypeOf<ChartInstance["clearSelection"]>()
      .toEqualTypeOf<() => void>();
    expectTypeOf<ChartInstance["getPanes"]>()
      .toEqualTypeOf<() => readonly ChartPane[]>();
    expectTypeOf<ChartInstance["getPaneById"]>()
      .toEqualTypeOf<(id: ChartPaneId) => ChartPane | undefined>();
    expectTypeOf<ChartInstance["getPaneApi"]>()
      .toEqualTypeOf<(id: ChartPaneId) => ChartPaneApi | undefined>();
    expectTypeOf<ChartPaneApi["getPriceScale"]>()
      .toEqualTypeOf<() => ChartPriceScaleApi>();
    expectTypeOf<ChartPriceScaleApi["setVisibleRange"]>()
      .toEqualTypeOf<(range: ChartPriceRange) => void>();
    expectTypeOf<ChartPriceScaleState>().toEqualTypeOf<{
      readonly mode: import("../index").ChartPriceScaleMode;
      readonly autoScale: boolean;
      readonly inverted: boolean;
      readonly visibleRange?: Readonly<ChartPriceRange>;
    }>();
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
    expectTypeOf<ChartInstance["getComparisons"]>()
      .toEqualTypeOf<() => readonly ChartComparison[]>();
    expectTypeOf<ChartInstance["setComparisons"]>()
      .toEqualTypeOf<(comparisons: readonly ChartComparison[]) => void>();
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
    expectTypeOf<ChartOptions>().toHaveProperty("themeOverrides");
    expectTypeOf<ChartOptions>().toHaveProperty("locale");
    expectTypeOf<ChartOptions>().toHaveProperty("executions");
    expectTypeOf<ChartOptions>().toHaveProperty("comparisons");
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
    expectTypeOf<ChartComparison>().toEqualTypeOf<{
      readonly symbol: ChartSymbol;
      readonly color?: string;
      readonly visible?: boolean;
    }>();
    expectTypeOf<ChartCrosshairComparisonValue>().toEqualTypeOf<{
      readonly symbolId: string;
      readonly code: string;
      readonly name: string;
      readonly pricePrecision?: number;
      readonly color?: string;
      readonly value: number | null;
      readonly changePercent: number | null;
      readonly dataVersion?: string;
    }>();
    expectTypeOf<ChartCrosshairSnapshot["comparisons"]>()
      .toEqualTypeOf<readonly ChartCrosshairComparisonValue[]>();
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
    expectTypeOf<Extract<ChartEvent, { type: "replay-changed" }>["replay"]>()
      .toEqualTypeOf<Readonly<ChartReplayState>>();
    expectTypeOf<Extract<ChartEvent, { type: "layout-changed" }>["layout"]>()
      .toEqualTypeOf<Readonly<ChartLayoutV3>>();
    expectTypeOf<Extract<ChartEvent, { type: "mark-clicked" }>["mark"]>()
      .toEqualTypeOf<Readonly<ChartMark>>();
    expectTypeOf<Extract<ChartEvent, { type: "selection-changed" }>["selection"]>()
      .toEqualTypeOf<readonly ChartSelectableEntityId[]>();
    expectTypeOf<Extract<ChartEvent, { type: "drawing-clicked" }>["entity"]["id"]>()
      .toEqualTypeOf<`drawing:${string}`>();
    expectTypeOf<Extract<ChartEvent, { type: "study-clicked" }>["entity"]["id"]>()
      .toEqualTypeOf<ChartIndicatorEntityId>();
    expectTypeOf<Extract<ChartEvent, { type: "execution-clicked" }>["executions"]>()
      .toEqualTypeOf<readonly ChartExecution[]>();
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
      | "symbol-compare"
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
      "symbol-compare",
      "timeframes",
      "adjustment",
      "series-type",
      "price-scale",
      "indicators",
      "drawing-tools",
      "drawing-history",
      "settings",
      "bottom-panel",
      "replay"
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

  it("round-trips optional Series Properties 2.0 fields while accepting legacy V2 layouts", () => {
    const legacy = {
      schemaVersion: 2,
      seriesType: "renko",
      priceScaleMode: "linear",
      indicators: [],
      drawings: [],
      gridVisible: true
    } as const;
    expect(parseLayout(legacy)).toEqual(legacy);

    const configured = {
      ...legacy,
      seriesProperties: [
        { type: "renko", brickSize: 2 },
        { type: "pointAndFigure", boxSize: 0.5, reversalBoxes: 2 }
      ]
    } as const;
    const parsed = parseLayout(configured);
    expect(parsed).toEqual(configured);
    expect(parsed.seriesProperties).not.toBe(configured.seriesProperties);
    expect(() => parseLayout({
      ...configured,
      seriesProperties: [{ type: "renko", brickSize: 0 }]
    })).toThrow();
  });

  it("parses Layout V3 and migrates V2 pane state without sharing input references", () => {
    const v2 = {
      schemaVersion: 2,
      seriesType: "candles",
      priceScaleMode: "log",
      indicators: [{
        instanceId: "macd-primary",
        id: "MACD",
        params: { fast: 12, slow: 26, signal: 9 },
        visible: true
      }],
      drawings: [],
      gridVisible: true
    } as const satisfies ChartLayoutV2;
    const migrated = toLayoutV3(parseLayout(v2));
    expect(migrated).toEqual({
      ...v2,
      schemaVersion: 3,
      panes: [
        {
          id: "main",
          heightRatio: 3,
          collapsed: false,
          priceScale: { autoScale: true, inverted: false }
        },
        {
          id: "study:macd-primary",
          heightRatio: 1,
          collapsed: false,
          priceScale: { autoScale: true, inverted: false }
        }
      ]
    });

    const source = {
      ...migrated,
      seriesVisualOverrides: [{
        type: "candles",
        upColor: "#ff3355",
        downColor: "#00aa88"
      }],
      panes: migrated.panes.map((pane) => pane.id === "main"
        ? {
            ...pane,
            heightRatio: 4,
            priceScale: {
              autoScale: false,
              inverted: true,
              visibleRange: { from: 8, to: 18 }
            }
          }
        : { ...pane, collapsed: true })
    } as const;
    const parsed = parseLayout(source) as ChartLayoutV3;
    expect(parsed).toEqual(source);
    expect(parsed.panes).not.toBe(source.panes);
    expect(parsed.panes[0]?.priceScale).not.toBe(source.panes[0]?.priceScale);
    expect(parsed.seriesVisualOverrides).not.toBe(source.seriesVisualOverrides);
    expect(() => parseLayout({
      ...v2,
      seriesVisualOverrides: source.seriesVisualOverrides
    })).toThrow("unsupported fields");
  });

  it("round-trips the pane id generated from the longest valid study instance id", () => {
    const instanceId = "x".repeat(256);
    const layout = {
      schemaVersion: 3,
      seriesType: "candles",
      priceScaleMode: "linear",
      indicators: [{
        instanceId,
        id: "MACD",
        params: { fast: 12, slow: 26, signal: 9 },
        visible: true
      }],
      drawings: [],
      gridVisible: true,
      panes: [
        {
          id: "main",
          heightRatio: 3,
          collapsed: false,
          priceScale: { autoScale: true, inverted: false }
        },
        {
          id: `study:${instanceId}`,
          heightRatio: 1,
          collapsed: false,
          priceScale: { autoScale: true, inverted: false }
        }
      ]
    } as const;

    expect(parseLayout(layout)).toEqual(layout);
  });

  it("atomically rejects malformed Layout V3 pane and scale state", () => {
    const valid = {
      schemaVersion: 3,
      seriesType: "candles",
      priceScaleMode: "linear",
      indicators: [{
        instanceId: "macd-primary",
        id: "MACD",
        params: { fast: 12, slow: 26, signal: 9 },
        visible: true
      }],
      drawings: [],
      gridVisible: true,
      panes: [
        {
          id: "main",
          heightRatio: 3,
          collapsed: false,
          priceScale: { autoScale: true, inverted: false }
        },
        {
          id: "study:macd-primary",
          heightRatio: 1,
          collapsed: false,
          priceScale: { autoScale: true, inverted: false }
        }
      ]
    } as const;

    expect(parseLayout(valid)).toEqual(valid);
    expect(() => parseLayout({
      ...valid,
      panes: [valid.panes[0], valid.panes[0]]
    })).toThrow("duplicated");
    expect(() => parseLayout({
      ...valid,
      panes: [...valid.panes, {
        id: "study:unknown",
        heightRatio: 1,
        collapsed: false,
        priceScale: { autoScale: true, inverted: false }
      }]
    })).toThrow("does not match");
    expect(() => parseLayout({
      ...valid,
      panes: valid.panes.map((pane) => pane.id === "main"
        ? { ...pane, collapsed: true }
        : pane)
    })).toThrow("main pane");
    expect(() => parseLayout({
      ...valid,
      panes: valid.panes.map((pane) => pane.id === "main"
        ? { ...pane, heightRatio: Number.NaN }
        : pane)
    })).toThrow("height ratio");
    expect(() => parseLayout({
      ...valid,
      panes: valid.panes.map((pane) => pane.id === "main"
        ? {
            ...pane,
            priceScale: {
              autoScale: false,
              inverted: false,
              visibleRange: { from: 10, to: 10 }
            }
          }
        : pane)
    })).toThrow("ascending");
    expect(() => parseLayout({
      ...valid,
      priceScaleMode: "log",
      panes: valid.panes.map((pane) => pane.id === "main"
        ? {
            ...pane,
            priceScale: {
              autoScale: false,
              inverted: false,
              visibleRange: { from: -1, to: 10 }
            }
          }
        : pane)
    })).toThrow("positive");
    expect(() => parseLayout({
      ...valid,
      panes: valid.panes.map((pane) => ({
        ...pane,
        priceScale: {
          autoScale: true,
          inverted: false,
          visibleRange: { from: 1, to: 2 }
        }
      }))
    })).toThrow("automatic");
    expect(() => parseLayout({
      ...valid,
      panes: valid.panes.map((pane) => pane.id === "main"
        ? {
            ...pane,
            priceScale: {
              autoScale: false,
              inverted: false,
              visibleRange: {
                from: -Number.MAX_VALUE,
                to: Number.MAX_VALUE
              }
            }
          }
        : pane)
    })).toThrow("finite span");
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

  it("validates sparse study output visual overrides against output metadata", () => {
    const definitions = parseStudyDefinitions([customStudyDefinition]);
    const parsed = parseIndicatorInput({
      id: "custom:acme.spread",
      definitionVersion: "1",
      params: {},
      visible: true,
      visualOverrides: [{
        outputId: "spread",
        type: "histogram",
        visible: false,
        color: "#ff3355"
      }]
    }, definitions);
    expect(parsed.visualOverrides).toEqual([{
      outputId: "spread",
      type: "histogram",
      visible: false,
      color: "#ff3355"
    }]);

    const validMa = {
      id: "MA",
      params: { period: 5 },
      visible: true,
      visualOverrides: [{
        outputId: "MA",
        type: "line",
        color: "#5566ff",
        lineWidth: 3
      }]
    } as const;
    expect(parseIndicatorInput(validMa)).toEqual(validMa);

    for (const visualOverrides of [
      [{ outputId: "missing", type: "histogram", color: "#fff" }],
      [{ outputId: "spread", type: "line", color: "#fff" }],
      [
        { outputId: "spread", type: "histogram", color: "#fff" },
        { outputId: "spread", type: "histogram", visible: false }
      ],
      [{ outputId: "spread", type: "histogram", color: "var(--host-color)" }],
      [{ outputId: "spread", type: "histogram", lineWidth: 2 }],
      [{ outputId: "spread", type: "histogram", visible: "no" }]
    ]) {
      expect(() => parseIndicatorInput({
        id: "custom:acme.spread",
        definitionVersion: "1",
        params: {},
        visible: true,
        visualOverrides
      }, definitions)).toThrow();
    }
    expect(() => parseIndicatorInput({
      id: "custom:acme.spread",
      definitionVersion: "1",
      params: {},
      visible: true,
      visualOverrides: Array(1)
    }, definitions)).toThrow("dense");
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
