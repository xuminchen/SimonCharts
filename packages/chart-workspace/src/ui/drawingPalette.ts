import {
  builtInDrawingToolDefinitions,
  type DrawingToolCategory
} from "@simoncharts/chart-engine";
import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartController";
import type { ChartLabels } from "./localization";

const categories = [...new Set(builtInDrawingToolDefinitions.map((definition) => definition.category))];
const categoryIcons: Readonly<Record<DrawingToolCategory, string>> = {
  basic: "╱",
  channel: "∥",
  fibonacci: "Φ",
  annotation: "T",
  shape: "□",
  path: "⌁",
  position: "↕",
  measurement: "↔",
  gann: "G",
  pitchfork: "Ψ",
  pattern: "W",
  forecast: "⋯"
};

export interface DrawingPalette {
  readonly element: HTMLDivElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
}

export function createDrawingPalette(labels: ChartLabels): DrawingPalette {
  const element = document.createElement("div");
  element.className = "sc-drawing-palette";
  element.dataset.testid = "drawing-palette";
  const select = document.createElement("button");
  select.type = "button";
  select.className = "sc-drawing-select";
  select.dataset.testid = "drawing-palette-expand";
  select.textContent = "↖";
  select.title = labels.select;
  select.setAttribute("aria-label", labels.select);
  const categoryHost = document.createElement("div");
  categoryHost.className = "sc-drawing-categories";
  for (const category of categories) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.drawingCategory = category;
    button.dataset.testid = `drawing-category-${category}`;
    button.textContent = categoryIcons[category];
    button.title = category;
    button.setAttribute("aria-label", category);
    button.setAttribute("aria-expanded", "false");
    categoryHost.append(button);
  }
  const popup = document.createElement("div");
  popup.className = "sc-drawing-tools-popup";
  popup.hidden = true;
  popup.setAttribute("role", "menu");
  element.append(select, categoryHost, popup);
  let actions: WorkspaceUiActions | undefined;
  let current: WorkspaceViewModel["drawingPalette"] = { x: 12, y: 12, collapsed: true };
  let activeTool = "select";

  const closePopup = () => {
    popup.hidden = true;
    for (const button of categoryHost.querySelectorAll("button")) button.setAttribute("aria-expanded", "false");
  };
  const showCategory = (category: DrawingToolCategory, anchor: HTMLElement) => {
    popup.replaceChildren();
    for (const definition of builtInDrawingToolDefinitions.filter((item) => item.category === category)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.drawingTool = definition.type;
      button.dataset.drawingMode = definition.drawingMode;
      button.dataset.anchorCount = String(definition.anchorCount);
      button.setAttribute("role", "menuitem");
      button.textContent = definition.label;
      popup.append(button);
    }
    for (const button of categoryHost.querySelectorAll("button")) {
      button.setAttribute("aria-expanded", String(button === anchor));
    }
    popup.hidden = false;
    const top = Math.max(4, Math.min(anchor.offsetTop, element.clientHeight - popup.offsetHeight - 4));
    popup.style.top = `${top}px`;
  };

  return {
    element,
    bind(nextActions) {
      actions = nextActions;
      const selectClick = () => {
        activeTool = "select";
        closePopup();
        actions?.setDrawingTool("select");
      };
      const click = (event: Event) => {
        const target = event.target as HTMLElement;
        const categoryButton = target.closest<HTMLElement>("[data-drawing-category]");
        const category = categoryButton?.dataset.drawingCategory as DrawingToolCategory | undefined;
        if (category && categoryButton) {
          if (!popup.hidden && categoryButton.getAttribute("aria-expanded") === "true") closePopup();
          else showCategory(category, categoryButton);
          return;
        }
        const tool = target.closest<HTMLElement>("[data-drawing-tool]")?.dataset.drawingTool;
        if (!tool) return;
        const definition = builtInDrawingToolDefinitions.find((item) => item.type === tool);
        if (!definition) return;
        activeTool = definition.type;
        actions?.setDrawingTool(definition.type);
        actions?.setDrawingPalette({ ...current, recentTool: definition.type });
        closePopup();
      };
      const outside = (event: PointerEvent) => {
        if (!element.contains(event.target as Node)) closePopup();
      };
      const escape = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        activeTool = "select";
        closePopup();
        actions?.setDrawingTool("select");
      };
      select.addEventListener("click", selectClick);
      element.addEventListener("click", click);
      element.ownerDocument.addEventListener("pointerdown", outside);
      element.ownerDocument.addEventListener("keydown", escape);
      return () => {
        select.removeEventListener("click", selectClick);
        element.removeEventListener("click", click);
        element.ownerDocument.removeEventListener("pointerdown", outside);
        element.ownerDocument.removeEventListener("keydown", escape);
      };
    },
    render(viewModel) {
      current = viewModel.drawingPalette;
      if (activeTool === "select" && current.recentTool === undefined) select.setAttribute("aria-pressed", "true");
      else select.setAttribute("aria-pressed", String(activeTool === "select"));
      for (const button of categoryHost.querySelectorAll<HTMLButtonElement>("button")) {
        const recent = builtInDrawingToolDefinitions.find((definition) => definition.type === activeTool);
        button.setAttribute("aria-pressed", String(recent?.category === button.dataset.drawingCategory));
      }
    }
  };
}
