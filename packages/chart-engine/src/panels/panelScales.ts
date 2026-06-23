import type { PanelArea } from "./panelTypes";

export function findPanelArea(panels: PanelArea[], panelId: string): PanelArea | undefined {
  return panels.find((panel) => panel.id === panelId);
}
