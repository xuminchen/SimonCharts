import type { Candle, ChartWorkspaceDataSource } from "@simoncharts/chart-workspace";

export const stock = { id: "stock:SSE:600000", code: "600000", name: "浦发银行", exchange: "SSE" as const, kind: "stock" as const };
export const index = { id: "index:SSE:000001", code: "000001", name: "上证指数", exchange: "SSE" as const, kind: "index" as const };

function candles(): Candle[] {
  return Array.from({ length: 500 }, (_, position) => {
    const close = 100 + position * 0.02 + Math.sin(position / 12) * 3;
    return {
      time: Date.UTC(2026, 0, 1) + position * 60_000,
      open: close - 0.2,
      high: close + 0.8,
      low: close - 0.7,
      close,
      volume: 10_000 + position,
      turnover: (10_000 + position) * close
    };
  });
}

export function createFixtureDataSource(): ChartWorkspaceDataSource {
  return {
    async searchSymbols(query, signal) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      return [stock, index].filter((symbol) => `${symbol.code}${symbol.name}`.includes(query));
    },
    async loadSeries(_request, signal) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      window.__workspaceRequests ??= [];
      window.__workspaceRequests.push({
        symbolId: _request.symbol.id,
        timeframe: _request.timeframe,
        adjustMode: _request.adjustMode,
        hasCursor: _request.beforeCursor !== undefined
      });
      return { candles: candles(), hasMoreBefore: false, dataVersion: "fixture-v1" };
    }
  };
}

declare global {
  interface Window {
    __workspaceRequests?: Array<Record<string, unknown>>;
  }
}
