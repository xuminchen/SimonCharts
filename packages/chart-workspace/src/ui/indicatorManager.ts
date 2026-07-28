import { coreIndicatorDefinitions, type CoreIndicatorDefinition } from "@simoncharts/chart-engine";
import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartController";
import type { IndicatorConfig } from "../runtime/indicatorRuntime";
import type { ChartLabels } from "./localization";

function validParams(id: string, params: Record<string, number>): boolean {
  if (Object.values(params).some((value) => !Number.isFinite(value) || value <= 0)) return false;
  for (const key of ["period", "fast", "slow", "signal"]) {
    if (params[key] !== undefined && !Number.isInteger(params[key])) return false;
  }
  if (params.fast !== undefined && params.slow !== undefined && params.fast >= params.slow) return false;
  if (id === "SAR" && params.step !== undefined && params.max !== undefined && params.step > params.max) return false;
  return true;
}

const createInstanceId = (id: string): string => `${id}-${crypto.randomUUID()}`;

export interface IndicatorManager {
  readonly element: HTMLDivElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
}

export function createIndicatorManager(
  labels: ChartLabels,
  compact = false,
  titleFor: (config: Readonly<IndicatorConfig>) => string = (config) => config.id
): IndicatorManager {
  const element = document.createElement("div");
  element.className = "sc-indicator-manager";
  const open = document.createElement("button");
  open.type = "button";
  open.dataset.testid = "indicator-manager-open";
  open.textContent = labels.indicators;
  open.setAttribute("aria-expanded", "false");
  const popup = document.createElement("div");
  popup.className = "sc-indicator-popup";
  popup.hidden = true;
  const definitions = document.createElement("div");
  for (const definition of coreIndicatorDefinitions) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.indicatorId = definition.id;
    button.textContent = definition.label;
    definitions.append(button);
  }
  const editor = document.createElement("div");
  const legends = document.createElement("div");
  legends.className = "sc-indicator-legends";
  popup.append(definitions, editor);
  if (compact) popup.append(legends);
  element.append(open, popup);
  if (!compact) element.append(legends);
  let actions: WorkspaceUiActions | undefined;
  let current: readonly IndicatorConfig[] = [];
  let active: CoreIndicatorDefinition | undefined;
  let activeInstanceId: string | undefined;

  const showEditor = (definition: CoreIndicatorDefinition, existing?: IndicatorConfig) => {
    active = definition;
    activeInstanceId = existing?.instanceId;
    editor.replaceChildren();
    for (const parameter of definition.params) {
      const label = document.createElement("label");
      label.textContent = `${definition.id} ${parameter.id}`;
      const input = document.createElement("input");
      input.type = "number";
      input.name = parameter.id;
      input.setAttribute("aria-label", `${definition.id} ${parameter.id}`);
      input.value = String(existing?.params[parameter.id] ?? parameter.defaultValue);
      label.append(input);
      editor.append(label);
    }
    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = `Apply ${definition.id}`;
    editor.append(apply);
  };

  return {
    element,
    bind(nextActions) {
      actions = nextActions;
      const toggle = () => {
        popup.hidden = !popup.hidden;
        open.setAttribute("aria-expanded", String(!popup.hidden));
      };
      const click = (event: Event) => {
        const target = event.target as HTMLElement;
        const id = target.closest<HTMLElement>("[data-indicator-id]")?.dataset.indicatorId;
        if (id) {
          const definition = coreIndicatorDefinitions.find((candidate) => candidate.id === id);
          if (definition) showEditor(definition);
          return;
        }
        const editInstanceId = target.closest<HTMLElement>("[data-edit-indicator]")?.dataset.editIndicator;
        if (editInstanceId) {
          const existing = current.find((config) => config.instanceId === editInstanceId);
          const definition = coreIndicatorDefinitions.find((candidate) => candidate.id === existing?.id);
          if (existing && definition) showEditor(definition, existing);
          return;
        }
        if (active && target.textContent === `Apply ${active.id}`) {
          if (activeInstanceId === undefined && current.length >= 32) return;
          const params = Object.fromEntries(
            [...editor.querySelectorAll<HTMLInputElement>("input")].map((input) => [input.name, Number(input.value)])
          );
          if (!validParams(active.id, params)) return;
          const next: IndicatorConfig = {
            instanceId: activeInstanceId ?? createInstanceId(active.id),
            id: active.id,
            params,
            visible: true
          };
          actions?.setIndicators(activeInstanceId === undefined
            ? [...current, next]
            : current.map((config) => config.instanceId === activeInstanceId ? next : config));
          popup.hidden = true;
          open.setAttribute("aria-expanded", "false");
        }
        const hideId = target.closest<HTMLElement>("[data-hide-indicator]")?.dataset.hideIndicator;
        if (hideId) actions?.setIndicators(current.map((config) => config.instanceId === hideId ? { ...config, visible: !config.visible } : config));
        const removeId = target.closest<HTMLElement>("[data-remove-indicator]")?.dataset.removeIndicator;
        if (removeId) actions?.setIndicators(current.filter((config) => config.instanceId !== removeId));
      };
      const outside = (event: PointerEvent) => {
        if (element.contains(event.target as Node)) return;
        popup.hidden = true;
        open.setAttribute("aria-expanded", "false");
      };
      const escape = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        popup.hidden = true;
        open.setAttribute("aria-expanded", "false");
      };
      open.addEventListener("click", toggle);
      element.addEventListener("click", click);
      element.ownerDocument.addEventListener("pointerdown", outside);
      element.ownerDocument.addEventListener("keydown", escape);
      return () => {
        open.removeEventListener("click", toggle);
        element.removeEventListener("click", click);
        element.ownerDocument.removeEventListener("pointerdown", outside);
        element.ownerDocument.removeEventListener("keydown", escape);
      };
    },
    render(viewModel) {
      current = viewModel.indicators;
      legends.replaceChildren();
      for (const config of current) {
        const legend = document.createElement("span");
        legend.dataset.testid = `indicator-legend-${config.instanceId}`;
        legend.dataset.visible = String(config.visible);
        const title = titleFor(config);
        legend.textContent = `${title}${Object.values(config.params).length === 0 ? "" : ` ${Object.values(config.params).join(",")}`}${config.visible ? "" : " (隐藏)"}`;
        const editable = coreIndicatorDefinitions.some((definition) => definition.id === config.id);
        const edit = editable ? document.createElement("button") : undefined;
        if (edit) {
          edit.type = "button";
          edit.dataset.editIndicator = config.instanceId;
          edit.setAttribute("aria-label", `Edit ${config.id}`);
          edit.textContent = "设置";
        }
        const hide = document.createElement("button");
        hide.type = "button";
        hide.dataset.hideIndicator = config.instanceId;
        hide.setAttribute("aria-label", `${config.visible ? "Hide" : "Show"} ${config.id}`);
        hide.textContent = config.visible ? "隐藏" : "显示";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.dataset.removeIndicator = config.instanceId;
        remove.textContent = "删除";
        legend.append(...(edit === undefined ? [] : [edit]), hide, remove);
        legends.append(legend);
      }
    }
  };
}
