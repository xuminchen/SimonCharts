import type { DrawingObject } from "@simoncharts/chart-engine";
import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartController";
import type { BottomPanelState } from "../persistence/browserPersistence";
import type { DataWindowSnapshot } from "../runtime/chartEngineRuntime";
import { createDataWindow } from "./dataWindow";
import type { ChartLabels } from "./localization";
import { createPropertyEditor } from "./propertyEditor";

export interface BottomPanel {
  readonly element: HTMLDivElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
  renderDataWindow(snapshot: DataWindowSnapshot | undefined): void;
}

function selectedDrawing(viewModel: WorkspaceViewModel): DrawingObject | undefined {
  if (viewModel.selectedDrawingIds.length !== 1) return undefined;
  const selectedId = viewModel.selectedDrawingIds[0];
  return viewModel.drawings.find((drawing) => drawing.id === selectedId);
}

export function createBottomPanel(labels: ChartLabels): BottomPanel {
  const tabs = [
    { id: "objects", label: labels.objects, icon: "☷" },
    { id: "properties", label: labels.properties, icon: "≡" },
    { id: "data", label: labels.dataWindow, icon: "▤" }
  ] as const;
  const element = document.createElement("div");
  element.className = "sc-bottom-panel sc-right-sidebar";
  element.dataset.testid = "right-inspector";
  const tabList = document.createElement("div");
  tabList.className = "sc-bottom-tabs sc-inspector-rail";
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-orientation", "vertical");
  for (const tab of tabs) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tab = tab.id;
    button.dataset.testid = `inspector-${tab.id}`;
    button.textContent = tab.icon;
    button.title = tab.label;
    button.setAttribute("aria-label", tab.label);
    button.setAttribute("role", "tab");
    tabList.append(button);
  }
  const content = document.createElement("div");
  content.className = "sc-bottom-content sc-inspector-content";
  const title = document.createElement("div");
  title.className = "sc-inspector-title";
  const objects = document.createElement("div");
  objects.className = "sc-object-manager";
  const propertyEditor = createPropertyEditor();
  const dataWindow = createDataWindow();
  content.append(title, objects, propertyEditor.element, dataWindow.element);
  element.append(content, tabList);
  let currentViewModel: WorkspaceViewModel | undefined;
  let actions: WorkspaceUiActions | undefined;
  let currentDataWindow: DataWindowSnapshot | undefined;
  let expandedGroupIds = new Set<string>();
  let renderedGroupIds = new Set<string>();
  let drawingScope: string | undefined;

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
        if (!activeTab || !currentViewModel) return;
        actions?.setBottomPanel({
          ...currentViewModel.bottomPanel,
          activeTab,
          collapsed: currentViewModel.bottomPanel.activeTab === activeTab && !currentViewModel.bottomPanel.collapsed
        });
      };
      const onObjectClick = (event: Event) => {
        const eventTarget = event.target as HTMLElement;
        if (eventTarget.closest("[data-create-drawing-group]")) {
          const drawingIds = currentViewModel?.selectedDrawingIds ?? [];
          if (drawingIds.length >= 2) actions?.createDrawingGroup(drawingIds);
          return;
        }
        const drawingTarget = eventTarget.closest<HTMLElement>("[data-drawing-id]");
        const drawing = currentViewModel?.drawings.find(
          (item) => item.id === drawingTarget?.dataset.drawingId
        );
        const objectCommand = eventTarget.closest<HTMLElement>("[data-object-command]")
          ?.dataset.objectCommand as "visible" | "locked" | "forward" | "backward" | undefined;
        if (drawing && objectCommand) {
          commandFor(drawing, objectCommand);
          return;
        }
        const groupTarget = eventTarget.closest<HTMLElement>("[data-drawing-group-id]");
        const group = currentViewModel?.drawingGroups.find(
          (item) => item.id === groupTarget?.dataset.drawingGroupId
        );
        const groupCommand = eventTarget.closest<HTMLElement>("[data-group-command]")
          ?.dataset.groupCommand as
            | "visible"
            | "locked"
            | "forward"
            | "backward"
            | "ungroup"
            | "delete"
            | undefined;
        if (group && groupCommand) {
          const members = currentViewModel?.drawings.filter((item) =>
            group.drawingIds.includes(item.id)
          ) ?? [];
          if (groupCommand === "visible") {
            actions?.setDrawingGroupVisible(
              group.id,
              !members.every((item) => item.visible !== false)
            );
          }
          if (groupCommand === "locked") {
            actions?.setDrawingGroupLocked(
              group.id,
              !members.every((item) => item.locked === true)
            );
          }
          if (groupCommand === "forward" || groupCommand === "backward") {
            actions?.moveDrawingGroup(group.id, groupCommand);
          }
          if (groupCommand === "ungroup") actions?.ungroupDrawingGroup(group.id);
          if (groupCommand === "delete") actions?.deleteDrawingGroupDrawings(group.id);
          return;
        }
        if (drawing) {
          select(drawing.id);
          return;
        }
        if (group && eventTarget.closest("[data-group-select]")) {
          const details = eventTarget.closest<HTMLDetailsElement>(
            "details[data-drawing-group-id]"
          );
          if (details) {
            details.open = !details.open;
            event.preventDefault();
          }
          actions?.setDrawingTool("select");
          actions?.executeDrawingCommand({
            type: "selectDrawings",
            drawingIds: [...group.drawingIds]
          });
        }
      };
      const onObjectChange = (event: Event) => {
        const input = (event.target as HTMLElement).closest<HTMLInputElement>(
          "[data-group-name]"
        );
        const group = currentViewModel?.drawingGroups.find(
          (item) => item.id === input?.closest<HTMLElement>("[data-drawing-group-id]")
            ?.dataset.drawingGroupId
        );
        if (!input || !group) return;
        const name = input.value.trim();
        if (!name) {
          input.value = group.name;
          return;
        }
        if (document.activeElement === input) delete input.dataset.focusKey;
        actions?.setDrawingGroupName(group.id, name);
      };
      tabList.addEventListener("click", onTabClick);
      objects.addEventListener("click", onObjectClick);
      objects.addEventListener("change", onObjectChange);
      return () => {
        tabList.removeEventListener("click", onTabClick);
        objects.removeEventListener("click", onObjectClick);
        objects.removeEventListener("change", onObjectChange);
        actions = undefined;
      };
    },
    render(viewModel) {
      currentViewModel = viewModel;
      // ponytail: the v1 `height` key is the dock extent; keep it to preserve stored layouts.
      const width = Math.max(240, Math.min(420, viewModel.bottomPanel.height));
      element.style.setProperty("--sc-inspector-width", `${width}px`);
      element.dataset.collapsed = String(viewModel.bottomPanel.collapsed);
      content.hidden = viewModel.bottomPanel.collapsed;
      for (const button of tabList.querySelectorAll("button")) {
        const selected = button.getAttribute("data-tab") === viewModel.bottomPanel.activeTab;
        button.setAttribute("aria-selected", String(selected));
      }
      title.textContent = tabs.find((tab) => tab.id === viewModel.bottomPanel.activeTab)?.label ?? "";
      let focusedKey = objects.contains(document.activeElement)
        ? (document.activeElement as HTMLElement).dataset.focusKey
        : undefined;
      const nextDrawingScope = `${viewModel.state.symbol.id}:${viewModel.state.adjustMode}`;
      if (drawingScope === nextDrawingScope) {
        for (const details of objects.querySelectorAll<HTMLDetailsElement>(
          "details[data-drawing-group-id]"
        )) {
          const groupId = details.dataset.drawingGroupId;
          if (!groupId) continue;
          if (details.open) expandedGroupIds.add(groupId);
          else expandedGroupIds.delete(groupId);
        }
      } else {
        drawingScope = nextDrawingScope;
        focusedKey = undefined;
        expandedGroupIds.clear();
        renderedGroupIds.clear();
      }
      objects.replaceChildren();
      const groupedDrawingIds = new Set(
        viewModel.drawingGroups.flatMap((group) => [...group.drawingIds])
      );
      const selectedDrawings = viewModel.drawings.filter((drawing) =>
        viewModel.selectedDrawingIds.includes(drawing.id)
      );
      const createGroup = document.createElement("button");
      createGroup.type = "button";
      createGroup.className = "sc-object-create-group";
      createGroup.dataset.createDrawingGroup = "";
      createGroup.dataset.focusKey = "create-group";
      createGroup.textContent = labels.createDrawingGroup;
      createGroup.disabled =
        selectedDrawings.length < 2 ||
        selectedDrawings.some(
          (drawing) =>
            drawing.interactive === false ||
            drawing.locked === true ||
            groupedDrawingIds.has(drawing.id)
        );
      const list = document.createElement("ul");
      list.className = "sc-object-list";
      const drawingById = new Map(viewModel.drawings.map((drawing) => [drawing.id, drawing]));
      const groupByDrawingId = new Map(
        viewModel.drawingGroups.flatMap((group) =>
          group.drawingIds.map((drawingId) => [drawingId, group] as const)
        )
      );
      const appendedGroupIds = new Set<string>();

      const drawingRow = (drawing: DrawingObject) => {
        const row = document.createElement("li");
        row.className = "sc-object-row";
        row.dataset.drawingId = drawing.id;
        row.dataset.selected = String(viewModel.selectedDrawingIds.includes(drawing.id));
        const selectButton = document.createElement("button");
        selectButton.type = "button";
        selectButton.dataset.focusKey = `drawing:${drawing.id}:select`;
        selectButton.textContent = `${drawing.type} ${drawing.id}`;
        const controls = [
          ["visible", drawing.visible === false ? labels.showObject : labels.hideObject],
          ["locked", drawing.locked ? labels.unlockObject : labels.lockObject],
          ["forward", labels.moveObjectForward],
          ["backward", labels.moveObjectBackward]
        ] as const;
        row.append(selectButton);
        for (const [command, label] of controls) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.objectCommand = command;
          button.dataset.focusKey = `drawing:${drawing.id}:${command}`;
          button.setAttribute("aria-label", label);
          button.textContent = label;
          button.disabled =
            drawing.interactive === false ||
            (drawing.locked === true && command !== "locked");
          row.append(button);
        }
        selectButton.disabled = drawing.interactive === false;
        return row;
      };

      for (const drawing of viewModel.drawings) {
        const group = groupByDrawingId.get(drawing.id);
        if (!group) {
          list.append(drawingRow(drawing));
          continue;
        }
        if (appendedGroupIds.has(group.id)) continue;
        appendedGroupIds.add(group.id);
        const item = document.createElement("li");
        item.className = "sc-object-group";
        const details = document.createElement("details");
        details.dataset.drawingGroupId = group.id;
        details.open =
          !renderedGroupIds.has(group.id) || expandedGroupIds.has(group.id);
        const summary = document.createElement("summary");
        summary.dataset.groupSelect = "";
        summary.dataset.focusKey = `group:${group.id}:select`;
        summary.setAttribute("aria-label", `${labels.selectDrawingGroup}: ${group.name}`);
        summary.textContent = group.name;
        const members = group.drawingIds.flatMap((drawingId) => {
          const member = drawingById.get(drawingId);
          return member ? [member] : [];
        });
        const hasNonInteractive = members.some((member) => member.interactive === false);
        const hasLocked = members.some((member) => member.locked === true);
        const allVisible = members.every((member) => member.visible !== false);
        const allLocked = members.every((member) => member.locked === true);
        const controls = document.createElement("div");
        controls.className = "sc-object-group-controls";
        const name = document.createElement("input");
        name.type = "text";
        name.maxLength = 256;
        name.value = group.name;
        name.dataset.groupName = "";
        name.dataset.focusKey = `group:${group.id}:name`;
        name.setAttribute("aria-label", labels.renameDrawingGroup);
        name.disabled = hasNonInteractive;
        controls.append(name);
        const groupControls = [
          ["visible", allVisible ? labels.hideObject : labels.showObject],
          ["locked", allLocked ? labels.unlockObject : labels.lockObject],
          ["forward", labels.moveObjectForward],
          ["backward", labels.moveObjectBackward],
          ["ungroup", labels.ungroupDrawingGroup],
          ["delete", labels.deleteDrawingGroupDrawings]
        ] as const;
        for (const [command, label] of groupControls) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.groupCommand = command;
          button.dataset.focusKey = `group:${group.id}:${command}`;
          button.setAttribute("aria-label", label);
          button.textContent = label;
          button.disabled =
            hasNonInteractive ||
            (hasLocked &&
              command !== "locked" &&
              command !== "ungroup");
          controls.append(button);
        }
        const membersList = document.createElement("ul");
        membersList.className = "sc-object-group-members";
        for (const member of members) membersList.append(drawingRow(member));
        details.append(summary, controls, membersList);
        item.append(details);
        list.append(item);
      }
      renderedGroupIds = new Set(viewModel.drawingGroups.map(({ id }) => id));
      objects.append(createGroup, list);
      if (focusedKey) {
        [...objects.querySelectorAll<HTMLElement>("[data-focus-key]")]
          .find((candidate) => candidate.dataset.focusKey === focusedKey)
          ?.focus();
      }
      const active = viewModel.bottomPanel.activeTab;
      objects.hidden = active !== "objects";
      propertyEditor.element.hidden = active !== "properties";
      dataWindow.element.hidden = active !== "data";
      propertyEditor.render(selectedDrawing(viewModel), (command) => actions?.executeDrawingCommand(command));
      dataWindow.render(currentDataWindow);
    },
    renderDataWindow(snapshot) {
      currentDataWindow = snapshot;
      dataWindow.render(snapshot);
    }
  };
}
