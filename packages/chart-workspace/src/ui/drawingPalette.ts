import {
  builtInDrawingToolDefinitions,
  type DrawingToolCategory
} from "@simoncharts/chart-engine";
import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartWorkspaceController";

const categories = [...new Set(builtInDrawingToolDefinitions.map((definition) => definition.category))];

export interface DrawingPalette {
  readonly element: HTMLDivElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
}

export function createDrawingPalette(chartRegion: HTMLElement): DrawingPalette {
  const element = document.createElement("div");
  element.className = "sc-drawing-palette";
  element.dataset.testid = "drawing-palette";
  const header = document.createElement("div");
  header.className = "sc-drawing-palette-header";
  header.dataset.testid = "drawing-palette-drag-handle";
  const grip = document.createElement("span");
  grip.className = "sc-drawing-palette-grip";
  grip.textContent = "⋮";
  const expand = document.createElement("button");
  expand.type = "button";
  expand.dataset.testid = "drawing-palette-expand";
  const categoryHost = document.createElement("div");
  categoryHost.className = "sc-drawing-categories";
  for (const category of categories) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.drawingCategory = category;
    button.dataset.testid = `drawing-category-${category}`;
    button.textContent = category;
    categoryHost.append(button);
  }
  const popup = document.createElement("div");
  popup.className = "sc-drawing-tools-popup";
  popup.hidden = true;
  header.append(grip, expand);
  element.append(header, categoryHost, popup);
  let actions: WorkspaceUiActions | undefined;
  let current: WorkspaceViewModel["drawingPalette"] = { x: 12, y: 12, collapsed: true };
  let drag: { pointerId: number; dx: number; dy: number } | undefined;

  const clamp = (x: number, y: number) => ({
    x: Math.max(0, Math.min(Math.max(0, chartRegion.clientWidth - element.offsetWidth), x)),
    y: Math.max(0, Math.min(Math.max(0, chartRegion.clientHeight - element.offsetHeight), y))
  });
  const applyPosition = (x: number, y: number) => {
    const next = clamp(x, y);
    element.style.left = `${next.x}px`;
    element.style.top = `${next.y}px`;
    return next;
  };
  const showCategory = (category: DrawingToolCategory) => {
    popup.replaceChildren();
    for (const definition of builtInDrawingToolDefinitions.filter((item) => item.category === category)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.drawingTool = definition.type;
      button.dataset.drawingMode = definition.drawingMode;
      button.dataset.anchorCount = String(definition.anchorCount);
      button.textContent = definition.label;
      popup.append(button);
    }
    popup.hidden = false;
  };

  return {
    element,
    bind(nextActions) {
      actions = nextActions;
      const expandClick = () => actions?.setDrawingPalette({ ...current, collapsed: !current.collapsed });
      const click = (event: Event) => {
        const target = event.target as HTMLElement;
        const category = target.closest<HTMLElement>("[data-drawing-category]")?.dataset.drawingCategory as DrawingToolCategory | undefined;
        if (category) { showCategory(category); return; }
        const tool = target.closest<HTMLElement>("[data-drawing-tool]")?.dataset.drawingTool;
        if (tool) {
          const definition = builtInDrawingToolDefinitions.find((item) => item.type === tool);
          if (!definition) return;
          actions?.setDrawingTool(definition.type);
          actions?.setDrawingPalette({ ...current, recentTool: definition.type });
          popup.hidden = true;
        }
      };
      const down = (event: PointerEvent) => {
        if ((event.target as HTMLElement).closest("button")) return;
        drag = { pointerId: event.pointerId, dx: event.clientX - current.x, dy: event.clientY - current.y };
        header.setPointerCapture?.(event.pointerId);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
      const move = (event: PointerEvent) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        applyPosition(event.clientX - drag.dx, event.clientY - drag.dy);
      };
      const up = (event: PointerEvent) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const position = applyPosition(event.clientX - drag.dx, event.clientY - drag.dy);
        drag = undefined;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        actions?.setDrawingPalette({ ...current, ...position });
      };
      const resize = () => {
        const position = applyPosition(current.x, current.y);
        if (position.x !== current.x || position.y !== current.y) actions?.setDrawingPalette({ ...current, ...position });
      };
      expand.addEventListener("click", expandClick);
      element.addEventListener("click", click);
      header.addEventListener("pointerdown", down);
      header.addEventListener("pointermove", move);
      header.addEventListener("pointerup", up);
      header.addEventListener("pointercancel", up);
      window.addEventListener("resize", resize);
      return () => {
        expand.removeEventListener("click", expandClick); element.removeEventListener("click", click);
        header.removeEventListener("pointerdown", down); header.removeEventListener("pointermove", move); header.removeEventListener("pointerup", up); header.removeEventListener("pointercancel", up); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("resize", resize);
      };
    },
    render(viewModel) {
      current = viewModel.drawingPalette;
      applyPosition(current.x, current.y);
      categoryHost.hidden = current.collapsed;
      if (current.collapsed) popup.hidden = true;
      expand.textContent = current.collapsed ? current.recentTool ?? "绘图" : "收起";
    }
  };
}
