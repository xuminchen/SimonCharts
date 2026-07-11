import { describe, expect, it } from "vitest";
import {
  hitTestSeriesPoint,
  transformHeikinAshi,
  transformKagi,
  transformLineBreak,
  transformPointAndFigure,
  transformRenko,
  transformSeriesChunk,
  type CandleSeries,
  type SeriesRenderModel,
  type SeriesTransformCheckpoint,
  type StatefulSeriesTransformOptions,
  type StatefulSeriesTransformType
} from "../index";

const partitionSizes = [1, 7, 113, 509, 1370] as const;
const transformCases: ReadonlyArray<
  readonly [StatefulSeriesTransformType, StatefulSeriesTransformOptions]
> = [
  ["heikinAshi", {}],
  ["renko", { brickSize: 1.25 }],
  ["lineBreak", { lineCount: 3 }],
  ["kagi", { reversalAmount: 1.5 }],
  ["pointAndFigure", { boxSize: 1, reversalBoxes: 3 }]
];

function createLongSeries(count = 2_000): CandleSeries {
  let previousClose = 100;
  const candles = Array.from({ length: count }, (_unused, index) => {
    const close =
      100 +
      index * 0.018 +
      Math.sin(index * 0.19) * 6 +
      Math.cos(index * 0.043) * 2.5 +
      ((index % 31) - 15) * 0.04;
    const open = previousClose + Math.cos(index * 0.13) * 0.35;
    const high = Math.max(open, close) + 0.8;
    const low = Math.min(open, close) - 0.7;
    const volume = 2_000 + (index % 41) * 11;

    previousClose = close;

    return {
      time: 1_710_000_000 + index * 60,
      open,
      high,
      low,
      close,
      volume,
      turnover: volume * ((open + close) / 2)
    };
  });

  return {
    symbol: "SYNTHETIC-CHECKPOINT",
    timeframe: "1m",
    adjustMode: "none",
    dataVersion: "synthetic-v1",
    candles
  };
}

