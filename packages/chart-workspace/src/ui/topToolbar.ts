import type { WorkspaceViewModel } from "../controller/chartWorkspaceController";

export interface TopToolbar {
  readonly element: HTMLDivElement;
  render(viewModel: WorkspaceViewModel): void;
}

export function createTopToolbar(): TopToolbar {
  const element = document.createElement("div");
  element.className = "sc-top-toolbar";
  const symbol = document.createElement("span");
  symbol.className = "sc-current-symbol";
  element.append(symbol);
  return {
    element,
    render(viewModel) {
      symbol.textContent = `${viewModel.state.symbol.name} ${viewModel.state.symbol.code}`;
    }
  };
}
