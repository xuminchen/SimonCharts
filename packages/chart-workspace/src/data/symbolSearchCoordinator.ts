import type { ChartDatafeed, ChartSymbol } from "../contracts";
import { parseChartSymbol } from "./chartSymbol";

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
    const parsed = parseChartSymbol(symbol);
    if (parsed === undefined || ids.has(parsed.id)) return undefined;
    ids.add(parsed.id);
    cloned.push(Object.freeze(parsed));
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
      activeController = undefined;
      if (query.trim().length === 0) return;
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
