import type { WorkspaceViewModel } from "../controller/chartWorkspaceController";

export interface BottomPanel {
  readonly element: HTMLDivElement;
  render(viewModel: WorkspaceViewModel): void;
}

export function createBottomPanel(): BottomPanel {
  const element = document.createElement("div");
  element.className = "sc-bottom-panel";
  const tabs = document.createElement("div");
  tabs.className = "sc-bottom-tabs";
  for (const id of ["objects", "properties", "data"] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tab = id;
    button.textContent = id;
    tabs.append(button);
  }
  const content = document.createElement("div");
  content.className = "sc-bottom-content";
  element.append(tabs, content);
  return {
    element,
    render(viewModel) {
      element.style.height = viewModel.bottomPanel.collapsed
        ? "32px"
        : `${viewModel.bottomPanel.height}px`;
      for (const button of tabs.querySelectorAll("button")) {
        button.setAttribute("aria-selected", String(button.dataset.tab === viewModel.bottomPanel.activeTab));
      }
    }
  };
}
