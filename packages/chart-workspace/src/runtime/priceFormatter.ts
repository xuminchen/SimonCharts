export function formatPrice(value: number, precision: number): string {
  const formatted = value.toFixed(precision);
  return Number(formatted) === 0 ? (0).toFixed(precision) : formatted;
}

export function priceFormatter(precision: number | undefined): ((price: number) => string) | undefined {
  return precision === undefined ? undefined : (value) => formatPrice(value, precision);
}
