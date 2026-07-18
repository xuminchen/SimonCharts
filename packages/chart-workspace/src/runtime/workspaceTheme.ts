import { defaultChartTheme, type ChartTheme } from "@simoncharts/chart-engine";

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
      tooltip: { background: variable(style, "--sc-surface", "#15171c"), text, border }
    },
    lineDashes: { grid: [1, 3] }
  };
}
