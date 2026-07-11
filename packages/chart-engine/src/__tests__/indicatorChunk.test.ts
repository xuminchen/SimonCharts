import { describe, expect, it } from "vitest";
import {
  calculateCoreIndicator,
  calculateCoreIndicatorChunk,
  coreIndicatorIds,
  type CandleSeries,
  type CoreIndicatorCheckpoint,
  type CoreIndicatorId,
  type IndicatorResult,
  type IndicatorVisualOutput
} from "../index";

const partitionSizes = [1, 7, 113, 509, 1370] as const;

function createLongSeries(count = 2_000): CandleSeries {
  let previousClose = 100;
  const candles = Array.from({ length: count }, (_unused, index) => {
    const close =
      100 +
      index * 0.025 +
      Math.sin(index * 0.17) * 4 +
      Math.cos(index * 0.037) * 2 +
      ((index % 29) - 14) * 0.03;
    const open = previousClose + Math.sin(index * 0.11) * 0.4;
    const high = Math.max(open, close) + 0.7 + (index % 5) * 0.08;
    const low = Math.min(open, close) - 0.65 - (index % 7) * 0.06;
    const volume = 1_000 + (index % 37) * 17 + (index % 2) * 0.25;

    previousClose = close;

    return {
      time: 1_700_000_000 + index * 60,
      open,
      high,
      low,
      close,
      volume,
      turnover: volume * ((open + close) / 2)
    };
  });

  return {
    symbol: "CHECKPOINT",
    timeframe: "1m",
    adjustMode: "forward",
    dataVersion: "fixture-v1",
    candles
  };
}

function sliceSeries(series: CandleSeries, from: number, to: number): CandleSeries {
  return {
    ...series,
    candles: series.candles.slice(from, to).map((candle) => ({ ...candle }))
  };
}

function partitionSeries(series: CandleSeries): CandleSeries[] {
  let cursor = 0;
  const chunks = partitionSizes.map((size) => {
    const chunk = sliceSeries(series, cursor, cursor + size);

    cursor += size;
    return chunk;
  });

  expect(cursor).toBe(series.candles.length);
  return chunks;
}

function appendOutput(target: IndicatorVisualOutput, incoming: IndicatorVisualOutput): void {
  expect(incoming.type).toBe(target.type);
  expect(incoming.id).toBe(target.id);

  if (target.type === "line" && incoming.type === "line") {
    target.values.push(...incoming.values);
    return;
  }

  if (target.type === "histogram" && incoming.type === "histogram") {
    target.values.push(...incoming.values);
    return;
  }

  if (target.type === "band" && incoming.type === "band") {
    target.upper.push(...incoming.upper);
    target.lower.push(...incoming.lower);
    return;
  }

  if (target.type === "marker" && incoming.type === "marker") {
    target.marks.push(...incoming.marks);
    return;
  }

  throw new Error(`Indicator output shape changed for ${target.id}`);
}

function mergeIndicatorChunks(chunks: IndicatorResult[]): IndicatorResult {
  const [first, ...rest] = chunks;

  if (!first) {
    return { outputs: [] };
  }

  const merged = structuredClone(first);

  for (const chunk of rest) {
    expect(chunk.outputs).toHaveLength(merged.outputs.length);
    chunk.outputs.forEach((output, index) => appendOutput(merged.outputs[index], output));
  }

  return merged;
}

function expectDeepFrozen(value: unknown, seen = new Set<unknown>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }

  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);

  for (const child of Object.values(value)) {
    expectDeepFrozen(child, seen);
  }
}

function maxArrayLength(value: unknown): number {
  if (Array.isArray(value)) {
    return Math.max(value.length, ...value.map(maxArrayLength));
  }

  if (value !== null && typeof value === "object") {
    return Math.max(0, ...Object.values(value).map(maxArrayLength));
  }

  return 0;
}

