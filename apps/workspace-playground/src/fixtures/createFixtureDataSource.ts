import type {
  Candle,
  ChartSymbol,
  ChartWorkspaceDataSource,
  SeriesPage,
  SeriesRequest
} from "@simoncharts/chart-workspace";

export const stock = { id: "stock:SSE:600000", code: "600000", name: "浦发银行", exchange: "SSE" as const, kind: "stock" as const };
export const index = { id: "index:SSE:000001", code: "000001", name: "上证指数", exchange: "SSE" as const, kind: "index" as const };
export const slowStock = { id: "stock:SSE:slow", code: "600001", name: "慢速股票", exchange: "SSE" as const, kind: "stock" as const };
export const fastStock = { id: "stock:SSE:fast", code: "600002", name: "快速股票", exchange: "SSE" as const, kind: "stock" as const };

export interface HostCounters {
  activeRequests: number;
  activeObservers: number;
  activeAnimationFrames: number;
  activeEventListeners: number;
  abortedRequests: number;
  errors: number;
}

export interface FixtureRequestLog extends Record<string, unknown> {
  symbolId: string;
  timeframe: string;
  adjustMode: string;
  hasCursor: boolean;
  cursor?: string;
  status: "started" | "resolved" | "aborted" | "rejected";
}

export interface FixtureControls {
  latency: number;
  initialFailure?: "once" | "always";
  historyFailure: boolean;
  invalidPage?: "initial" | "history";
  cursorCycle: boolean;
  boundaryConflict: boolean;
  versionChange: boolean;
  history: boolean;
}

export function readFixtureControls(search: string): FixtureControls {
  const params = new URLSearchParams(search);
  const initialFailure = params.get("initialFailure");
  const invalidPage = params.get("invalidPage");
  return {
    latency: Math.max(0, Number(params.get("latency") ?? 0) || 0),
    ...(initialFailure === "once" || initialFailure === "always" ? { initialFailure } : {}),
    historyFailure: params.get("historyFailure") === "1",
    ...(invalidPage === "initial" || invalidPage === "history" ? { invalidPage } : {}),
    cursorCycle: params.get("cursorCycle") === "1",
    boundaryConflict: params.get("boundaryConflict") === "1",
    versionChange: params.get("versionChange") === "1",
    history: params.get("history") === "1" || ["historyFailure", "cursorCycle", "boundaryConflict", "versionChange"].some((key) => params.get(key) === "1") || invalidPage === "history"
  };
}

function candleAt(position: number): Candle {
  const close = 100 + Math.sin(position / 25) * 8 + position * 0.0001;
  return {
    time: Date.UTC(2026, 5, 5, 1, 30) + position * 60_000,
    open: close - 0.2,
    high: close + 0.8,
    low: close - 0.8,
    close,
    volume: 10_000 + (position % 500),
    turnover: (10_000 + (position % 500)) * close
  };
}

function waitFor(signal: AbortSignal, milliseconds: number): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

function pageFor(request: SeriesRequest, controls: FixtureControls, version: string): SeriesPage {
  const historyRequest = request.beforeCursor !== undefined;
  const start = controls.history ? (historyRequest ? 0 : 500) : 0;
  const page = {
    candles: Array.from({ length: 500 }, (_, position) => candleAt(start + position)),
    ...(controls.history && !historyRequest ? { beforeCursor: "page-1" } : {}),
    hasMoreBefore: controls.history && !historyRequest,
    dataVersion: version
  };
  if (controls.invalidPage === (historyRequest ? "history" : "initial")) {
    page.candles[0] = { ...page.candles[0], close: Number.NaN };
  }
  if (historyRequest && controls.cursorCycle) return { ...page, beforeCursor: request.beforeCursor, hasMoreBefore: true };
  if (historyRequest && controls.boundaryConflict) return { ...page, candles: Array.from({ length: 500 }, (_, position) => candleAt(500 + position)) };
  return page;
}

export function createFixtureDataSource(
  controls: FixtureControls,
  counters: HostCounters,
  requests: FixtureRequestLog[]
): ChartWorkspaceDataSource {
  const initialAttempts = new Map<string, number>();
  let version = "fixture-v1";
  const symbols: readonly ChartSymbol[] = [stock, index, slowStock, fastStock];

  const tracked = async <T>(signal: AbortSignal, log: FixtureRequestLog, work: () => Promise<T>): Promise<T> => {
    requests.push(log);
    counters.activeRequests += 1;
    try {
      const result = await work();
      log.status = "resolved";
      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        log.status = "aborted";
        counters.abortedRequests += 1;
      } else log.status = "rejected";
      throw error;
    } finally {
      counters.activeRequests -= 1;
    }
  };

  return {
    searchSymbols(query, signal) {
      const log: FixtureRequestLog = { symbolId: `search:${query}`, timeframe: "", adjustMode: "", hasCursor: false, status: "started" };
      return tracked(signal, log, async () => {
        await waitFor(signal, controls.latency);
        return symbols.filter((symbol) => `${symbol.code}${symbol.name}`.includes(query));
      });
    },
    loadSeries(request, signal) {
      const log: FixtureRequestLog = {
        symbolId: request.symbol.id,
        timeframe: request.timeframe,
        adjustMode: request.adjustMode,
        hasCursor: request.beforeCursor !== undefined,
        ...(request.beforeCursor === undefined ? {} : { cursor: request.beforeCursor }),
        status: "started"
      };
      return tracked(signal, log, async () => {
        const latency = request.symbol.id === slowStock.id ? Math.max(1_000, controls.latency) : controls.latency;
        await waitFor(signal, latency);
        if (request.beforeCursor !== undefined && controls.historyFailure) throw new Error("fixture history failure");
        const attemptKey = `${request.symbol.id}:${request.timeframe}:${request.adjustMode}`;
        const attempts = initialAttempts.get(attemptKey) ?? 0;
        initialAttempts.set(attemptKey, attempts + 1);
        if (request.beforeCursor === undefined && (controls.initialFailure === "always" || (controls.initialFailure === "once" && attempts === 0))) {
          throw new Error("fixture initial failure");
        }
        if (request.beforeCursor !== undefined && controls.versionChange && version === "fixture-v1") version = "fixture-v2";
        const page = pageFor(request, controls, version);
        log.dataVersion = page.dataVersion;
        return page;
      });
    }
  };
}

declare global {
  interface Window {
    __workspaceRequests?: Array<Record<string, unknown>>;
  }
}
