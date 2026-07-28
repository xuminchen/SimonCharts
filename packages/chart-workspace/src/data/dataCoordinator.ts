import type { ChartDatafeed, SeriesPage, SeriesRequest } from "../contracts";
import type { PagedSeriesStore, SeriesSelection } from "./pagedSeriesStore";
import { validateSeriesPage } from "./seriesPageValidation";

export type DataCoordinatorEvent =
  | { type: "loadingInitial"; selection: SeriesSelection; generation: number }
  | {
      type: "initialPageAccepted";
      selection: SeriesSelection;
      generation: number;
      dataVersion: string;
    }
  | {
      type: "historyPageAccepted";
      selection: SeriesSelection;
      generation: number;
      dataVersion: string;
    }
  | { type: "snapshotRefreshing"; selection: SeriesSelection; generation: number }
  | { type: "pageRejected"; phase: "initial" | "history"; code: string; message: string }
  | { type: "initialRequestFailed"; error: unknown }
  | { type: "historyRequestFailed"; cursor?: string; error: unknown };

export interface DataCoordinator {
  cancel(): void;
  start(selection: SeriesSelection): Promise<void>;
  loadMoreBefore(): Promise<void>;
  reloadPage(requestCursor?: string): Promise<void>;
  retryInitial(): Promise<void>;
  getGeneration(): number;
  destroy(): void;
}

