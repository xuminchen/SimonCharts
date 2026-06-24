export interface MagnetPoint {
  x: number;
  y: number;
}

export function snapPointToTargets(
  point: MagnetPoint,
  targets: MagnetPoint[],
  radius: number
): MagnetPoint {
  let best = point;
  let bestDistance = radius;

  for (const target of targets) {
    const distance = Math.hypot(point.x - target.x, point.y - target.y);

    if (distance <= bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }

  return best;
}
