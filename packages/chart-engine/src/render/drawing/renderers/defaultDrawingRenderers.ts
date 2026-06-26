import { createDrawingRendererRegistry } from "../../../drawing/drawingRegistry";
import type { DrawingRendererRegistry } from "../../../drawing/drawingRegistry";
import type { DrawingType } from "../../../drawing/drawingTypes";
import { createChannelDrawingRenderers } from "./channelDrawingRenderer";
import { createFibonacciDrawingRenderers } from "./fibonacciDrawingRenderer";
import { createLineDrawingRenderers } from "./lineDrawingRenderer";
import { createPathDrawingRenderers } from "./pathDrawingRenderer";
import { createPositionDrawingRenderers } from "./positionDrawingRenderer";
import { createRangeDrawingRenderers } from "./rangeDrawingRenderer";
import { createShapeDrawingRenderers } from "./shapeDrawingRenderer";
import { createTextDrawingRenderers } from "./textDrawingRenderer";
import { createFigureDrawingRenderer } from "./drawingRendererHelpers";

export function createDefaultDrawingRendererRegistry(): DrawingRendererRegistry {
  const registry = createDrawingRendererRegistry();
  const renderers = [
    ...createLineDrawingRenderers(),
    ...createChannelDrawingRenderers(),
    ...createFibonacciDrawingRenderers(),
    ...createTextDrawingRenderers(),
    ...createShapeDrawingRenderers(),
    ...createPathDrawingRenderers(),
    ...createPositionDrawingRenderers(),
    ...createRangeDrawingRenderers(),
    ...figureDrawingTypes.map(createFigureDrawingRenderer)
  ];

  for (const renderer of renderers) {
    registry.register(renderer);
  }

  return registry;
}

const figureDrawingTypes: DrawingType[] = [
  "segment",
  "straightLine",
  "rayLine",
  "horizontalRayLine",
  "horizontalSegment",
  "horizontalStraightLine",
  "verticalRayLine",
  "verticalSegment",
  "verticalStraightLine",
  "priceLine",
  "priceChannelLine",
  "simpleAnnotation",
  "simpleTag",
  "triangle",
  "arc",
  "curve",
  "fibTrendBasedExtension",
  "fibTimeZone",
  "fibFan",
  "fibArc",
  "fibChannel",
  "fibWedge",
  "gannFan",
  "gannBox",
  "gannSquare",
  "pitchfork",
  "schiffPitchfork",
  "modifiedSchiffPitchfork",
  "insidePitchfork",
  "elliottImpulseWave",
  "elliottCorrectionWave",
  "xabcdPattern",
  "cypherPattern",
  "headAndShouldersPattern",
  "forecastPath"
];
