import type { VisualAutoscaleRange } from "./visualTypes";

export function mergeVisualAutoscaleRanges(
  ranges: Array<VisualAutoscaleRange | undefined>
): VisualAutoscaleRange | undefined {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const range of ranges) {
    if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) {
      continue;
    }

    min = Math.min(min, range.min);
    max = Math.max(max, range.max);
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : undefined;
}
