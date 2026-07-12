import {
  getDrawingPropertyDefinitionsForDrawing,
  type DrawingEditorCommand,
  type DrawingObject,
  type DrawingPropertyDefinition,
  type DrawingStyle
} from "@simoncharts/chart-engine";

export interface PropertyEditor {
  readonly element: HTMLDivElement;
  render(drawing: DrawingObject | undefined, execute: (command: DrawingEditorCommand) => void): void;
}

function valueOf(drawing: DrawingObject, definition: DrawingPropertyDefinition): unknown {
  if (definition.scope === "style") return drawing.style?.[definition.styleKey] ?? definition.defaultValue;
  if (definition.scope === "content") return drawing.text ?? definition.defaultValue;
  if (definition.scope === "parameters") return drawing.metadata?.[definition.metadataKey] ?? definition.defaultValue;
  return definition.stateKey === "visible" ? drawing.visible !== false : drawing.locked === true;
}

function dashValue(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "solid";
  return value[0] === 2 ? "dotted" : "dashed";
}

function dashPattern(value: string): number[] {
  if (value === "dashed") return [6, 4];
  if (value === "dotted") return [2, 3];
  return [];
}

function numberInSchema(value: number, definition: DrawingPropertyDefinition): number {
  if (definition.scope !== "style" && definition.scope !== "parameters") return value;
  return Math.min(definition.max ?? value, Math.max(definition.min ?? value, value));
}

function commandFor(
  definition: DrawingPropertyDefinition,
  input: HTMLInputElement | HTMLSelectElement
): DrawingEditorCommand | undefined {
  if (definition.scope === "state") {
    return { type: input instanceof HTMLInputElement && input.checked
      ? definition.commandWhenTrue
      : definition.commandWhenFalse };
  }
  if (definition.scope === "content") return { type: "updateSelectedText", text: input.value };
  if (definition.scope === "parameters") {
    const value = definition.valueType === "numberList"
      ? input.value.split(",").map(Number).filter(Number.isFinite).map((item) => numberInSchema(item, definition))
      : input.value;
    return { type: "updateSelectedMetadata", metadata: { [definition.metadataKey]: value } };
  }
  let value: string | number | number[] = input.value;
  if (definition.valueType === "number") value = numberInSchema(Number(input.value), definition);
  if (definition.valueType === "lineDash") value = dashPattern(input.value);
  return { type: "updateSelectedStyle", style: { [definition.styleKey]: value } as DrawingStyle };
}

export function createPropertyEditor(): PropertyEditor {
  const element = document.createElement("div");
  element.className = "sc-property-editor";
  return {
    element,
    render(drawing, execute) {
      element.replaceChildren();
      if (!drawing) {
        const empty = document.createElement("p");
        empty.className = "sc-panel-empty";
        empty.textContent = "请选择一个绘图对象";
        element.append(empty);
        return;
      }
      for (const definition of getDrawingPropertyDefinitionsForDrawing(drawing)) {
        const label = document.createElement("label");
        label.textContent = definition.label;
        let input: HTMLInputElement | HTMLSelectElement;
        if (definition.valueType === "lineDash") {
          input = document.createElement("select");
          for (const optionDefinition of definition.options ?? []) {
            const option = document.createElement("option");
            option.value = optionDefinition.value;
            option.textContent = optionDefinition.label;
            input.append(option);
          }
          input.value = dashValue(valueOf(drawing, definition));
        } else {
          input = document.createElement("input");
          input.type = definition.valueType === "boolean"
            ? "checkbox"
            : definition.valueType === "number"
              ? "number"
              : definition.valueType === "color"
                ? "color"
                : "text";
          const value = valueOf(drawing, definition);
          if (input.type === "checkbox") input.checked = Boolean(value);
          else input.value = Array.isArray(value) ? value.join(", ") : String(value ?? "");
          if ((definition.scope === "style" || definition.scope === "parameters") && definition.valueType !== "text") {
            if (definition.min !== undefined) input.min = String(definition.min);
            if (definition.max !== undefined) input.max = String(definition.max);
            if (definition.step !== undefined) input.step = String(definition.step);
          }
        }
        input.setAttribute("aria-label", definition.label);
        const commit = () => {
          const command = commandFor(definition, input);
          if (command) execute(command);
        };
        input.addEventListener(definition.valueType === "color" ? "input" : "change", commit);
        label.append(input);
        element.append(label);
      }
    }
  };
}
