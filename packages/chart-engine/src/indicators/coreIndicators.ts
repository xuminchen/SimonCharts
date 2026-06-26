import type { Candle, CandleSeries } from "../model/market";
import type {
  ChartMark,
  IndicatorBandOutput,
  IndicatorHistogramOutput,
  IndicatorLineOutput,
  IndicatorPoint,
  IndicatorResult
} from "../model/visual";
import { calculateMovingAverage } from "./movingAverage";
import {
  coreIndicatorDefinitions,
  type CoreIndicatorDefinition,
  type CoreIndicatorId
} from "./indicatorDefinitions";

export type CoreIndicatorParams = Partial<Record<string, number>>;

const definitionById = new Map<CoreIndicatorId, CoreIndicatorDefinition>(
  coreIndicatorDefinitions.map((definition) => [definition.id, definition])
);

export function calculateCoreIndicator(
  id: CoreIndicatorId | string,
  series: CandleSeries,
  params: CoreIndicatorParams = {}
): IndicatorResult {
  const definition = definitionById.get(id as CoreIndicatorId);

  if (!definition) {
    throw new Error(`Unsupported core indicator: ${id}`);
  }

  const parameters = mergeParams(definition, params);

  switch (definition.id) {
    case "MA":
      return calculateMa(series, definition, parameters);
    case "EMA":
      return calculateEma(series, definition, parameters);
    case "SMA":
      return calculateSma(series, definition, parameters);
    case "VOL":
      return calculateVol(series, definition, parameters);
    case "MACD":
      return calculateMacd(series, definition, parameters);
    case "BOLL":
      return calculateBoll(series, definition, parameters);
    case "KDJ":
      return calculateKdj(series, definition, parameters);
    case "RSI":
      return calculateRsi(series, definition, parameters);
    case "BIAS":
      return calculateBias(series, definition, parameters);
    case "CCI":
      return calculateCci(series, definition, parameters);
    case "DMI":
      return calculateDmi(series, definition, parameters);
    case "OBV":
      return calculateObv(series, definition, parameters);
    case "VR":
      return calculateVr(series, definition, parameters);
    case "WR":
      return calculateWr(series, definition, parameters);
    case "MTM":
      return calculateMtm(series, definition, parameters);
    case "SAR":
      return calculateSar(series, definition, parameters);
  }
}

