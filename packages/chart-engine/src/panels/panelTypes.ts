import type { IndicatorPanelKind } from "../model/visual";

export interface PanelDefinition {
  id: string;
  kind: IndicatorPanelKind;
  label: string;
  heightRatio: number;
}

export interface PanelArea {
  id: string;
  kind: IndicatorPanelKind;
  label: string;
  plotArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  priceAxisArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