export interface DataCoordinatorOptions {
  readonly dataSource: ChartDatafeed;
  readonly dataCutoffTime?: number;
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
  let initialAcceptedGeneration: number | undefined;
  const activeControllers = new Set<AbortController>();
  const pendingRequests = new Map<
    string | undefined,
    { readonly generation: number; readonly controller: AbortController }
  >();
  const pendingHistoryTasks = new Map<
    string | undefined,
    { readonly generation: number; readonly promise: Promise<void> }
  >();
  const pendingReloads = new Map<string | undefined, Promise<void>>();

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
    ...(options.dataCutoffTime === undefined ? {} : { dataCutoffTime: options.dataCutoffTime }),
    ...(requestCursor === undefined ? {} : { beforeCursor: requestCursor })
  });

  const validate = (page: SeriesPage, requestCursor?: string, reload = false) => {
    const descriptors = options.store.listDescriptors();
    const reloadedDescriptor = reload
      ? descriptors.find((descriptor) => descriptor.requestCursor === requestCursor)
      : undefined;
    const seenCursors = new Set<string>();
    for (const descriptor of descriptors) {
      if (
        descriptor.requestCursor !== undefined &&
        (!reload || descriptor.requestCursor !== requestCursor) &&
        (!reload || descriptor.requestCursor !== reloadedDescriptor?.beforeCursor)
      ) seenCursors.add(descriptor.requestCursor);
      if (
        descriptor.beforeCursor !== undefined &&
        (!reload || descriptor.beforeCursor !== reloadedDescriptor?.beforeCursor)
      ) seenCursors.add(descriptor.beforeCursor);
    }
    const currentEarliestTime = descriptors.reduce<number | undefined>(
      (earliest, descriptor) =>
        earliest === undefined ? descriptor.minTime : Math.min(earliest, descriptor.minTime),
      undefined
    );
    return validateSeriesPage(page, {
      ...(requestCursor === undefined ? {} : { requestCursor }),
      seenCursors,
      ...(reload || currentEarliestTime === undefined ? {} : { currentEarliestTime }),
      ...(options.dataCutoffTime === undefined ? {} : { dataCutoffTime: options.dataCutoffTime })
    });
  };

  const requestInitial = async (
    currentSelection: SeriesSelection,
    requestGeneration: number
  ): Promise<void> => {
    if (destroyed || pendingRequests.has(undefined)) return;
    const controller = new AbortController();
    let failed = false;
    let failure: unknown;
    pendingRequests.set(undefined, { generation: requestGeneration, controller });
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
      const result = validateSeriesPage(page, {
        seenCursors: new Set(),
        ...(options.dataCutoffTime === undefined ? {} : { dataCutoffTime: options.dataCutoffTime })
      });
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
      initialAcceptedGeneration = requestGeneration;
      options.onEvent({
        type: "initialPageAccepted",
        selection: currentSelection,
        generation: requestGeneration,
        dataVersion: result.page.dataVersion
      });
    } catch (error) {
      if (isCurrent(requestGeneration, controller) && !isAbortError(error)) {
        failed = true;
        failure = error;
      }
    } finally {
      const owner = pendingRequests.get(undefined);
      if (owner?.controller === controller && owner.generation === requestGeneration) {
        pendingRequests.delete(undefined);
      }
      activeControllers.delete(controller);
    }
    if (failed) options.onEvent({ type: "initialRequestFailed", error: failure });
  };

  const requestHistory = async (requestCursor: string | undefined, reload = false): Promise<void> => {
    const currentSelection = selection;
    const existingTask = pendingHistoryTasks.get(requestCursor);
    if (existingTask?.generation === generation) {
      await existingTask.promise;
      return;
    }
    if (
      destroyed ||
      currentSelection === undefined ||
      initialAcceptedGeneration !== generation
    ) return;
    const requestGeneration = generation;
    let resolveSharedTask!: () => void;
    const sharedTask = new Promise<void>((resolve) => {
      resolveSharedTask = resolve;
    });
    pendingHistoryTasks.set(requestCursor, {
      generation: requestGeneration,
      promise: sharedTask
    });
    const controller = new AbortController();
    pendingRequests.set(requestCursor, { generation: requestGeneration, controller });
    activeControllers.add(controller);
    try {
      const page = await options.dataSource.loadSeries(
        buildRequest(currentSelection, requestCursor),
        controller.signal
      );
      if (!isCurrent(requestGeneration, controller)) return;
      const result = validate(page, requestCursor, reload);
      if (!result.ok) {
        options.onEvent({
          type: "pageRejected",
          phase: "history",
          code: result.code,
          message: result.message
        });
        return;
      }
      const trustedVersion = options.store.getSnapshot().dataVersion;
      if (trustedVersion !== undefined && page.dataVersion !== trustedVersion) {
        generation += 1;
        initialAcceptedGeneration = undefined;
        abortActive();
        pendingRequests.clear();
        pendingHistoryTasks.clear();
        pendingReloads.clear();
        options.onEvent({
          type: "snapshotRefreshing",
          selection: currentSelection,
          generation
        });
        await requestInitial(currentSelection, generation);
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
        generation: requestGeneration,
        dataVersion: result.page.dataVersion
      });
    } catch (error) {
      if (isCurrent(requestGeneration, controller) && !isAbortError(error)) {
        options.onEvent({
          type: "historyRequestFailed",
          ...(requestCursor === undefined ? {} : { cursor: requestCursor }),
          error
        });
      }
    } finally {
      const owner = pendingRequests.get(requestCursor);
      if (owner?.controller === controller && owner.generation === requestGeneration) {
        pendingRequests.delete(requestCursor);
      }
      activeControllers.delete(controller);
      const sharedOwner = pendingHistoryTasks.get(requestCursor);
      if (
        sharedOwner?.generation === requestGeneration &&
        sharedOwner.promise === sharedTask
      ) pendingHistoryTasks.delete(requestCursor);
      resolveSharedTask();
    }
  };

  return {
    cancel() {
      if (destroyed) return;
      generation += 1;
      initialAcceptedGeneration = undefined;
      abortActive();
      pendingRequests.clear();
      pendingHistoryTasks.clear();
      pendingReloads.clear();
      selection = undefined;
    },

    async start(nextSelection) {
      if (destroyed) return;
      generation += 1;
      initialAcceptedGeneration = undefined;
      abortActive();
      pendingRequests.clear();
      pendingHistoryTasks.clear();
      pendingReloads.clear();
      selection = cloneSelection(nextSelection);
      options.onEvent({ type: "loadingInitial", selection, generation });
      await requestInitial(selection, generation);
    },

    async loadMoreBefore() {
      if (initialAcceptedGeneration !== generation) return;
      const cursor = options.store.getNextBeforeCursor();
      if (cursor !== undefined) await requestHistory(cursor);
    },

    async reloadPage(requestCursor) {
      if (destroyed) return;
      const existing = pendingReloads.get(requestCursor);
      if (existing !== undefined) {
        await existing;
        return;
      }
      const task = (async () => {
        if (options.store.getDescriptorForCursor(requestCursor) !== undefined) {
          if (initialAcceptedGeneration === generation) await requestHistory(requestCursor, true);
          return;
        }
        if (requestCursor === undefined) {
          if (selection !== undefined) await requestInitial(selection, generation);
          return;
        }
        if (initialAcceptedGeneration !== generation) return;
        await requestHistory(requestCursor);
      })();
      pendingReloads.set(requestCursor, task);
      try {
        await task;
      } finally {
        if (pendingReloads.get(requestCursor) === task) pendingReloads.delete(requestCursor);
      }
    },

    async retryInitial() {
      if (destroyed || selection === undefined) return;
      options.onEvent({ type: "loadingInitial", selection, generation });
      await requestInitial(selection, generation);
    },

    getGeneration() {
      return generation;
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      generation += 1;
      initialAcceptedGeneration = undefined;
      abortActive();
      pendingRequests.clear();
      pendingHistoryTasks.clear();
      pendingReloads.clear();
    }
  };
}
