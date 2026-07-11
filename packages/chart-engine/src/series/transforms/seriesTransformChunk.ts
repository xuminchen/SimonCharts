import type { AdjustMode, CandleSeries, Timeframe } from "../../model/market";
import type { SeriesRenderModel, SeriesRenderPoint } from "../seriesTypes";

export type StatefulSeriesTransformType =
  | "heikinAshi"
  | "renko"
  | "lineBreak"
  | "kagi"
  | "pointAndFigure";

export interface StatefulSeriesTransformOptions {
  brickSize?: number;
  lineCount?: number;
  reversalAmount?: number;
  boxSize?: number;
  reversalBoxes?: number;
}

export interface SeriesTransformCheckpoint {
  readonly kind: "seriesTransform";
  readonly type: StatefulSeriesTransformType;
  readonly options: Readonly<Record<string, number>>;
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly adjustMode: AdjustMode;
  readonly dataVersion: string;
  readonly processedCount: number;
  readonly state: unknown;
}

export interface SeriesTransformChunkResult {
  model: SeriesRenderModel;
  checkpoint: SeriesTransformCheckpoint;
  replaceTailCount: number;
}

interface HeikinAshiState {
  initialized: boolean;
  previousOpen: number;
  previousClose: number;
}

interface RenkoState {
  initialized: boolean;
  lastBrickClose: number;
  rangeStart: number;
}

interface LineBreakState {
  initialized: boolean;
  recentCloses: number[];
}

type KagiDirection = "up" | "down";

interface KagiState {
  initialized: boolean;
  direction: KagiDirection | null;
  extreme: number;
  lastPointClose: number;
}

type PointAndFigureDirection = "up" | "down";

interface PointAndFigureColumnState {
  start: number;
  end: number;
  startIndex: number;
  endIndex: number;
  endTime: number;
}

interface PointAndFigureState extends PointAndFigureColumnState {
  initialized: boolean;
  direction: PointAndFigureDirection | null;
}

type SeriesTransformState =
  | HeikinAshiState
  | RenkoState
  | LineBreakState
  | KagiState
  | PointAndFigureState;

interface TransformDelta {
  points: SeriesRenderPoint[];
  replaceTailCount: number;
}

export function transformSeriesChunk(
  type: StatefulSeriesTransformType,
  chunk: CandleSeries,
  options: StatefulSeriesTransformOptions,
  checkpoint?: SeriesTransformCheckpoint
): SeriesTransformChunkResult {
  const normalizedOptions = normalizeOptions(type, options);

  if (checkpoint) {
    validateCheckpoint(checkpoint, type, normalizedOptions, chunk);
  }

  const processedCount = checkpoint?.processedCount ?? 0;
  const state = checkpoint
    ? cloneJson(checkpoint.state as SeriesTransformState)
    : createInitialState(type);
  const delta = transformChunk(type, chunk, normalizedOptions, processedCount, state);
  const nextCheckpoint = deepFreeze({
    kind: "seriesTransform" as const,
    type,
    options: cloneJson(normalizedOptions),
    symbol: chunk.symbol,
    timeframe: chunk.timeframe,
    adjustMode: chunk.adjustMode,
    dataVersion: chunk.dataVersion,
    processedCount: processedCount + chunk.candles.length,
    state: cloneJson(state)
  });

  return {
    model: {
      type,
      source: chunk,
      sourceIndexOffset: processedCount,
      points: delta.points
    },
    checkpoint: nextCheckpoint,
    replaceTailCount: delta.replaceTailCount
  };
}