describe("core indicator chunks", () => {
  it.each(coreIndicatorIds)("matches the full-series %s result across exact partitions", (id) => {
    const series = createLongSeries();
    const full = calculateCoreIndicator(id, series);
    const results: IndicatorResult[] = [];
    let checkpoint: CoreIndicatorCheckpoint | undefined;

    for (const chunk of partitionSeries(series)) {
      const chunkBefore = structuredClone(chunk);
      const checkpointBefore = checkpoint ? JSON.stringify(checkpoint) : undefined;
      const calculation = calculateCoreIndicatorChunk(id, chunk, undefined, checkpoint);

      expect(chunk).toEqual(chunkBefore);
      if (checkpointBefore !== undefined) {
        expect(JSON.stringify(checkpoint)).toBe(checkpointBefore);
      }

      const jsonCheckpoint = JSON.stringify(calculation.checkpoint);

      expect(JSON.parse(jsonCheckpoint)).toEqual(calculation.checkpoint);
      results.push(calculation.result);
      checkpoint = JSON.parse(jsonCheckpoint) as CoreIndicatorCheckpoint;
    }

    expect(checkpoint?.processedCount).toBe(series.candles.length);
    expect(mergeIndicatorChunks(results)).toEqual(full);
  });

  it("normalizes default parameters before checkpoint comparison", () => {
    const series = createLongSeries(20);
    const first = calculateCoreIndicatorChunk("MA", sliceSeries(series, 0, 10), {});

    expect(() =>
      calculateCoreIndicatorChunk("MA", sliceSeries(series, 10, 20), { period: 5 }, first.checkpoint)
    ).not.toThrow();
  });

  it.each([
    ["kind", "MA"],
    ["indicator id", "EMA"],
    ["normalized params", "MA"],
    ["symbol", "MA"],
    ["timeframe", "MA"],
    ["adjustment", "MA"],
    ["data version", "MA"]
  ] as const)("rejects a mismatched checkpoint %s before calculation", (field, nextId) => {
    const series = createLongSeries(20);
    const firstChunk = sliceSeries(series, 0, 10);
    const nextChunk = sliceSeries(series, 10, 20);
    const initial = calculateCoreIndicatorChunk("MA", firstChunk, { period: 5 });
    let checkpoint = initial.checkpoint;

    if (field === "kind") {
      checkpoint = {
        ...structuredClone(checkpoint),
        kind: "seriesTransform"
      } as unknown as CoreIndicatorCheckpoint;
    } else if (field === "symbol") {
      nextChunk.symbol = "OTHER";
    } else if (field === "timeframe") {
      nextChunk.timeframe = "5m";
    } else if (field === "adjustment") {
      nextChunk.adjustMode = "backward";
    } else if (field === "data version") {
      nextChunk.dataVersion = "fixture-v2";
    }

    const checkpointBefore = JSON.stringify(checkpoint);
    const chunkBefore = structuredClone(nextChunk);
    const params = field === "normalized params" ? { period: 6 } : undefined;

    expect(() =>
      calculateCoreIndicatorChunk(nextId as CoreIndicatorId, nextChunk, params, checkpoint)
    ).toThrow(/checkpoint/i);
    expect(JSON.stringify(checkpoint)).toBe(checkpointBefore);
    expect(nextChunk).toEqual(chunkBefore);
  });

  it.each(coreIndicatorIds)("returns a cloned, deeply frozen, JSON-safe %s checkpoint", (id) => {
    const source = createLongSeries(200);
    const frozenSource = deepFreeze(structuredClone(source));
    const first = calculateCoreIndicatorChunk(id, frozenSource);
    const firstBefore = JSON.stringify(first.checkpoint);

    expectDeepFrozen(first.checkpoint);
    expect(JSON.parse(firstBefore)).toEqual(first.checkpoint);

    calculateCoreIndicatorChunk(id, sliceSeries(source, 0, 10), undefined, first.checkpoint);

    expect(JSON.stringify(first.checkpoint)).toBe(firstBefore);
    expect(frozenSource).toEqual(source);
  });

  it.each(coreIndicatorIds)("keeps the %s checkpoint bounded as processed candles grow", (id) => {
    const series = createLongSeries();
    const first = calculateCoreIndicatorChunk(id, sliceSeries(series, 0, 1_000));
    const second = calculateCoreIndicatorChunk(
      id,
      sliceSeries(series, 1_000, 2_000),
      undefined,
      first.checkpoint
    );
    const firstJson = JSON.stringify(first.checkpoint);
    const secondJson = JSON.stringify(second.checkpoint);

    expect(maxArrayLength(second.checkpoint)).toBeLessThanOrEqual(30);
    expect(firstJson.length).toBeLessThan(10_000);
    expect(secondJson.length).toBeLessThan(10_000);
    expect(Math.abs(secondJson.length - firstJson.length)).toBeLessThan(2_000);
    expect(secondJson).not.toContain('"outputs"');
    expect(second.checkpoint.processedCount).toBe(2_000);
  });
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }

  return value;
}
