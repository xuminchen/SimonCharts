export type ThemeMode = "light" | "dark";
export type CandleColorScheme = "aShare" | "international";
export type VolumeColorMode = "fixed" | "followCandle";
export type ChartDensity = "compact" | "comfortable";

export interface ChartSettings {
  themeMode: ThemeMode;
  candleColorScheme: CandleColorScheme;
  gridVisible: boolean;
  volumeColorMode: VolumeColorMode;
  density: ChartDensity;
}

export const defaultChartSettings: ChartSettings = {
  themeMode: "light",
  candleColorScheme: "international",
  gridVisible: true,
  volumeColorMode: "followCandle",
  density: "comfortable"
};

export function mergeChartSettings(
  base: ChartSettings,
  override: Partial<ChartSettings>
): ChartSettings {
  return {
    ...base,
    ...override
  };
}