function transformChunk(
  type: StatefulSeriesTransformType,
  chunk: CandleSeries,
  options: Record<string, number>,
  processedCount: number,
  state: SeriesTransformState
): TransformDelta {
  switch (type) {
    case "heikinAshi":
      return transformHeikinAshiChunk(chunk, processedCount, state as HeikinAshiState);
    case "renko":
      return transformRenkoChunk(chunk, options.brickSize, processedCount, state as RenkoState);
    case "lineBreak":
      return transformLineBreakChunk(
        chunk,
        options.lineCount,
        processedCount,
        state as LineBreakState
      );
    case "kagi":
      return transformKagiChunk(
        chunk,
        options.reversalAmount,
        processedCount,
        state as KagiState
      );
    case "pointAndFigure":
      return transformPointAndFigureChunk(
        chunk,
        options.boxSize,
        options.reversalBoxes,
        processedCount,
        state as PointAndFigureState
      );
  }
}

function transformHeikinAshiChunk(
  chunk: CandleSeries,
  processedCount: number,
  state: HeikinAshiState
): TransformDelta {
  const points = chunk.candles.map((candle, localIndex) => {
    const close = (candle.open + candle.high + candle.low + candle.close) / 4;
    const open = state.initialized
      ? (state.previousOpen + state.previousClose) / 2
      : (candle.open + candle.close) / 2;
    const point: SeriesRenderPoint = {
      time: candle.time,
      open,
      high: Math.max(candle.high, open, close),
      low: Math.min(candle.low, open, close),
      close,
      volume: candle.volume,
      turnover: candle.turnover,
      sourceIndex: processedCount + localIndex
    };

    state.previousOpen = open;
    state.previousClose = close;
    state.initialized = true;

    return point;
  });

  return { points, replaceTailCount: 0 };
}

function transformRenkoChunk(
  chunk: CandleSeries,
  brickSize: number,
  processedCount: number,
  state: RenkoState
): TransformDelta {
  const points: SeriesRenderPoint[] = [];

  chunk.candles.forEach((candle, localIndex) => {
    const sourceIndex = processedCount + localIndex;

    if (!state.initialized) {
      state.initialized = true;
      state.lastBrickClose = candle.close;
      state.rangeStart = sourceIndex;
      return;
    }

    let move = candle.close - state.lastBrickClose;

    while (Math.abs(move) >= brickSize) {
      const direction = Math.sign(move);
      const open = state.lastBrickClose;
      const close = state.lastBrickClose + direction * brickSize;

      points.push({
        time: candle.time,
        open,
        high: Math.max(open, close),
        low: Math.min(open, close),
        close,
        sourceIndex,
        sourceRange: { from: state.rangeStart, to: sourceIndex }
      });

      state.lastBrickClose = close;
      state.rangeStart = sourceIndex;
      move = candle.close - state.lastBrickClose;
    }
  });

  return { points, replaceTailCount: 0 };
}

function transformLineBreakChunk(
  chunk: CandleSeries,
  lineCount: number,
  processedCount: number,
  state: LineBreakState
): TransformDelta {
  const points: SeriesRenderPoint[] = [];

  chunk.candles.forEach((candle, localIndex) => {
    const sourceIndex = processedCount + localIndex;

    if (!state.initialized) {
      state.initialized = true;
      state.recentCloses = [candle.close];
      points.push({
        time: candle.time,
        open: candle.close,
        high: candle.close,
        low: candle.close,
        close: candle.close,
        volume: candle.volume,
        turnover: candle.turnover,
        sourceIndex
      });
      return;
    }

    const recentHigh = Math.max(...state.recentCloses);
    const recentLow = Math.min(...state.recentCloses);

    if (candle.close > recentHigh || candle.close < recentLow) {
      const previousClose = state.recentCloses[state.recentCloses.length - 1];

      points.push({
        time: candle.time,
        open: previousClose,
        high: Math.max(previousClose, candle.close),
        low: Math.min(previousClose, candle.close),
        close: candle.close,
        volume: candle.volume,
        turnover: candle.turnover,
        sourceIndex
      });
      appendBounded(state.recentCloses, candle.close, lineCount);
    }
  });

  return { points, replaceTailCount: 0 };
}

