import type { ChartError } from "./errors";

export type SymbolKind = "stock" | "index";
export type Exchange = "SSE" | "SZSE" | "BSE";
export type Timeframe = "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1w" | "1mo";
export type AdjustMode = "none" | "forward" | "backward";
export type IntradayDayCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface ChartDataSeriesCapability {
  readonly timeframe: Timeframe;
  readonly adjustModes: readonly AdjustMode[];
}

export interface ChartIntradayScale {
  readonly previousClose: number;
  readonly priceLimitPercent?: number;
}

export interface ChartDataCapabilities {
  readonly series: readonly ChartDataSeriesCapability[];
  readonly intradayScale?: ChartIntradayScale;
}

export interface ChartSymbol {
  id: string;
  code: string;
  name: string;
  exchange: Exchange;
  kind: SymbolKind;
  pricePrecision?: number;
}

export interface ChartComparison {
  readonly symbol: ChartSymbol;
  readonly color?: string;
  readonly visible?: boolean;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

export type ChartExecutionSide = "buy" | "sell";

export interface ChartExecution {
  readonly id: string;
  readonly time: number;
  readonly firstTime?: number;
  readonly lastTime?: number;
  readonly side: ChartExecutionSide;
  readonly price: number;
  readonly quantity: number;
  readonly label?: string;
  readonly amount?: number;
  readonly fee?: number;
  readonly tQuantity?: number;
}

export interface SeriesRequest {
  symbol: ChartSymbol;
  timeframe: Timeframe;
  adjustMode: AdjustMode;
  beforeCursor?: string;
  dataCutoffTime?: number;
}

export interface SeriesPage {
  candles: readonly Candle[];
  beforeCursor?: string;
  hasMoreBefore: boolean;
  dataVersion: string;
}

export interface ChartDatafeed {
  getCapabilities(symbol: ChartSymbol, signal: AbortSignal): Promise<ChartDataCapabilities>;
  searchSymbols(query: string, signal: AbortSignal): Promise<readonly ChartSymbol[]>;
  loadSeries(request: SeriesRequest, signal: AbortSignal): Promise<SeriesPage>;
}

export type ChartFeature =
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
  | "replay"
  | "executions";

export type ChartTheme = "dark" | "light";
export interface ChartThemeOverrides {
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
}
export type ChartLocale = "zh-CN" | "en-US";
export type ChartView = "intraday" | "timeframe";
export type ChartSeriesType =
  | "bars"
  | "candles"
  | "hollowCandles"
  | "volumeCandles"
  | "line"
  | "lineWithMarkers"
  | "stepLine"
  | "area"
  | "hlcArea"
  | "baseline"
  | "columns"
  | "highLow"
  | "heikinAshi"
  | "renko"
  | "lineBreak"
  | "kagi"
  | "pointAndFigure";
export type ChartSeriesVisualOverrides<T extends ChartSeriesType = ChartSeriesType> =
  T extends
    | "bars"
    | "candles"
    | "hollowCandles"
    | "volumeCandles"
    | "highLow"
    | "heikinAshi"
    | "renko"
    | "lineBreak"
    | "kagi"
    | "pointAndFigure"
    ? {
        readonly type: T;
        readonly upColor?: string;
        readonly downColor?: string;
        readonly lineWidth?: number;
      }
    : T extends "line" | "lineWithMarkers" | "stepLine"
      ? {
          readonly type: T;
          readonly color?: string;
          readonly lineWidth?: number;
        }
      : T extends "area" | "hlcArea"
        ? {
            readonly type: T;
            readonly lineColor?: string;
            readonly fillColor?: string;
            readonly lineWidth?: number;
          }
        : T extends "baseline"
          ? {
              readonly type: T;
              readonly upColor?: string;
              readonly downColor?: string;
              readonly lineWidth?: number;
            }
          : {
              readonly type: T;
              readonly upColor?: string;
              readonly downColor?: string;
            };
export type ChartSeriesProperties =
  | { readonly type: "renko"; readonly brickSize: number }
  | { readonly type: "lineBreak"; readonly lineCount: number }
  | { readonly type: "kagi"; readonly reversalAmount: number }
  | {
      readonly type: "pointAndFigure";
      readonly boxSize: number;
      readonly reversalBoxes: number;
    };
export type ChartConfigurableSeriesType = ChartSeriesProperties["type"];
export type ChartPriceScaleMode = "linear" | "log" | "percentage";
export type ChartReplaySpeed = 1 | 2 | 4 | 8;

export interface ChartReplayState {
  readonly status: "inactive" | "paused" | "playing";
  readonly speed: ChartReplaySpeed;
  readonly cursorTime?: number;
}

export type ChartPaneId = "main" | `study:${string}`;

export interface ChartPriceRange {
  readonly from: number;
  readonly to: number;
}

export interface ChartPriceScaleState {
  readonly mode: ChartPriceScaleMode;
  readonly autoScale: boolean;
  readonly inverted: boolean;
  readonly visibleRange?: Readonly<ChartPriceRange>;
}

export interface ChartPane {
  readonly id: ChartPaneId;
  readonly kind: "main" | "study";
  readonly title: string;
  readonly studyInstanceId?: string;
  readonly visible: boolean;
  readonly heightRatio: number;
  readonly collapsed: boolean;
  readonly priceScale: Readonly<ChartPriceScaleState>;
}

export interface ChartPriceScaleApi {
  readonly paneId: ChartPaneId;
  getState(): Readonly<ChartPriceScaleState>;
  setMode(mode: ChartPriceScaleMode): void;
  setAutoScale(enabled: boolean): void;
  setVisibleRange(range: ChartPriceRange): void;
  setInverted(inverted: boolean): void;
}

export interface ChartPaneApi {
  readonly id: ChartPaneId;
  getState(): Readonly<ChartPane>;
  setHeightRatio(ratio: number): void;
  setCollapsed(collapsed: boolean): void;
  moveTo(index: number): void;
  getPriceScale(): ChartPriceScaleApi;
}
export type ChartIndicatorId =
  | "MA"
  | "EMA"
  | "SMA"
  | "VOL"
  | "MACD"
  | "BOLL"
  | "KDJ"
  | "RSI"
  | "BIAS"
  | "CCI"
  | "DMI"
  | "OBV"
  | "VR"
  | "WR"
  | "MTM"
  | "SAR";

export type ChartCustomStudyId = `custom:${string}`;
export type ChartStudyDefinitionId = ChartIndicatorId | ChartCustomStudyId;

export interface ChartCustomStudyInputDefinition {
  readonly id: string;
  readonly title: string;
  readonly defaultValue: number;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly integer?: boolean;
}

export type ChartCustomStudyOutputDefinition =
  | {
      readonly id: string;
      readonly title: string;
      readonly type: "line";
      readonly color?: string;
      readonly lineWidth?: number;
    }
  | {
      readonly id: string;
      readonly title: string;
      readonly type: "histogram";
      readonly color?: string;
    }
  | {
      readonly id: string;
      readonly title: string;
      readonly type: "band";
      readonly fill?: string;
    }
  | {
      readonly id: string;
      readonly title: string;
      readonly type: "marker";
      readonly color?: string;
    };

export interface ChartCustomStudyCalculationInput {
  readonly symbol: Readonly<ChartSymbol>;
  readonly timeframe: Timeframe;
  readonly adjustMode: AdjustMode;
  readonly dataVersion: string;
  readonly inputs: Readonly<Record<string, number>>;
  readonly candles: readonly Readonly<Candle>[];
  readonly processedCount: number;
  readonly previousState?: ChartJsonValue;
}

export type ChartCustomStudyOutputValues =
  | readonly (number | null)[]
  | {
      readonly upper: readonly (number | null)[];
      readonly lower: readonly (number | null)[];
    };

export interface ChartCustomStudyCalculationResult {
  readonly outputs: Readonly<Record<string, ChartCustomStudyOutputValues>>;
  readonly state?: ChartJsonValue;
}

export interface ChartCustomStudyDefinition {
  readonly id: ChartCustomStudyId;
  readonly version: string;
  readonly title: string;
  readonly pane: "main" | "separate";
  readonly inputs: readonly ChartCustomStudyInputDefinition[];
  readonly outputs: readonly ChartCustomStudyOutputDefinition[];
  readonly calculate: (
    input: Readonly<ChartCustomStudyCalculationInput>
  ) => ChartCustomStudyCalculationResult;
}

export type ChartStudyOutputVisualOverride =
  | {
      readonly outputId: string;
      readonly type: "line";
      readonly visible?: boolean;
      readonly color?: string;
      readonly lineWidth?: number;
    }
  | {
      readonly outputId: string;
      readonly type: "histogram";
      readonly visible?: boolean;
      readonly color?: string;
    }
  | {
      readonly outputId: string;
      readonly type: "band";
      readonly visible?: boolean;
      readonly fill?: string;
    }
  | {
      readonly outputId: string;
      readonly type: "marker";
      readonly visible?: boolean;
      readonly color?: string;
    };

export interface ChartIndicator {
  readonly instanceId: string;
  readonly id: ChartStudyDefinitionId;
  readonly definitionVersion?: string;
  readonly params: Readonly<Record<string, number>>;
  readonly visible: boolean;
  readonly visualOverrides?: readonly ChartStudyOutputVisualOverride[];
}

export interface ChartBuiltInStudy extends ChartIndicator {
  readonly id: ChartIndicatorId;
  readonly definitionVersion?: never;
}

export interface ChartCustomStudy extends ChartIndicator {
  readonly id: ChartCustomStudyId;
  readonly definitionVersion: string;
}

export interface ChartIndicatorInput {
  readonly instanceId?: string;
  readonly id: ChartStudyDefinitionId;
  readonly definitionVersion?: string;
  readonly params: Readonly<Record<string, number>>;
  readonly visible: boolean;
  readonly visualOverrides?: readonly ChartStudyOutputVisualOverride[];
}

export interface ChartBuiltInStudyInput extends ChartIndicatorInput {
  readonly id: ChartIndicatorId;
  readonly definitionVersion?: never;
}

export interface ChartCustomStudyInput extends ChartIndicatorInput {
  readonly id: ChartCustomStudyId;
  readonly definitionVersion: string;
}

export type ChartDrawingType =
  | "trendLine"
  | "ray"
  | "extendedLine"
  | "horizontalLine"
  | "verticalLine"
  | "crossLine"
  | "segment"
  | "straightLine"
  | "rayLine"
  | "horizontalRayLine"
  | "horizontalSegment"
  | "horizontalStraightLine"
  | "verticalRayLine"
  | "verticalSegment"
  | "verticalStraightLine"
  | "priceLine"
  | "parallelChannel"
  | "regressionChannel"
  | "priceChannelLine"
  | "fibonacciRetracement"
  | "fibonacciExtension"
  | "fibTrendBasedExtension"
  | "fibTimeZone"
  | "fibFan"
  | "fibArc"
  | "fibChannel"
  | "fibWedge"
  | "text"
  | "callout"
  | "simpleAnnotation"
  | "simpleTag"
  | "rectangle"
  | "rotatedRectangle"
  | "circle"
  | "ellipse"
  | "polygon"
  | "triangle"
  | "arc"
  | "curve"
  | "path"
  | "brush"
  | "arrow"
  | "longPosition"
  | "shortPosition"
  | "profitLossRange"
  | "datePriceRange"
  | "dateRange"
  | "priceRange"
  | "measure"
  | "trendAngle"
  | "gannFan"
  | "gannBox"
  | "gannSquare"
  | "pitchfork"
  | "schiffPitchfork"
  | "modifiedSchiffPitchfork"
  | "insidePitchfork"
  | "elliottImpulseWave"
  | "elliottCorrectionWave"
  | "xabcdPattern"
  | "cypherPattern"
  | "headAndShouldersPattern"
  | "forecastPath";

export type ChartDrawingTool = ChartDrawingType | "select";

export interface ChartDrawingAnchor {
  readonly time: number;
  readonly price: number;
}

export interface ChartDrawingStyle {
  readonly color?: string;
  readonly lineWidth?: number;
  readonly lineDash?: readonly number[];
  readonly fill?: string;
  readonly textColor?: string;
  readonly fontSize?: number;
}

export interface ChartDrawing {
  readonly id: string;
  readonly type: ChartDrawingType;
  readonly anchors: readonly ChartDrawingAnchor[];
  readonly style?: ChartDrawingStyle;
  readonly text?: string;
  readonly visible?: boolean;
  readonly locked?: boolean;
  readonly interactive?: boolean;
  readonly affectsPriceScale?: boolean;
  readonly zIndex?: number;
  readonly metadata?: Readonly<Record<string, ChartJsonValue>>;
}

export type ChartJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly ChartJsonValue[]
  | { readonly [key: string]: ChartJsonValue };

export interface ChartMark {
  readonly id: string;
  readonly time: number;
  readonly price: number;
  readonly label?: string;
  readonly color?: string;
}

export type ChartEntityKind = "indicator" | "drawing" | "mark";
export type ChartIndicatorEntityId = `indicator:${string}`;
export type ChartEntityId =
  | ChartIndicatorEntityId
  | `drawing:${string}`
  | `mark:${string}`;
export type ChartSelectableEntityId =
  | ChartIndicatorEntityId
  | `drawing:${string}`;

export type ChartEntityInput =
  | { readonly kind: "indicator"; readonly value: ChartIndicator }
  | { readonly kind: "drawing"; readonly value: ChartDrawing }
  | { readonly kind: "mark"; readonly value: ChartMark };

export type ChartEntity =
  | { readonly id: ChartEntityId; readonly kind: "indicator"; readonly value: ChartIndicator }
  | { readonly id: ChartEntityId; readonly kind: "drawing"; readonly value: ChartDrawing }
  | { readonly id: ChartEntityId; readonly kind: "mark"; readonly value: ChartMark };

export const defaultChartFeatures: readonly ChartFeature[] = Object.freeze([
  "timeframes",
  "adjustment",
  "indicators"
]);

export const advancedChartFeatures: readonly ChartFeature[] = Object.freeze([
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

export interface ChartOptions {
  chartId: string;
  persistenceScopeId: string;
  dataContextId: string;
  initialSymbol: ChartSymbol;
  datafeed: ChartDatafeed;
  initialTimeframe?: Timeframe;
  initialAdjustMode?: AdjustMode;
  dataCutoffTime?: number;
  features?: readonly ChartFeature[];
  theme?: ChartTheme;
  themeOverrides?: ChartThemeOverrides;
  locale?: ChartLocale;
  executions?: readonly ChartExecution[];
  comparisons?: readonly ChartComparison[];
  marks?: readonly ChartMark[];
  seriesProperties?: readonly ChartSeriesProperties[];
  seriesVisualOverrides?: readonly ChartSeriesVisualOverrides[];
  studyDefinitions?: readonly ChartCustomStudyDefinition[];
  onError?: (error: ChartError) => void;
}

export interface ChartState {
  symbol: ChartSymbol;
  timeframe: Timeframe;
  view: ChartView;
  intradayDays: IntradayDayCount;
  adjustMode: AdjustMode;
  loading: boolean;
  capabilities?: ChartDataCapabilities;
}

export type ChartStateListener = (state: Readonly<ChartState>) => void;

export interface ChartVisibleRange {
  readonly from: number;
  readonly to: number;
}

export type ChartActionId =
  | "timeScaleReset"
  | "chartReset"
  | "zoomIn"
  | "zoomOut"
  | "fitContent";

export interface ChartTimeScaleApi {
  getVisibleRange(): Readonly<ChartVisibleRange> | undefined;
  setVisibleRange(range: ChartVisibleRange): void;
  timeToCoordinate(time: number): number | undefined;
  coordinateToTime(coordinate: number): number | undefined;
  getBarSpacing(): number;
  setBarSpacing(spacing: number): void;
  getWidth(): number;
  scrollByBars(bars: number): void;
  zoomIn(): void;
  zoomOut(): void;
  fitContent(): void;
  reset(): void;
}

export type ChartCrosshairStudyOutput =
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
    };

export interface ChartCrosshairStudyValues {
  readonly entityId: ChartIndicatorEntityId;
  readonly indicatorId: ChartStudyDefinitionId;
  readonly title: string;
  readonly outputs: readonly ChartCrosshairStudyOutput[];
}

export interface ChartCrosshairComparisonValue {
  readonly symbolId: string;
  readonly code: string;
  readonly name: string;
  readonly pricePrecision?: number;
  readonly color?: string;
  readonly value: number | null;
  readonly changePercent: number | null;
  readonly dataVersion?: string;
}

export interface ChartCrosshairSnapshot {
  readonly symbolId: string;
  readonly timeframe: Timeframe;
  readonly adjustMode: AdjustMode;
  readonly dataVersion: string;
  readonly time: number;
  readonly price: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly candle: Readonly<Candle>;
  readonly referencePrice: number | null;
  readonly change: number | null;
  readonly changePercent: number | null;
  readonly studies: readonly ChartCrosshairStudyValues[];
  readonly comparisons: readonly ChartCrosshairComparisonValue[];
}

export type ChartCrosshairEvent =
  | { readonly type: "crosshair-moved"; readonly crosshair: Readonly<ChartCrosshairSnapshot> }
  | { readonly type: "crosshair-left" };

export type ChartCrosshairListener = (event: Readonly<ChartCrosshairEvent>) => void;

export interface ChartStudyApi {
  readonly entityId: ChartIndicatorEntityId;
  getInputs(): Readonly<Record<string, number>>;
  setInputs(inputs: Readonly<Record<string, number>>): void;
  isVisible(): boolean;
  setVisible(visible: boolean): void;
  getVisualOverrides(): readonly ChartStudyOutputVisualOverride[];
  setVisualOverrides(overrides: readonly ChartStudyOutputVisualOverride[]): void;
  remove(): boolean;
}

export interface ChartLayoutV2 {
  readonly schemaVersion: 2;
  readonly seriesType: ChartSeriesType;
  readonly seriesProperties?: readonly ChartSeriesProperties[];
  readonly priceScaleMode: ChartPriceScaleMode;
  readonly indicators: readonly ChartIndicator[];
  readonly drawings: readonly ChartDrawing[];
  readonly gridVisible: boolean;
}

export interface ChartPaneLayout {
  readonly id: ChartPaneId;
  readonly heightRatio: number;
  readonly collapsed: boolean;
  readonly priceScale: {
    readonly autoScale: boolean;
    readonly inverted: boolean;
    readonly visibleRange?: Readonly<ChartPriceRange>;
  };
}

export interface ChartLayoutV3 {
  readonly schemaVersion: 3;
  readonly seriesType: ChartSeriesType;
  readonly seriesProperties?: readonly ChartSeriesProperties[];
  readonly seriesVisualOverrides?: readonly ChartSeriesVisualOverrides[];
  readonly priceScaleMode: ChartPriceScaleMode;
  readonly indicators: readonly ChartIndicator[];
  readonly drawings: readonly ChartDrawing[];
  readonly gridVisible: boolean;
  readonly panes: readonly ChartPaneLayout[];
}

export type ChartLayout = ChartLayoutV2 | ChartLayoutV3;

export type ChartEvent =
  | {
      readonly type: "data-loaded";
      readonly state: Readonly<ChartState>;
      readonly dataVersion: string;
      readonly phase: "initial" | "history";
    }
  | { readonly type: "replay-changed"; readonly replay: Readonly<ChartReplayState> }
  | { readonly type: "visible-range"; readonly range: Readonly<ChartVisibleRange> }
  | { readonly type: "layout-changed"; readonly layout: Readonly<ChartLayoutV3> }
  | { readonly type: "mark-clicked"; readonly mark: Readonly<ChartMark> }
  | { readonly type: "selection-changed"; readonly selection: readonly ChartSelectableEntityId[] }
  | {
      readonly type: "drawing-clicked";
      readonly entity: Readonly<
        Extract<ChartEntity, { readonly kind: "drawing" }> & { readonly id: `drawing:${string}` }
      >;
    }
  | {
      readonly type: "study-clicked";
      readonly entity: Readonly<
        Extract<ChartEntity, { readonly kind: "indicator" }> & { readonly id: ChartIndicatorEntityId }
      >;
    }
  | { readonly type: "execution-clicked"; readonly executions: readonly ChartExecution[] }
  | { readonly type: "entity-created"; readonly entity: Readonly<ChartEntity> }
  | { readonly type: "entity-updated"; readonly entity: Readonly<ChartEntity> }
  | { readonly type: "entity-removed"; readonly entity: Readonly<ChartEntity> };

export type ChartEventListener = (event: Readonly<ChartEvent>) => void;

export interface ChartInstance {
  getState(): Readonly<ChartState>;
  getTheme(): ChartTheme;
  getThemeOverrides(): Readonly<ChartThemeOverrides>;
  getVisibleRange(): Readonly<ChartVisibleRange> | undefined;
  getTimeScale(): ChartTimeScaleApi;
  getSeriesType(): ChartSeriesType;
  getSeriesProperties<T extends ChartConfigurableSeriesType>(
    type: T
  ): Readonly<Extract<ChartSeriesProperties, { readonly type: T }>>;
  getSeriesVisualOverrides<T extends ChartSeriesType>(
    type: T
  ): Readonly<ChartSeriesVisualOverrides<T>>;
  getPriceScaleMode(): ChartPriceScaleMode;
  getPanes(): readonly ChartPane[];
  getPaneById(id: ChartPaneId): ChartPane | undefined;
  getPaneApi(id: ChartPaneId): ChartPaneApi | undefined;
  getIndicators(): readonly ChartIndicator[];
  getDrawings(): readonly ChartDrawing[];
  getMarks(): readonly ChartMark[];
  getComparisons(): readonly ChartComparison[];
  getReplayState(): Readonly<ChartReplayState>;
  dataReady(): Promise<boolean>;
  createStudy(indicator: ChartIndicatorInput): ChartIndicatorEntityId;
  getStudyById(entityId: ChartIndicatorEntityId): ChartIndicator | undefined;
  getStudyApi(entityId: ChartIndicatorEntityId): ChartStudyApi | undefined;
  getAllStudies(): readonly ChartIndicator[];
  removeStudy(entityId: ChartIndicatorEntityId): boolean;
  createEntity(entity: ChartEntityInput): ChartEntityId;
  getEntity(entityId: ChartEntityId): ChartEntity | undefined;
  getEntities(kind?: ChartEntityKind): readonly ChartEntity[];
  getSelection(): readonly ChartSelectableEntityId[];
  setSelection(entityIds: readonly ChartSelectableEntityId[]): void;
  clearSelection(): void;
  updateEntity(entity: ChartEntity): void;
  removeEntity(entityId: ChartEntityId): boolean;
  exportLayout(): ChartLayoutV3;
  setTheme(theme: ChartTheme): void;
  setThemeOverrides(overrides: ChartThemeOverrides): void;
  setSymbol(symbol: ChartSymbol): void;
  setTimeframe(timeframe: Timeframe): void;
  setView(view: ChartView): void;
  setIntradayDays(days: IntradayDayCount): void;
  setAdjustMode(adjustMode: AdjustMode): void;
  setSeriesType(type: ChartSeriesType): void;
  setSeriesProperties(properties: ChartSeriesProperties): void;
  setSeriesVisualOverrides(overrides: ChartSeriesVisualOverrides): void;
  setPriceScaleMode(mode: ChartPriceScaleMode): void;
  setIndicators(indicators: readonly ChartIndicator[]): void;
  setDrawings(drawings: readonly ChartDrawing[]): void;
  setMarks(marks: readonly ChartMark[]): void;
  setComparisons(comparisons: readonly ChartComparison[]): void;
  setDrawingTool(tool: ChartDrawingTool): void;
  setGridVisible(visible: boolean): void;
  undoDrawing(): void;
  redoDrawing(): void;
  importLayout(layout: unknown): void;
  setExecutions(executions: readonly ChartExecution[]): void;
  setExecutionsVisible(visible: boolean): void;
  setVisibleRange(range: ChartVisibleRange): void;
  executeActionById(actionId: ChartActionId): void;
  startReplay(time: number): boolean;
  stepReplay(steps?: number): boolean;
  playReplay(): void;
  pauseReplay(): void;
  setReplaySpeed(speed: ChartReplaySpeed): void;
  stopReplay(): void;
  resetToLatest(): void;
  retry(): void;
  subscribe(listener: ChartStateListener): () => void;
  subscribeEvents(listener: ChartEventListener): () => void;
  subscribeCrosshair(listener: ChartCrosshairListener): () => void;
  destroy(): void;
}
