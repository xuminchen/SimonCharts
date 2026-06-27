import type { DrawingObject, DrawingStyle, DrawingType } from "./drawingTypes";

export type DrawingPropertyScope = "style" | "content" | "state";
export type DrawingPropertyValueType = "boolean" | "color" | "lineDash" | "number" | "text";
export type DrawingStylePropertyKey = keyof DrawingStyle;
export type DrawingContentPropertyKey = "text";
export type DrawingStatePropertyKey = "locked" | "visible";

export interface DrawingPropertyOption {
  label: string;
  value: string;
}

export interface DrawingStylePropertyDefinition {
  id: string;
  label: string;
  scope: "style";
  valueType: DrawingPropertyValueType;
  styleKey: DrawingStylePropertyKey;
  commandType: "updateSelectedStyle";
  defaultValue?: string | number | number[];
  min?: number;
  max?: number;
  step?: number;
  options?: DrawingPropertyOption[];
}

export interface DrawingContentPropertyDefinition {
  id: string;
  label: string;
  scope: "content";
  valueType: "text";
  contentKey: DrawingContentPropertyKey;
  commandType: "updateSelectedText";
  defaultValue?: string;
}

export interface DrawingStatePropertyDefinition {
  id: string;
  label: string;
  scope: "state";
  valueType: "boolean";
  stateKey: DrawingStatePropertyKey;
  commandWhenTrue: "showSelected" | "lockSelected";
  commandWhenFalse: "hideSelected" | "unlockSelected";
  defaultValue: boolean;
}

export type DrawingPropertyDefinition =
  | DrawingStylePropertyDefinition
  | DrawingContentPropertyDefinition
  | DrawingStatePropertyDefinition;

export interface DrawingPropertySchema {
  type: DrawingType;
  properties: DrawingPropertyDefinition[];
}

const textDrawingTypes = new Set<DrawingType>([
  "text",
  "callout",
  "simpleAnnotation",
  "simpleTag"
]);

const fillDrawingTypes = new Set<DrawingType>([
  "parallelChannel",
  "regressionChannel",
  "priceChannelLine",
  "fibChannel",
  "fibWedge",
  "rectangle",
  "rotatedRectangle",
  "circle",
  "ellipse",
  "polygon",
  "triangle",
  "longPosition",
  "shortPosition",
  "profitLossRange",
  "datePriceRange",
  "dateRange",
  "priceRange",
  "gannBox",
  "gannSquare",
  "xabcdPattern",
  "cypherPattern",
  "headAndShouldersPattern"
]);

const lineDashOptions: DrawingPropertyOption[] = [
  { label: "Solid", value: "solid" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" }
];

const baseStyleProperties: DrawingStylePropertyDefinition[] = [
  {
    id: "style.color",
    label: "Color",
    scope: "style",
    valueType: "color",
    styleKey: "color",
    commandType: "updateSelectedStyle",
    defaultValue: "#2563eb"
  },
  {
    id: "style.lineWidth",
    label: "Width",
    scope: "style",
    valueType: "number",
    styleKey: "lineWidth",
    commandType: "updateSelectedStyle",
    defaultValue: 2,
    min: 1,
    max: 12,
    step: 1
  },
  {
    id: "style.lineDash",
    label: "Line",
    scope: "style",
    valueType: "lineDash",
    styleKey: "lineDash",
    commandType: "updateSelectedStyle",
    defaultValue: [],
    options: lineDashOptions
  }
];

const fillProperty: DrawingStylePropertyDefinition = {
  id: "style.fill",
  label: "Fill",
  scope: "style",
  valueType: "color",
  styleKey: "fill",
  commandType: "updateSelectedStyle",
  defaultValue: "#dbeafe"
};

const textStyleProperties: DrawingStylePropertyDefinition[] = [
  {
    id: "style.textColor",
    label: "Text Color",
    scope: "style",
    valueType: "color",
    styleKey: "textColor",
    commandType: "updateSelectedStyle",
    defaultValue: "#111827"
  },
  {
    id: "style.fontSize",
    label: "Font Size",
    scope: "style",
    valueType: "number",
    styleKey: "fontSize",
    commandType: "updateSelectedStyle",
    defaultValue: 12,
    min: 8,
    max: 48,
    step: 1
  }
];

const textProperty: DrawingContentPropertyDefinition = {
  id: "content.text",
  label: "Text",
  scope: "content",
  valueType: "text",
  contentKey: "text",
  commandType: "updateSelectedText",
  defaultValue: ""
};

const stateProperties: DrawingStatePropertyDefinition[] = [
  {
    id: "state.visible",
    label: "Visible",
    scope: "state",
    valueType: "boolean",
    stateKey: "visible",
    commandWhenTrue: "showSelected",
    commandWhenFalse: "hideSelected",
    defaultValue: true
  },
  {
    id: "state.locked",
    label: "Locked",
    scope: "state",
    valueType: "boolean",
    stateKey: "locked",
    commandWhenTrue: "lockSelected",
    commandWhenFalse: "unlockSelected",
    defaultValue: false
  }
];

export function isTextDrawingType(type: DrawingType): boolean {
  return textDrawingTypes.has(type);
}

export function isFillDrawingType(type: DrawingType): boolean {
  return fillDrawingTypes.has(type);
}

export function getDrawingPropertySchema(type: DrawingType): DrawingPropertySchema {
  return {
    type,
    properties: getPropertyDefinitionsForType(type)
  };
}

export function getDrawingPropertyDefinitionsForDrawing(
  drawing: DrawingObject
): DrawingPropertyDefinition[] {
  return getPropertyDefinitionsForType(drawing.type);
}

function getPropertyDefinitionsForType(type: DrawingType): DrawingPropertyDefinition[] {
  const properties: DrawingPropertyDefinition[] = [...baseStyleProperties];

  if (isFillDrawingType(type)) {
    properties.push(fillProperty);
  }

  if (isTextDrawingType(type)) {
    properties.push(...textStyleProperties, textProperty);
  }

  properties.push(...stateProperties);

  return properties.map(clonePropertyDefinition);
}

function clonePropertyDefinition<T extends DrawingPropertyDefinition>(definition: T): T {
  if (definition.scope !== "style") {
    return { ...definition } as T;
  }

  return {
    ...definition,
    defaultValue: Array.isArray(definition.defaultValue)
      ? [...definition.defaultValue]
      : definition.defaultValue,
    options: definition.options?.map((option) => ({ ...option }))
  } as T;
}
