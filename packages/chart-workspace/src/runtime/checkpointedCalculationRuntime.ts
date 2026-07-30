import {
  calculateCoreIndicatorChunk,
  transformSeriesChunk,
  type CandleSeries,
  type CoreIndicatorCheckpoint,
  type IndicatorResult,
  type IndicatorVisualOutput,
  type SeriesRenderModel,
  type SeriesRenderPoint,
  type SeriesTransformCheckpoint,
  type StatefulSeriesTransformOptions,
  type StatefulSeriesTransformType
} from "@simoncharts/chart-engine";
import type {
  CalculationCheckpoint,
  CalculationCheckpointKey,
  CalculationCheckpointStore
} from "../data/calculationCheckpointStore";
import type { PagedSeriesStore, SeriesSelection } from "../data/pagedSeriesStore";
import type {
  ChartCustomStudyId,
  ChartIndicatorId,
  ChartNumericStudyInputs
} from "../contracts";
import {
  calculateCustomStudyChunk,
  studyDefinitionKey,
  type StudyDefinitionCatalog
} from "../programmableApi";
import {
  indicatorOutputId,
  indicatorPanelId,
  type IndicatorConfig
} from "./indicatorRuntime";

export type CalculationStatus =
  | { type: "idle" }
  | { type: "calculating"; kind: "indicator" | "series"; id: string; generation: number };

export interface CheckpointedCalculationRuntime {
  calculateIndicators(input: {
    selection: SeriesSelection;
    configs: readonly IndicatorConfig[];
    targetTimes: ReadonlySet<number>;
    generation?: number;
    signal?: AbortSignal;
  }): Promise<ReadonlyMap<string, IndicatorResult>>;
  calculateSeries(input: {
    selection: SeriesSelection;
    type: StatefulSeriesTransformType;
    options: StatefulSeriesTransformOptions;
    targetTimes: ReadonlySet<number>;
    generation?: number;
    signal?: AbortSignal;
  }): Promise<SeriesRenderModel>;
}

export interface CheckpointedCalculationRuntimeOptions {
  readonly store: PagedSeriesStore;
  readonly checkpointStore: CalculationCheckpointStore;
  readonly studyDefinitions?: StudyDefinitionCatalog;
  readonly reloadPage: (requestCursor?: string) => Promise<void>;
  readonly isGenerationCurrent?: (generation: number) => boolean;
  readonly onStatusChanged?: (status: CalculationStatus) => void;
}

