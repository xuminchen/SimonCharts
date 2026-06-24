import type { IndicatorVisualOutput } from "../model/visual";
import type { PanelArea } from "../panels/panelTypes";
import type { LayerRenderContext, RenderState } from "../render/renderTypes";

export type VisualOutputType = IndicatorVisualOutput["type"];

export interface VisualRenderContext extends LayerRenderContext {
  output: IndicatorVisualOutput;
  panel: PanelArea;
  valueRange?: VisualAutoscaleRange;
}

export interface VisualHitTestContext {
  output: IndicatorVisualOutput;
  panel: PanelArea;
  state: RenderState;
  valueRange?: VisualAutoscaleRange;
}

export interface VisualAutoscaleRange {
  min: number;
  max: number;
}

export interface VisualHitTestResult {
  outputId: string;
  outputType: VisualOutputType;
  time: number;
  value?: number;
  distance: number;
}

export interface VisualTooltipRow {
  label: string;
  value: string;
}

export interface VisualRenderer {
  type: VisualOutputType;
  render(context: VisualRenderContext): void;
  getAutoscale(output: IndicatorVisualOutput): VisualAutoscaleRange | undefined;
  hitTest(context: VisualHitTestContext, x: number, y: number): VisualHitTestResult | undefined;
  getTooltipRows(hit: VisualHitTestResult): VisualTooltipRow[];
}
