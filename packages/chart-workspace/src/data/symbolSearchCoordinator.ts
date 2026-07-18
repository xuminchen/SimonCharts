import type { ChartDatafeed, ChartSymbol } from "../contracts";

export type SymbolSearchCoordinatorEvent =
  | { type: "results"; query: string; symbols: readonly Readonly<ChartSymbol>[] }
  | { type: "searchFailed"; query: string; code: "SYMBOL_SEARCH_FAILED"; error: unknown };

export interface SymbolSearchCoordinator {
  search(query: string): Promise<void>;
  destroy(): void;
}

export interface SymbolSearchCoordinatorOptions {
  readonly dataSource: ChartDatafeed;
  readonly onEvent: (event: SymbolSearchCoordinatorEvent) => void;
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function cloneValidSymbols(symbols: readonly ChartSymbol[]): readonly Readonly<ChartSymbol>[] | undefined {
  const ids = new Set<string>();
  const cloned: Readonly<ChartSymbol>[] = [];
  for (const symbol of symbols) {
    if (
      typeof symbol.id !== "string" ||
      symbol.id.trim().length === 0 ||
      typeof symbol.code !== "string" ||
      symbol.code.trim().length === 0 ||
      typeof symbol.name !== "string" ||
      symbol.name.trim().length === 0 ||
      !(["stock", "index"] as const).includes(symbol.kind) ||
      !(["SSE", "SZSE", "BSE"] as const).includes(symbol.exchange) ||
      ids.has(symbol.id)
    ) {
      return undefined;
    }
    ids.add(symbol.id);
    cloned.push(Object.freeze({ ...symbol }));
  }
  return Object.freeze(cloned);
}

export function createSymbolSearchCoordinator(
  options: SymbolSearchCoordinatorOptions
): SymbolSearchCoordinator {
  let generation = 0;
  let activeController: AbortController | undefined;
  let destroyed = false;

  return {
    async search(query) {
      if (destroyed) return;
      generation += 1;
      const requestGeneration = generation;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      try {
        const symbols = await options.dataSource.searchSymbols(query, controller.signal);
        if (destroyed || controller.signal.aborted || requestGeneration !== generation) return;
        const cloned = cloneValidSymbols(symbols);
        if (cloned === undefined) {
          options.onEvent({
            type: "searchFailed",
            query,
            code: "SYMBOL_SEARCH_FAILED",
            error: new Error("Symbol search returned invalid results.")
          });
          return;
        }
        options.onEvent({ type: "results", query, symbols: cloned });
      } catch (error) {
        if (
          !destroyed &&
          !controller.signal.aborted &&
          requestGeneration === generation &&
          !isAbortError(error)
        ) {
          options.onEvent({ type: "searchFailed", query, code: "SYMBOL_SEARCH_FAILED", error });
        }
      } finally {
        if (activeController === controller) activeController = undefined;
      }
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      generation += 1;
      activeController?.abort();
      activeController = undefined;
    }
  };
}
