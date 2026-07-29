import type {
  AdjustMode,
  Candle,
  ChartComparison,
  ChartDatafeed,
  ChartSymbol,
  ChartVisibleRange,
  Timeframe
} from "../contracts";
import {
  normalizeDataCapabilities,
  selectSupportedAdjustMode
} from "./capabilities";
import { parseComparisons } from "./comparisons";
import { createDataCoordinator, type DataCoordinator } from "./dataCoordinator";
import {
  createPagedSeriesStore,
  type PagedSeriesStore
} from "./pagedSeriesStore";

export type ComparisonDataStatus =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "unsupported"
  | "hidden";

export interface ComparisonDataSnapshot {
  readonly comparison: Readonly<ChartComparison>;
  readonly status: ComparisonDataStatus;
  readonly candles: readonly Readonly<Candle>[];
  readonly adjustMode?: AdjustMode;
  readonly dataVersion?: string;
  readonly previousClose?: number;
}

export interface ComparisonContext {
  readonly comparisons: readonly ChartComparison[];
  readonly mainSymbol: Readonly<ChartSymbol>;
  readonly timeframe: Timeframe;
  readonly adjustMode: AdjustMode;
  readonly intraday: boolean;
}

export interface ComparisonCoordinator {
  setContext(context: ComparisonContext): Promise<boolean>;
  ensureTimeRange(range: Readonly<ChartVisibleRange>): Promise<boolean>;
  getSnapshots(): readonly ComparisonDataSnapshot[];
  destroy(): void;
}

interface Entry {
  comparison: ChartComparison;
  status: ComparisonDataStatus;
  statusBeforeHidden?: Exclude<ComparisonDataStatus, "hidden">;
  candles: readonly Candle[];
  adjustMode?: AdjustMode;
  dataVersion?: string;
  previousClose?: number;
  capabilityController?: AbortController;
  store?: PagedSeriesStore;
  coordinator?: DataCoordinator;
  loadTask?: Promise<void>;
  rangeStepTask?: Promise<void>;
}

