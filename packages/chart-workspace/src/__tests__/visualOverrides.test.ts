import { describe, expect, it } from "vitest";
import type { IndicatorVisualOutput } from "@simoncharts/chart-engine";
import type { ChartStudyOutputVisualOverride } from "../contracts";
import { applyStudyVisualOverrides } from "../runtime/visualOverrides";
import { indicatorOutputId } from "../runtime/indicatorRuntime";

const instanceId = 'study:"one"';

function outputs(): IndicatorVisualOutput[] {
  return [
    {
      type: "line",
      id: indicatorOutputId(instanceId, "LINE"),
      label: "Line",
      color: "#111111",
      lineWidth: 1,
      values: [{ time: 1, value: 10 }]
    },
    {
      type: "histogram",
      id: indicatorOutputId(instanceId, "HISTOGRAM"),
      label: "Histogram",
      values: [{ time: 1, value: 2, color: "#222222" }]
    },
    {
      type: "band",
      id: indicatorOutputId(instanceId, "BAND"),
      label: "Band",
      fill: "#333333",
      upper: [{ time: 1, value: 12 }],
      lower: [{ time: 1, value: 8 }]
    },
    {
      type: "marker",
      id: indicatorOutputId(instanceId, "MARKER"),
      label: "Marker",
      marks: [{ id: "mark", time: 1, price: 10, color: "#444444" }]
    }
  ];
}

describe("study visual overrides", () => {
  it("applies type-specific styles and visibility to scoped outputs", () => {
    const overrides: readonly ChartStudyOutputVisualOverride[] = [
      {
        outputId: "LINE",
        type: "line",
        visible: false,
        color: "#aaaaaa",
        lineWidth: 3
      },
      {
        outputId: "HISTOGRAM",
        type: "histogram",
        visible: false,
        color: "#bbbbbb"
      },
      {
        outputId: "BAND",
        type: "band",
        visible: false,
        fill: "#cccccc"
      },
      {
        outputId: "MARKER",
        type: "marker",
        visible: false,
        color: "#dddddd"
      }
    ];

    expect(applyStudyVisualOverrides(outputs(), instanceId, overrides)).toEqual([
      expect.objectContaining({
        type: "line",
        visible: false,
        color: "#aaaaaa",
        lineWidth: 3
      }),
      expect.objectContaining({
        type: "histogram",
        visible: false,
        values: [{ time: 1, value: 2, color: "#bbbbbb" }]
      }),
      expect.objectContaining({
        type: "band",
        visible: false,
        fill: "#cccccc"
      }),
      expect.objectContaining({
        type: "marker",
        visible: false,
        marks: [{ id: "mark", time: 1, price: 10, color: "#dddddd" }]
      })
    ]);
  });

  it("leaves unspecified properties at their calculated defaults", () => {
    const result = applyStudyVisualOverrides(outputs(), instanceId, [
      { outputId: "LINE", type: "line", visible: false }
    ]);

    expect(result[0]).toMatchObject({
      visible: false,
      color: "#111111",
      lineWidth: 1
    });
  });

  it("does not mutate the source outputs or their nested values", () => {
    const source = outputs();
    const snapshot = structuredClone(source);

    const result = applyStudyVisualOverrides(source, instanceId, [
      { outputId: "HISTOGRAM", type: "histogram", color: "#ffffff" },
      { outputId: "MARKER", type: "marker", color: "#eeeeee" }
    ]);

    expect(source).toEqual(snapshot);
    expect(result).not.toBe(source);
    expect(result[1]).not.toBe(source[1]);
    expect(result[3]).not.toBe(source[3]);
  });

  it("does not apply another study instance's override", () => {
    const source = outputs();

    expect(
      applyStudyVisualOverrides(source, "another-study", [
        { outputId: "LINE", type: "line", color: "#ffffff" }
      ])
    ).toEqual(source);
  });
});
