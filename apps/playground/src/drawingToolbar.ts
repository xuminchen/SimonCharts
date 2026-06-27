import type {
  DrawingEditorCapabilities,
  DrawingEditorTool,
  DrawingToolDefinition
} from "@simoncharts/chart-engine";

export interface DrawingToolbar {
  element: HTMLDivElement;
  countElement: HTMLSpanElement;
  setActiveTool(tool: DrawingEditorTool): void;
  setCapabilities(capabilities: DrawingEditorCapabilities): void;
}

export interface DrawingToolbarActions {
  copySelected(): void;
  pasteCopied(): void;
  duplicateSelected(): void;
  bringSelectedForward(): void;
  sendSelectedBackward(): void;
  setTool(tool: DrawingEditorTool): void;
  deleteSelected(): void;
  lockSelected(): void;
  unlockSelected(): void;
  hideSelected(): void;
  showSelected(): void;
  undo(): void;
  redo(): void;
}

export interface DrawingToolbarOptions extends DrawingToolbarActions {
  tools: DrawingToolDefinition[];
}

export function createDrawingToolbar(options: DrawingToolbarOptions): DrawingToolbar {
  const element = document.createElement("div");
  const toolPalette = document.createElement("div");
  const actionControls = document.createElement("div");
  const countElement = document.createElement("span");
  const toolButtons = new Map<DrawingEditorTool, HTMLButtonElement>();
  const actionButtons = {
    copy: createButton("Copy", "copy-drawing", options.copySelected),
    paste: createButton("Paste", "paste-drawing", options.pasteCopied),
    duplicate: createButton("Duplicate", "duplicate-drawing", options.duplicateSelected),
    forward: createButton("Forward", "bring-drawing-forward", options.bringSelectedForward),
    backward: createButton("Backward", "send-drawing-backward", options.sendSelectedBackward),
    delete: createButton("Delete", "delete-drawing", options.deleteSelected),
    lock: createButton("Lock", "lock-drawing", options.lockSelected),
    unlock: createButton("Unlock", "unlock-drawing", options.unlockSelected),
    hide: createButton("Hide", "hide-drawing", options.hideSelected),
    show: createButton("Show", "show-drawing", options.showSelected),
    undo: createButton("Undo", "undo", options.undo),
    redo: createButton("Redo", "redo", options.redo)
  };

  element.className = "drawing-controls";
  toolPalette.className = "drawing-tool-palette";
  actionControls.className = "drawing-actions";
  countElement.className = "status-item";
  countElement.dataset.testid = "drawing-count";

  const selectButton = createButton("Select", "drawing-tool-select", () => options.setTool("select"));
  selectButton.title = "Select";
  toolButtons.set("select", selectButton);
  toolPalette.append(selectButton);

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

    toolPalette.append(group);
  }

  actionControls.append(
    actionButtons.copy,
    actionButtons.paste,
    actionButtons.duplicate,
    actionButtons.forward,
    actionButtons.backward,
    actionButtons.delete,
    actionButtons.lock,
    actionButtons.unlock,
    actionButtons.hide,
    actionButtons.show,
    actionButtons.undo,
    actionButtons.redo,
    countElement
  );
  element.append(toolPalette, actionControls);

  return {
    element,
    countElement,
    setActiveTool(tool) {
      for (const [buttonTool, button] of toolButtons) {
        button.classList.toggle("is-active", buttonTool === tool);
      }
    },
    setCapabilities(capabilities) {
      actionButtons.copy.disabled = !capabilities.canCopy;
      actionButtons.paste.disabled = !capabilities.canPaste;
      actionButtons.duplicate.disabled = !capabilities.canDuplicate;
      actionButtons.forward.disabled = !capabilities.canBringSelectedForward;
      actionButtons.backward.disabled = !capabilities.canSendSelectedBackward;
      actionButtons.delete.disabled = !capabilities.canDelete;
      actionButtons.lock.disabled = !capabilities.canLock;
      actionButtons.unlock.disabled = !capabilities.canUnlock;
      actionButtons.hide.disabled = !capabilities.canHide;
      actionButtons.show.disabled = !capabilities.canShow;
      actionButtons.undo.disabled = !capabilities.canUndo;
      actionButtons.redo.disabled = !capabilities.canRedo;
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
