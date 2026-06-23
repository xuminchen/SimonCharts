import type { CandleSeries } from "../../model/market";
import type { SeriesRenderModel, SeriesRenderPoint } from "../seriesTypes";

export interface PointAndFigureTransformOptions {
  boxSize: number;
  reversalBoxes: number;
}

type ColumnDirection = "up" | "down";

interface PointAndFigureColumn {
  start: number;
  end: number;
  startIndex: number;
  endIndex: number;
}

export function transformPointAndFigure(
  series: CandleSeries,
  options: PointAndFigureTransformOptions
): SeriesRenderModel {
  assertPositiveNumber(options.boxSize, "boxSize");
  assertPositiveInteger(options.reversalBoxes, "reversalBoxes");

  const first = series.candles[0];
  const columns: PointAndFigureColumn[] = [];

  if (!first) {
    return { type: "pointAndFigure", source: series, points: [] };
  }

  let direction: ColumnDirection | undefined;
  let start = first.close;
  let end = first.close;
  let startIndex = 0;
  let endIndex = 0;
  const reversalAmount = options.boxSize * options.reversalBoxes;

  for (let sourceIndex = 1; sourceIndex < series.candles.length; sourceIndex += 1) {
    const close = series.candles[sourceIndex].close;

    if (!direction) {
      const boxMove = wholeBoxes(Math.abs(close - start), options.boxSize);

      if (boxMove === 0) {
        continue;
      }

      direction = close > start ? "up" : "down";
      end = start + (direction === "up" ? boxMove : -boxMove) * options.boxSize;
      endIndex = sourceIndex;
      continue;
    }

    if (direction === "up") {
      if (close >= end + options.boxSize) {
        end += wholeBoxes(close - end, options.boxSize) * options.boxSize;
        endIndex = sourceIndex;
      } else if (end - close >= reversalAmount) {
        columns.push({ start, end, startIndex, endIndex });
        const boxMove = wholeBoxes(end - close, options.boxSize);
        direction = "down";
        start = end;
        end = end - boxMove * options.boxSize;
        startIndex = endIndex;
        endIndex = sourceIndex;
      }
    } else if (close <= end - options.boxSize) {
      end -= wholeBoxes(end - close, options.boxSize) * options.boxSize;
      endIndex = sourceIndex;
    } else if (close - end >= reversalAmount) {
      columns.push({ start, end, startIndex, endIndex });
      const boxMove = wholeBoxes(close - end, options.boxSize);
      direction = "up";
      start = end;
      end = end + boxMove * options.boxSize;
      startIndex = endIndex;
      endIndex = sourceIndex;
    }
  }

  if (direction) {
    columns.push({ start, end, startIndex, endIndex });
  }

  return {
    type: "pointAndFigure",
    source: series,
    points: columns.map((column) => createColumnPoint(series, column))
  };
}

function createColumnPoint(series: CandleSeries, column: PointAndFigureColumn): SeriesRenderPoint {
  const candle = series.candles[column.endIndex];

  return {
    time: candle.time,
    open: column.start,
    high: Math.max(column.start, column.end),
    low: Math.min(column.start, column.end),
    close: column.end,
    sourceIndex: column.endIndex,
    sourceRange: { from: column.startIndex, to: column.endIndex }
  };
}

function wholeBoxes(move: number, boxSize: number): number {
  return Math.floor(move / boxSize);
}

function assertPositiveNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}
