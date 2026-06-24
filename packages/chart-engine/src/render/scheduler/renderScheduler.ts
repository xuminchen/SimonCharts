import {
  defaultRenderPassOrder,
  renderLayerPasses,
  type CreateRenderSchedulerOptions,
  type RenderInvalidation,
  type RenderLayerId,
  type RenderMetrics,
  type RenderPass,
  type RenderScheduler,
  type RenderSchedulerState
} from "./renderSchedulerTypes";

const defaultMetrics: RenderMetrics = {
  totalRenderCount: 0,
  renderCountByPass: { static: 0, dynamic: 0, overlay: 0 },
  lastRenderDuration: 0,
  dirtyLayerCount: 0,
  lastInvalidationReasons: [],
  slowFrameCount: 0
};

const renderLayerOrder: RenderLayerId[] = [
  "grid",
  "axis",
  "series",
  "volume",
  "indicators",
  "visuals",
  "drawings",
  "crosshair",
  "tooltip"
];

export function createRenderScheduler(options: CreateRenderSchedulerOptions): RenderScheduler {
  const now = options.now ?? (() => performance.now());
  const slowFrameThresholdMs = options.slowFrameThresholdMs ?? 16.7;
  const dirtyLayers = new Set<RenderLayerId>();
  const reasons: string[] = [];
  let layoutRequired = false;
  let frameId: number | undefined;
  let destroyed = false;
  let metrics = cloneMetrics(defaultMetrics);

  function schedule(): void {
    if (frameId !== undefined || destroyed) {
      return;
    }

    let callbackRanSynchronously = false;
    let nextFrameId: number | undefined;

    nextFrameId = options.requestFrame(() => {
      callbackRanSynchronously = nextFrameId === undefined;
      if (frameId === nextFrameId) {
        frameId = undefined;
      }
      flush();
    });

    if (!callbackRanSynchronously && !destroyed) {
      frameId = nextFrameId;
    }
  }

  function flush(): void {
    if (destroyed || dirtyLayers.size === 0) {
      return;
    }

    if (frameId !== undefined) {
      options.cancelFrame?.(frameId);
      frameId = undefined;
    }

    const layers = sortLayers([...dirtyLayers]);
    const reasonSnapshot = [...reasons];
    const layoutRequiredSnapshot = layoutRequired;
    const timestamp = now();
    const passes = getPassesForLayers(layers);

    dirtyLayers.clear();
    reasons.length = 0;
    layoutRequired = false;

    const startedAt = now();

    for (const pass of passes) {
      const invalidation = createRenderInvalidation(
        layers,
        reasonSnapshot,
        layoutRequiredSnapshot,
        timestamp
      );
      options.renderPass(pass, invalidation);
      metrics = {
        ...metrics,
        totalRenderCount: metrics.totalRenderCount + 1,
        renderCountByPass: {
          ...metrics.renderCountByPass,
          [pass]: metrics.renderCountByPass[pass] + 1
        }
      };
      if (destroyed) {
        break;
      }
    }

    const duration = Math.max(0, now() - startedAt);
    metrics = {
      ...metrics,
      lastRenderDuration: duration,
      dirtyLayerCount: layers.length,
      lastInvalidationReasons: reasonSnapshot,
      slowFrameCount: duration > slowFrameThresholdMs ? metrics.slowFrameCount + 1 : metrics.slowFrameCount
    };
  }

  return {
    invalidate(invalidation) {
      if (destroyed || invalidation.layers.length === 0) {
        return;
      }

      for (const layer of invalidation.layers) {
        dirtyLayers.add(layer);
      }
      reasons.push(invalidation.reason);
      layoutRequired = layoutRequired || invalidation.layoutRequired === true;
      schedule();
    },
    flush,
    getState(): RenderSchedulerState {
      return {
        pending: frameId !== undefined,
        dirtyLayers: sortLayers([...dirtyLayers]),
        layoutRequired,
        metrics: cloneMetrics(metrics)
      };
    },
    destroy() {
      destroyed = true;
      if (frameId !== undefined) {
        options.cancelFrame?.(frameId);
        frameId = undefined;
      }
      dirtyLayers.clear();
      reasons.length = 0;
      layoutRequired = false;
    }
  };
}

function getPassesForLayers(layers: RenderLayerId[]): RenderPass[] {
  const passes = new Set<RenderPass>();
  for (const layer of layers) {
    for (const pass of renderLayerPasses[layer]) {
      passes.add(pass);
    }
  }
  return defaultRenderPassOrder.filter((pass) => passes.has(pass));
}

function sortLayers(layers: RenderLayerId[]): RenderLayerId[] {
  return [...layers].sort((left, right) => renderLayerOrder.indexOf(left) - renderLayerOrder.indexOf(right));
}

function createRenderInvalidation(
  layers: RenderLayerId[],
  reasons: string[],
  layoutRequired: boolean,
  timestamp: number
): RenderInvalidation {
  return {
    layers: [...layers],
    reason: reasons[reasons.length - 1] ?? "unspecified",
    layoutRequired,
    timestamp
  };
}

function cloneMetrics(metrics: RenderMetrics): RenderMetrics {
  return {
    totalRenderCount: metrics.totalRenderCount,
    renderCountByPass: { ...metrics.renderCountByPass },
    lastRenderDuration: metrics.lastRenderDuration,
    dirtyLayerCount: metrics.dirtyLayerCount,
    lastInvalidationReasons: [...metrics.lastInvalidationReasons],
    slowFrameCount: metrics.slowFrameCount
  };
}
