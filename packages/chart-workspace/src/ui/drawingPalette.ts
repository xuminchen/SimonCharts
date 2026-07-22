import {
  builtInDrawingToolDefinitions,
  type BuiltInDrawingType,
  type DrawingToolCategory
} from "@simoncharts/chart-engine";
import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartController";
import type { ChartLabels } from "./localization";

const categories: readonly DrawingToolCategory[] = [
  "basic",
  "channel",
  "fibonacci",
  "pitchfork",
  "gann",
  "pattern",
  "path",
  "annotation",
  "shape",
  "measurement",
  "position",
  "forecast"
];
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

function iconElement(className: string, icon: string): HTMLSpanElement {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = icon;
  element.setAttribute("aria-hidden", "true");
  return element;
}

function drawingToolIconShape(type: BuiltInDrawingType): string {
  if (type === "text") return '<text x="7" y="18" fill="currentColor" stroke="none" font-size="18" font-weight="700">T</text>';
  if (type === "simpleAnnotation" || type === "simpleTag") return '<circle cx="12" cy="12" r="5"/><path d="M12 9v6m-3-3h6"/>';
  if (type === "callout") return '<path d="M3 4h18v12H10l-5 5v-5H3Z"/>';
  if (type === "rectangle" || type === "rotatedRectangle") return type === "rectangle" ? '<rect x="3" y="5" width="18" height="14"/>' : '<path d="m5 3 16 6-5 12L0 15Z"/>';
  if (type === "circle") return '<circle cx="12" cy="12" r="8"/>';
  if (type === "ellipse") return '<ellipse cx="12" cy="12" rx="10" ry="6"/>';
  if (type === "polygon") return '<path d="m12 2 9 7-3 11H6L3 9Z"/>';
  if (type === "triangle") return '<path d="m12 3 10 18H2Z"/>';
  if (type === "arc") return '<path d="M3 18A11 11 0 0 1 21 7"/>';
  if (type === "curve") return '<path d="M2 19C7 1 16 2 22 15"/>';
  if (type === "arrow") return '<path d="M3 20 20 3m-8 1h8v8"/>';
  if (type === "path" || type === "brush" || type === "forecastPath") return `<path d="M2 18c5-14 7 7 12-7 3-8 5 7 8-5"${type === "forecastPath" ? ' stroke-dasharray="3 2"' : ""}/>`;
  if (type.includes("Channel") || type.includes("channel")) return '<path d="M2 17 18 3M6 21 22 7"/>';
  if (type.startsWith("fib") || type.startsWith("fibonacci")) return '<path d="M2 4h20M4 8h16M6 12h12M8 16h8M10 20h4"/>';
  if (type.includes("Pitchfork") || type === "pitchfork") return '<path d="M3 20 12 3m0 0 9 17M12 3v18"/>';
  if (type.startsWith("gann")) return '<path d="M3 21 21 3M3 21h18V3M3 15h12M9 21V9"/>';
  if (type.includes("Pattern") || type.startsWith("elliott")) return '<path d="M2 18 6 8l4 6 4-11 4 9 4-5"/><circle cx="6" cy="8" r="1" fill="currentColor"/><circle cx="14" cy="3" r="1" fill="currentColor"/>';
  if (type.includes("Position") || type === "profitLossRange") return '<path d="M4 3v18m-3-9h21M8 5h12v6H8Zm0 8h12v6H8Z"/>';
  if (type.includes("Range") || type === "measure" || type === "trendAngle") return '<path d="M3 4v16m18-16v16M3 12h18m-4-3 4 3-4 3M7 9l-4 3 4 3"/>';
  if (type.includes("horizontal") || type === "priceLine") return '<path d="M2 12h20"/>';
  if (type.includes("vertical")) return '<path d="M12 2v20"/>';
  if (type === "crossLine") return '<path d="M2 12h20M12 2v20"/>';
  if (type === "ray" || type === "rayLine") return '<path d="M3 20 20 3m-6 0h6v6"/>';
  return '<path d="M3 20 21 3"/><circle cx="3" cy="20" r="1.5" fill="currentColor"/><circle cx="21" cy="3" r="1.5" fill="currentColor"/>';
}

function drawingToolIcon(type: BuiltInDrawingType): SVGSVGElement {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("sc-drawing-tool-icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.7");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.innerHTML = drawingToolIconShape(type);
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

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
    button.append(iconElement("sc-drawing-category-icon", categoryIcons[category]));
    button.title = labels.drawingCategories[category];
    button.setAttribute("aria-label", labels.drawingCategories[category]);
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
    const definitions = builtInDrawingToolDefinitions.filter((item) => item.category === category);
    const header = document.createElement("div");
    header.className = "sc-drawing-tools-header";
    header.setAttribute("role", "presentation");
    const headerLabel = document.createElement("strong");
    headerLabel.className = "sc-drawing-tools-header-label";
    headerLabel.textContent = labels.drawingCategories[category];
    const headerCount = document.createElement("span");
    headerCount.className = "sc-drawing-tools-header-count";
    headerCount.textContent = String(definitions.length);
    header.append(headerLabel, " ", headerCount);
    popup.append(header);
    for (const definition of definitions) {
      const button = document.createElement("button");
      const label = labels.drawingTools[definition.type as BuiltInDrawingType] ?? definition.label;
      button.type = "button";
      button.dataset.drawingTool = definition.type;
      button.dataset.drawingMode = definition.drawingMode;
      button.dataset.anchorCount = String(definition.anchorCount);
      button.setAttribute("role", "menuitem");
      button.setAttribute("aria-label", label);
      const icon = drawingToolIcon(definition.type as BuiltInDrawingType);
      const text = document.createElement("span");
      text.className = "sc-drawing-tool-label";
      text.textContent = label;
      button.append(icon, " ", text);
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
