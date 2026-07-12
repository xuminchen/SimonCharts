import type { ChartWorkspaceError } from "./errors";

export type SymbolKind = "stock" | "index";
export type Exchange = "SSE" | "SZSE" | "BSE";
export type Timeframe = "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1w" | "1mo";
export type AdjustMode = "none" | "forward" | "backward";

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

export interface SeriesRequest {
  symbol: ChartSymbol;
  timeframe: Timeframe;
  adjustMode: AdjustMode;
  beforeCursor?: string;
}

export interface SeriesPage {
  candles: readonly Candle[];
  beforeCursor?: string;
  hasMoreBefore: boolean;
  dataVersion: string;
}

export interface ChartWorkspaceDataSource {
  searchSymbols(query: string, signal: AbortSignal): Promise<readonly ChartSymbol[]>;
  loadSeries(request: SeriesRequest, signal: AbortSignal): Promise<SeriesPage>;
}

export interface ChartWorkspaceOptions {
  workspaceId: string;
  initialSymbol: ChartSymbol;
  dataSource: ChartWorkspaceDataSource;
  initialTimeframe?: Timeframe;
  initialAdjustMode?: AdjustMode;
  onError?: (error: ChartWorkspaceError) => void;
}

export interface ChartWorkspaceState {
  symbol: ChartSymbol;
  timeframe: Timeframe;
  adjustMode: AdjustMode;
  loading: boolean;
}

export interface ChartWorkspace {
  getState(): Readonly<ChartWorkspaceState>;
  setSymbol(symbol: ChartSymbol): void;
  setTimeframe(timeframe: Timeframe): void;
  setAdjustMode(adjustMode: AdjustMode): void;
  retry(): void;
  destroy(): void;
}
