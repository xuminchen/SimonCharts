import { describe, expect, it } from "vitest";
import {
  calculateCoreIndicator,
  coreIndicatorDefinitions,
  transformSeriesChunk,
  type CandleSeries,
  type CoreIndicatorCheckpoint,
  type IndicatorResult,
  type IndicatorVisualOutput,
  type SeriesTransformCheckpoint,
  type StatefulSeriesTransformType
} from "@simoncharts/chart-engine";
import { createCalculationCheckpointStore } from "../data/calculationCheckpointStore";
import { createPagedSeriesStore, type SeriesSelection } from "../data/pagedSeriesStore";
import type { ValidatedSeriesPage } from "../data/seriesPageValidation";
import { createCheckpointedCalculationRuntime } from "../runtime/checkpointedCalculationRuntime";
import {
  indicatorOutputId,
  indicatorOutputPrefix,
  indicatorPanelId
} from "../runtime/indicatorRuntime";

const selection: SeriesSelection = {
  symbol: { id: "SSE:600000", code: "600000", name: "浦发银行", exchange: "SSE", kind: "stock" },
  timeframe: "1m",
  adjustMode: "forward"
};

function createSeries(count = 240): CandleSeries {
  return {
    symbol: selection.symbol.id,
    timeframe: selection.timeframe,
    adjustMode: selection.adjustMode,
    dataVersion: "v1",
    candles: Array.from({ length: count }, (_, index) => {
      const close = 100 + index * 0.03 + Math.sin(index / 9) * 2;
      return { time: index + 1, open: close - 0.2, high: close + 0.8, low: close - 0.7, close, volume: 1_000 + index, turnover: (1_000 + index) * close };
    })
  };
}

function validatedPage(series: CandleSeries, from: number, to: number, beforeCursor?: string): ValidatedSeriesPage {
  return Object.freeze({
    candles: Object.freeze(series.candles.slice(from, to).map((item) => Object.freeze({ ...item }))),
    ...(beforeCursor === undefined ? {} : { beforeCursor }),
    hasMoreBefore: beforeCursor !== undefined,
    dataVersion: series.dataVersion
  });
}

function filterResult(result: IndicatorResult, times: ReadonlySet<number>): IndicatorResult {
  const filterOutput = (output: IndicatorVisualOutput): IndicatorVisualOutput => {
    if (output.type === "line") return { ...output, values: output.values.filter((point) => times.has(point.time)) };
    if (output.type === "histogram") return { ...output, values: output.values.filter((point) => times.has(point.time)) };
    if (output.type === "band") return { ...output, upper: output.upper.filter((point) => times.has(point.time)), lower: output.lower.filter((point) => times.has(point.time)) };
    return { ...output, marks: output.marks.filter((mark) => times.has(mark.time)) };
  };
  return {
    outputs: result.outputs.map(filterOutput),
    ...(result.panels === undefined ? {} : { panels: result.panels.map((panel) => ({ ...panel, outputs: panel.outputs.map(filterOutput) })) })
  };
}

function withoutOutputIdentity(result: IndicatorResult | undefined) {
  return result?.outputs.map(({ id: _id, panelId: _panelId, ...output }) => output);
}

