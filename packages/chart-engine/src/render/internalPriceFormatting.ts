import { formatPriceScaleTick, type PriceScale } from "../viewport/priceScale";

export function formatPriceScaleTickForRender(
  price: number,
  scale: PriceScale,
  formatPrice?: (price: number) => string
): string {
  return scale.mode === "percentage"
    ? formatPriceScaleTick(price, scale)
    : formatPrice?.(price) ?? formatPriceScaleTick(price, scale);
}
