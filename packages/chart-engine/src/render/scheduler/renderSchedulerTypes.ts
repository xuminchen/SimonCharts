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

export const defaultRenderPassOrder: RenderPass[] = ["static", "dynamic", "overlay"];

export const renderLayerPasses: Record<RenderLayerId, RenderPass[]> = {
  grid: ["static"],
  axis: ["static"],
  series: ["static"],
  volume: ["static"],
  indicators: ["static"],
  visuals: ["static"],
  drawings: ["static", "dynamic"],
  crosshair: ["overlay"],
  tooltip: ["overlay"]
};
