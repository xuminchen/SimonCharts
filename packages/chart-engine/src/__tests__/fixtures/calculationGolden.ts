// Extracted from read-only BASE 1fb9ccbdf453ec8e769fcfc8ee151c8b2fe15e65 and
// manually reviewed. Runtime tests consume only this static object; they never load BASE code.
const times = [1_000, 2_000, 3_000, 4_000, 5_000, 6_000, 7_000, 8_000, 9_000];
const sourceCandles = [
  { volume: 100, turnover: 1_000 },
  { volume: 120, turnover: 1_680 },
  { volume: 80, turnover: 960 },
  { volume: 140, turnover: 2_240 },
  { volume: 160, turnover: 1_760 },
  { volume: 180, turnover: 1_440 },
  { volume: 200, turnover: 2_600 },
  { volume: 220, turnover: 1_980 },
  { volume: 90, turnover: 810 }
];

export const baseCalculationGolden = deepFreeze({
  series: {
    symbol: "BASE-GOLDEN",
    timeframe: "1d",
    adjustMode: "none",
    dataVersion: "base-1fb9ccb",
    candles: [
      { time: 1_000, open: 10, high: 11, low: 9, close: 10, volume: 100, turnover: 1_000 },
      { time: 2_000, open: 10, high: 15, low: 9.5, close: 14, volume: 120, turnover: 1_680 },
      { time: 3_000, open: 14, high: 14.5, low: 11, close: 12, volume: 80, turnover: 960 },
      { time: 4_000, open: 12, high: 17, low: 11.5, close: 16, volume: 140, turnover: 2_240 },
      { time: 5_000, open: 16, high: 16.5, low: 10, close: 11, volume: 160, turnover: 1_760 },
      { time: 6_000, open: 11, high: 12, low: 7, close: 8, volume: 180, turnover: 1_440 },
      { time: 7_000, open: 8, high: 14, low: 7.5, close: 13, volume: 200, turnover: 2_600 },
      { time: 8_000, open: 13, high: 13.5, low: 8, close: 9, volume: 220, turnover: 1_980 },
      { time: 9_000, open: 9, high: 10, low: 8, close: 9, volume: 90, turnover: 810 }
    ]
  },
  indicators: [
    {
      id: "MA",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "MA",
            label: "MA2",
            panelId: "main",
            values: points([null, 12, 13, 14, 13.5, 9.5, 10.5, 11, 9]),
            color: "#f59e0b"
          }
        ]
      }
    },
    {
      id: "EMA",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "EMA",
            label: "EMA2",
            panelId: "main",
            values: points([
              10,
              12.666666666666666,
              12.222222222222221,
              14.74074074074074,
              12.246913580246915,
              9.415637860082306,
              11.805212620027435,
              9.935070873342479,
              9.31169029111416
            ]),
            color: "#22c55e"
          }
        ]
      }
    },
    {
      id: "SMA",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "SMA",
            label: "SMA2",
            panelId: "main",
            values: points([10, 12, 12, 14, 12.5, 10.25, 11.625, 10.3125, 9.65625]),
            color: "#38bdf8"
          }
        ]
      }
    },
    {
      id: "VOL",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "histogram",
            id: "VOL",
            label: "Volume",
            panelId: "VOL",
            values: histogram([
              [100, "#16a34a"],
              [120, "#16a34a"],
              [80, "#dc2626"],
              [140, "#16a34a"],
              [160, "#dc2626"],
              [180, "#dc2626"],
              [200, "#16a34a"],
              [220, "#dc2626"],
              [90, "#16a34a"]
            ])
          },
          {
            type: "line",
            id: "VOL-MA",
            label: "VMA2",
            panelId: "VOL",
            values: points([null, 110, 100, 110, 150, 170, 190, 210, 155]),
            color: "#f59e0b"
          }
        ]
      }
    },
    {
      id: "MACD",
      params: { fast: 2, slow: 3, signal: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "MACD-DIF",
            label: "DIF",
            panelId: "MACD",
            values: points([
              0,
              0.6666666666666661,
              0.22222222222222143,
              0.7407407407407405,
              -0.2530864197530853,
              -0.8343621399176939,
              0.18021262002743477,
              -0.37742912665752115,
              -0.3445597088858392
            ]),
            color: "#2563eb"
          },
          {
            type: "line",
            id: "MACD-DEA",
            label: "DEA",
            panelId: "MACD",
            values: points([
              0,
              0.44444444444444403,
              0.2962962962962956,
              0.5925925925925922,
              0.028806584362140564,
              -0.5466392318244157,
              -0.06207133058984873,
              -0.2723098613016303,
              -0.3204764263577696
            ]),
            color: "#f97316"
          },
          {
            type: "histogram",
            id: "MACD-HISTOGRAM",
            label: "MACD",
            panelId: "MACD",
            values: histogram([
              [0, "#16a34a"],
              [0.4444444444444441, "#16a34a"],
              [-0.14814814814814836, "#dc2626"],
              [0.2962962962962965, "#16a34a"],
              [-0.5637860082304518, "#dc2626"],
              [-0.5754458161865565, "#dc2626"],
              [0.484567901234567, "#16a34a"],
              [-0.21023853071178167, "#dc2626"],
              [-0.048166565056139254, "#dc2626"]
            ])
          }
        ]
      }
    },
    {
      id: "BOLL",
      params: { period: 2, deviation: 2 },
      expected: {
        outputs: [
          {
            type: "band",
            id: "BOLL-BAND",
            label: "BOLL",
            panelId: "main",
            upper: points([null, 16, 15, 18, 18.5, 12.5, 15.5, 15, 9]),
            lower: points([null, 8, 11, 10, 8.5, 6.5, 5.5, 7, 9]),
            fill: "rgba(37, 99, 235, 0.14)"
          },
          {
            type: "line",
            id: "BOLL-MID",
            label: "BOLL2",
            panelId: "main",
            values: points([null, 12, 13, 14, 13.5, 9.5, 10.5, 11, 9]),
            color: "#2563eb"
          }
        ]
      }
    },
    {
      id: "KDJ",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "KDJ-K",
            label: "K",
            panelId: "KDJ",
            values: points([
              null,
              61.111111111111114,
              55.89225589225589,
              65.03928170594837,
              48.12142589920367,
              35.589722529293674,
              52.29791025762435,
              42.5575811973906,
              34.43232685886646
            ]),
            color: "#2563eb"
          },
          {
            type: "line",
            id: "KDJ-D",
            label: "D",
            panelId: "KDJ",
            values: points([
              null,
              53.7037037037037,
              54.43322109988776,
              57.9685746352413,
              54.68619172322875,
              48.320701991917055,
              49.646438080486156,
              47.28348578612097,
              42.9997661437028
            ]),
            color: "#f97316"
          },
          {
            type: "line",
            id: "KDJ-J",
            label: "J",
            panelId: "KDJ",
            values: points([
              null,
              75.92592592592594,
              58.81032547699215,
              79.18069584736249,
              34.99189425115351,
              10.127763604046905,
              57.60085461190074,
              33.10577201992986,
              17.29744828919378
            ]),
            color: "#7c3aed"
          }
        ]
      }
    },
    {
      id: "RSI",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "RSI",
            label: "RSI2",
            panelId: "RSI",
            values: points([null, null, 66.66666666666666, 66.66666666666666, 44.44444444444444, 0, 62.50000000000001, 55.55555555555556, 0]),
            color: "#2563eb"
          }
        ]
      }
    },
    {
      id: "BIAS",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "BIAS",
            label: "BIAS2",
            panelId: "BIAS",
            values: points([null, 16.666666666666664, -7.6923076923076925, 14.285714285714285, -18.51851851851852, -15.789473684210526, 23.809523809523807, -18.181818181818183, 0]),
            color: "#2563eb"
          }
        ]
      }
    },
    {
      id: "CCI",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "CCI",
            label: "CCI2",
            panelId: "CCI",
            values: points([null, 66.66666666666663, -66.66666666666703, 66.66666666666661, -66.66666666666671, -66.66666666666667, 66.66666666666667, -66.66666666666659, -66.66666666666656]),
            color: "#2563eb"
          }
        ]
      }
    },
    {
      id: "DMI",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "DMI-PDI",
            label: "PDI",
            panelId: "DMI",
            values: points([null, null, 44.44444444444444, 27.77777777777778, 20.833333333333336, 0, 17.391304347826086, 16.666666666666664, 0]),
            color: "#16a34a"
          },
          {
            type: "line",
            id: "DMI-MDI",
            label: "MDI",
            panelId: "DMI",
            values: points([null, null, 0, 0, 12.5, 39.130434782608695, 26.08695652173913, 0, 0]),
            color: "#dc2626"
          },
          {
            type: "line",
            id: "DMI-ADX",
            label: "ADX",
            panelId: "DMI",
            values: points([null, null, null, 100, 62.5, 62.5, 60, 60, 50]),
            color: "#2563eb"
          }
        ]
      }
    },
    {
      id: "OBV",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "OBV",
            label: "OBV",
            panelId: "OBV",
            values: points([0, 120, 40, 180, 20, -160, 40, -180, -180]),
            color: "#2563eb"
          },
          {
            type: "line",
            id: "OBV-MA",
            label: "OBVMA2",
            panelId: "OBV",
            values: points([null, 60, 80, 110, 100, -70, -60, -70, -180]),
            color: "#f59e0b"
          }
        ]
      }
    },
    {
      id: "VR",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "VR",
            label: "VR2",
            panelId: "VR",
            values: points([null, null, 150, 175, 87.5, 0, 111.11111111111111, 90.9090909090909, 16.9811320754717]),
            color: "#2563eb"
          }
        ]
      }
    },
    {
      id: "WR",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "WR",
            label: "WR2",
            panelId: "WR",
            values: points([null, -16.666666666666664, -54.54545454545454, -16.666666666666664, -85.71428571428571, -89.47368421052632, -14.285714285714285, -76.92307692307693, -81.81818181818183]),
            color: "#2563eb"
          }
        ]
      }
    },
    {
      id: "MTM",
      params: { period: 2 },
      expected: {
        outputs: [
          {
            type: "line",
            id: "MTM",
            label: "MTM2",
            panelId: "MTM",
            values: points([null, null, 2, 2, -1, -8, 2, 1, -4]),
            color: "#2563eb"
          }
        ]
      }
    },
    {
      id: "SAR",
      params: { step: 2, max: 20 },
      expected: {
        outputs: [
          {
            type: "marker",
            id: "SAR",
            label: "SAR",
            panelId: "main",
            marks: [
              mark(0, 9, "below"),
              mark(1, 9, "below"),
              mark(2, 9, "below"),
              mark(3, 9.24, "below"),
              mark(4, 9.7056, "below"),
              mark(5, 17, "above"),
              mark(6, 16.8, "above"),
              mark(7, 16.604, "above"),
              mark(8, 16.41192, "above")
            ]
          }
        ]
      }
    }
  ],
  transforms: [
    {
      type: "heikinAshi",
      options: {},
      sourceIndexOffset: 0,
      expected: [
        { time: 1_000, open: 10, high: 11, low: 9, close: 10, volume: 100, turnover: 1_000, sourceIndex: 0 },
        { time: 2_000, open: 10, high: 15, low: 9.5, close: 12.125, volume: 120, turnover: 1_680, sourceIndex: 1 },
        { time: 3_000, open: 11.0625, high: 14.5, low: 11, close: 12.875, volume: 80, turnover: 960, sourceIndex: 2 },
        { time: 4_000, open: 11.96875, high: 17, low: 11.5, close: 14.125, volume: 140, turnover: 2_240, sourceIndex: 3 },
        { time: 5_000, open: 13.046875, high: 16.5, low: 10, close: 13.375, volume: 160, turnover: 1_760, sourceIndex: 4 },
        { time: 6_000, open: 13.2109375, high: 13.2109375, low: 7, close: 9.5, volume: 180, turnover: 1_440, sourceIndex: 5 },
        { time: 7_000, open: 11.35546875, high: 14, low: 7.5, close: 10.625, volume: 200, turnover: 2_600, sourceIndex: 6 },
        { time: 8_000, open: 10.990234375, high: 13.5, low: 8, close: 10.875, volume: 220, turnover: 1_980, sourceIndex: 7 },
        { time: 9_000, open: 10.9326171875, high: 10.9326171875, low: 8, close: 9, volume: 90, turnover: 810, sourceIndex: 8 }
      ]
    },
    {
      type: "renko",
      options: { brickSize: 2 },
      sourceIndexOffset: 0,
      expected: [
        rangePoint(2_000, 10, 12, 1, 0, 1),
        rangePoint(2_000, 12, 14, 1, 1, 1),
        rangePoint(3_000, 14, 12, 2, 1, 2),
        rangePoint(4_000, 12, 14, 3, 2, 3),
        rangePoint(4_000, 14, 16, 3, 3, 3),
        rangePoint(5_000, 16, 14, 4, 3, 4),
        rangePoint(5_000, 14, 12, 4, 4, 4),
        rangePoint(6_000, 12, 10, 5, 4, 5),
        rangePoint(6_000, 10, 8, 5, 5, 5),
        rangePoint(7_000, 8, 10, 6, 5, 6),
        rangePoint(7_000, 10, 12, 6, 6, 6),
        rangePoint(8_000, 12, 10, 7, 6, 7)
      ]
    },
    {
      type: "lineBreak",
      options: { lineCount: 2 },
      sourceIndexOffset: 0,
      expected: [
        syntheticPoint(0, 10, 10),
        syntheticPoint(1, 10, 14),
        syntheticPoint(3, 14, 16),
        syntheticPoint(4, 16, 11),
        syntheticPoint(5, 11, 8),
        syntheticPoint(6, 8, 13)
      ]
    },
    {
      type: "kagi",
      options: { reversalAmount: 2 },
      sourceIndexOffset: 0,
      expected: [
        syntheticPoint(0, 10, 10),
        syntheticPoint(1, 10, 14),
        syntheticPoint(2, 14, 12),
        syntheticPoint(3, 12, 16),
        syntheticPoint(4, 16, 11),
        syntheticPoint(5, 11, 8),
        syntheticPoint(6, 8, 13),
        syntheticPoint(7, 13, 9)
      ]
    },
    {
      type: "pointAndFigure",
      options: { boxSize: 1, reversalBoxes: 3 },
      sourceIndexOffset: 0,
      expected: [
        rangePoint(4_000, 10, 16, 3, 0, 3),
        rangePoint(6_000, 16, 8, 5, 3, 5),
        rangePoint(7_000, 8, 13, 6, 5, 6),
        rangePoint(8_000, 13, 9, 7, 6, 7)
      ]
    }
  ]
});

function points(values: Array<number | null>): Array<{ time: number; value: number | null }> {
  return values.map((value, index) => ({ time: times[index], value }));
}

function histogram(
  values: Array<[number, string]>
): Array<{ time: number; value: number; color: string }> {
  return values.map(([value, color], index) => ({ time: times[index], value, color }));
}

function mark(index: number, price: number, direction: "above" | "below") {
  return {
    id: `SAR-${index}`,
    time: times[index],
    index,
    price,
    direction,
    label: "SAR",
    metadata: { panelId: "main" }
  };
}

function rangePoint(
  time: number,
  open: number,
  close: number,
  sourceIndex: number,
  from: number,
  to: number
) {
  return {
    time,
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
    sourceIndex,
    sourceRange: { from, to }
  };
}

function syntheticPoint(index: number, open: number, close: number) {
  return {
    time: times[index],
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
    volume: sourceCandles[index].volume,
    turnover: sourceCandles[index].turnover,
    sourceIndex: index
  };
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
