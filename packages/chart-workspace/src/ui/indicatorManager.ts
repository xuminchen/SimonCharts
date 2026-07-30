import { coreIndicatorDefinitions, type CoreIndicatorDefinition } from "@simoncharts/chart-engine";
import type {
  ChartCustomStudyDefinition,
  ChartCustomStudyInputDefinition,
  ChartStudyInputs,
  ChartStudyInputValue,
  ChartStudySource
} from "../contracts";
import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartController";
import type { IndicatorConfig } from "../runtime/indicatorRuntime";
import type { ChartLabels } from "./localization";

const createInstanceId = (id: string): string => `${id}-${crypto.randomUUID()}`;
const studySources: readonly ChartStudySource[] = [
  "open",
  "high",
  "low",
  "close",
  "hl2",
  "hlc3",
  "ohlc4"
];

type CustomStudyDefinition = Readonly<ChartCustomStudyDefinition<ChartStudyInputs>>;

interface EditorDefinition {
  readonly id: string;
  readonly title: string;
  readonly definitionVersion?: string;
  readonly inputs: readonly Readonly<ChartCustomStudyInputDefinition>[];
}

const definitionKey = (id: string, version?: string): string =>
  `${id}@${version ?? ""}`;

const coreEditorDefinition = (
  definition: Readonly<CoreIndicatorDefinition>
): EditorDefinition => ({
  id: definition.id,
  title: definition.id,
  inputs: definition.params.map((parameter) => ({
    id: parameter.id,
    title: parameter.id,
    defaultValue: parameter.defaultValue
  }))
});

const customEditorDefinition = (
  definition: CustomStudyDefinition
): EditorDefinition => ({
  id: definition.id,
  title: definition.title,
  definitionVersion: definition.version,
  inputs: definition.inputs
});

const inputValue = (
  definition: Readonly<ChartCustomStudyInputDefinition>,
  existing?: Readonly<IndicatorConfig>
): ChartStudyInputValue =>
  existing?.params[definition.id] ?? definition.defaultValue;

function appendOption(
  select: HTMLSelectElement,
  value: string,
  title: string
): void {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = title;
  select.append(option);
}

function createInputControl(
  study: Readonly<EditorDefinition>,
  definition: Readonly<ChartCustomStudyInputDefinition>,
  existing?: Readonly<IndicatorConfig>
): HTMLInputElement | HTMLSelectElement {
  const value = inputValue(definition, existing);
  const accessibleName = `${study.title} ${definition.title}`;
  let control: HTMLInputElement | HTMLSelectElement;
  if (definition.type === "select") {
    const select = document.createElement("select");
    for (const option of definition.options) {
      appendOption(select, option.value, option.title);
    }
    select.value = String(value);
    control = select;
  } else if (definition.type === "source") {
    const select = document.createElement("select");
    for (const source of definition.options ?? studySources) {
      appendOption(select, source, source);
    }
    select.value = String(value);
    control = select;
  } else {
    const input = document.createElement("input");
    if (definition.type === "boolean") {
      input.type = "checkbox";
      input.checked = value === true;
      input.style.width = "auto";
    } else {
      input.type = definition.type === "string" ? "text" : "number";
      input.value = String(value);
      if (definition.type === undefined || definition.type === "number") {
        if (definition.minValue !== undefined) input.min = String(definition.minValue);
        if (definition.maxValue !== undefined) input.max = String(definition.maxValue);
        input.step = definition.integer === true ? "1" : "any";
      }
    }
    control = input;
  }
  control.name = definition.id;
  control.dataset.studyInput = definition.id;
  control.setAttribute("aria-label", accessibleName);
  return control;
}

