import type { DrawingObject } from "@simoncharts/chart-engine";
import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartWorkspaceController";
import type { BottomPanelState } from "../persistence/browserPersistence";
import { createDataWindow } from "./dataWindow";
import { createPropertyEditor } from "./propertyEditor";

export interface BottomPanel {
  readonly element: HTMLDivElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
}

const tabs = [
  { id: "objects", label: "对象" },
  { id: "properties", label: "属性" },
  { id: "data", label: "数据窗口" }
] as const;

function selectedDrawing(viewModel: WorkspaceViewModel): DrawingObject | undefined {
  const selectedId = viewModel.selectedDrawingIds[0];
  return viewModel.drawings.find((drawing) => drawing.id === selectedId);
}

export function createBottomPanel(): BottomPanel {
  const element = document.createElement("div");
  element.className = "sc-bottom-panel";
  const tabList = document.createElement("div");
  tabList.className = "sc-bottom-tabs";
  for (const tab of tabs) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tab = tab.id;
    button.textContent = tab.label;
    tabList.append(button);
  }
  const content = document.createElement("div");
  content.className = "sc-bottom-content";
  const objects = document.createElement("div");
  objects.className = "sc-object-manager";
  const propertyEditor = createPropertyEditor();
  const dataWindow = createDataWindow();
  content.append(objects, propertyEditor.element, dataWindow.element);
  element.append(tabList, content);
  let currentViewModel: WorkspaceViewModel | undefined;
  let actions: WorkspaceUiActions | undefined;

  const select = (drawingId: string) => {
    actions?.setDrawingTool("select");
    actions?.executeDrawingCommand({ type: "selectDrawing", drawingId });
  };
  const commandFor = (drawing: DrawingObject, command: "visible" | "locked" | "forward" | "backward") => {
    select(drawing.id);
    if (command === "visible") actions?.executeDrawingCommand({ type: drawing.visible === false ? "showSelected" : "hideSelected" });
    if (command === "locked") actions?.executeDrawingCommand({ type: drawing.locked ? "unlockSelected" : "lockSelected" });
    if (command === "forward") actions?.executeDrawingCommand({ type: "bringSelectedForward" });
    if (command === "backward") actions?.executeDrawingCommand({ type: "sendSelectedBackward" });
  };

  return {
    element,
    bind(nextActions) {
      actions = nextActions;
      const onTabClick = (event: Event) => {
        const activeTab = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tab]")?.dataset.tab as BottomPanelState["activeTab"] | undefined;
        if (activeTab && currentViewModel) actions?.setBottomPanel({ ...currentViewModel.bottomPanel, activeTab, collapsed: false });
      };
      const onObjectClick = (event: Event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>("[data-drawing-id]");
        const drawing = currentViewModel?.drawings.find((item) => item.id === target?.dataset.drawingId);
        if (!drawing) return;
        const command = (event.target as HTMLElement).closest<HTMLElement>("[data-object-command]")?.dataset.objectCommand as "visible" | "locked" | "forward" | "backward" | undefined;
        if (command) commandFor(drawing, command);
        else select(drawing.id);
      };
      tabList.addEventListener("click", onTabClick);
      objects.addEventListener("click", onObjectClick);
      return () => {
        tabList.removeEventListener("click", onTabClick);
        objects.removeEventListener("click", onObjectClick);
        actions = undefined;
      };
    },
    render(viewModel) {
      currentViewModel = viewModel;
      element.style.height = viewModel.bottomPanel.collapsed ? "32px" : `${viewModel.bottomPanel.height}px`;
      content.hidden = viewModel.bottomPanel.collapsed;
      for (const button of tabList.querySelectorAll("button")) button.setAttribute("aria-selected", String(button.dataset.tab === viewModel.bottomPanel.activeTab));
      objects.replaceChildren();
      for (const drawing of viewModel.drawings) {
        const row = document.createElement("div");
        row.className = "sc-object-row";
        row.dataset.drawingId = drawing.id;
        row.dataset.selected = String(viewModel.selectedDrawingIds.includes(drawing.id));
        const selectButton = document.createElement("button");
        selectButton.type = "button";
        selectButton.textContent = `${drawing.type} ${drawing.id}`;
        const controls = [
          ["visible", drawing.visible === false ? "显示" : "隐藏"],
          ["locked", drawing.locked ? "解锁" : "锁定"],
          ["forward", "上移"],
          ["backward", "下移"]
        ] as const;
        row.append(selectButton);
        for (const [command, label] of controls) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.objectCommand = command;
          button.setAttribute("aria-label", label);
          button.textContent = label;
          row.append(button);
        }
        objects.append(row);
      }
      const active = viewModel.bottomPanel.activeTab;
      objects.hidden = active !== "objects";
      propertyEditor.element.hidden = active !== "properties";
      dataWindow.element.hidden = active !== "data";
      propertyEditor.render(selectedDrawing(viewModel), (command) => actions?.executeDrawingCommand(command));
      dataWindow.render(viewModel.dataWindow);
    }
  };
}