describe("checkpointed calculation runtime", () => {
  it("bounds checkpoint entries and returns defensive values", () => {
    const store = createCalculationCheckpointStore({ maxEntries: 2, maxEstimatedBytes: 100_000 });
    const checkpoint = { kind: "coreIndicator", id: "MA", params: { period: 5 }, symbol: "S", timeframe: "1m", adjustMode: "forward", dataVersion: "v1", processedCount: 1, finalized: false, state: {} } satisfies CoreIndicatorCheckpoint;
    for (let index = 0; index < 3; index += 1) {
      store.set({ selectionKey: "S|1m|forward", dataVersion: "v1", kind: "indicator", id: "MA", paramsHash: "{}", descriptorCursor: `c${index}` }, checkpoint);
    }
    expect(store.getDiagnostics().entryCount).toBeLessThanOrEqual(2);
    expect(store.getDiagnostics().estimatedBytes).toBeLessThanOrEqual(100_000);
  });

  it("reloads evicted pages and matches all 16 indicators plus five stateful transforms", async () => {
    const full = createSeries();
    const store = createPagedSeriesStore({ maxPages: 2, maxEstimatedBytes: 8_000 });
    const sourcePages = new Map<string | undefined, ValidatedSeriesPage>();
    store.reset(selection, full.dataVersion);
    for (let pageIndex = 0; pageIndex < 6; pageIndex += 1) {
      const from = full.candles.length - (pageIndex + 1) * 40;
      const requestCursor = pageIndex === 0 ? undefined : `c${pageIndex}`;
      const beforeCursor = pageIndex === 5 ? undefined : `c${pageIndex + 1}`;
      const page = validatedPage(full, from, from + 40, beforeCursor);
      sourcePages.set(requestCursor, page);
      store.mergePage(requestCursor, page);
    }
    const checkpointStore = createCalculationCheckpointStore();
    let reloadCount = 0;
    const runtime = createCheckpointedCalculationRuntime({
      store,
      checkpointStore,
      reloadPage: async (cursor) => {
        reloadCount += 1;
        const source = sourcePages.get(cursor);
        if (!source) throw new Error("missing fixture page");
        const merged = store.mergePage(cursor, source);
        if (!merged.ok) throw new Error(merged.message);
      }
    });
    const targetTimes = new Set(full.candles.slice(-60).map((item) => item.time));

    const configs = coreIndicatorDefinitions.map((definition) => ({
      instanceId: definition.id,
      id: definition.id,
      params: Object.fromEntries(definition.params.map((parameter) => [parameter.id, parameter.defaultValue])),
      visible: true
    }));
    const indicators = await runtime.calculateIndicators({ selection, configs, targetTimes });
    for (const definition of coreIndicatorDefinitions) {
      expect(withoutOutputIdentity(indicators.get(definition.id))).toEqual(withoutOutputIdentity(
        filterResult(calculateCoreIndicator(definition.id, full), targetTimes)
      ));
    }
    const firstReloadCount = reloadCount;
    const repeated = await runtime.calculateIndicators({ selection, configs, targetTimes });
    expect(repeated).toEqual(indicators);
    expect(reloadCount - firstReloadCount).toBeLessThan(firstReloadCount);

    for (const type of ["heikinAshi", "renko", "lineBreak", "kagi", "pointAndFigure"] as const satisfies readonly StatefulSeriesTransformType[]) {
      const options = type === "renko" ? { brickSize: 1 } : type === "lineBreak" ? { lineCount: 3 } : type === "kagi" ? { reversalAmount: 1 } : type === "pointAndFigure" ? { boxSize: 1, reversalBoxes: 3 } : {};
      const expected = transformSeriesChunk(type, full, options).model.points.filter((point) => targetTimes.has(point.time));
      const actual = await runtime.calculateSeries({ selection, type, options, targetTimes });
      expect(actual.points).toEqual(expected);
    }
    expect(checkpointStore.getDiagnostics().entryCount).toBeLessThanOrEqual(2048);
    expect(checkpointStore.getDiagnostics().estimatedBytes).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  it("keeps same-type indicator checkpoints and outputs isolated by instance", async () => {
    const full = createSeries(80);
    const store = createPagedSeriesStore();
    store.reset(selection, full.dataVersion);
    store.mergePage(undefined, validatedPage(full, 0, full.candles.length));
    const checkpointStore = createCalculationCheckpointStore();
    const runtime = createCheckpointedCalculationRuntime({
      store,
      checkpointStore,
      reloadPage: async () => undefined
    });

    const results = await runtime.calculateIndicators({
      selection,
      configs: [
        { instanceId: "desk", id: "MA", params: { period: 5 }, visible: true },
        { instanceId: "desk:ma", id: "MA", params: { period: 20 }, visible: true },
        { instanceId: "main", id: "RSI", params: { period: 14 }, visible: true }
      ],
      targetTimes: new Set(full.candles.map((item) => item.time))
    });

    expect([...results.keys()]).toEqual(["desk", "desk:ma", "main"]);
    expect(results.get("desk")?.outputs[0]?.id).toBe(indicatorOutputId("desk", "MA"));
    expect(results.get("desk:ma")?.outputs[0]?.id).toBe(indicatorOutputId("desk:ma", "MA"));
    expect(indicatorOutputId("desk:ma", "MA").startsWith(indicatorOutputPrefix("desk"))).toBe(false);
    expect(results.get("desk")?.outputs[0]).not.toEqual(results.get("desk:ma")?.outputs[0]);
    expect(results.get("main")?.outputs[0]?.panelId).toBe(indicatorPanelId("main"));
    expect(checkpointStore.getDiagnostics().entryCount).toBe(3);
  });

  it("publishes no result for an already aborted calculation", async () => {
    const full = createSeries(40);
    const store = createPagedSeriesStore();
    const initial = validatedPage(full, 0, 40);
    store.reset(selection, full.dataVersion);
    store.mergePage(undefined, initial);
    const controller = new AbortController();
    controller.abort();
    const runtime = createCheckpointedCalculationRuntime({
      store,
      checkpointStore: createCalculationCheckpointStore(),
      reloadPage: async () => undefined
    });

    await expect(
      runtime.calculateIndicators({
        selection,
        configs: [{ instanceId: "ma-5", id: "MA", params: { period: 5 }, visible: true }],
        targetTimes: new Set(full.candles.map((item) => item.time)),
        signal: controller.signal
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it.each(["indicator", "series"] as const)(
    "writes no %s checkpoint when cancellation happens during page reload",
    async (kind) => {
      const full = createSeries(80);
      const newest = validatedPage(full, 40, 80, "older");
      const oldest = validatedPage(full, 0, 40);
      const store = createPagedSeriesStore({ maxPages: 1 });
      store.reset(selection, full.dataVersion);
      store.mergePage(undefined, newest);
      store.mergePage("older", oldest);
      store.mergePage(undefined, newest);
      const checkpointStore = createCalculationCheckpointStore();
      let notifyReload!: () => void;
      let releaseReload!: () => void;
      const reloadStarted = new Promise<void>((resolve) => { notifyReload = resolve; });
      const reloadGate = new Promise<void>((resolve) => { releaseReload = resolve; });
      const runtime = createCheckpointedCalculationRuntime({
        store,
        checkpointStore,
        reloadPage: async (cursor) => {
          notifyReload();
          await reloadGate;
          const merged = store.mergePage(cursor, oldest);
          if (!merged.ok) throw new Error(merged.message);
        }
      });
      const controller = new AbortController();
      const targetTimes = new Set(full.candles.map((item) => item.time));
      const pending = kind === "indicator"
        ? runtime.calculateIndicators({
            selection,
            configs: [{ instanceId: "ma-5", id: "MA", params: { period: 5 }, visible: true }],
            targetTimes,
            signal: controller.signal
          })
        : runtime.calculateSeries({
            selection,
            type: "renko",
            options: { brickSize: 1 },
            targetTimes,
            signal: controller.signal
          });

      await reloadStarted;
      const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
      controller.abort();
      releaseReload();
      await rejected;
      expect(checkpointStore.getDiagnostics().entryCount).toBe(0);
    }
  );
});