function mergeParams(
  definition: CoreIndicatorDefinition,
  params: CoreIndicatorParams
): Record<string, number> {
  const merged: Record<string, number> = {};

  for (const param of definition.params) {
    merged[param.id] = params[param.id] ?? param.defaultValue;
  }

  return merged;
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

function times(series: CandleSeries): number[] {
  return series.candles.map((candle) => candle.time);
}

function closeValues(series: CandleSeries): number[] {
  return series.candles.map((candle) => candle.close);
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

function pointsFromValues(pointTimes: number[], values: Array<number | null>): IndicatorPoint[] {
  if (values.length !== pointTimes.length) {
    throw new Error(`Indicator value count (${values.length}) must match candle time count (${pointTimes.length})`);
  }

  return pointTimes.map((time, index) => ({ time, value: values[index] ?? null }));
}

function calculateMa(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const values = calculateMovingAverage(series, period).map((point) => ({
    time: point.time,
    value: point.value ?? null
  }));

  return {
    outputs: [lineOutput("MA", `MA${period}`, definition.panelId, values, "#f59e0b")]
  };
}

function calculateEma(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");

  return {
    outputs: [
      lineOutput(
        "EMA",
        `EMA${period}`,
        definition.panelId,
        pointsFromValues(times(series), emaValues(closeValues(series), period)),
        "#22c55e"
      )
    ]
  };
}

function calculateSma(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");

  return {
    outputs: [
      lineOutput(
        "SMA",
        `SMA${period}`,
        definition.panelId,
        pointsFromValues(times(series), smoothedValues(closeValues(series), period)),
        "#38bdf8"
      )
    ]
  };
}

function calculateVol(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const pointTimes = times(series);
  const volumes = series.candles.map((candle) => candle.volume);
  const histogramValues = series.candles.map((candle, index) => ({
    time: candle.time,
    value: candle.volume,
    color: candle.close >= candle.open ? "#16a34a" : "#dc2626"
  }));
  const averageValues = simpleAverageValues(volumes, period);

  return {
    outputs: [
      histogramOutput("VOL", "Volume", definition.panelId, histogramValues),
      lineOutput(
        "VOL-MA",
        `VMA${period}`,
        definition.panelId,
        pointsFromValues(pointTimes, averageValues),
        "#f59e0b"
      )
    ]
  };
}

function calculateMacd(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const fast = positiveInteger(params.fast, "fast");
  const slow = positiveInteger(params.slow, "slow");
  const signal = positiveInteger(params.signal, "signal");

  if (fast >= slow) {
    throw new Error("fast must be less than slow");
  }

  const pointTimes = times(series);
  const closes = closeValues(series);
  const fastEma = emaValues(closes, fast);
  const slowEma = emaValues(closes, slow);
  const dif = fastEma.map((value, index) => value - slowEma[index]);
  const dea = emaValues(dif, signal);
  const histogramValues = dif.map((value, index) => (value - dea[index]) * 2);

  return {
    outputs: [
      lineOutput("MACD-DIF", "DIF", definition.panelId, pointsFromValues(pointTimes, dif), "#2563eb"),
      lineOutput("MACD-DEA", "DEA", definition.panelId, pointsFromValues(pointTimes, dea), "#f97316"),
      histogramOutput(
        "MACD-HISTOGRAM",
        "MACD",
        definition.panelId,
        histogramValues.map((value, index) => ({
          time: pointTimes[index],
          value,
          color: value >= 0 ? "#16a34a" : "#dc2626"
        }))
      )
    ]
  };
}

function calculateBoll(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const deviation = positiveNumber(params.deviation, "deviation");
  const pointTimes = times(series);
  const closes = closeValues(series);
  const middle = simpleAverageValues(closes, period);
  const upper: Array<number | null> = [];
  const lower: Array<number | null> = [];

  for (let index = 0; index < closes.length; index += 1) {
    const average = middle[index];

    if (index < period - 1 || average === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }

    const window = closes.slice(index - period + 1, index + 1);
    const variance = window.reduce((sum, value) => sum + (value - average) ** 2, 0) / period;
    const bandWidth = Math.sqrt(variance) * deviation;

    upper.push(average + bandWidth);
    lower.push(average - bandWidth);
  }

  const band: IndicatorBandOutput = {
    type: "band",
    id: "BOLL-BAND",
    label: "BOLL",
    panelId: definition.panelId,
    upper: pointsFromValues(pointTimes, upper),
    lower: pointsFromValues(pointTimes, lower),
    fill: "rgba(37, 99, 235, 0.14)"
  };

  return {
    outputs: [
      band,
      lineOutput("BOLL-MID", `BOLL${period}`, definition.panelId, pointsFromValues(pointTimes, middle), "#2563eb")
    ]
  };
}

function calculateKdj(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const pointTimes = times(series);
  const kValues: Array<number | null> = [];
  const dValues: Array<number | null> = [];
  const jValues: Array<number | null> = [];
  let previousK = 50;
  let previousD = 50;

  for (let index = 0; index < series.candles.length; index += 1) {
    if (index < period - 1) {
      kValues.push(null);
      dValues.push(null);
      jValues.push(null);
      continue;
    }

    const window = series.candles.slice(index - period + 1, index + 1);
    const highestHigh = Math.max(...window.map((candle) => candle.high));
    const lowestLow = Math.min(...window.map((candle) => candle.low));
    const range = highestHigh - lowestLow;
    const rsv = range === 0 ? 50 : ((series.candles[index].close - lowestLow) / range) * 100;

    previousK = (2 * previousK + rsv) / 3;
    previousD = (2 * previousD + previousK) / 3;

    kValues.push(previousK);
    dValues.push(previousD);
    jValues.push(3 * previousK - 2 * previousD);
  }

  return {
    outputs: [
      lineOutput("KDJ-K", "K", definition.panelId, pointsFromValues(pointTimes, kValues), "#2563eb"),
      lineOutput("KDJ-D", "D", definition.panelId, pointsFromValues(pointTimes, dValues), "#f97316"),
      lineOutput("KDJ-J", "J", definition.panelId, pointsFromValues(pointTimes, jValues), "#7c3aed")
    ]
  };
}

function calculateRsi(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const pointTimes = times(series);
  const closes = closeValues(series);
  const values: Array<number | null> = [];

  for (let index = 0; index < closes.length; index += 1) {
    if (index < period) {
      values.push(null);
      continue;
    }

    let gain = 0;
    let loss = 0;

    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const change = closes[cursor] - closes[cursor - 1];

      if (change >= 0) {
        gain += change;
      } else {
        loss -= change;
      }
    }

    values.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  }

  return {
    outputs: [
      lineOutput("RSI", `RSI${period}`, definition.panelId, pointsFromValues(pointTimes, values), "#2563eb")
    ]
  };
}

function calculateBias(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const pointTimes = times(series);
  const closes = closeValues(series);
  const averages = simpleAverageValues(closes, period);
  const values = closes.map((close, index) => {
    const average = averages[index];

    return average === null || average === 0 ? null : ((close - average) / average) * 100;
  });

  return {
    outputs: [
      lineOutput("BIAS", `BIAS${period}`, definition.panelId, pointsFromValues(pointTimes, values), "#2563eb")
    ]
  };
}

function calculateCci(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const pointTimes = times(series);
  const typicalPrices = series.candles.map((candle) => (candle.high + candle.low + candle.close) / 3);
  const averages = simpleAverageValues(typicalPrices, period);
  const values: Array<number | null> = [];

  for (let index = 0; index < typicalPrices.length; index += 1) {
    const average = averages[index];

    if (average === null) {
      values.push(null);
      continue;
    }

    const window = typicalPrices.slice(index - period + 1, index + 1);
    const meanDeviation = window.reduce((sum, value) => sum + Math.abs(value - average), 0) / period;

    values.push(meanDeviation === 0 ? 0 : (typicalPrices[index] - average) / (0.015 * meanDeviation));
  }

  return {
    outputs: [
      lineOutput("CCI", `CCI${period}`, definition.panelId, pointsFromValues(pointTimes, values), "#2563eb")
    ]
  };
}

function calculateDmi(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const pointTimes = times(series);
  const plusDm = new Array(series.candles.length).fill(0) as number[];
  const minusDm = new Array(series.candles.length).fill(0) as number[];
  const tr = new Array(series.candles.length).fill(0) as number[];

  for (let index = 1; index < series.candles.length; index += 1) {
    const current = series.candles[index];
    const previous = series.candles[index - 1];
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;

    plusDm[index] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDm[index] = downMove > upMove && downMove > 0 ? downMove : 0;
    tr[index] = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
  }

  const pdi: Array<number | null> = [];
  const mdi: Array<number | null> = [];
  const dx: Array<number | null> = [];

  for (let index = 0; index < series.candles.length; index += 1) {
    if (index < period) {
      pdi.push(null);
      mdi.push(null);
      dx.push(null);
      continue;
    }

    const plus = sumSlice(plusDm, index - period + 1, index + 1);
    const minus = sumSlice(minusDm, index - period + 1, index + 1);
    const trueRange = sumSlice(tr, index - period + 1, index + 1);
    const plusDi = trueRange === 0 ? 0 : (plus / trueRange) * 100;
    const minusDi = trueRange === 0 ? 0 : (minus / trueRange) * 100;
    const totalDi = plusDi + minusDi;

    pdi.push(plusDi);
    mdi.push(minusDi);
    dx.push(totalDi === 0 ? 0 : (Math.abs(plusDi - minusDi) / totalDi) * 100);
  }

  const adx = averageNullable(dx, period);

  return {
    outputs: [
      lineOutput("DMI-PDI", "PDI", definition.panelId, pointsFromValues(pointTimes, pdi), "#16a34a"),
      lineOutput("DMI-MDI", "MDI", definition.panelId, pointsFromValues(pointTimes, mdi), "#dc2626"),
      lineOutput("DMI-ADX", "ADX", definition.panelId, pointsFromValues(pointTimes, adx), "#2563eb")
    ]
  };
}

function calculateObv(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const pointTimes = times(series);
  const values: number[] = [];
  let obv = 0;

  for (let index = 0; index < series.candles.length; index += 1) {
    if (index > 0) {
      const current = series.candles[index];
      const previous = series.candles[index - 1];

      if (current.close > previous.close) {
        obv += current.volume;
      } else if (current.close < previous.close) {
        obv -= current.volume;
      }
    }

    values.push(obv);
  }

  return {
    outputs: [
      lineOutput("OBV", "OBV", definition.panelId, pointsFromValues(pointTimes, values), "#2563eb"),
      lineOutput(
        "OBV-MA",
        `OBVMA${period}`,
        definition.panelId,
        pointsFromValues(pointTimes, simpleAverageValues(values, period)),
        "#f59e0b"
      )
    ]
  };
}

function calculateVr(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const pointTimes = times(series);
  const values: Array<number | null> = [];

  for (let index = 0; index < series.candles.length; index += 1) {
    if (index < period) {
      values.push(null);
      continue;
    }

    let rising = 0;
    let falling = 0;
    let flat = 0;

    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const current = series.candles[cursor];
      const previous = series.candles[cursor - 1];

      if (current.close > previous.close) {
        rising += current.volume;
      } else if (current.close < previous.close) {
        falling += current.volume;
      } else {
        flat += current.volume;
      }
    }

    const denominator = falling + flat / 2;

    values.push(denominator === 0 ? 100 : ((rising + flat / 2) / denominator) * 100);
  }

  return {
    outputs: [
      lineOutput("VR", `VR${period}`, definition.panelId, pointsFromValues(pointTimes, values), "#2563eb")
    ]
  };
}

