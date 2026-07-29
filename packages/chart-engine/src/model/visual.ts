import type { CandleSeries } from "./market";

export type ChartMarkDirection = "above" | "below" | "inline";

export type ChartMarkSeverity = "info" | "warning" | "critical";

export interface ChartMark {
  id: string;
  time: number;
  index?: number;
  price?: number;
  direction?: ChartMarkDirection;
  severity?: ChartMarkSeverity;
  label?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

export type IndicatorParameterType = "number" | "string" | "boolean";

export interface IndicatorParameterDefinition {
  key: string;
  label: string;
  type: IndicatorParameterType;
  defaultValue: number | string | boolean;
}

export type IndicatorPanelKind = "main" | "sub";

export interface IndicatorPanelDefinition {
  id: string;
  kind: IndicatorPanelKind;
  label: string;
}

export interface IndicatorCalculationInput {
  series: CandleSeries;
  parameters: Record<string, number | string | boolean>;
}

export interface IndicatorPoint {
  time: number;
  value: number | null;
}

export interface IndicatorHistogramPoint {
  time: number;
  value: number;
  color?: string;
}

export interface IndicatorVisualOutputBase {
  id: string;
  label: string;
  panelId?: string;
  visible?: boolean;
  coordinateSpace?: "price" | "percentage";
}

export interface IndicatorLineOutput extends IndicatorVisualOutputBase {
  type: "line";
  values: IndicatorPoint[];
  color?: string;
  lineWidth?: number;
}

export interface IndicatorHistogramOutput extends IndicatorVisualOutputBase {
  type: "histogram";
  values: IndicatorHistogramPoint[];
}

export interface IndicatorBandOutput extends IndicatorVisualOutputBase {
  type: "band";
  upper: IndicatorPoint[];
  lower: IndicatorPoint[];
  fill?: string;
}

export interface IndicatorMarkerOutput extends IndicatorVisualOutputBase {
  type: "marker";
  marks: ChartMark[];
}

export type IndicatorVisualOutput =
  | IndicatorLineOutput
  | IndicatorHistogramOutput
  | IndicatorBandOutput
  | IndicatorMarkerOutput;

export interface IndicatorPanelOutput {
  type: "panel";
  id: string;
  label: string;
  outputs: IndicatorVisualOutput[];
}

export interface IndicatorResult {
  outputs: IndicatorVisualOutput[];
  panels?: IndicatorPanelOutput[];
}

export interface IndicatorDefinition {
  id: string;
  label: string;
  parameters?: IndicatorParameterDefinition[];
  outputPanels: IndicatorPanelDefinition[];
  calculate(input: IndicatorCalculationInput): IndicatorResult;
}
