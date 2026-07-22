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
  | "timeframes"
  | "adjustment"
  | "series-type"
  | "price-scale"
  | "indicators"
  | "drawing-tools"
  | "drawing-history"
  | "settings"
  | "bottom-panel"
  | "executions";

export type ChartTheme = "dark" | "light";
export type ChartLocale = "zh-CN" | "en-US";
export type ChartView = "intraday" | "timeframe";

export const defaultChartFeatures: readonly ChartFeature[] = Object.freeze([
  "timeframes",
  "adjustment",
  "indicators"
]);

export const advancedChartFeatures: readonly ChartFeature[] = Object.freeze([
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
  locale?: ChartLocale;
  executions?: readonly ChartExecution[];
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

export type ChartEvent =
  | {
      readonly type: "data-loaded";
      readonly state: Readonly<ChartState>;
      readonly dataVersion: string;
      readonly phase: "initial" | "history";
    }
  | { readonly type: "visible-range"; readonly range: Readonly<ChartVisibleRange> };

export type ChartEventListener = (event: Readonly<ChartEvent>) => void;

export interface ChartInstance {
  getState(): Readonly<ChartState>;
  getVisibleRange(): Readonly<ChartVisibleRange> | undefined;
  setSymbol(symbol: ChartSymbol): void;
  setTimeframe(timeframe: Timeframe): void;
  setView(view: ChartView): void;
  setIntradayDays(days: IntradayDayCount): void;
  setAdjustMode(adjustMode: AdjustMode): void;
  setExecutions(executions: readonly ChartExecution[]): void;
  setExecutionsVisible(visible: boolean): void;
  setVisibleRange(range: ChartVisibleRange): void;
  resetToLatest(): void;
  retry(): void;
  subscribe(listener: ChartStateListener): () => void;
  subscribeEvents(listener: ChartEventListener): () => void;
  destroy(): void;
}