export function createComparisonCoordinator(options: {
  readonly datafeed: ChartDatafeed;
  readonly dataCutoffTime?: number;
  readonly onChange?: (snapshots: readonly ComparisonDataSnapshot[]) => void;
}): ComparisonCoordinator {
  let generation = 0;
  let rangeGeneration = 0;
  let destroyed = false;
  let entries: Entry[] = [];
  let dataContextKey: string | undefined;

  const snapshot = (): readonly ComparisonDataSnapshot[] => Object.freeze(
    entries.map((entry) => Object.freeze({
      comparison: structuredClone(entry.comparison),
      status: entry.status,
      candles: entry.candles,
      ...(entry.adjustMode === undefined ? {} : { adjustMode: entry.adjustMode }),
      ...(entry.dataVersion === undefined ? {} : { dataVersion: entry.dataVersion }),
      ...(entry.previousClose === undefined ? {} : { previousClose: entry.previousClose })
    }))
  );
  const publish = (): void => options.onChange?.(snapshot());
  const release = (): void => {
    for (const entry of entries) {
      entry.capabilityController?.abort();
      entry.coordinator?.destroy();
      entry.store?.clear();
      entry.candles = [];
    }
  };
  const refresh = (entry: Entry): void => {
    const store = entry.store?.getSnapshot();
    entry.candles = store?.candles ?? [];
    entry.dataVersion = store?.dataVersion;
    publish();
  };

  const load = async (
    entry: Entry,
    context: ComparisonContext,
    currentGeneration: number
  ): Promise<void> => {
    const setStatus = (status: Exclude<ComparisonDataStatus, "hidden">): void => {
      if (entry.comparison.visible === false) {
        entry.statusBeforeHidden = status;
        entry.status = "hidden";
      } else {
        entry.status = status;
      }
    };
    const capabilityController = new AbortController();
    entry.capabilityController = capabilityController;
    try {
      const declared = await options.datafeed.getCapabilities(
        structuredClone(entry.comparison.symbol),
        capabilityController.signal
      );
      if (
        destroyed ||
        capabilityController.signal.aborted ||
        currentGeneration !== generation
      ) return;
      const capabilities = normalizeDataCapabilities(entry.comparison.symbol, declared);
      if (
        capabilities === undefined ||
        !capabilities.series.some((item) => item.timeframe === context.timeframe)
      ) {
        setStatus("unsupported");
        publish();
        return;
      }
      const adjustMode = selectSupportedAdjustMode(
        entry.comparison.symbol,
        capabilities,
        context.timeframe,
        context.adjustMode
      );
      entry.adjustMode = adjustMode;
      if (context.intraday) entry.previousClose = capabilities.intradayScale?.previousClose;
      const store = createPagedSeriesStore({
        maxPages: 64,
        maxEstimatedBytes: 16 * 1024 * 1024
      });
      entry.store = store;
      const coordinator = createDataCoordinator({
        dataSource: options.datafeed,
        dataCutoffTime: options.dataCutoffTime,
        store,
        onEvent(event) {
          if (destroyed || currentGeneration !== generation) return;
          let status = entry.status === "hidden"
            ? entry.statusBeforeHidden ?? "loading"
            : entry.status;
          if (event.type === "loadingInitial" || event.type === "snapshotRefreshing") {
            status = "loading";
          } else if (
            event.type === "initialPageAccepted" ||
            event.type === "historyPageAccepted"
          ) {
            status = "ready";
          } else if (event.type === "pageRejected") {
            status = event.code === "NO_VALID_DATA" ? "empty" : "error";
          } else if (
            event.type === "initialRequestFailed" ||
            event.type === "historyRequestFailed"
          ) {
            status = "error";
          }
          setStatus(status as Exclude<ComparisonDataStatus, "hidden">);
          refresh(entry);
        }
      });
      entry.coordinator = coordinator;
      await coordinator.start({
        symbol: structuredClone(entry.comparison.symbol),
        timeframe: context.timeframe,
        adjustMode
      });
      if (destroyed || currentGeneration !== generation) return;
      if (store.getSnapshot().descriptors.length === 0 && entry.status === "loading") {
        setStatus("empty");
      }
      refresh(entry);
    } catch {
      if (
        !destroyed &&
        !capabilityController.signal.aborted &&
        currentGeneration === generation
      ) {
        setStatus("error");
        refresh(entry);
      }
    } finally {
      if (entry.capabilityController === capabilityController) {
        entry.capabilityController = undefined;
      }
    }
  };
  const startLoad = (
    entry: Entry,
    context: ComparisonContext,
    currentGeneration: number
  ): Promise<void> => {
    if (entry.loadTask !== undefined) return entry.loadTask;
    const task = load(entry, context, currentGeneration);
    entry.loadTask = task;
    void task.finally(() => {
      if (entry.loadTask === task) entry.loadTask = undefined;
    });
    return task;
  };
  const runRangeStep = (
    entry: Entry,
    step: () => Promise<void>
  ): Promise<void> => {
    if (entry.rangeStepTask !== undefined) return entry.rangeStepTask;
    const task = step();
    entry.rangeStepTask = task;
    void task.finally(() => {
      if (entry.rangeStepTask === task) entry.rangeStepTask = undefined;
    });
    return task;
  };

  return {
    async setContext(context) {
      if (destroyed) return false;
      const comparisons = parseComparisons(context.comparisons, context.mainSymbol);
      rangeGeneration += 1;
      const nextDataContextKey = [
        context.timeframe,
        context.adjustMode,
        context.intraday ? "intraday" : "timeframe"
      ].join(":");
      if (
        dataContextKey === nextDataContextKey &&
        entries.length === comparisons.length &&
        entries.every((entry, index) =>
          entry.comparison.symbol.id === comparisons[index]!.symbol.id
        )
      ) {
        const pendingLoads: Promise<void>[] = [];
        entries.forEach((entry, index) => {
          const comparison = comparisons[index]!;
          const wasHidden = entry.status === "hidden";
          entry.comparison = structuredClone(comparison);
          if (comparison.visible === false) {
            if (entry.status !== "hidden") {
              entry.statusBeforeHidden = entry.status;
              entry.status = "hidden";
            }
          } else if (wasHidden) {
            entry.status = entry.statusBeforeHidden ?? "loading";
            entry.statusBeforeHidden = undefined;
          }
          if (comparison.visible !== false && entry.status === "error") {
            entry.capabilityController?.abort();
            entry.coordinator?.destroy();
            entry.store?.clear();
            entry.capabilityController = undefined;
            entry.coordinator = undefined;
            entry.store = undefined;
            entry.candles = [];
            entry.dataVersion = undefined;
            entry.previousClose = undefined;
            entry.status = "loading";
          }
          if (comparison.visible !== false && entry.status === "loading") {
            pendingLoads.push(startLoad(entry, context, generation));
          }
        });
        publish();
        await Promise.all(pendingLoads);
        return entries.every((entry) =>
          entry.status === "ready" || entry.status === "hidden"
        );
      }
      generation += 1;
      const currentGeneration = generation;
      release();
      dataContextKey = nextDataContextKey;
      entries = comparisons.map((comparison) => ({
        comparison: structuredClone(comparison),
        status: comparison.visible === false ? "hidden" : "loading",
        candles: []
      }));
      publish();
      await Promise.all(entries.map((entry) =>
        entry.status === "hidden"
          ? Promise.resolve()
          : startLoad(entry, context, currentGeneration)
      ));
      return (
        !destroyed &&
        currentGeneration === generation &&
        entries.every((entry) => entry.status === "ready" || entry.status === "hidden")
      );
    },

    async ensureTimeRange(range) {
      if (
        !Number.isFinite(range.from) ||
        !Number.isFinite(range.to) ||
        range.from > range.to
      ) {
        throw new TypeError("Comparison visible range must contain finite ordered timestamps");
      }
      if (destroyed) return false;
      const currentGeneration = generation;
      const currentRangeGeneration = ++rangeGeneration;
      for (const entry of entries) {
        const seen = new Set<string>();
        while (entry.status === "ready" && entry.store && entry.coordinator) {
          if (entry.rangeStepTask !== undefined) {
            await entry.rangeStepTask;
            if (
              destroyed ||
              currentGeneration !== generation ||
              currentRangeGeneration !== rangeGeneration
            ) return false;
            continue;
          }
          const snapshot = entry.store.getSnapshot();
          const descriptors = entry.store.listDescriptors();
          const stateKey = JSON.stringify([
            snapshot.dataVersion,
            entry.store.getNextBeforeCursor() ?? null,
            descriptors.map((descriptor) => [
              descriptor.requestCursor ?? null,
              descriptor.candles !== undefined
            ])
          ]);
          if (seen.has(stateKey)) break;
          seen.add(stateKey);
          if (
            (snapshot.candles[0]?.time ?? Number.POSITIVE_INFINITY) > range.from &&
            entry.store.getNextBeforeCursor() !== undefined
          ) {
            await runRangeStep(entry, () => entry.coordinator!.loadMoreBefore());
            if (
              destroyed ||
              currentGeneration !== generation ||
              currentRangeGeneration !== rangeGeneration
            ) return false;
            continue;
          }
          const missing = descriptors.find((descriptor) =>
            descriptor.candles === undefined &&
            descriptor.maxTime >= range.from &&
            descriptor.minTime <= range.to
          );
          if (missing === undefined) break;
          await runRangeStep(
            entry,
            () => entry.coordinator!.reloadPage(missing.requestCursor)
          );
          if (
            destroyed ||
            currentGeneration !== generation ||
            currentRangeGeneration !== rangeGeneration
          ) return false;
        }
        if (currentRangeGeneration !== rangeGeneration) return false;
        refresh(entry);
      }
      return currentRangeGeneration === rangeGeneration && entries.every((entry) =>
        entry.status === "hidden" ||
        (
          entry.status === "ready" &&
          (
            entry.store?.getNextBeforeCursor() === undefined ||
            (entry.store?.getSnapshot().candles[0]?.time ?? Number.POSITIVE_INFINITY) <= range.from
          ) &&
          !entry.store?.listDescriptors().some((descriptor) =>
              descriptor.candles === undefined &&
              descriptor.maxTime >= range.from &&
              descriptor.minTime <= range.to
            )
        )
      );
    },

    getSnapshots() {
      return snapshot();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      generation += 1;
      rangeGeneration += 1;
      release();
      entries = [];
    }
  };
}