function createCloseSeries(closes: number[]): CandleSeries {
  return {
    symbol: "P&F",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "p-and-f-v1",
    candles: closes.map((close, index) => ({
      time: index + 1,
      open: close,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 100 + index,
      turnover: close * (100 + index)
    }))
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

function calculateFullModel(
  type: StatefulSeriesTransformType,
  series: CandleSeries,
  options: StatefulSeriesTransformOptions
): SeriesRenderModel {
  if (type === "heikinAshi") return transformHeikinAshi(series);
  if (type === "renko") return transformRenko(series, { brickSize: options.brickSize as number });
  if (type === "lineBreak") return transformLineBreak(series, { lineCount: options.lineCount as number });
  if (type === "kagi") {
    return transformKagi(series, { reversalAmount: options.reversalAmount as number });
  }

  return transformPointAndFigure(series, {
    boxSize: options.boxSize as number,
    reversalBoxes: options.reversalBoxes as number
  });
}

function mergeSeriesChunks(
  series: CandleSeries,
  type: StatefulSeriesTransformType,
  chunks: Array<{ model: SeriesRenderModel; replaceTailCount: number }>
): SeriesRenderModel {
  const points: SeriesRenderModel["points"] = [];

  for (const chunk of chunks) {
    expect(chunk.replaceTailCount).toBeLessThanOrEqual(points.length);
    points.splice(points.length - chunk.replaceTailCount, chunk.replaceTailCount, ...chunk.model.points);
  }

  return { type, source: series, sourceIndexOffset: 0, points };
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

describe("stateful series transform chunks", () => {
  it.each(transformCases)("matches the full-series %s model across exact partitions", (type, options) => {
    const series = createLongSeries();
    const full = calculateFullModel(type, series, options);
    const results: Array<{ model: SeriesRenderModel; replaceTailCount: number }> = [];
    let checkpoint: SeriesTransformCheckpoint | undefined;
    let processed = 0;

    for (const chunk of partitionSeries(series)) {
      const chunkBefore = structuredClone(chunk);
      const checkpointBefore = checkpoint ? JSON.stringify(checkpoint) : undefined;
      const transformed = transformSeriesChunk(type, chunk, options, checkpoint);

      expect(chunk).toEqual(chunkBefore);
      expect(transformed.model.source).toBe(chunk);
      expect(transformed.model.sourceIndexOffset).toBe(processed);
      if (checkpointBefore !== undefined) {
        expect(JSON.stringify(checkpoint)).toBe(checkpointBefore);
      }

      const jsonCheckpoint = JSON.stringify(transformed.checkpoint);

      expect(JSON.parse(jsonCheckpoint)).toEqual(transformed.checkpoint);
      results.push(transformed);
      checkpoint = JSON.parse(jsonCheckpoint) as SeriesTransformCheckpoint;
      processed += chunk.candles.length;
    }

    expect(checkpoint?.processedCount).toBe(series.candles.length);
    expect(full.sourceIndexOffset).toBe(0);
    expect(mergeSeriesChunks(series, type, results).points).toEqual(full.points);
  });

  it.each(transformCases.filter(([type]) => type !== "pointAndFigure"))(
    "keeps %s output append-only",
    (type, options) => {
      const series = createLongSeries();
      let checkpoint: SeriesTransformCheckpoint | undefined;

      for (const chunk of partitionSeries(series)) {
        const transformed = transformSeriesChunk(type, chunk, options, checkpoint);

        expect(transformed.replaceTailCount).toBe(0);
        checkpoint = transformed.checkpoint;
      }
    }
  );

  it("replaces the provisional Point & Figure tail on extension and reversal", () => {
    const series = createCloseSeries([10, 11, 12, 13, 14, 11]);
    const options = { boxSize: 1, reversalBoxes: 3 };
    const initial = transformSeriesChunk("pointAndFigure", sliceSeries(series, 0, 3), options);
    const extension = transformSeriesChunk(
      "pointAndFigure",
      sliceSeries(series, 3, 5),
      options,
      initial.checkpoint
    );
    const reversal = transformSeriesChunk(
      "pointAndFigure",
      sliceSeries(series, 5, 6),
      options,
      extension.checkpoint
    );

    expect(initial.replaceTailCount).toBe(0);
    expect(initial.model.points).toHaveLength(1);
    expect(extension.replaceTailCount).toBe(1);
    expect(extension.model.points).toMatchObject([
      { open: 10, close: 14, sourceIndex: 4, sourceRange: { from: 0, to: 4 } }
    ]);
    expect(reversal.replaceTailCount).toBe(1);
    expect(reversal.model.points).toMatchObject([
      { open: 10, close: 14, sourceIndex: 4, sourceRange: { from: 0, to: 4 } },
      { open: 14, close: 11, sourceIndex: 5, sourceRange: { from: 4, to: 5 } }
    ]);
    expect(
      mergeSeriesChunks(series, "pointAndFigure", [initial, extension, reversal]).points
    ).toEqual(transformPointAndFigure(series, options).points);
  });

  it.each([
    ["kind", "renko"],
    ["series type", "kagi"],
    ["normalized options", "renko"],
    ["symbol", "renko"],
    ["timeframe", "renko"],
    ["adjustment", "renko"],
    ["data version", "renko"]
  ] as const)("rejects a mismatched checkpoint %s before transformation", (field, nextType) => {
    const series = createLongSeries(20);
    const firstChunk = sliceSeries(series, 0, 10);
    const nextChunk = sliceSeries(series, 10, 20);
    const initial = transformSeriesChunk("renko", firstChunk, { brickSize: 1 });
    let checkpoint = initial.checkpoint;

    if (field === "kind") {
      checkpoint = {
        ...structuredClone(checkpoint),
        kind: "coreIndicator"
      } as unknown as SeriesTransformCheckpoint;
    } else if (field === "symbol") {
      nextChunk.symbol = "OTHER";
    } else if (field === "timeframe") {
      nextChunk.timeframe = "5m";
    } else if (field === "adjustment") {
      nextChunk.adjustMode = "backward";
    } else if (field === "data version") {
      nextChunk.dataVersion = "synthetic-v2";
    }

    const checkpointBefore = JSON.stringify(checkpoint);
    const chunkBefore = structuredClone(nextChunk);
    const options =
      field === "normalized options"
        ? { brickSize: 2 }
        : nextType === "kagi"
          ? { reversalAmount: 1 }
          : { brickSize: 1 };

    expect(() =>
      transformSeriesChunk(nextType as StatefulSeriesTransformType, nextChunk, options, checkpoint)
    ).toThrow(/checkpoint/i);
    expect(JSON.stringify(checkpoint)).toBe(checkpointBefore);
    expect(nextChunk).toEqual(chunkBefore);
  });

  it.each(transformCases)("returns a cloned, deeply frozen, JSON-safe %s checkpoint", (type, options) => {
    const source = createLongSeries(200);
    const frozenSource = deepFreeze(structuredClone(source));
    const first = transformSeriesChunk(type, frozenSource, options);
    const firstBefore = JSON.stringify(first.checkpoint);

    expectDeepFrozen(first.checkpoint);
    expect(JSON.parse(firstBefore)).toEqual(first.checkpoint);

    transformSeriesChunk(type, sliceSeries(source, 0, 10), options, first.checkpoint);

    expect(JSON.stringify(first.checkpoint)).toBe(firstBefore);
    expect(frozenSource).toEqual(source);
  });

  it.each(transformCases)("keeps the %s checkpoint bounded as processed candles grow", (type, options) => {
    const series = createLongSeries();
    const first = transformSeriesChunk(type, sliceSeries(series, 0, 1_000), options);
    const second = transformSeriesChunk(
      type,
      sliceSeries(series, 1_000, 2_000),
      options,
      first.checkpoint
    );
    const firstJson = JSON.stringify(first.checkpoint);
    const secondJson = JSON.stringify(second.checkpoint);

    expect(maxArrayLength(second.checkpoint)).toBeLessThanOrEqual(3);
    expect(firstJson.length).toBeLessThan(4_000);
    expect(secondJson.length).toBeLessThan(4_000);
    expect(Math.abs(secondJson.length - firstJson.length)).toBeLessThan(1_000);
    expect(secondJson).not.toContain('"points"');
    expect(secondJson).not.toContain('"candles"');
    expect(second.checkpoint.processedCount).toBe(2_000);
  });

  it("maps global source indexes through a bounded model source offset", () => {
    const full = createLongSeries(120);
    const source = sliceSeries(full, 100, 103);
    const model: SeriesRenderModel = {
      type: "heikinAshi",
      source,
      sourceIndexOffset: 100,
      points: source.candles.map((candle, index) => ({
        time: candle.time,
        close: candle.close,
        sourceIndex: 100 + index
      }))
    };
    const hit = hitTestSeriesPoint(model, 15, {
      plotLeft: 0,
      candleWidth: 10,
      visibleRange: { from: 0, to: 2 }
    });
    const fullSourceHit = hitTestSeriesPoint(
      { ...model, source: full, sourceIndexOffset: 0 },
      15,
      {
        plotLeft: 0,
        candleWidth: 10,
        visibleRange: { from: 0, to: 2 }
      }
    );

    expect(hit?.point.sourceIndex).toBe(101);
    expect(hit?.sourceCandle?.time).toBe(full.candles[101].time);
    expect(hit?.sourceCandle?.time).toBe(fullSourceHit?.sourceCandle?.time);
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
