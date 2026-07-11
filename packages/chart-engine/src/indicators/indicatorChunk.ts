import type { AdjustMode, Candle, CandleSeries, Timeframe } from "../model/market";
import type {
  ChartMark,
  IndicatorBandOutput,
  IndicatorHistogramOutput,
  IndicatorLineOutput,
  IndicatorPoint,
  IndicatorResult
} from "../model/visual";
import type { CoreIndicatorParams } from "./coreIndicators";
import {
  coreIndicatorDefinitions,
  type CoreIndicatorDefinition,
  type CoreIndicatorId
} from "./indicatorDefinitions";

export interface CoreIndicatorCheckpoint {
  readonly kind: "coreIndicator";
  readonly id: CoreIndicatorId;
  readonly params: Readonly<Record<string, number>>;
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly adjustMode: AdjustMode;
  readonly dataVersion: string;
  readonly processedCount: number;
  readonly finalized: boolean;
  readonly state: unknown;
}

export interface CoreIndicatorChunkOptions {
  finalize?: boolean;
}

export interface CoreIndicatorChunkResult {
  result: IndicatorResult;
  checkpoint: CoreIndicatorCheckpoint;
}

interface RollingSumState {
  values: number[];
  sum: number;
}

interface RecursiveValueState {
  initialized: boolean;
  previous: number;
}

interface MacdState {
  initialized: boolean;
  fast: number;
  slow: number;
  signal: number;
}

interface OhlcValue {
  high: number;
  low: number;
  close: number;
}

interface KdjState {
  window: OhlcValue[];
  previousK: number;
  previousD: number;
}

interface DmiState {
  previous: OhlcValue | null;
  plusDm: number[];
  minusDm: number[];
  trueRange: number[];
  dx: Array<number | null>;
}

interface ObvState {
  previousClose: number | null;
  value: number;
  window: number[];
  sum: number;
}

interface VrContribution {
  rising: number;
  falling: number;
  flat: number;
}

interface VrState {
  previousClose: number | null;
  window: VrContribution[];
}

interface SarCandleState {
  time: number;
  high: number;
  low: number;
  close: number;
}

interface PendingSarCandle {
  candle: SarCandleState;
  index: number;
}

interface SarState {
  initialized: boolean;
  pendingFirst: PendingSarCandle | null;
  rising: boolean;
  sar: number;
  extreme: number;
  acceleration: number;
  tail: SarCandleState[];
}

interface NumberWindowState {
  values: number[];
}

interface OhlcWindowState {
  values: OhlcValue[];
}

type IndicatorAlgorithmState =
  | RollingSumState
  | RecursiveValueState
  | MacdState
  | KdjState
  | DmiState
  | ObvState
  | VrState
  | SarState
  | NumberWindowState
  | OhlcWindowState;

const definitionById = new Map<CoreIndicatorId, CoreIndicatorDefinition>(
  coreIndicatorDefinitions.map((definition) => [definition.id, definition])
);

export function calculateCoreIndicatorChunk(
  id: CoreIndicatorId,
  chunk: CandleSeries,
  params: CoreIndicatorParams = {},
  checkpoint?: CoreIndicatorCheckpoint,
  options: CoreIndicatorChunkOptions = {}
): CoreIndicatorChunkResult {
  return runCoreIndicatorChunk(id, chunk, params, checkpoint, options.finalize ?? false);
}

export function runCoreIndicatorChunk(
  id: CoreIndicatorId | string,
  chunk: CandleSeries,
  params: CoreIndicatorParams = {},
  checkpoint?: CoreIndicatorCheckpoint,
  finalize = false
): CoreIndicatorChunkResult {
  const definition = definitionById.get(id as CoreIndicatorId);

  if (!definition) {
    throw new Error(`Unsupported core indicator: ${id}`);
  }

  const normalizedParams = normalizeParams(definition, params);

  if (checkpoint) {
    validateCheckpoint(checkpoint, definition.id, normalizedParams, chunk);

    if (checkpoint.finalized === true && chunk.candles.length > 0) {
      throw new Error("Core indicator checkpoint is finalized");
    }
  }

  const processedCount = checkpoint?.processedCount ?? 0;
  const state = checkpoint
    ? cloneJson(checkpoint.state as IndicatorAlgorithmState)
    : createInitialState(definition.id);
  const result = calculateChunk(
    definition,
    normalizedParams,
    chunk.candles,
    processedCount,
    state,
    finalize
  );
  const nextCheckpoint = deepFreeze({
    kind: "coreIndicator" as const,
    id: definition.id,
    params: cloneJson(normalizedParams),
    symbol: chunk.symbol,
    timeframe: chunk.timeframe,
    adjustMode: chunk.adjustMode,
    dataVersion: chunk.dataVersion,
    processedCount: processedCount + chunk.candles.length,
    finalized: checkpoint?.finalized === true || finalize,
    state: cloneJson(state)
  });

  return { result, checkpoint: nextCheckpoint };
}

function calculateChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: IndicatorAlgorithmState,
  finalize: boolean
): IndicatorResult {
  switch (definition.id) {
    case "MA":
      return calculateMaChunk(definition, params, candles, processedCount, state as RollingSumState);
    case "EMA":
      return calculateEmaChunk(definition, params, candles, state as RecursiveValueState);
    case "SMA":
      return calculateSmaChunk(definition, params, candles, state as RecursiveValueState);
    case "VOL":
      return calculateVolChunk(definition, params, candles, processedCount, state as RollingSumState);
    case "MACD":
      return calculateMacdChunk(definition, params, candles, state as MacdState);
    case "BOLL":
      return calculateBollChunk(definition, params, candles, processedCount, state as RollingSumState);
    case "KDJ":
      return calculateKdjChunk(definition, params, candles, processedCount, state as KdjState);
    case "RSI":
      return calculateRsiChunk(definition, params, candles, processedCount, state as NumberWindowState);
    case "BIAS":
      return calculateBiasChunk(definition, params, candles, processedCount, state as RollingSumState);
    case "CCI":
      return calculateCciChunk(definition, params, candles, processedCount, state as RollingSumState);
    case "DMI":
      return calculateDmiChunk(definition, params, candles, processedCount, state as DmiState);
    case "OBV":
      return calculateObvChunk(definition, params, candles, processedCount, state as ObvState);
    case "VR":
      return calculateVrChunk(definition, params, candles, processedCount, state as VrState);
    case "WR":
      return calculateWrChunk(definition, params, candles, processedCount, state as OhlcWindowState);
    case "MTM":
      return calculateMtmChunk(definition, params, candles, processedCount, state as NumberWindowState);
    case "SAR":
      return calculateSarChunk(
        definition,
        params,
        candles,
        processedCount,
        state as SarState,
        finalize
      );
  }
}

function calculateMaChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: RollingSumState
): IndicatorResult {
  const period = params.period;
  const values = candles.map((candle, localIndex) => ({
    time: candle.time,
    value: appendAverage(state, candle.close, period, processedCount + localIndex)
  }));

  return {
    outputs: [lineOutput("MA", `MA${period}`, definition.panelId, values, "#f59e0b")]
  };
}

function calculateEmaChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  state: RecursiveValueState
): IndicatorResult {
  const period = params.period;
  const alpha = 2 / (period + 1);
  const values = candles.map((candle) => {
    state.previous = state.initialized
      ? alpha * candle.close + (1 - alpha) * state.previous
      : candle.close;
    state.initialized = true;

    return { time: candle.time, value: state.previous };
  });

  return {
    outputs: [lineOutput("EMA", `EMA${period}`, definition.panelId, values, "#22c55e")]
  };
}

function calculateSmaChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  state: RecursiveValueState
): IndicatorResult {
  const period = params.period;
  const values = candles.map((candle) => {
    state.previous = state.initialized
      ? (candle.close + (period - 1) * state.previous) / period
      : candle.close;
    state.initialized = true;

    return { time: candle.time, value: state.previous };
  });

  return {
    outputs: [lineOutput("SMA", `SMA${period}`, definition.panelId, values, "#38bdf8")]
  };
}

function calculateVolChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: RollingSumState
): IndicatorResult {
  const period = params.period;
  const averageValues = candles.map((candle, localIndex) => ({
    time: candle.time,
    value: appendAverage(state, candle.volume, period, processedCount + localIndex)
  }));
  const histogramValues = candles.map((candle) => ({
    time: candle.time,
    value: candle.volume,
    color: candle.close >= candle.open ? "#16a34a" : "#dc2626"
  }));

  return {
    outputs: [
      histogramOutput("VOL", "Volume", definition.panelId, histogramValues),
      lineOutput("VOL-MA", `VMA${period}`, definition.panelId, averageValues, "#f59e0b")
    ]
  };
}

function calculateMacdChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  state: MacdState
): IndicatorResult {
  const fastAlpha = 2 / (params.fast + 1);
  const slowAlpha = 2 / (params.slow + 1);
  const signalAlpha = 2 / (params.signal + 1);
  const difValues: IndicatorPoint[] = [];
  const deaValues: IndicatorPoint[] = [];
  const histogramValues: IndicatorHistogramOutput["values"] = [];

  for (const candle of candles) {
    if (state.initialized) {
      state.fast = fastAlpha * candle.close + (1 - fastAlpha) * state.fast;
      state.slow = slowAlpha * candle.close + (1 - slowAlpha) * state.slow;
    } else {
      state.fast = candle.close;
      state.slow = candle.close;
    }

    const dif = state.fast - state.slow;

    state.signal = state.initialized
      ? signalAlpha * dif + (1 - signalAlpha) * state.signal
      : dif;
    state.initialized = true;

    const histogram = (dif - state.signal) * 2;

    difValues.push({ time: candle.time, value: dif });
    deaValues.push({ time: candle.time, value: state.signal });
    histogramValues.push({
      time: candle.time,
      value: histogram,
      color: histogram >= 0 ? "#16a34a" : "#dc2626"
    });
  }

  return {
    outputs: [
      lineOutput("MACD-DIF", "DIF", definition.panelId, difValues, "#2563eb"),
      lineOutput("MACD-DEA", "DEA", definition.panelId, deaValues, "#f97316"),
      histogramOutput("MACD-HISTOGRAM", "MACD", definition.panelId, histogramValues)
    ]
  };
}

function calculateBollChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: RollingSumState
): IndicatorResult {
  const period = params.period;
  const middle: IndicatorPoint[] = [];
  const upper: IndicatorPoint[] = [];
  const lower: IndicatorPoint[] = [];

  candles.forEach((candle, localIndex) => {
    const average = appendAverage(state, candle.close, period, processedCount + localIndex);

    middle.push({ time: candle.time, value: average });

    if (average === null) {
      upper.push({ time: candle.time, value: null });
      lower.push({ time: candle.time, value: null });
      return;
    }

    const variance =
      state.values.reduce((sum, value) => sum + (value - average) ** 2, 0) / period;
    const bandWidth = Math.sqrt(variance) * params.deviation;

    upper.push({ time: candle.time, value: average + bandWidth });
    lower.push({ time: candle.time, value: average - bandWidth });
  });

  const band: IndicatorBandOutput = {
    type: "band",
    id: "BOLL-BAND",
    label: "BOLL",
    panelId: definition.panelId,
    upper,
    lower,
    fill: "rgba(37, 99, 235, 0.14)"
  };

  return {
    outputs: [
      band,
      lineOutput("BOLL-MID", `BOLL${period}`, definition.panelId, middle, "#2563eb")
    ]
  };
}

function calculateKdjChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: KdjState
): IndicatorResult {
  const period = params.period;
  const kValues: IndicatorPoint[] = [];
  const dValues: IndicatorPoint[] = [];
  const jValues: IndicatorPoint[] = [];

  candles.forEach((candle, localIndex) => {
    appendBounded(state.window, toOhlcValue(candle), period);
    const index = processedCount + localIndex;

    if (index < period - 1) {
      kValues.push({ time: candle.time, value: null });
      dValues.push({ time: candle.time, value: null });
      jValues.push({ time: candle.time, value: null });
      return;
    }

    const highestHigh = Math.max(...state.window.map((value) => value.high));
    const lowestLow = Math.min(...state.window.map((value) => value.low));
    const range = highestHigh - lowestLow;
    const rsv = range === 0 ? 50 : ((candle.close - lowestLow) / range) * 100;

    state.previousK = (2 * state.previousK + rsv) / 3;
    state.previousD = (2 * state.previousD + state.previousK) / 3;

    kValues.push({ time: candle.time, value: state.previousK });
    dValues.push({ time: candle.time, value: state.previousD });
    jValues.push({ time: candle.time, value: 3 * state.previousK - 2 * state.previousD });
  });

  return {
    outputs: [
      lineOutput("KDJ-K", "K", definition.panelId, kValues, "#2563eb"),
      lineOutput("KDJ-D", "D", definition.panelId, dValues, "#f97316"),
      lineOutput("KDJ-J", "J", definition.panelId, jValues, "#7c3aed")
    ]
  };
}

function calculateRsiChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: { values: number[] }
): IndicatorResult {
  const period = params.period;
  const values: IndicatorPoint[] = [];

  candles.forEach((candle, localIndex) => {
    appendBounded(state.values, candle.close, period + 1);
    const index = processedCount + localIndex;

    if (index < period) {
      values.push({ time: candle.time, value: null });
      return;
    }

    let gain = 0;
    let loss = 0;

    for (let cursor = 1; cursor < state.values.length; cursor += 1) {
      const change = state.values[cursor] - state.values[cursor - 1];

      if (change >= 0) {
        gain += change;
      } else {
        loss -= change;
      }
    }

    values.push({
      time: candle.time,
      value: loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
    });
  });

  return {
    outputs: [lineOutput("RSI", `RSI${period}`, definition.panelId, values, "#2563eb")]
  };
}

function calculateBiasChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: RollingSumState
): IndicatorResult {
  const period = params.period;
  const values = candles.map((candle, localIndex) => {
    const average = appendAverage(state, candle.close, period, processedCount + localIndex);

    return {
      time: candle.time,
      value: average === null || average === 0 ? null : ((candle.close - average) / average) * 100
    };
  });

  return {
    outputs: [lineOutput("BIAS", `BIAS${period}`, definition.panelId, values, "#2563eb")]
  };
}

function calculateCciChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: RollingSumState
): IndicatorResult {
  const period = params.period;
  const values = candles.map((candle, localIndex) => {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const average = appendAverage(state, typicalPrice, period, processedCount + localIndex);

    if (average === null) {
      return { time: candle.time, value: null };
    }

    const meanDeviation =
      state.values.reduce((sum, value) => sum + Math.abs(value - average), 0) / period;

    return {
      time: candle.time,
      value: meanDeviation === 0 ? 0 : (typicalPrice - average) / (0.015 * meanDeviation)
    };
  });

  return {
    outputs: [lineOutput("CCI", `CCI${period}`, definition.panelId, values, "#2563eb")]
  };
}

function calculateDmiChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: DmiState
): IndicatorResult {
  const period = params.period;
  const pdiValues: IndicatorPoint[] = [];
  const mdiValues: IndicatorPoint[] = [];
  const adxValues: IndicatorPoint[] = [];

  candles.forEach((candle, localIndex) => {
    let plusDm = 0;
    let minusDm = 0;
    let trueRange = 0;

    if (state.previous) {
      const upMove = candle.high - state.previous.high;
      const downMove = state.previous.low - candle.low;

      plusDm = upMove > downMove && upMove > 0 ? upMove : 0;
      minusDm = downMove > upMove && downMove > 0 ? downMove : 0;
      trueRange = Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - state.previous.close),
        Math.abs(candle.low - state.previous.close)
      );
    }

    appendBounded(state.plusDm, plusDm, period);
    appendBounded(state.minusDm, minusDm, period);
    appendBounded(state.trueRange, trueRange, period);
    state.previous = toOhlcValue(candle);

    const index = processedCount + localIndex;
    let pdi: number | null = null;
    let mdi: number | null = null;
    let dx: number | null = null;

    if (index >= period) {
      const plus = sumValues(state.plusDm);
      const minus = sumValues(state.minusDm);
      const range = sumValues(state.trueRange);

      pdi = range === 0 ? 0 : (plus / range) * 100;
      mdi = range === 0 ? 0 : (minus / range) * 100;

      const total = pdi + mdi;

      dx = total === 0 ? 0 : (Math.abs(pdi - mdi) / total) * 100;
    }

    appendBounded(state.dx, dx, period);

    const adx =
      state.dx.length === period && state.dx.every((value) => value !== null)
        ? sumNullableValues(state.dx) / period
        : null;

    pdiValues.push({ time: candle.time, value: pdi });
    mdiValues.push({ time: candle.time, value: mdi });
    adxValues.push({ time: candle.time, value: adx });
  });

  return {
    outputs: [
      lineOutput("DMI-PDI", "PDI", definition.panelId, pdiValues, "#16a34a"),
      lineOutput("DMI-MDI", "MDI", definition.panelId, mdiValues, "#dc2626"),
      lineOutput("DMI-ADX", "ADX", definition.panelId, adxValues, "#2563eb")
    ]
  };
}

function calculateObvChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: ObvState
): IndicatorResult {
  const period = params.period;
  const values: IndicatorPoint[] = [];
  const averages: IndicatorPoint[] = [];

  candles.forEach((candle, localIndex) => {
    if (state.previousClose !== null) {
      if (candle.close > state.previousClose) {
        state.value += candle.volume;
      } else if (candle.close < state.previousClose) {
        state.value -= candle.volume;
      }
    }

    state.previousClose = candle.close;
    state.sum += state.value;
    state.window.push(state.value);

    if (state.window.length > period) {
      state.sum -= state.window.shift() as number;
    }

    values.push({ time: candle.time, value: state.value });
    averages.push({
      time: candle.time,
      value: processedCount + localIndex >= period - 1 ? state.sum / period : null
    });
  });

  return {
    outputs: [
      lineOutput("OBV", "OBV", definition.panelId, values, "#2563eb"),
      lineOutput("OBV-MA", `OBVMA${period}`, definition.panelId, averages, "#f59e0b")
    ]
  };
}

function calculateVrChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: VrState
): IndicatorResult {
  const period = params.period;
  const values: IndicatorPoint[] = [];

  candles.forEach((candle, localIndex) => {
    const contribution: VrContribution = { rising: 0, falling: 0, flat: 0 };

    if (state.previousClose !== null) {
      if (candle.close > state.previousClose) {
        contribution.rising = candle.volume;
      } else if (candle.close < state.previousClose) {
        contribution.falling = candle.volume;
      } else {
        contribution.flat = candle.volume;
      }
    }

    state.previousClose = candle.close;
    appendBounded(state.window, contribution, period);

    if (processedCount + localIndex < period) {
      values.push({ time: candle.time, value: null });
      return;
    }

    let rising = 0;
    let falling = 0;
    let flat = 0;

    for (const item of state.window) {
      rising += item.rising;
      falling += item.falling;
      flat += item.flat;
    }

    const denominator = falling + flat / 2;

    values.push({
      time: candle.time,
      value: denominator === 0 ? 100 : ((rising + flat / 2) / denominator) * 100
    });
  });

  return {
    outputs: [lineOutput("VR", `VR${period}`, definition.panelId, values, "#2563eb")]
  };
}

function calculateWrChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: { values: OhlcValue[] }
): IndicatorResult {
  const period = params.period;
  const values: IndicatorPoint[] = [];

  candles.forEach((candle, localIndex) => {
    appendBounded(state.values, toOhlcValue(candle), period);

    if (processedCount + localIndex < period - 1) {
      values.push({ time: candle.time, value: null });
      return;
    }

    const highestHigh = Math.max(...state.values.map((value) => value.high));
    const lowestLow = Math.min(...state.values.map((value) => value.low));
    const range = highestHigh - lowestLow;

    values.push({
      time: candle.time,
      value: range === 0 ? 0 : ((highestHigh - candle.close) / range) * -100
    });
  });

  return {
    outputs: [lineOutput("WR", `WR${period}`, definition.panelId, values, "#2563eb")]
  };
}

function calculateMtmChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: { values: number[] }
): IndicatorResult {
  const period = params.period;
  const values: IndicatorPoint[] = [];

  candles.forEach((candle, localIndex) => {
    appendBounded(state.values, candle.close, period + 1);
    values.push({
      time: candle.time,
      value:
        processedCount + localIndex < period
          ? null
          : candle.close - state.values[0]
    });
  });

  return {
    outputs: [lineOutput("MTM", `MTM${period}`, definition.panelId, values, "#2563eb")]
  };
}

