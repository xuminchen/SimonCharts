import type { DrawingEditorTool, DrawingToolDefinition } from "@simoncharts/chart-engine";

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

export interface DrawingToolbarOptions extends DrawingToolbarActions {
  tools: DrawingToolDefinition[];
}

export function createDrawingToolbar(options: DrawingToolbarOptions): DrawingToolbar {
  const element = document.createElement("div");
  const countElement = document.createElement("span");
  const toolButtons = new Map<DrawingEditorTool, HTMLButtonElement>();

  element.className = "drawing-controls";
  countElement.className = "status-item";
  countElement.dataset.testid = "drawing-count";

  const selectButton = createButton("Select", "drawing-tool-select", () => options.setTool("select"));
  selectButton.title = "Select";
  toolButtons.set("select", selectButton);
  element.append(selectButton);

  for (const [category, tools] of groupToolsByCategory(options.tools)) {
    const group = document.createElement("div");
    const label = document.createElement("span");

    group.className = "drawing-tool-group";
    label.className = "drawing-tool-group-label";
    label.textContent = category;
    group.append(label);

    for (const item of tools) {
      const button = createButton(item.label, `drawing-tool-${item.type}`, () => options.setTool(item.type));

      button.title = item.label;
      toolButtons.set(item.type, button);
      group.append(button);
    }

    element.append(group);
  }

  element.append(
    createButton("Delete", "delete-drawing", options.deleteSelected),
    createButton("Lock", "lock-drawing", options.lockSelected),
    createButton("Hide", "hide-drawing", options.hideSelected),
    createButton("Undo", "undo", options.undo),
    createButton("Redo", "redo", options.redo),
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

function groupToolsByCategory(
  tools: DrawingToolDefinition[]
): Array<[DrawingToolDefinition["category"], DrawingToolDefinition[]]> {
  const groups = new Map<DrawingToolDefinition["category"], DrawingToolDefinition[]>();

  for (const tool of tools) {
    const group = groups.get(tool.category);

    if (group) {
      group.push(tool);
    } else {
      groups.set(tool.category, [tool]);
    }
  }

  return [...groups.entries()];
}
