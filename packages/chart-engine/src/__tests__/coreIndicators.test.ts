import { describe, expect, it } from "vitest";
import {
  calculateCoreIndicator,
  coreIndicatorDefinitions,
  type IndicatorBandOutput,
  type IndicatorLineOutput,
  type IndicatorMarkerOutput,
  type IndicatorPoint,
  type IndicatorVisualOutput
} from "../index";
import { fixtureDailyCandleSeries } from "./fixtures/dailyCandles";

const coreIndicatorIds = [
  "MA",
  "EMA",
  "SMA",
  "VOL",
  "MACD",
  "BOLL",
  "KDJ",
  "RSI",
  "BIAS",
  "CCI",
  "DMI",
  "OBV",
  "VR",
  "WR",
  "MTM",
  "SAR"
] as const;

function outputValues(output: IndicatorVisualOutput): Array<{ time: number; value: number | null }> {
  if (output.type === "line") {
    return output.values;
  }

  if (output.type === "histogram") {
    return output.values;
  }

  if (output.type === "band") {
    return output.upper;
  }

  return output.marks.map((mark) => ({ time: mark.time, value: mark.price ?? null }));
}

function expectLine(output: IndicatorVisualOutput, id: string): IndicatorLineOutput {
  expect(output.type).toBe("line");
  expect(output.id).toBe(id);

  if (output.type !== "line") {
    throw new Error(`Expected ${id} to be a line output`);
  }

  return output;
}

function expectBand(output: IndicatorVisualOutput, id: string): IndicatorBandOutput {
  expect(output.type).toBe("band");
  expect(output.id).toBe(id);

  if (output.type !== "band") {
    throw new Error(`Expected ${id} to be a band output`);
  }

  return output;
}

function expectMarker(output: IndicatorVisualOutput, id: string): IndicatorMarkerOutput {
  expect(output.type).toBe("marker");
  expect(output.id).toBe(id);

  if (output.type !== "marker") {
    throw new Error(`Expected ${id} to be a marker output`);
  }

  return output;
}

function expectPointValue(points: IndicatorPoint[], index: number, expected: number): void {
  expect(points[index].time).toBe(fixtureDailyCandleSeries.candles[index].time);
  expect(points[index].value).toBeCloseTo(expected, 5);
}

