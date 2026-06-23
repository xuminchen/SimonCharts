import { createSeriesRendererRegistry } from "../../../series/seriesRegistry";
import type { SeriesRendererRegistry } from "../../../series/seriesRegistry";
import { createAreaRenderer } from "./areaRenderer";
import { createBarsRenderer } from "./barsRenderer";
import { createBaselineRenderer } from "./baselineRenderer";
import { createCandlesRenderer } from "./candlesRenderer";
import { createColumnsRenderer } from "./columnsRenderer";
import { createHighLowRenderer } from "./highLowRenderer";
import { createHlcAreaRenderer } from "./hlcAreaRenderer";
import { createHollowCandlesRenderer } from "./hollowCandlesRenderer";
import { createLineRenderer } from "./lineRenderer";
import { createLineWithMarkersRenderer } from "./lineWithMarkersRenderer";
import { createStepLineRenderer } from "./stepLineRenderer";
import { createSyntheticOhlcSeriesRenderer } from "./syntheticOhlcRenderer";
import { createVolumeCandlesRenderer } from "./volumeCandlesRenderer";

export function createDefaultSeriesRendererRegistry(): SeriesRendererRegistry {
  const registry = createSeriesRendererRegistry();

  registry.register(createBarsRenderer());
  registry.register(createCandlesRenderer());
  registry.register(createHollowCandlesRenderer());
  registry.register(createVolumeCandlesRenderer());
  registry.register(createLineRenderer());
  registry.register(createLineWithMarkersRenderer());
  registry.register(createStepLineRenderer());
  registry.register(createAreaRenderer());
  registry.register(createHlcAreaRenderer());
  registry.register(createBaselineRenderer());
  registry.register(createColumnsRenderer());
  registry.register(createHighLowRenderer());
  registry.register(createSyntheticOhlcSeriesRenderer("heikinAshi"));
  registry.register(createSyntheticOhlcSeriesRenderer("renko"));
  registry.register(createSyntheticOhlcSeriesRenderer("lineBreak"));
  registry.register(createSyntheticOhlcSeriesRenderer("kagi"));
  registry.register(createSyntheticOhlcSeriesRenderer("pointAndFigure"));

  return registry;
}