function calculateWr(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const pointTimes = times(series);
  const values: Array<number | null> = [];

  for (let index = 0; index < series.candles.length; index += 1) {
    if (index < period - 1) {
      values.push(null);
      continue;
    }

    const window = series.candles.slice(index - period + 1, index + 1);
    const highestHigh = Math.max(...window.map((candle) => candle.high));
    const lowestLow = Math.min(...window.map((candle) => candle.low));
    const range = highestHigh - lowestLow;

    values.push(range === 0 ? 0 : ((highestHigh - series.candles[index].close) / range) * -100);
  }

  return {
    outputs: [
      lineOutput("WR", `WR${period}`, definition.panelId, pointsFromValues(pointTimes, values), "#2563eb")
    ]
  };
}

function calculateMtm(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const period = positiveInteger(params.period, "period");
  const pointTimes = times(series);
  const closes = closeValues(series);
  const values = closes.map((close, index) => (index < period ? null : close - closes[index - period]));

  return {
    outputs: [
      lineOutput("MTM", `MTM${period}`, definition.panelId, pointsFromValues(pointTimes, values), "#2563eb")
    ]
  };
}

function calculateSar(
  series: CandleSeries,
  definition: CoreIndicatorDefinition,
  params: Record<string, number>
): IndicatorResult {
  const step = normalizeSarRatio(positiveNumber(params.step, "step"));
  const max = normalizeSarRatio(positiveNumber(params.max, "max"));
  const marks = calculateSarMarks(series.candles, definition.panelId, step, max);

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

function emaValues(values: number[], period: number): number[] {
  if (values.length === 0) {
    return [];
  }

  const alpha = 2 / (period + 1);
  const result: number[] = [];
  let previous = values[0];

  for (const value of values) {
    previous = result.length === 0 ? value : alpha * value + (1 - alpha) * previous;
    result.push(previous);
  }

  return result;
}

function smoothedValues(values: number[], period: number): number[] {
  if (values.length === 0) {
    return [];
  }

  const result: number[] = [];
  let previous = values[0];

  for (const value of values) {
    previous = result.length === 0 ? value : (value + (period - 1) * previous) / period;
    result.push(previous);
  }

  return result;
}

function simpleAverageValues(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = [];
  let sum = 0;

  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];

    if (index >= period) {
      sum -= values[index - period];
    }

    result.push(index >= period - 1 ? sum / period : null);
  }

  return result;
}

