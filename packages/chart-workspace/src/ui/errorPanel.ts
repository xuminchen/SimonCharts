import type { WorkspaceStatus } from "../controller/chartController";

export interface ErrorPanel {
  readonly element: HTMLDivElement;
  bind(retry: () => void, retryHistory: () => void): () => void;
  render(status: WorkspaceStatus): void;
}

export function createErrorPanel(): ErrorPanel {
  const element = document.createElement("div");
  element.className = "sc-error-panel";
  element.hidden = true;
  const message = document.createElement("span");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "重试";
  const historyRetry = document.createElement("button");
  historyRetry.type = "button";
  historyRetry.textContent = "重试历史";
  return {
    element,
    bind(action, historyAction) {
      retry.addEventListener("click", action);
      historyRetry.addEventListener("click", historyAction);
      return () => {
        retry.removeEventListener("click", action);
        historyRetry.removeEventListener("click", historyAction);
      };
    },
    render(status) {
      if (status.type === "loading" || status.type === "ready") {
        element.hidden = true;
        element.replaceChildren();
        delete element.dataset.errorCode;
        delete element.dataset.warning;
        return;
      }
      element.hidden = false;
      message.textContent = status.error.message;
      element.replaceChildren(message);
      if (status.type === "blocked" && status.error.recoverable) element.append(retry);
      if (status.type === "readyWithWarning" && status.error.scope === "history-data" && status.error.recoverable) element.append(historyRetry);
      element.dataset.errorCode = status.error.code;
      if (status.type === "readyWithWarning") element.dataset.warning = "true";
      else delete element.dataset.warning;
    }
  };
}
