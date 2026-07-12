import type { WorkspaceStatus } from "../controller/chartWorkspaceController";

export interface ErrorPanel {
  readonly element: HTMLDivElement;
  render(status: WorkspaceStatus): void;
}

export function createErrorPanel(): ErrorPanel {
  const element = document.createElement("div");
  element.className = "sc-error-panel";
  element.hidden = true;
  return {
    element,
    render(status) {
      if (status.type !== "blocked") {
        element.hidden = true;
        element.textContent = "";
        return;
      }
      element.hidden = false;
      element.textContent = status.error.message;
      element.dataset.errorCode = status.error.code;
    }
  };
}
