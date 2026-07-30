import type { IndicatorVisualOutput } from "@simoncharts/chart-engine";
import type { ChartStudyOutputVisualOverride } from "../contracts";
import { indicatorOutputPrefix } from "./indicatorRuntime";

function applyOverride(
  output: IndicatorVisualOutput,
  override: ChartStudyOutputVisualOverride
): IndicatorVisualOutput {
  const visibility = override.visible === undefined
    ? {}
    : { visible: override.visible };

  if (output.type === "line" && override.type === "line") {
    return {
      ...output,
      ...visibility,
      ...(override.color === undefined ? {} : { color: override.color }),
      ...(override.lineWidth === undefined ? {} : { lineWidth: override.lineWidth })
    };
  }
  if (output.type === "histogram" && override.type === "histogram") {
    return {
      ...output,
      ...visibility,
      values: override.color === undefined
        ? output.values
        : output.values.map((point) => ({ ...point, color: override.color }))
    };
  }
  if (output.type === "band" && override.type === "band") {
    return {
      ...output,
      ...visibility,
      ...(override.fill === undefined ? {} : { fill: override.fill })
    };
  }
  if (output.type === "marker" && override.type === "marker") {
    return {
      ...output,
      ...visibility,
      marks: override.color === undefined
        ? output.marks
        : output.marks.map((mark) => ({ ...mark, color: override.color }))
    };
  }
  return output;
}

export function applyStudyVisualOverrides(
  outputs: readonly IndicatorVisualOutput[],
  instanceId: string,
  overrides: readonly ChartStudyOutputVisualOverride[] | undefined
): IndicatorVisualOutput[] {
  const prefix = indicatorOutputPrefix(instanceId);
  const byOutputId = new Map(overrides?.map((override) => [override.outputId, override]));

  return outputs.map((output) => {
    if (!output.id.startsWith(prefix)) return output;
    const override = byOutputId.get(output.id.slice(prefix.length));
    return override === undefined ? output : applyOverride(output, override);
  });
}