function transformKagiChunk(
  chunk: CandleSeries,
  reversalAmount: number,
  processedCount: number,
  state: KagiState
): TransformDelta {
  const points: SeriesRenderPoint[] = [];

  chunk.candles.forEach((candle, localIndex) => {
    const sourceIndex = processedCount + localIndex;

    if (!state.initialized) {
      state.initialized = true;
      state.extreme = candle.close;
      state.lastPointClose = candle.close;
      points.push({
        time: candle.time,
        open: candle.close,
        high: candle.close,
        low: candle.close,
        close: candle.close,
        volume: candle.volume,
        turnover: candle.turnover,
        sourceIndex
      });
      return;
    }

    let emit = false;

    if (state.direction === null) {
      if (candle.close !== state.extreme) {
        state.direction = candle.close > state.extreme ? "up" : "down";
        state.extreme = candle.close;
        emit = true;
      }
    } else if (state.direction === "up") {
      if (candle.close > state.extreme) {
        state.extreme = candle.close;
        emit = true;
      } else if (state.extreme - candle.close >= reversalAmount) {
        state.direction = "down";
        state.extreme = candle.close;
        emit = true;
      }
    } else if (candle.close < state.extreme) {
      state.extreme = candle.close;
      emit = true;
    } else if (candle.close - state.extreme >= reversalAmount) {
      state.direction = "up";
      state.extreme = candle.close;
      emit = true;
    }

    if (emit) {
      const open = state.lastPointClose;

      points.push({
        time: candle.time,
        open,
        high: Math.max(open, candle.close),
        low: Math.min(open, candle.close),
        close: candle.close,
        volume: candle.volume,
        turnover: candle.turnover,
        sourceIndex
      });
      state.lastPointClose = candle.close;
    }
  });

  return { points, replaceTailCount: 0 };
}

function transformPointAndFigureChunk(
  chunk: CandleSeries,
  boxSize: number,
  reversalBoxes: number,
  processedCount: number,
  state: PointAndFigureState
): TransformDelta {
  const startedWithOpenColumn = state.direction !== null;
  const completedColumns: PointAndFigureColumnState[] = [];
  const reversalAmount = boxSize * reversalBoxes;
  let changed = false;

  chunk.candles.forEach((candle, localIndex) => {
    const sourceIndex = processedCount + localIndex;

    if (!state.initialized) {
      state.initialized = true;
      state.start = candle.close;
      state.end = candle.close;
      state.startIndex = sourceIndex;
      state.endIndex = sourceIndex;
      state.endTime = candle.time;
      return;
    }

    if (state.direction === null) {
      const boxMove = wholeBoxes(Math.abs(candle.close - state.start), boxSize);

      if (boxMove === 0) {
        return;
      }

      state.direction = candle.close > state.start ? "up" : "down";
      state.end = state.start + (state.direction === "up" ? boxMove : -boxMove) * boxSize;
      state.endIndex = sourceIndex;
      state.endTime = candle.time;
      changed = true;
      return;
    }

    if (state.direction === "up") {
      if (candle.close >= state.end + boxSize) {
        state.end += wholeBoxes(candle.close - state.end, boxSize) * boxSize;
        state.endIndex = sourceIndex;
        state.endTime = candle.time;
        changed = true;
      } else if (state.end - candle.close >= reversalAmount) {
        completedColumns.push(snapshotColumn(state));

        const boxMove = wholeBoxes(state.end - candle.close, boxSize);

        state.direction = "down";
        state.start = state.end;
        state.end -= boxMove * boxSize;
        state.startIndex = state.endIndex;
        state.endIndex = sourceIndex;
        state.endTime = candle.time;
        changed = true;
      }
    } else if (candle.close <= state.end - boxSize) {
      state.end -= wholeBoxes(state.end - candle.close, boxSize) * boxSize;
      state.endIndex = sourceIndex;
      state.endTime = candle.time;
      changed = true;
    } else if (candle.close - state.end >= reversalAmount) {
      completedColumns.push(snapshotColumn(state));

      const boxMove = wholeBoxes(candle.close - state.end, boxSize);

      state.direction = "up";
      state.start = state.end;
      state.end += boxMove * boxSize;
      state.startIndex = state.endIndex;
      state.endIndex = sourceIndex;
      state.endTime = candle.time;
      changed = true;
    }
  });

  if (!changed || state.direction === null) {
    return { points: [], replaceTailCount: 0 };
  }

  const columns = [...completedColumns, snapshotColumn(state)];

  return {
    points: columns.map(createPointAndFigurePoint),
    replaceTailCount: startedWithOpenColumn ? 1 : 0
  };
}

