import { defaultChartTheme, type ChartTheme } from "@simoncharts/chart-engine";
import type { ChartThemeOverrides } from "../contracts";

const themeVariables = {
  backgroundColor: "--sc-bg",
  surfaceColor: "--sc-surface",
  surfaceHoverColor: "--sc-surface-hover",
  borderColor: "--sc-border",
  gridColor: "--sc-grid",
  textColor: "--sc-text",
  mutedTextColor: "--sc-muted",
  accentColor: "--sc-accent",
  upColor: "--sc-up",
  downColor: "--sc-down",
  intradayAverageColor: "--sc-intraday-average"
} as const satisfies Record<keyof ChartThemeOverrides, `--sc-${string}`>;

function variable(style: Pick<CSSStyleDeclaration, "getPropertyValue">, name: string, fallback: string): string {
  const value = style.getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

export function readWorkspaceChartTheme(
  root: Element,
  style: Pick<CSSStyleDeclaration, "getPropertyValue"> = getComputedStyle(root)
): ChartTheme {
  const text = variable(style, "--sc-text", "#d8dbe4");
  const border = variable(style, "--sc-border", "#282b33");
  return {
    ...defaultChartTheme,
    colors: {
      ...defaultChartTheme.colors,
      background: variable(style, "--sc-bg", "#08090d"),
      grid: variable(style, "--sc-grid", "rgba(118, 126, 148, 0.16)"),
      text,
      bullishCandle: variable(style, "--sc-up", "#f04455"),
      bearishCandle: variable(style, "--sc-down", "#00aa91"),
      volume: variable(style, "--sc-muted", "#858b9a"),
      crosshair: variable(style, "--sc-muted", "#858b9a"),
      panelSeparator: border,
      selectedDrawing: variable(style, "--sc-accent", "#6266f1"),
      hoveredDrawing: variable(style, "--sc-accent", "#6266f1"),
      maLines: [
        variable(style, "--sc-intraday-average", "#d6a700"),
        ...defaultChartTheme.colors.maLines.slice(1)
      ],
      tooltip: { background: variable(style, "--sc-surface", "#15171c"), text, border }
    },
    lineDashes: { grid: [1, 3] }
  };
}

export function applyWorkspaceThemeOverrides(
  root: HTMLElement,
  overrides: Readonly<ChartThemeOverrides>
): void {
  for (const [field, variableName] of Object.entries(themeVariables)) {
    const value = overrides[field as keyof ChartThemeOverrides];
    if (value === undefined) root.style.removeProperty(variableName);
    else root.style.setProperty(variableName, value);
  }
}