function calculateSarChunk(
  definition: CoreIndicatorDefinition,
  params: Record<string, number>,
  candles: readonly Candle[],
  processedCount: number,
  state: SarState,
  finalize: boolean
): IndicatorResult {
  const events = candles.map((candle, localIndex) => ({
    candle: toSarCandle(candle),
    index: processedCount + localIndex
  }));
  const marks: ChartMark[] = [];
  let cursor = 0;

  if (!state.initialized) {
    if (!state.pendingFirst && cursor < events.length) {
      state.pendingFirst = events[cursor];
      cursor += 1;
    }

    if (state.pendingFirst && cursor < events.length) {
      initializeSar(state, state.pendingFirst.candle, events[cursor].candle, params.step);
      marks.push(createSarMark(state.pendingFirst.candle, state.pendingFirst.index, state, definition.panelId));
      state.pendingFirst = null;
    } else if (state.pendingFirst && finalize) {
      initializeSar(state, state.pendingFirst.candle, null, params.step);
      marks.push(createSarMark(state.pendingFirst.candle, state.pendingFirst.index, state, definition.panelId));
      state.pendingFirst = null;
    }
  }

  while (state.initialized && cursor < events.length) {
    const event = events[cursor];

    updateSar(state, event.candle, params.step, params.max);
    marks.push(createSarMark(event.candle, event.index, state, definition.panelId));
    cursor += 1;
  }

  return {
    outputs: [
      {
        type: "marker",
        id: "SAR",
        label: "SAR",
        panelId: definition.panelId,
        marks
      }
    ]
  };
}

function initializeSar(
  state: SarState,
  first: SarCandleState,
  second: SarCandleState | null,
  step: number
): void {
  state.rising = second === null || second.close >= first.close;
  state.sar = state.rising ? first.low : first.high;
  state.extreme = state.rising ? first.high : first.low;
  state.acceleration = step;
  state.tail = [{ ...first }];
  state.initialized = true;
}

function updateSar(state: SarState, candle: SarCandleState, step: number, max: number): void {
  state.sar += state.acceleration * (state.extreme - state.sar);

  if (state.rising) {
    const previousLow = state.tail[state.tail.length - 1].low;
    const priorLow = state.tail[state.tail.length - 2]?.low ?? previousLow;

    state.sar = Math.min(state.sar, previousLow, priorLow);

    if (candle.low < state.sar) {
      state.rising = false;
      state.sar = state.extreme;
      state.extreme = candle.low;
      state.acceleration = step;
    } else if (candle.high > state.extreme) {
      state.extreme = candle.high;
      state.acceleration = Math.min(state.acceleration + step, max);
    }
  } else {
    const previousHigh = state.tail[state.tail.length - 1].high;
    const priorHigh = state.tail[state.tail.length - 2]?.high ?? previousHigh;

    state.sar = Math.max(state.sar, previousHigh, priorHigh);

    if (candle.high > state.sar) {
      state.rising = true;
      state.sar = state.extreme;
      state.extreme = candle.high;
      state.acceleration = step;
    } else if (candle.low < state.extreme) {
      state.extreme = candle.low;
      state.acceleration = Math.min(state.acceleration + step, max);
    }
  }

  appendBounded(state.tail, { ...candle }, 2);
}

function createSarMark(
  candle: SarCandleState,
  index: number,
  state: SarState,
  panelId: string
): ChartMark {
  return {
    id: `SAR-${index}`,
    time: candle.time,
    index,
    price: state.sar,
    direction: state.rising ? "below" : "above",
    label: "SAR",
    metadata: { panelId }
  };
}

function createInitialState(id: CoreIndicatorId): IndicatorAlgorithmState {
  switch (id) {
    case "MA":
    case "VOL":
    case "BOLL":
    case "BIAS":
    case "CCI":
      return { values: [], sum: 0 };
    case "EMA":
    case "SMA":
      return { initialized: false, previous: 0 };
    case "MACD":
      return { initialized: false, fast: 0, slow: 0, signal: 0 };
    case "KDJ":
      return { window: [], previousK: 50, previousD: 50 };
    case "RSI":
    case "WR":
    case "MTM":
      return { values: [] };
    case "DMI":
      return { previous: null, plusDm: [], minusDm: [], trueRange: [], dx: [] };
    case "OBV":
      return { previousClose: null, value: 0, window: [], sum: 0 };
    case "VR":
      return { previousClose: null, window: [] };
    case "SAR":
      return {
        initialized: false,
        pendingFirst: null,
        rising: true,
        sar: 0,
        extreme: 0,
        acceleration: 0,
        tail: []
      };
  }
}

