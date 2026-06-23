import type { PanelArea, PanelDefinition } from "./panelTypes";

export interface CreatePanelLayoutInput {
  width: number;
  height: number;
  rightAxisWidth: number;
  bottomAxisHeight: number;
  panels: PanelDefinition[];
}

export function createPanelLayout(input: CreatePanelLayoutInput): PanelArea[] {
  const chartHeight = Math.max(0, input.height - input.bottomAxisHeight);
  const plotWidth = Math.max(0, input.width - input.rightAxisWidth);
  const totalRatio = input.panels.reduce((sum, panel) => sum + Math.max(0, panel.heightRatio), 0);

  if (input.panels.length === 0 || totalRatio <= 0) {
    return [];
  }

  let y = 0;

  return input.panels.map((panel, index) => {
    const remainingHeight = chartHeight - y;
    const rawHeight =
      index === input.panels.length - 1
        ? remainingHeight
        : Math.floor((chartHeight * Math.max(0, panel.heightRatio)) / totalRatio);
    const height = Math.max(0, rawHeight);
    const area: PanelArea = {
      id: panel.id,
      kind: panel.kind,
      label: panel.label,
      plotArea: { x: 0, y, width: plotWidth, height },
      priceAxisArea: { x: plotWidth, y, width: input.rightAxisWidth, height }
    };

    y += height;

    return area;
  });
}
