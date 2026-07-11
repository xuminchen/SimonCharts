import { describe, expect, it } from "vitest";
import {
  calculateCoreIndicator,
  calculateCoreIndicatorChunk,
  transformHeikinAshi,
  transformKagi,
  transformLineBreak,
  transformPointAndFigure,
  transformRenko,
  transformSeriesChunk,
  type CandleSeries,
  type CoreIndicatorCheckpoint,
  type CoreIndicatorId,
  type CoreIndicatorParams,
  type IndicatorResult,
  type IndicatorVisualOutput,
  type SeriesRenderModel,
  type SeriesTransformCheckpoint,
  type StatefulSeriesTransformOptions,
  type StatefulSeriesTransformType
} from "../index";
import { baseCalculationGolden } from "./fixtures/calculationGolden";

const partitionSizes = [1, 2, 3, 3] as const;

function createSeries(): CandleSeries {
  return structuredClone(baseCalculationGolden.series) as CandleSeries;
}

function partitionSeries(series: CandleSeries): CandleSeries[] {
  let cursor = 0;

  return partitionSizes.map((size) => {
    const chunk = {
      ...series,
      candles: series.candles.slice(cursor, cursor + size).map((candle) => ({ ...candle }))
    };

    cursor += size;
    return chunk;
  });
}

function appendOutput(target: IndicatorVisualOutput, incoming: IndicatorVisualOutput): void {
  if (target.type === "line" && incoming.type === "line") {
    target.values.push(...incoming.values);
  } else if (target.type === "histogram" && incoming.type === "histogram") {
    target.values.push(...incoming.values);
  } else if (target.type === "band" && incoming.type === "band") {
    target.upper.push(...incoming.upper);
    target.lower.push(...incoming.lower);
  } else if (target.type === "marker" && incoming.type === "marker") {
    target.marks.push(...incoming.marks);
  } else {
    throw new Error(`Indicator output shape changed for ${target.id}`);
  }
}

function mergeIndicatorResults(results: IndicatorResult[]): IndicatorResult {
  const merged = structuredClone(results[0]);

  for (const result of results.slice(1)) {
    result.outputs.forEach((output, index) => appendOutput(merged.outputs[index], output));
  }

  return merged;
}

function calculateIndicatorChunks(
  id: CoreIndicatorId,
  params: CoreIndicatorParams
): IndicatorResult {
  const chunks = partitionSeries(createSeries());
  const results: IndicatorResult[] = [];
  let checkpoint: CoreIndicatorCheckpoint | undefined;

  chunks.forEach((chunk, index) => {
    const calculation = calculateCoreIndicatorChunk(
      id,
      chunk,
      params,
      checkpoint,
      { finalize: index === chunks.length - 1 }
    );

    results.push(calculation.result);
    checkpoint = JSON.parse(JSON.stringify(calculation.checkpoint)) as CoreIndicatorCheckpoint;
  });

  return mergeIndicatorResults(results);
}

function calculateFullTransform(
  type: StatefulSeriesTransformType,
  options: StatefulSeriesTransformOptions
): SeriesRenderModel {
  const series = createSeries();

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

function calculateTransformChunks(
  type: StatefulSeriesTransformType,
  options: StatefulSeriesTransformOptions
): Pick<SeriesRenderModel, "sourceIndexOffset" | "points"> {
  const chunks = partitionSeries(createSeries());
  const points: SeriesRenderModel["points"] = [];
  let checkpoint: SeriesTransformCheckpoint | undefined;

  for (const chunk of chunks) {
    const transformed = transformSeriesChunk(type, chunk, options, checkpoint);

    points.splice(
      points.length - transformed.replaceTailCount,
      transformed.replaceTailCount,
      ...transformed.model.points
    );
    checkpoint = JSON.parse(JSON.stringify(transformed.checkpoint)) as SeriesTransformCheckpoint;
  }

  return { sourceIndexOffset: 0, points };
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

describe("BASE calculation golden", () => {
  it("is a deeply frozen static characterization fixture", () => {
    expectDeepFrozen(baseCalculationGolden);
  });

  it.each(baseCalculationGolden.indicators)(
    "keeps the full-series $id visual result equal to BASE",
    ({ id, params, expected }) => {
      expect(calculateCoreIndicator(id, createSeries(), params)).toEqual(expected);
    }
  );

  it.each(baseCalculationGolden.indicators)(
    "keeps the checkpointed $id visual result equal to BASE",
    ({ id, params, expected }) => {
      expect(
        calculateIndicatorChunks(id as CoreIndicatorId, params as CoreIndicatorParams)
      ).toEqual(expected);
    }
  );

  it.each(baseCalculationGolden.transforms)(
    "keeps the full-series $type points equal to BASE",
    ({ type, options, sourceIndexOffset, expected }) => {
      const model = calculateFullTransform(
        type as StatefulSeriesTransformType,
        options as StatefulSeriesTransformOptions
      );

      expect({ sourceIndexOffset: model.sourceIndexOffset, points: model.points }).toEqual({
        sourceIndexOffset,
        points: expected
      });
    }
  );

  it.each(baseCalculationGolden.transforms)(
    "keeps the checkpointed $type points equal to BASE",
    ({ type, options, sourceIndexOffset, expected }) => {
      expect(
        calculateTransformChunks(
          type as StatefulSeriesTransformType,
          options as StatefulSeriesTransformOptions
        )
      ).toEqual({ sourceIndexOffset, points: expected });
    }
  );
});