function normalizeParams(
  definition: CoreIndicatorDefinition,
  params: CoreIndicatorParams
): Record<string, number> {
  const normalized: Record<string, number> = {};

  for (const parameter of definition.params) {
    normalized[parameter.id] = params[parameter.id] ?? parameter.defaultValue;
  }

  switch (definition.id) {
    case "MA":
    case "EMA":
    case "SMA":
    case "VOL":
    case "KDJ":
    case "RSI":
    case "BIAS":
    case "CCI":
    case "DMI":
    case "OBV":
    case "VR":
    case "WR":
    case "MTM":
      normalized.period = positiveInteger(normalized.period, "period");
      break;
    case "MACD":
      normalized.fast = positiveInteger(normalized.fast, "fast");
      normalized.slow = positiveInteger(normalized.slow, "slow");
      normalized.signal = positiveInteger(normalized.signal, "signal");
      if (normalized.fast >= normalized.slow) {
        throw new Error("fast must be less than slow");
      }
      break;
    case "BOLL":
      normalized.period = positiveInteger(normalized.period, "period");
      normalized.deviation = positiveNumber(normalized.deviation, "deviation");
      break;
    case "SAR":
      normalized.step = normalizeSarRatio(positiveNumber(normalized.step, "step"));
      normalized.max = normalizeSarRatio(positiveNumber(normalized.max, "max"));
      break;
  }

  return normalized;
}

function validateCheckpoint(
  checkpoint: CoreIndicatorCheckpoint,
  id: CoreIndicatorId,
  params: Record<string, number>,
  chunk: CandleSeries
): void {
  if (checkpoint.kind !== "coreIndicator") {
    throw new Error("Core indicator checkpoint kind mismatch");
  }
  if (checkpoint.id !== id) {
    throw new Error("Core indicator checkpoint id mismatch");
  }
  if (!sameNumberRecord(checkpoint.params, params)) {
    throw new Error("Core indicator checkpoint params mismatch");
  }
  if (checkpoint.symbol !== chunk.symbol) {
    throw new Error("Core indicator checkpoint symbol mismatch");
  }
  if (checkpoint.timeframe !== chunk.timeframe) {
    throw new Error("Core indicator checkpoint timeframe mismatch");
  }
  if (checkpoint.adjustMode !== chunk.adjustMode) {
    throw new Error("Core indicator checkpoint adjustment mismatch");
  }
  if (checkpoint.dataVersion !== chunk.dataVersion) {
    throw new Error("Core indicator checkpoint data version mismatch");
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

function appendAverage(
  state: RollingSumState,
  value: number,
  period: number,
  index: number
): number | null {
  state.sum += value;
  state.values.push(value);

  if (state.values.length > period) {
    state.sum -= state.values.shift() as number;
  }

  return index >= period - 1 ? state.sum / period : null;
}

function appendBounded<T>(values: T[], value: T, limit: number): void {
  values.push(value);

  if (values.length > limit) {
    values.shift();
  }
}

function sumValues(values: readonly number[]): number {
  let sum = 0;

  for (const value of values) {
    sum += value;
  }

  return sum;
}

function sumNullableValues(values: ReadonlyArray<number | null>): number {
  let sum = 0;

  for (const value of values) {
    if (value !== null) {
      sum += value;
    }
  }

  return sum;
}

function toOhlcValue(candle: Candle): OhlcValue {
  return { high: candle.high, low: candle.low, close: candle.close };
}

function toSarCandle(candle: Candle): SarCandleState {
  return { time: candle.time, high: candle.high, low: candle.low, close: candle.close };
}

function lineOutput(
  id: string,
  label: string,
  panelId: string,
  values: IndicatorPoint[],
  color?: string
): IndicatorLineOutput {
  return { type: "line", id, label, panelId, values, color };
}

function histogramOutput(
  id: string,
  label: string,
  panelId: string,
  values: IndicatorHistogramOutput["values"]
): IndicatorHistogramOutput {
  return { type: "histogram", id, label, panelId, values };
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${name} must be a finite integer`);
  }
  if (value <= 0) {
    throw new Error(`${name} must be greater than 0`);
  }

  return value;
}

function positiveNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be greater than 0`);
  }

  return value;
}

function normalizeSarRatio(value: number): number {
  return value > 1 ? value / 100 : value;
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
