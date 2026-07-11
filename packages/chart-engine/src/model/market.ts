export const supportedTimeframes = [
  "1m",
  "5m",
  "15m",
  "30m",
  "60m",
  "1d",
  "1w",
  "1mo"
] as const;

export type Timeframe = (typeof supportedTimeframes)[number];

export type AdjustMode = "none" | "forward" | "backward";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

export interface CandleSeries {
  symbol: string;
  timeframe: Timeframe;
  adjustMode: AdjustMode;
  candles: Candle[];
  dataVersion: string;
}

export interface Quote {
  symbol: string;
  timestamp: number;
  last: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
}

export interface TradingSession {
  openTime: string;
  closeTime: string;
}

export interface TradingCalendar {
  timezone: string;
  tradingDays: string[];
  sessions?: TradingSession[];
}
