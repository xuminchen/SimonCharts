export const coreIndicatorIds = [
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

export type CoreIndicatorId = (typeof coreIndicatorIds)[number];

export interface CoreIndicatorParameterDefinition {
  id: string;
  defaultValue: number;
}

export interface CoreIndicatorDefinition {
  id: CoreIndicatorId;
  label: string;
  panelId: string;
  params: CoreIndicatorParameterDefinition[];
}

export const coreIndicatorDefinitions: CoreIndicatorDefinition[] = [
  { id: "MA", label: "Moving Average", panelId: "main", params: [{ id: "period", defaultValue: 5 }] },
  { id: "EMA", label: "Exponential Moving Average", panelId: "main", params: [{ id: "period", defaultValue: 6 }] },
  { id: "SMA", label: "Smoothed Moving Average", panelId: "main", params: [{ id: "period", defaultValue: 12 }] },
  { id: "VOL", label: "Volume", panelId: "VOL", params: [{ id: "period", defaultValue: 5 }] },
  {
    id: "MACD",
    label: "MACD",
    panelId: "MACD",
    params: [
      { id: "fast", defaultValue: 12 },
      { id: "slow", defaultValue: 26 },
      { id: "signal", defaultValue: 9 }
    ]
  },
  {
    id: "BOLL",
    label: "Bollinger Bands",
    panelId: "main",
    params: [
      { id: "period", defaultValue: 20 },
      { id: "deviation", defaultValue: 2 }
    ]
  },
  { id: "KDJ", label: "KDJ", panelId: "KDJ", params: [{ id: "period", defaultValue: 9 }] },
  { id: "RSI", label: "RSI", panelId: "RSI", params: [{ id: "period", defaultValue: 6 }] },
  { id: "BIAS", label: "BIAS", panelId: "BIAS", params: [{ id: "period", defaultValue: 6 }] },
  { id: "CCI", label: "CCI", panelId: "CCI", params: [{ id: "period", defaultValue: 13 }] },
  { id: "DMI", label: "DMI", panelId: "DMI", params: [{ id: "period", defaultValue: 14 }] },
  { id: "OBV", label: "OBV", panelId: "OBV", params: [{ id: "period", defaultValue: 30 }] },
  { id: "VR", label: "VR", panelId: "VR", params: [{ id: "period", defaultValue: 24 }] },
  { id: "WR", label: "WR", panelId: "WR", params: [{ id: "period", defaultValue: 6 }] },
  { id: "MTM", label: "MTM", panelId: "MTM", params: [{ id: "period", defaultValue: 6 }] },
  {
    id: "SAR",
    label: "SAR",
    panelId: "main",
    params: [
      { id: "step", defaultValue: 2 },
      { id: "max", defaultValue: 20 }
    ]
  }
];
