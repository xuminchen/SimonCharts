import type { DrawingEditorTool } from "@simoncharts/chart-engine";

export interface DrawingToolbar {
  element: HTMLDivElement;
  countElement: HTMLSpanElement;
  setActiveTool(tool: DrawingEditorTool): void;
}

export interface DrawingToolbarActions {
  setTool(tool: DrawingEditorTool): void;
  deleteSelected(): void;
  lockSelected(): void;
  hideSelected(): void;
  undo(): void;
  redo(): void;
}

export function createDrawingToolbar(actions: DrawingToolbarActions): DrawingToolbar {
  const element = document.createElement("div");
  const countElement = document.createElement("span");
  const toolButtons = new Map<DrawingEditorTool, HTMLButtonElement>();

  element.className = "drawing-controls";
  countElement.className = "status-item";
  countElement.dataset.testid = "drawing-count";

  const tools: Array<{ tool: DrawingEditorTool; label: string; testId: string }> = [
    { tool: "select", label: "Select", testId: "drawing-tool-select" },
    { tool: "trendLine", label: "Line", testId: "drawing-tool-trendLine" },
    { tool: "horizontalLine", label: "H", testId: "drawing-tool-horizontalLine" },
    { tool: "verticalLine", label: "V", testId: "drawing-tool-verticalLine" },
    { tool: "rectangle", label: "Rect", testId: "drawing-tool-rectangle" },
    { tool: "text", label: "Text", testId: "drawing-tool-text" }
  ];

  for (const item of tools) {
    const button = createButton(item.label, item.testId, () => actions.setTool(item.tool));

    toolButtons.set(item.tool, button);
    element.append(button);
  }

  element.append(
    createButton("Delete", "delete-drawing", actions.deleteSelected),
    createButton("Lock", "lock-drawing", actions.lockSelected),
    createButton("Hide", "hide-drawing", actions.hideSelected),
    createButton("Undo", "undo", actions.undo),
    createButton("Redo", "redo", actions.redo),
    countElement
  );

  return {
    element,
    countElement,
    setActiveTool(tool) {
      for (const [buttonTool, button] of toolButtons) {
        button.classList.toggle("is-active", buttonTool === tool);
      }
    }
  };
}

function createButton(label: string, testId: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");

  button.type = "button";
  button.dataset.testid = testId;
  button.textContent = label;
  button.addEventListener("click", onClick);

  return button;
}