describe("core indicators", () => {
  it("exposes v0.3 indicator definitions in stable order", () => {
    expect(coreIndicatorDefinitions.map((definition) => definition.id)).toEqual(coreIndicatorIds);
  });

  it("calculates MACD as visual outputs routed to a sub panel", () => {
    const result = calculateCoreIndicator("MACD", fixtureDailyCandleSeries);

    expect(result.outputs.map((output) => output.type)).toEqual(["line", "line", "histogram"]);
    expect(result.outputs.every((output) => output.panelId === "MACD")).toBe(true);
  });

  it("calculates BOLL as main-panel band plus middle line", () => {
    const result = calculateCoreIndicator("BOLL", fixtureDailyCandleSeries);

    expect(result.outputs.map((output) => output.type)).toEqual(["band", "line"]);
    expect(result.outputs.every((output) => output.panelId === "main")).toBe(true);
  });

  it("calculates representative BOLL bands from fixture data", () => {
    const result = calculateCoreIndicator("BOLL", fixtureDailyCandleSeries);
    const band = expectBand(result.outputs[0], "BOLL-BAND");
    const mid = expectLine(result.outputs[1], "BOLL-MID");
    const index = 35;

    expectPointValue(band.upper, index, 113.505313);
    expectPointValue(mid.values, index, 109.001);
    expectPointValue(band.lower, index, 104.496687);
  });

  it("calculates representative KDJ values from fixture data", () => {
    const [kOutput, dOutput, jOutput] = calculateCoreIndicator("KDJ", fixtureDailyCandleSeries).outputs;
    const index = 35;

    expectPointValue(expectLine(kOutput, "KDJ-K").values, index, 75.587973);
    expectPointValue(expectLine(dOutput, "KDJ-D").values, index, 75.49524);
    expectPointValue(expectLine(jOutput, "KDJ-J").values, index, 75.773439);
  });

  it("calculates representative DMI values from fixture data", () => {
    const [pdiOutput, mdiOutput, adxOutput] = calculateCoreIndicator("DMI", fixtureDailyCandleSeries).outputs;
    const index = 35;

    expectPointValue(expectLine(pdiOutput, "DMI-PDI").values, index, 18.59866);
    expectPointValue(expectLine(mdiOutput, "DMI-MDI").values, index, 3.657908);
    expectPointValue(expectLine(adxOutput, "DMI-ADX").values, index, 59.711547);
  });

  it("calculates representative VR, WR, and MTM values from fixture data", () => {
    const index = 35;
    const vr = expectLine(calculateCoreIndicator("VR", fixtureDailyCandleSeries).outputs[0], "VR");
    const wr = expectLine(calculateCoreIndicator("WR", fixtureDailyCandleSeries).outputs[0], "WR");
    const mtm = expectLine(calculateCoreIndicator("MTM", fixtureDailyCandleSeries).outputs[0], "MTM");

    expectPointValue(vr.values, index, 302.624736);
    expectPointValue(wr.values, index, -39.099099);
    expectPointValue(mtm.values, index, 2.96);
  });

  it("calculates representative SAR marks from fixture data", () => {
    const output = expectMarker(calculateCoreIndicator("SAR", fixtureDailyCandleSeries).outputs[0], "SAR");
    const index = 50;
    const mark = output.marks[index];

    expect(mark).toMatchObject({
      id: "SAR-50",
      time: fixtureDailyCandleSeries.candles[index].time,
      index,
      direction: "above"
    });
    expect(mark.price).toBeCloseTo(118.939, 5);
  });

  it("returns deterministic representative values from fixture data", () => {
    const ma = calculateCoreIndicator("MA", fixtureDailyCandleSeries).outputs[0];
    const ema = calculateCoreIndicator("EMA", fixtureDailyCandleSeries).outputs[0];
    const rsi = calculateCoreIndicator("RSI", fixtureDailyCandleSeries).outputs[0];
    const macd = calculateCoreIndicator("MACD", fixtureDailyCandleSeries).outputs;

    expect(ma.type).toBe("line");
    expect(ema.type).toBe("line");
    expect(rsi.type).toBe("line");
    expect(macd[0].type).toBe("line");
    expect(macd[2].type).toBe("histogram");
    if (
      ma.type !== "line" ||
      ema.type !== "line" ||
      rsi.type !== "line" ||
      macd[0].type !== "line" ||
      macd[2].type !== "histogram"
    ) {
      return;
    }

    expect(ma.values[0].value).toBeNull();
    expect(ma.values[4]).toEqual({
      time: fixtureDailyCandleSeries.candles[4].time,
      value: 99.76
    });
    expect(ema.values[25].value).toBeCloseTo(107.632975);
    expect(rsi.values[25].value).toBeCloseTo(57.692308);
    expect(macd[0].values[35].value).toBeCloseTo(2.452236);
    expect(macd[2].values[35].value).toBeCloseTo(0.399687);
  });

  it("calculates every core indicator without throwing and keeps candle time alignment", () => {
    const candleTimes = fixtureDailyCandleSeries.candles.map((candle) => candle.time);

    for (const id of coreIndicatorIds) {
      const definition = coreIndicatorDefinitions.find((item) => item.id === id);
      const result = calculateCoreIndicator(id, fixtureDailyCandleSeries);

      expect(definition).toBeDefined();
      expect(result.outputs.length).toBeGreaterThan(0);

      for (const output of result.outputs) {
        expect(output.id).toMatch(new RegExp(`^${id}`));
        expect(output.label.length).toBeGreaterThan(0);
        expect(output.panelId).toBe(definition?.panelId);

        const values = outputValues(output);

        expect(values.length).toBeGreaterThan(0);
        expect(values.map((point) => point.time)).toEqual(candleTimes);
      }
    }
  });

  it("throws a clear error for unsupported indicator ids", () => {
    expect(() => calculateCoreIndicator("UNKNOWN", fixtureDailyCandleSeries)).toThrow(
      new Error("Unsupported core indicator: UNKNOWN")
    );
  });

  it("throws clear errors for invalid core indicator parameters", () => {
    expect(() => calculateCoreIndicator("MA", fixtureDailyCandleSeries, { period: 0 })).toThrow(
      new Error("period must be greater than 0")
    );
    expect(() => calculateCoreIndicator("MACD", fixtureDailyCandleSeries, { fast: 26, slow: 12 })).toThrow(
      new Error("fast must be less than slow")
    );
    expect(() => calculateCoreIndicator("BOLL", fixtureDailyCandleSeries, { deviation: 0 })).toThrow(
      new Error("deviation must be greater than 0")
    );
    expect(() => calculateCoreIndicator("SAR", fixtureDailyCandleSeries, { step: 0 })).toThrow(
      new Error("step must be greater than 0")
    );
  });
});
