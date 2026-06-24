import type { IndicatorVisualOutput } from "@simoncharts/chart-engine";

const dayMs = 24 * 60 * 60 * 1_000;
const startTime = Date.UTC(2026, 0, 1);

function timeAt(index: number): number {
  return startTime + index * dayMs;
}

export const playgroundVisualOutputs: IndicatorVisualOutput[] = [
  {
    type: "line",
    id: "playground-main-line",
    label: "Main Line",
    panelId: "main",
    color: "#2563eb",
    lineWidth: 2,
    values: [
      { time: timeAt(72), value: 116 },
      { time: timeAt(80), value: 118 },
      { time: timeAt(88), value: 113 },
      { time: timeAt(96), value: 121 },
      { time: timeAt(104), value: 117 },
      { time: timeAt(112), value: 123 },
      { time: timeAt(118), value: 119 }
    ]
  },
  {
    type: "band",
    id: "playground-main-band",
    label: "Main Band",
    panelId: "main",
    fill: "rgba(37, 99, 235, 0.14)",
    upper: [
      { time: timeAt(72), value: 119 },
      { time: timeAt(80), value: 121 },
      { time: timeAt(88), value: 116 },
      { time: timeAt(96), value: 124 },
      { time: timeAt(104), value: 120 },
      { time: timeAt(112), value: 126 },
      { time: timeAt(118), value: 122 }
    ],
    lower: [
      { time: timeAt(72), value: 111 },
      { time: timeAt(80), value: 113 },
      { time: timeAt(88), value: 108 },
      { time: timeAt(96), value: 116 },
      { time: timeAt(104), value: 112 },
      { time: timeAt(112), value: 118 },
      { time: timeAt(118), value: 114 }
    ]
  },
  {
    type: "histogram",
    id: "playground-sub-histogram",
    label: "Sub Histogram",
    panelId: "sub",
    values: [
      { time: timeAt(72), value: -4, color: "#dc2626" },
      { time: timeAt(80), value: 6, color: "#059669" },
      { time: timeAt(88), value: -3, color: "#dc2626" },
      { time: timeAt(96), value: 8, color: "#059669" },
      { time: timeAt(104), value: 2, color: "#059669" },
      { time: timeAt(112), value: -5, color: "#dc2626" },
      { time: timeAt(118), value: 7, color: "#059669" }
    ]
  },
  {
    type: "marker",
    id: "playground-main-marker",
    label: "Main Marker",
    panelId: "main",
    marks: [
      {
        id: "playground-marker-1",
        time: timeAt(104),
        price: 120,
        label: "M",
        color: "#db2777"
      }
    ]
  }
];