function selectionKey(selection: SeriesSelection): string {
  return JSON.stringify([selection.symbol.id, selection.timeframe, selection.adjustMode]);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function filterOutput(output: IndicatorVisualOutput, times: ReadonlySet<number>): IndicatorVisualOutput {
  if (output.type === "line") return { ...output, values: output.values.filter((point) => times.has(point.time)) };
  if (output.type === "histogram") return { ...output, values: output.values.filter((point) => times.has(point.time)) };
  if (output.type === "band") return { ...output, upper: output.upper.filter((point) => times.has(point.time)), lower: output.lower.filter((point) => times.has(point.time)) };
  return { ...output, marks: output.marks.filter((mark) => times.has(mark.time)) };
}

function filterResult(result: IndicatorResult, times: ReadonlySet<number>): IndicatorResult {
  return {
    outputs: result.outputs.map((output) => filterOutput(output, times)),
    ...(result.panels === undefined
      ? {}
      : {
          panels: result.panels.map((panel) => ({
            ...panel,
            outputs: panel.outputs.map((output) => filterOutput(output, times))
          }))
        })
  };
}

function appendOutput(target: IndicatorVisualOutput, incoming: IndicatorVisualOutput): void {
  if (target.type === "line" && incoming.type === "line") target.values.push(...incoming.values);
  else if (target.type === "histogram" && incoming.type === "histogram") target.values.push(...incoming.values);
  else if (target.type === "band" && incoming.type === "band") {
    target.upper.push(...incoming.upper);
    target.lower.push(...incoming.lower);
  } else if (target.type === "marker" && incoming.type === "marker") target.marks.push(...incoming.marks);
  else throw new Error(`Indicator output shape changed for ${target.id}`);
}

function appendResult(target: IndicatorResult | undefined, incoming: IndicatorResult): IndicatorResult {
  if (target === undefined) return structuredClone(incoming);
  incoming.outputs.forEach((output, index) => appendOutput(target.outputs[index], output));
  incoming.panels?.forEach((panel, panelIndex) =>
    panel.outputs.forEach((output, outputIndex) =>
      appendOutput(target.panels![panelIndex].outputs[outputIndex], output)
    )
  );
  return target;
}

const duplicateIndicatorColors = ["#f59e0b", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#0891b2"];
const maxSeriesRenderPoints = 50_000;

function lastIndexAtOrBefore(
  descriptors: readonly { readonly minTime: number }[],
  time: number
): number {
  for (let index = descriptors.length - 1; index >= 0; index -= 1) {
    if (descriptors[index]!.minTime <= time) return index;
  }
  return -1;
}

function scopeIndicatorResult(
  config: IndicatorConfig,
  result: IndicatorResult,
  duplicateIndex: number | undefined
): IndicatorResult {
  const scopeOutput = (output: IndicatorVisualOutput): IndicatorVisualOutput => ({
    ...output,
    id: indicatorOutputId(config.instanceId, output.id),
    ...(output.panelId === undefined || output.panelId === "main"
      ? {}
      : { panelId: indicatorPanelId(config.instanceId) }),
    ...(config.definitionVersion === undefined &&
      duplicateIndex !== undefined &&
      result.outputs.length === 1 &&
      output.type === "line"
      ? { color: duplicateIndicatorColors[duplicateIndex % duplicateIndicatorColors.length] }
      : {})
  });
  return {
    outputs: result.outputs.map(scopeOutput),
    ...(result.panels === undefined
      ? {}
      : {
          panels: result.panels.map((panel) => ({
            ...panel,
            id: indicatorPanelId(config.instanceId),
            outputs: panel.outputs.map(scopeOutput)
          }))
        })
  };
}

function indicatorParamsHash(config: IndicatorConfig): string {
  return canonicalJson({
    id: config.id,
    ...("definitionVersion" in config
      ? { definitionVersion: config.definitionVersion }
      : {}),
    params: config.params
  });
}

export function createCheckpointedCalculationRuntime(
  options: CheckpointedCalculationRuntimeOptions
): CheckpointedCalculationRuntime {
  const assertCurrent = (generation: number, signal?: AbortSignal): void => {
    if (signal?.aborted || options.isGenerationCurrent?.(generation) === false) {
      throw new DOMException("Calculation aborted", "AbortError");
    }
  };
  const chronologicalCursors = (): Array<string | undefined> =>
    options.store
      .listDescriptors()
      .map((descriptor) => descriptor.requestCursor)
      .reverse();

  const loadDescriptor = async (cursor?: string) => {
    let descriptor = options.store.getDescriptorForCursor(cursor);
    if (descriptor?.candles === undefined) {
      await options.reloadPage(cursor);
      descriptor = options.store.getDescriptorForCursor(cursor);
    }
    if (descriptor?.candles === undefined) {
      throw new Error("Required series page payload is unavailable after reload.");
    }
    return descriptor;
  };

  const chunkFor = (selection: SeriesSelection, dataVersion: string, candles: readonly CandleSeries["candles"][number][]): CandleSeries => ({
    symbol: selection.symbol.id,
    timeframe: selection.timeframe,
    adjustMode: selection.adjustMode,
    dataVersion,
    candles: candles.map((candle) => ({ ...candle }))
  });

  const checkpointKey = (
    selection: SeriesSelection,
    dataVersion: string,
    kind: "indicator" | "series",
    id: string,
    paramsHash: string,
    descriptorCursor?: string
  ): CalculationCheckpointKey => ({
    selectionKey: selectionKey(selection),
    dataVersion,
    kind,
    id,
    paramsHash,
    ...(descriptorCursor === undefined ? {} : { descriptorCursor })
  });

  return {
    async calculateIndicators(input) {
      const generation = input.generation ?? 0;
      assertCurrent(generation, input.signal);
      options.onStatusChanged?.({
        type: "calculating",
        kind: "indicator",
        id: input.configs[0]?.instanceId ?? "indicators",
        generation
      });
      try {
      const cursors = chronologicalCursors();
      const results = new Map<string, IndicatorResult>();
      const checkpoints = new Map<string, CalculationCheckpoint>();
      const dataVersion = options.store.getSnapshot().dataVersion ?? "";
      const metadata = options.store.listDescriptors().slice().reverse();
      const targetMin = Math.min(...input.targetTimes);
      const targetMax = Math.max(...input.targetTimes);
      const targetIndex = Math.max(
        0,
        metadata.findIndex((descriptor) => descriptor.maxTime >= targetMin)
      );
      const lastTargetIndex = lastIndexAtOrBefore(metadata, targetMax);
      let startIndex = 0;
      if (targetIndex > 0) {
        const predecessor = metadata[targetIndex - 1];
        const restored = input.configs.map((config) =>
          options.checkpointStore.get(
            checkpointKey(
              input.selection,
              dataVersion,
              "indicator",
              config.instanceId,
              indicatorParamsHash(config),
              predecessor.requestCursor
            )
          )
        );
        if (restored.every((checkpoint, index) => {
          const config = input.configs[index]!;
          return config.definitionVersion === undefined
            ? checkpoint?.kind === "coreIndicator"
            : checkpoint?.kind === "customStudy" &&
                checkpoint.id === config.id &&
                checkpoint.definitionVersion === config.definitionVersion;
        })) {
          restored.forEach((checkpoint, index) =>
            checkpoints.set(input.configs[index].instanceId, checkpoint!)
          );
          startIndex = targetIndex;
        }
      }
      for (let pageIndex = startIndex; pageIndex <= lastTargetIndex; pageIndex += 1) {
        const descriptor = await loadDescriptor(cursors[pageIndex]);
        assertCurrent(generation, input.signal);
        const candles = descriptor.candles!.filter((candle) => candle.time <= targetMax);
        const chunk = chunkFor(input.selection, dataVersion, candles);
        const completeDescriptor = candles.length === descriptor.candles!.length;
        for (const config of input.configs) {
          const currentCheckpoint = checkpoints.get(config.instanceId);
          const calculated = config.definitionVersion === undefined
            ? calculateCoreIndicatorChunk(
                config.id as ChartIndicatorId,
                chunk,
                config.params as ChartNumericStudyInputs,
                checkpoints.get(config.instanceId) as CoreIndicatorCheckpoint | undefined,
                { finalize: pageIndex === lastTargetIndex }
              )
            : calculateCustomStudyChunk({
                definition: options.studyDefinitions?.get(
                  studyDefinitionKey(config.id as ChartCustomStudyId, config.definitionVersion)
                ) ?? (() => {
                  throw new TypeError(`Chart indicator ${config.id} is unsupported`);
                })(),
                selection: input.selection,
                dataVersion,
                params: config.params,
                chunk,
                checkpoint: currentCheckpoint?.kind === "customStudy"
                  ? currentCheckpoint
                  : undefined
              });
          assertCurrent(generation, input.signal);
          checkpoints.set(config.instanceId, calculated.checkpoint);
          const filtered = filterResult(calculated.result, input.targetTimes);
          results.set(
            config.instanceId,
            appendResult(results.get(config.instanceId), filtered)
          );
          if (completeDescriptor) {
            options.checkpointStore.set(
              checkpointKey(
                input.selection,
                dataVersion,
                "indicator",
                config.instanceId,
                indicatorParamsHash(config),
                descriptor.requestCursor
              ),
              calculated.checkpoint
            );
          }
        }
      }
      assertCurrent(generation, input.signal);
      return new Map(input.configs.flatMap((config) => {
        const result = results.get(config.instanceId);
        if (result === undefined) return [];
        // ponytail: O(n²) is bounded by 32 studies; index by definition only if that cap grows.
        const siblings = input.configs.filter((candidate) =>
          candidate.id === config.id &&
          candidate.definitionVersion === config.definitionVersion
        );
        return [[
          config.instanceId,
          scopeIndicatorResult(
            config,
            result,
            siblings.length > 1
              ? siblings.findIndex((candidate) => candidate.instanceId === config.instanceId)
              : undefined
          )
        ] as const];
      }));
      } finally {
        options.onStatusChanged?.({ type: "idle" });
      }
    },

    async calculateSeries(input) {
      const generation = input.generation ?? 0;
      assertCurrent(generation, input.signal);
      options.onStatusChanged?.({
        type: "calculating",
        kind: "series",
        id: input.type,
        generation
      });
      try {
      const cursors = chronologicalCursors();
      const metadata = options.store.listDescriptors().slice().reverse();
      const dataVersion = options.store.getSnapshot().dataVersion ?? "";
      let checkpoint: SeriesTransformCheckpoint | undefined;
      const selectedPoints: SeriesRenderPoint[] = [];
      let lastLogicalPoint: SeriesRenderPoint | undefined;
      const targetCandles: CandleSeries["candles"] = [];
      let sourceIndexOffset = 0;
      let processedBefore = 0;
      const targetMin = Math.min(...input.targetTimes);
      const targetMax = Math.max(...input.targetTimes);
      const targetIndex = Math.max(
        0,
        metadata.findIndex((descriptor) => descriptor.maxTime >= targetMin)
      );
      const lastTargetIndex = lastIndexAtOrBefore(metadata, targetMax);
      let startIndex = 0;
      if (targetIndex > 0) {
        const predecessor = metadata[targetIndex - 1];
        const restored = options.checkpointStore.get(
          checkpointKey(
            input.selection,
            dataVersion,
            "series",
            input.type,
            canonicalJson(input.options),
            predecessor.requestCursor
          )
        );
        if (restored?.kind === "seriesTransform") {
          checkpoint = restored;
          processedBefore = restored.processedCount;
          startIndex = targetIndex;
        }
      }
      let foundSourceOffset = false;
      for (let pageIndex = startIndex; pageIndex <= lastTargetIndex; pageIndex += 1) {
        const descriptor = await loadDescriptor(cursors[pageIndex]);
        assertCurrent(generation, input.signal);
        const candles = descriptor.candles!.filter((candle) => candle.time <= targetMax);
        const chunk = chunkFor(input.selection, dataVersion, candles);
        const completeDescriptor = candles.length === descriptor.candles!.length;
        const transformed = transformSeriesChunk(input.type, chunk, input.options, checkpoint);
        checkpoint = transformed.checkpoint;
        if (transformed.replaceTailCount > 0 && lastLogicalPoint !== undefined) {
          if (input.targetTimes.has(lastLogicalPoint.time)) selectedPoints.pop();
          lastLogicalPoint = undefined;
        }
        for (const point of transformed.model.points) {
          lastLogicalPoint = point;
          if (input.targetTimes.has(point.time)) {
            if (selectedPoints.length >= maxSeriesRenderPoints) {
              throw new RangeError("Series render point limit exceeded");
            }
            selectedPoints.push(point);
          }
        }
        chunk.candles.forEach((candle, localIndex) => {
          if (!input.targetTimes.has(candle.time)) return;
          if (!foundSourceOffset) {
            sourceIndexOffset = processedBefore + localIndex;
            foundSourceOffset = true;
          }
          targetCandles.push(candle);
        });
        processedBefore += chunk.candles.length;
        if (completeDescriptor) {
          options.checkpointStore.set(
            checkpointKey(
              input.selection,
              dataVersion,
              "series",
              input.type,
              canonicalJson(input.options),
              descriptor.requestCursor
            ),
            checkpoint
          );
        }
      }
      assertCurrent(generation, input.signal);
      return {
        type: input.type,
        source: chunkFor(input.selection, dataVersion, targetCandles),
        sourceIndexOffset,
        points: selectedPoints
      };
      } finally {
        options.onStatusChanged?.({ type: "idle" });
      }
    }
  };
}
