import type { ChartWorkspaceDataSource, SeriesPage, SeriesRequest } from "../contracts";
import type { PagedSeriesStore, SeriesSelection } from "./pagedSeriesStore";
import { validateSeriesPage } from "./seriesPageValidation";

export type DataCoordinatorEvent =
  | { type: "loadingInitial"; selection: SeriesSelection; generation: number }
  | { type: "initialPageAccepted"; selection: SeriesSelection; generation: number }
  | { type: "historyPageAccepted"; selection: SeriesSelection; generation: number }
  | { type: "snapshotRefreshing"; selection: SeriesSelection; generation: number }
  | { type: "pageRejected"; phase: "initial" | "history"; code: string; message: string }
  | { type: "initialRequestFailed"; error: unknown }
  | { type: "historyRequestFailed"; cursor: string; error: unknown };

export interface DataCoordinator {
  start(selection: SeriesSelection): Promise<void>;
  loadMoreBefore(): Promise<void>;
  reloadPage(requestCursor?: string): Promise<void>;
  retryInitial(): Promise<void>;
  getGeneration(): number;
  destroy(): void;
}

export interface DataCoordinatorOptions {
  readonly dataSource: ChartWorkspaceDataSource;
  readonly store: PagedSeriesStore;
  readonly onEvent: (event: DataCoordinatorEvent) => void;
}

