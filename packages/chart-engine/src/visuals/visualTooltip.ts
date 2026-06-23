export function formatVisualValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