function readEditorInputs(
  editor: HTMLElement,
  definition: Readonly<EditorDefinition>
): Record<string, ChartStudyInputValue> {
  return Object.fromEntries(definition.inputs.map((inputDefinition) => {
    const control = editor.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-study-input="${CSS.escape(inputDefinition.id)}"]`
    );
    if (control === null) {
      throw new TypeError(`Study input ${inputDefinition.id} is unavailable`);
    }
    if (inputDefinition.type === "boolean") {
      return [inputDefinition.id, (control as HTMLInputElement).checked] as const;
    }
    if (inputDefinition.type === undefined || inputDefinition.type === "number") {
      return [inputDefinition.id, (control as HTMLInputElement).valueAsNumber] as const;
    }
    return [inputDefinition.id, control.value] as const;
  }));
}

export interface IndicatorManager {
  readonly element: HTMLDivElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
}

export function createIndicatorManager(
  labels: ChartLabels,
  compact = false,
  titleFor: (config: Readonly<IndicatorConfig>) => string = (config) => config.id,
  customStudies: readonly CustomStudyDefinition[] = []
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
  const editorDefinitions = [
    ...coreIndicatorDefinitions.map(coreEditorDefinition),
    ...customStudies.map(customEditorDefinition)
  ];
  const definitionsByKey = new Map(
    editorDefinitions.map((definition) => [
      definitionKey(definition.id, definition.definitionVersion),
      definition
    ])
  );
  for (const definition of editorDefinitions) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.studyDefinition = definitionKey(
      definition.id,
      definition.definitionVersion
    );
    if (definition.definitionVersion === undefined) {
      button.dataset.indicatorId = definition.id;
    }
    button.textContent = definition.definitionVersion === undefined
      ? coreIndicatorDefinitions.find((candidate) => candidate.id === definition.id)?.label ??
        definition.title
      : definition.title;
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
  let active: EditorDefinition | undefined;
  let activeInstanceId: string | undefined;

  const showEditor = (definition: EditorDefinition, existing?: IndicatorConfig) => {
    active = definition;
    activeInstanceId = existing?.instanceId;
    editor.replaceChildren();
    for (const parameter of definition.inputs) {
      const label = document.createElement("label");
      label.textContent = parameter.title;
      label.append(createInputControl(definition, parameter, existing));
      editor.append(label);
    }
    const apply = document.createElement("button");
    apply.type = "button";
    apply.dataset.applyStudy = definitionKey(
      definition.id,
      definition.definitionVersion
    );
    apply.textContent = `Apply ${definition.id}`;
    const error = document.createElement("div");
    error.dataset.testid = "indicator-editor-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    editor.append(apply, error);
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
        const definitionId = target.closest<HTMLElement>("[data-study-definition]")
          ?.dataset.studyDefinition;
        if (definitionId) {
          const definition = definitionsByKey.get(definitionId);
          if (definition) showEditor(definition);
          return;
        }
        const editInstanceId = target.closest<HTMLElement>("[data-edit-indicator]")?.dataset.editIndicator;
        if (editInstanceId) {
          const existing = current.find((config) => config.instanceId === editInstanceId);
          const definition = existing === undefined
            ? undefined
            : definitionsByKey.get(definitionKey(existing.id, existing.definitionVersion));
          if (existing && definition) showEditor(definition, existing);
          return;
        }
        const applyId = target.closest<HTMLElement>("[data-apply-study]")?.dataset.applyStudy;
        if (active && applyId === definitionKey(active.id, active.definitionVersion)) {
          const error = editor.querySelector<HTMLElement>("[data-testid='indicator-editor-error']");
          if (activeInstanceId === undefined && current.length >= 32) {
            if (error) {
              error.textContent = labels.studyLimitReached;
              error.hidden = false;
            }
            return;
          }
          try {
            const params = readEditorInputs(editor, active);
            const existing = activeInstanceId === undefined
              ? undefined
              : current.find((config) => config.instanceId === activeInstanceId);
            if (activeInstanceId !== undefined && existing === undefined) {
              throw new DOMException(labels.studyNoLongerExists, "NotFoundError");
            }
            const next = existing === undefined
              ? {
                  instanceId: createInstanceId(active.id),
                  id: active.id,
                  ...(active.definitionVersion === undefined
                    ? {}
                    : { definitionVersion: active.definitionVersion }),
                  params,
                  visible: true
                }
              : {
                  ...existing,
                  params
                };
            actions?.setIndicators(activeInstanceId === undefined
              ? [...current, next as IndicatorConfig]
              : current.map((config) =>
                  config.instanceId === activeInstanceId
                    ? next as IndicatorConfig
                    : config
                ));
            popup.hidden = true;
            open.setAttribute("aria-expanded", "false");
          } catch (cause) {
            if (error) {
              error.textContent = cause instanceof Error ? cause.message : "Study inputs are invalid";
              error.hidden = false;
            }
          }
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
        if (event.key !== "Escape" || popup.hidden) return;
        popup.hidden = true;
        open.setAttribute("aria-expanded", "false");
        open.focus();
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
        const editable = definitionsByKey.has(
          definitionKey(config.id, config.definitionVersion)
        );
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