function averageNullable(values: Array<number | null>, period: number): Array<number | null> {
  return values.map((_value, index) => {
    if (index < period - 1) {
      return null;
    }

    const window = values.slice(index - period + 1, index + 1);

    if (window.some((value) => value === null)) {
      return null;
    }

    let sum = 0;

    for (const value of window) {
      if (value === null) {
        return null;
      }

      sum += value;
    }

    return sum / period;
  });
}

function sumSlice(values: number[], start: number, end: number): number {
  let sum = 0;

  for (let index = start; index < end; index += 1) {
    sum += values[index] ?? 0;
  }

  return sum;
}

function normalizeSarRatio(value: number): number {
  return value > 1 ? value / 100 : value;
}

function calculateSarMarks(
  candles: Candle[],
  panelId: string,
  step: number,
  max: number
): ChartMark[] {
  if (candles.length === 0) {
    return [];
  }

  let rising = candles.length === 1 || candles[1].close >= candles[0].close;
  let sar = rising ? candles[0].low : candles[0].high;
  let extreme = rising ? candles[0].high : candles[0].low;
  let acceleration = step;

  return candles.map((candle, index) => {
    if (index > 0) {
      sar += acceleration * (extreme - sar);

      if (rising) {
        const previousLow = candles[index - 1].low;
        const priorLow = candles[index - 2]?.low ?? previousLow;

        sar = Math.min(sar, previousLow, priorLow);

        if (candle.low < sar) {
          rising = false;
          sar = extreme;
          extreme = candle.low;
          acceleration = step;
        } else if (candle.high > extreme) {
          extreme = candle.high;
          acceleration = Math.min(acceleration + step, max);
        }
      } else {
        const previousHigh = candles[index - 1].high;
        const priorHigh = candles[index - 2]?.high ?? previousHigh;

        sar = Math.max(sar, previousHigh, priorHigh);

        if (candle.high > sar) {
          rising = true;
          sar = extreme;
          extreme = candle.high;
          acceleration = step;
        } else if (candle.low < extreme) {
          extreme = candle.low;
          acceleration = Math.min(acceleration + step, max);
        }
      }
    }

    return {
      id: `SAR-${index}`,
      time: candle.time,
      index,
      price: sar,
      direction: rising ? "below" : "above",
      label: "SAR",
      metadata: { panelId }
    };
  });
}
