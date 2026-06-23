import type { VisualHitTestResult } from "./visualTypes";

export function chooseNearestVisualHit(
  hits: Array<VisualHitTestResult | undefined>
): VisualHitTestResult | undefined {
  let nearestHit: VisualHitTestResult | undefined;

  for (const hit of hits) {
    if (!hit) {
      continue;
    }

    if (!nearestHit || hit.distance < nearestHit.distance) {
      nearestHit = hit;
    }
  }

  return nearestHit;
}
