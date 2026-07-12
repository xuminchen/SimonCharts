import { coreIndicatorDefinitions, type CoreIndicatorDefinition } from "@simoncharts/chart-engine";
import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartWorkspaceController";
import type { IndicatorConfig } from "../runtime/indicatorRuntime";

function validParams(id: string, params: Record<string, number>): boolean {
  if (Object.values(params).some((value) => !Number.isFinite(value) || value <= 0)) return false;
  for (const key of ["period", "fast", "slow", "signal"]) {
    if (params[key] !== undefined && !Number.isInteger(params[key])) return false;
  }
  if (params.fast !== undefined && params.slow !== undefined && params.fast >= params.slow) return false;
  if (id === "SAR" && params.step !== undefined && params.max !== undefined && params.step > params.max) return false;
  return true;
}

export interface IndicatorManager {
  readonly element: HTMLDivElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
}

export function createIndicatorManager(): IndicatorManager {
  const element = document.createElement("div");
  element.className = "sc-indicator-manager";
  const open = document.createElement("button");
  open.type = "button";
  open.dataset.testid = "indicator-manager-open";
  open.textContent = "指标";
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
  element.append(open, popup, legends);
  let actions: WorkspaceUiActions | undefined;
  let current: readonly IndicatorConfig[] = [];
  let active: CoreIndicatorDefinition | undefined;

  const showEditor = (definition: CoreIndicatorDefinition) => {
    active = definition;
    editor.replaceChildren();
    const existing = current.find((config) => config.id === definition.id);
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
      const toggle = () => { popup.hidden = !popup.hidden; };
      const click = (event: Event) => {
        const target = event.target as HTMLElement;
        const id = target.closest<HTMLElement>("[data-indicator-id]")?.dataset.indicatorId;
        if (id) {
          const definition = coreIndicatorDefinitions.find((candidate) => candidate.id === id);
          if (definition) showEditor(definition);
          return;
        }
        if (active && target.textContent === `Apply ${active.id}`) {
          const params = Object.fromEntries(
            [...editor.querySelectorAll<HTMLInputElement>("input")].map((input) => [input.name, Number(input.value)])
          );
          if (!validParams(active.id, params)) return;
          const next: IndicatorConfig = { id: active.id, params, visible: true, panelId: active.panelId };
          actions?.setIndicators([...current.filter((config) => config.id !== active!.id), next]);
          popup.hidden = true;
        }
        const hideId = target.closest<HTMLElement>("[data-hide-indicator]")?.dataset.hideIndicator;
        if (hideId) actions?.setIndicators(current.map((config) => config.id === hideId ? { ...config, visible: false } : config));
        const removeId = target.closest<HTMLElement>("[data-remove-indicator]")?.dataset.removeIndicator;
        if (removeId) actions?.setIndicators(current.filter((config) => config.id !== removeId));
      };
      open.addEventListener("click", toggle);
      element.addEventListener("click", click);
      return () => { open.removeEventListener("click", toggle); element.removeEventListener("click", click); };
    },
    render(viewModel) {
      current = viewModel.indicators;
      legends.replaceChildren();
      for (const config of current) {
        const legend = document.createElement("span");
        legend.dataset.testid = `indicator-legend-${config.id}`;
        legend.hidden = !config.visible;
        legend.textContent = `${config.id} ${Object.values(config.params).join(",")}`;
        const hide = document.createElement("button");
        hide.type = "button";
        hide.dataset.hideIndicator = config.id;
        hide.setAttribute("aria-label", `Hide ${config.id}`);
        hide.textContent = "隐藏";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.dataset.removeIndicator = config.id;
        remove.textContent = "删除";
        legend.append(hide, remove);
        legends.append(legend);
      }
    }
  };
}
