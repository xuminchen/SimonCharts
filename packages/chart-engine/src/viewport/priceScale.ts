import type { CandleSeries } from "../model/market";
import type { PriceScaleMode, VisibleRange } from "../model/runtime";
import { computeVisiblePriceBounds } from "./priceRange";

export interface PriceScale {
  mode: PriceScaleMode;
  basePrice: number;
  min: number;
  max: number;
}

export function createPriceScale(
  series: CandleSeries,
  visibleRange: VisibleRange,
  mode: PriceScaleMode
): PriceScale {
  const raw = computeVisiblePriceBounds(series, visibleRange);
  const first = series.candles[Math.max(0, visibleRange.from)];
  const basePrice = first?.close ?? 1;

  return createPriceScaleFromBounds(raw, basePrice, mode);
}

export function createPriceScaleFromBounds(
  raw: { min: number; max: number },
  basePrice: number,
  mode: PriceScaleMode
): PriceScale {
  if (mode === "log" && raw.min <= 0) {
    throw new Error("Log price scale requires positive prices");
  }
  if (mode === "percentage" && basePrice <= 0) {
    throw new Error("Percentage price scale requires a positive base price");
  }

  const provisional: PriceScale = { mode, basePrice, min: 0, max: 1 };
  const transformedMin = priceToScaleValue(raw.min, provisional);
  const transformedMax = priceToScaleValue(raw.max, provisional);
  const span = transformedMax - transformedMin;
  const padding = span === 0 ? Math.max(Math.abs(transformedMax), 1) * 0.05 : span * 0.05;

  return {
    mode,
    basePrice,
    min: transformedMin - padding,
    max: transformedMax + padding
  };
}

export function priceToScaleValue(price: number, scale: PriceScale): number {
  if (scale.mode === "linear") return price;
  if (scale.mode === "log") {
    if (price <= 0) throw new Error("Log price scale requires positive prices");
    return Math.log(price);
  }
  return (price / scale.basePrice - 1) * 100;
}

export function scaleValueToPrice(value: number, scale: PriceScale): number {
  if (scale.mode === "linear") return value;
  if (scale.mode === "log") return Math.exp(value);
  return scale.basePrice * (1 + value / 100);
}

export function priceToY(
  price: number,
  scale: PriceScale,
  plotTop: number,
  plotHeight: number
): number {
  const value = priceToScaleValue(price, scale);
  const span = scale.max - scale.min;
  return span === 0
    ? plotTop + plotHeight / 2
    : plotTop + ((scale.max - value) / span) * plotHeight;
}

export function yToPrice(
  y: number,
  scale: PriceScale,
  plotTop: number,
  plotHeight: number
): number {
  const span = scale.max - scale.min;
  const value = span === 0
    ? scale.min
    : scale.max - ((y - plotTop) / plotHeight) * span;
  return scaleValueToPrice(value, scale);
}

export function formatPriceScaleTick(price: number, scale: PriceScale): string {
  if (scale.mode === "percentage") {
    return `${priceToScaleValue(price, scale).toFixed(2)}%`;
  }
  return Number.isInteger(price) ? String(price) : price.toFixed(2);
}