function snapshotColumn(state: PointAndFigureState): PointAndFigureColumnState {
  return {
    start: state.start,
    end: state.end,
    startIndex: state.startIndex,
    endIndex: state.endIndex,
    endTime: state.endTime
  };
}

function createPointAndFigurePoint(column: PointAndFigureColumnState): SeriesRenderPoint {
  return {
    time: column.endTime,
    open: column.start,
    high: Math.max(column.start, column.end),
    low: Math.min(column.start, column.end),
    close: column.end,
    sourceIndex: column.endIndex,
    sourceRange: { from: column.startIndex, to: column.endIndex }
  };
}

function createInitialState(type: StatefulSeriesTransformType): SeriesTransformState {
  switch (type) {
    case "heikinAshi":
      return { initialized: false, previousOpen: 0, previousClose: 0 };
    case "renko":
      return { initialized: false, lastBrickClose: 0, rangeStart: 0 };
    case "lineBreak":
      return { initialized: false, recentCloses: [] };
    case "kagi":
      return { initialized: false, direction: null, extreme: 0, lastPointClose: 0 };
    case "pointAndFigure":
      return {
        initialized: false,
        direction: null,
        start: 0,
        end: 0,
        startIndex: 0,
        endIndex: 0,
        endTime: 0
      };
  }
}

function normalizeOptions(
  type: StatefulSeriesTransformType,
  options: StatefulSeriesTransformOptions
): Record<string, number> {
  switch (type) {
    case "heikinAshi":
      return {};
    case "renko":
      return { brickSize: positiveNumber(options.brickSize, "brickSize") };
    case "lineBreak":
      return { lineCount: positiveInteger(options.lineCount, "lineCount") };
    case "kagi":
      return { reversalAmount: positiveNumber(options.reversalAmount, "reversalAmount") };
    case "pointAndFigure":
      return {
        boxSize: positiveNumber(options.boxSize, "boxSize"),
        reversalBoxes: positiveInteger(options.reversalBoxes, "reversalBoxes")
      };
  }
}

function validateCheckpoint(
  checkpoint: SeriesTransformCheckpoint,
  type: StatefulSeriesTransformType,
  options: Record<string, number>,
  chunk: CandleSeries
): void {
  if (checkpoint.kind !== "seriesTransform") {
    throw new Error("Series transform checkpoint kind mismatch");
  }
  if (checkpoint.type !== type) {
    throw new Error("Series transform checkpoint type mismatch");
  }
  if (!sameNumberRecord(checkpoint.options, options)) {
    throw new Error("Series transform checkpoint options mismatch");
  }
  if (checkpoint.symbol !== chunk.symbol) {
    throw new Error("Series transform checkpoint symbol mismatch");
  }
  if (checkpoint.timeframe !== chunk.timeframe) {
    throw new Error("Series transform checkpoint timeframe mismatch");
  }
  if (checkpoint.adjustMode !== chunk.adjustMode) {
    throw new Error("Series transform checkpoint adjustment mismatch");
  }
  if (checkpoint.dataVersion !== chunk.dataVersion) {
    throw new Error("Series transform checkpoint data version mismatch");
  }
}

function sameNumberRecord(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && Object.is(left[key], right[key]))
  );
}

function appendBounded<T>(values: T[], value: T, limit: number): void {
  values.push(value);

  if (values.length > limit) {
    values.shift();
  }
}

function wholeBoxes(move: number, boxSize: number): number {
  return Math.floor(move / boxSize);
}

function positiveNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return value;
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }

  return value;
}
