export interface ChartTheme {
  colors: {
    background: string;
    grid: string;
    text: string;
    bullishCandle: string;
    bearishCandle: string;
    volume: string;
    crosshair: string;
    tooltip: {
      background: string;
      text: string;
      border: string;
    };
    maLines: string[];
  };
  typography: {
    fontFamily: string;
    fontSize: number;
  };
  spacing: {
    axisPadding: number;
    panelGap: number;
  };
  lineWidths: {
    grid: number;
    candleWick: number;
    crosshair: number;
    indicator: number;
  };
}

export const defaultChartTheme: ChartTheme = {
  colors: {
    background: "#ffffff",
    grid: "#e5e7eb",
    text: "#1f2937",
    bullishCandle: "#16a34a",
    bearishCandle: "#dc2626",
    volume: "#94a3b8",
    crosshair: "#64748b",
    tooltip: {
      background: "#111827",
      text: "#f9fafb",
      border: "#374151"
    },
    maLines: ["#2563eb", "#d97706", "#7c3aed", "#0891b2"]
  },
  typography: {
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 12
  },
  spacing: {
    axisPadding: 8,
    panelGap: 16
  },
  lineWidths: {
    grid: 1,
    candleWick: 1,
    crosshair: 1,
    indicator: 2
  }
};
