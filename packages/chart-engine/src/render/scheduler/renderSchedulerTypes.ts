export type RenderLayerId =
  | "grid"
  | "axis"
  | "series"
  | "volume"
  | "indicators"
  | "visuals"
  | "drawings"
  | "crosshair"
  | "tooltip";

export type RenderPass = "static" | "dynamic" | "overlay";

export interface RenderInvalidation {
  layers: RenderLayerId[];
  reason: string;
  layoutRequired?: boolean;
  timestamp?: number;
}

export interface RenderMetrics {
  totalRenderCount: number;
  renderCountByPass: Record<RenderPass, number>;
  lastRenderDuration: number;
  dirtyLayerCount: number;
  lastInvalidationReasons: string[];
  slowFrameCount: number;
}

export interface RenderSchedulerState {
  pending: boolean;
  dirtyLayers: RenderLayerId[];
  layoutRequired: boolean;
  metrics: RenderMetrics;
}

export interface CreateRenderSchedulerOptions {
  requestFrame: (callback: () => void) => number;
  cancelFrame?: (frameId: number) => void;
  now?: () => number;
  slowFrameThresholdMs?: number;
  renderPass: (pass: RenderPass, invalidation: RenderInvalidation) => void;
}

export interface RenderScheduler {
  invalidate(invalidation: RenderInvalidation): void;
  flush(): void;
  getState(): RenderSchedulerState;
  destroy(): void;
}

export const defaultRenderPassOrder: readonly RenderPass[] = Object.freeze([
  "static",
  "dynamic",
  "overlay"
]);

export const renderLayerPasses: Readonly<Record<RenderLayerId, readonly RenderPass[]>> = Object.freeze({
  grid: Object.freeze(["static"] as const),
  axis: Object.freeze(["static"] as const),
  series: Object.freeze(["static"] as const),
  volume: Object.freeze(["static"] as const),
  indicators: Object.freeze(["static"] as const),
  visuals: Object.freeze(["static"] as const),
  drawings: Object.freeze(["static", "dynamic"] as const),
  crosshair: Object.freeze(["overlay"] as const),
  tooltip: Object.freeze(["overlay"] as const)
});