function cloneSelection(selection: SeriesSelection): SeriesSelection {
  return Object.freeze({
    symbol: Object.freeze({ ...selection.symbol }),
    timeframe: selection.timeframe,
    adjustMode: selection.adjustMode
  });
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

export function createDataCoordinator(options: DataCoordinatorOptions): DataCoordinator {
  let generation = 0;
  let selection: SeriesSelection | undefined;
  let destroyed = false;
  const activeControllers = new Set<AbortController>();
  const pendingCursors = new Set<string | undefined>();

  const abortActive = (): void => {
    for (const controller of activeControllers) controller.abort();
    activeControllers.clear();
  };

  const isCurrent = (requestGeneration: number, controller: AbortController): boolean =>
    !destroyed && requestGeneration === generation && !controller.signal.aborted;

  const buildRequest = (
    currentSelection: SeriesSelection,
    requestCursor?: string
  ): SeriesRequest => ({
    symbol: currentSelection.symbol,
    timeframe: currentSelection.timeframe,
    adjustMode: currentSelection.adjustMode,
    ...(requestCursor === undefined ? {} : { beforeCursor: requestCursor })
  });

  const validate = (page: SeriesPage, requestCursor?: string) => {
    const descriptors = options.store.listDescriptors();
    const seenCursors = new Set<string>();
    for (const descriptor of descriptors) {
      if (descriptor.requestCursor !== undefined) seenCursors.add(descriptor.requestCursor);
      if (descriptor.beforeCursor !== undefined) seenCursors.add(descriptor.beforeCursor);
    }
    const currentEarliestTime = descriptors.reduce<number | undefined>(
      (earliest, descriptor) =>
        earliest === undefined ? descriptor.minTime : Math.min(earliest, descriptor.minTime),
      undefined
    );
    return validateSeriesPage(page, {
      ...(requestCursor === undefined ? {} : { requestCursor }),
      seenCursors,
      ...(currentEarliestTime === undefined ? {} : { currentEarliestTime })
    });
  };

  const requestInitial = async (
    currentSelection: SeriesSelection,
    requestGeneration: number
  ): Promise<void> => {
    if (destroyed || pendingCursors.has(undefined)) return;
    const controller = new AbortController();
    pendingCursors.add(undefined);
    activeControllers.add(controller);
    try {
      const page = await options.dataSource.loadSeries(
        buildRequest(currentSelection),
        controller.signal
      );
      if (!isCurrent(requestGeneration, controller)) return;
      if (page.candles.length === 0) {
        options.onEvent({
          type: "pageRejected",
          phase: "initial",
          code: "NO_VALID_DATA",
          message: "Initial series page contains no candles."
        });
        return;
      }
      const result = validateSeriesPage(page, { seenCursors: new Set() });
      if (!result.ok) {
        options.onEvent({
          type: "pageRejected",
          phase: "initial",
          code: result.code,
          message: result.message
        });
        return;
      }
      if (!isCurrent(requestGeneration, controller)) return;
      options.store.reset(currentSelection, result.page.dataVersion);
      const merged = options.store.mergePage(undefined, result.page);
      if (!merged.ok) {
        options.onEvent({
          type: "pageRejected",
          phase: "initial",
          code: merged.code,
          message: merged.message
        });
        return;
      }
      options.onEvent({
        type: "initialPageAccepted",
        selection: currentSelection,
        generation: requestGeneration
      });
    } catch (error) {
      if (isCurrent(requestGeneration, controller) && !isAbortError(error)) {
        options.onEvent({ type: "initialRequestFailed", error });
      }
    } finally {
      pendingCursors.delete(undefined);
      activeControllers.delete(controller);
    }
  };

  const requestHistory = async (requestCursor: string): Promise<void> => {
    const currentSelection = selection;
    if (destroyed || currentSelection === undefined || pendingCursors.has(requestCursor)) return;
    const requestGeneration = generation;
    const controller = new AbortController();
    pendingCursors.add(requestCursor);
    activeControllers.add(controller);
    try {
      const page = await options.dataSource.loadSeries(
        buildRequest(currentSelection, requestCursor),
        controller.signal
      );
      if (!isCurrent(requestGeneration, controller)) return;
      const trustedVersion = options.store.getSnapshot().dataVersion;
      if (trustedVersion !== undefined && page.dataVersion !== trustedVersion) {
        generation += 1;
        abortActive();
        pendingCursors.clear();
        options.onEvent({
          type: "snapshotRefreshing",
          selection: currentSelection,
          generation
        });
        await requestInitial(currentSelection, generation);
        return;
      }

      const result = validate(page, requestCursor);
      if (!result.ok) {
        options.onEvent({
          type: "pageRejected",
          phase: "history",
          code: result.code,
          message: result.message
        });
        return;
      }
      if (!isCurrent(requestGeneration, controller)) return;
      const merged = options.store.mergePage(requestCursor, result.page);
      if (!merged.ok) {
        options.onEvent({
          type: "pageRejected",
          phase: "history",
          code: merged.code,
          message: merged.message
        });
        return;
      }
      options.onEvent({
        type: "historyPageAccepted",
        selection: currentSelection,
        generation: requestGeneration
      });
    } catch (error) {
      if (isCurrent(requestGeneration, controller) && !isAbortError(error)) {
        options.onEvent({ type: "historyRequestFailed", cursor: requestCursor, error });
      }
    } finally {
      pendingCursors.delete(requestCursor);
      activeControllers.delete(controller);
    }
  };

  return {
    async start(nextSelection) {
      if (destroyed) return;
      generation += 1;
      abortActive();
      pendingCursors.clear();
      selection = cloneSelection(nextSelection);
      options.onEvent({ type: "loadingInitial", selection, generation });
      await requestInitial(selection, generation);
    },

    async loadMoreBefore() {
      const cursor = options.store.getNextBeforeCursor();
      if (cursor !== undefined) await requestHistory(cursor);
    },

    async reloadPage(requestCursor) {
      if (destroyed) return;
      if (requestCursor === undefined) {
        if (selection !== undefined) await requestInitial(selection, generation);
        return;
      }
      await requestHistory(requestCursor);
    },

    async retryInitial() {
      if (!destroyed && selection !== undefined) await requestInitial(selection, generation);
    },

    getGeneration() {
      return generation;
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      generation += 1;
      abortActive();
      pendingCursors.clear();
    }
  };
}
