import { describe, expect, it } from "vitest";
import {
  calculateCoreIndicator,
  coreIndicatorDefinitions,
  fixtureDailyCandleSeries,
  type IndicatorVisualOutput
} from "../index";

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
});
