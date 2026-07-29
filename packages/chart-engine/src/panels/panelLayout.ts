import type { PanelArea, PanelDefinition } from "./panelTypes";

export interface CreatePanelLayoutInput {
  width: number;
  height: number;
  rightAxisWidth: number;
  bottomAxisHeight: number;
  panels: PanelDefinition[];
}

export function createPanelLayout(input: CreatePanelLayoutInput): PanelArea[] {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  const rightAxisWidth = Math.min(width, Math.max(0, input.rightAxisWidth));
  const bottomAxisHeight = Math.min(height, Math.max(0, input.bottomAxisHeight));
  const chartHeight = height - bottomAxisHeight;
  const plotWidth = width - rightAxisWidth;
  const totalRatio = input.panels.reduce((sum, panel) => sum + Math.max(0, panel.heightRatio), 0);

  if (input.panels.length === 0 || totalRatio <= 0) {
    return [];
  }

  let lastPositivePanelIndex = -1;
  for (let index = input.panels.length - 1; index >= 0; index -= 1) {
    if (input.panels[index].heightRatio > 0) {
      lastPositivePanelIndex = index;
      break;
    }
  }
  let allocatedHeight = 0;
  const heights = input.panels.map((panel, index) => {
    const panelRatio = Math.max(0, panel.heightRatio);
    const rawHeight =
      panelRatio <= 0
        ? 0
        : index === lastPositivePanelIndex
        ? chartHeight - allocatedHeight
        : Math.floor((chartHeight * panelRatio) / totalRatio);
    const height = Math.max(0, rawHeight);
    allocatedHeight += height;
    return height;
  });
  if (chartHeight >= input.panels.filter((panel) => panel.heightRatio > 0).length) {
    for (let index = 0; index < heights.length; index += 1) {
      if (input.panels[index]!.heightRatio <= 0 || heights[index]! > 0) continue;
      let donor = heights.length - 1;
      while (donor >= 0 && heights[donor]! <= 1) donor -= 1;
      if (donor < 0) break;
      heights[donor] -= 1;
      heights[index] = 1;
    }
  }
  let y = 0;

  return input.panels.map((panel, index) => {
    const height = heights[index]!;
    const area: PanelArea = {
      id: panel.id,
      kind: panel.kind,
      label: panel.label,
      plotArea: { x: 0, y, width: plotWidth, height },
      priceAxisArea: { x: plotWidth, y, width: rightAxisWidth, height }
    };

    y += height;

    return area;
  });
}
