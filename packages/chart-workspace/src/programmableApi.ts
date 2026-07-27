import {
  builtInDrawingToolDefinitions,
  coreIndicatorDefinitions,
  type DrawingObject
} from "@simoncharts/chart-engine";
import type {
  ChartDrawing,
  ChartDrawingStyle,
  ChartDrawingTool,
  ChartEntity,
  ChartEntityId,
  ChartEntityInput,
  ChartEntityKind,
  ChartIndicator,
  ChartIndicatorInput,
  ChartJsonValue,
  ChartLayoutV2,
  ChartMark,
  ChartPriceScaleMode,
  ChartSeriesType,
  ChartState,
  ChartVisibleRange
} from "./contracts";

const seriesTypes: readonly ChartSeriesType[] = [
  "bars", "candles", "hollowCandles", "volumeCandles", "line",
  "lineWithMarkers", "stepLine", "area", "hlcArea", "baseline",
  "columns", "highLow", "heikinAshi", "renko", "lineBreak", "kagi",
  "pointAndFigure"
];
const priceScaleModes: readonly ChartPriceScaleMode[] = ["linear", "log", "percentage"];
const drawingDefinitions = new Map(
  builtInDrawingToolDefinitions.map((definition) => [definition.type, definition])
);
const indicatorDefinitions = new Map(
  coreIndicatorDefinitions.map((definition) => [definition.id, definition])
);
const integerIndicatorParams = new Set(["period", "fast", "slow", "signal"]);
const maxIndicators = 32;
const maxDrawings = 1_000;
const maxAnchorsPerDrawing = 10_000;
const maxTotalAnchors = 50_000;
const maxLineDashEntries = 64;
const maxMarks = 50_000;
const maxJsonNodes = 50_000;
const maxJsonCharacters = 1_000_000;
const maxTextLength = 10_000;
const maxTotalTextLength = 1_000_000;
const maxIdentifierLength = 256;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some((descriptor) => !("value" in descriptor))) {
    throw new TypeError(`${label} must contain only data properties`);
  }
  return Object.fromEntries(
    Object.entries(descriptors)
      .filter(([, descriptor]) => descriptor.enumerable)
      .map(([key, descriptor]) => [key, descriptor.value])
  );
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new TypeError(`${label} contains unsupported fields`);
  }
}

function identifier(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maxIdentifierLength
  ) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return identifier(value, label);
}

function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxTextLength) {
    throw new TypeError(`${label} must be a bounded string`);
  }
  return value;
}

function jsonValue(
  value: unknown,
  label: string,
  budget = { remaining: maxJsonNodes, remainingCharacters: maxJsonCharacters },
  seen = new WeakSet<object>(),
  depth = 0
): ChartJsonValue {
  budget.remaining -= 1;
  if (budget.remaining < 0 || depth > 100) {
    throw new TypeError(`${label} must be bounded JSON-safe data`);
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    budget.remainingCharacters -= value.length;
    if (value.length > maxTextLength || budget.remainingCharacters < 0) {
      throw new TypeError(`${label} must be bounded JSON-safe data`);
    }
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError(`${label} must be JSON-safe`);
    const keys = Object.keys(value);
    if (
      keys.length !== value.length ||
      keys.some((key, index) => key !== String(index))
    ) {
      throw new TypeError(`${label} must be a dense JSON-safe array`);
    }
    seen.add(value);
    try {
      return value.map((item, index) =>
        jsonValue(item, `${label} ${index}`, budget, seen, depth + 1)
      );
    } finally {
      seen.delete(value);
    }
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${label} must be JSON-safe`);
  }
  if (seen.has(value)) throw new TypeError(`${label} must be JSON-safe`);
  seen.add(value);
  try {
    const result: Record<string, ChartJsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      budget.remainingCharacters -= key.length;
      if (budget.remainingCharacters < 0) {
        throw new TypeError(`${label} must be bounded JSON-safe data`);
      }
      Object.defineProperty(result, key, {
        value: jsonValue(item, `${label}.${key}`, budget, seen, depth + 1),
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function parseSeriesType(value: unknown): ChartSeriesType {
  if (!seriesTypes.includes(value as ChartSeriesType)) {
    throw new TypeError("Chart series type is unsupported");
  }
  return value as ChartSeriesType;
}

export function parsePriceScaleMode(value: unknown): ChartPriceScaleMode {
  if (!priceScaleModes.includes(value as ChartPriceScaleMode)) {
    throw new TypeError("Chart price scale mode is unsupported");
  }
  return value as ChartPriceScaleMode;
}

export function parseDrawingTool(value: unknown): ChartDrawingTool {
  if (value !== "select" && !drawingDefinitions.has(value as ChartDrawing["type"])) {
    throw new TypeError("Chart drawing tool is unsupported");
  }
  return value as ChartDrawingTool;
}

export function parseEntityKind(value: unknown): ChartEntityKind {
  if (value !== "indicator" && value !== "drawing" && value !== "mark") {
    throw new TypeError("Chart entity kind is unsupported");
  }
  return value;
}

export function parseEntityId(value: unknown): ChartEntityId {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    (!value.startsWith("indicator:") &&
      !value.startsWith("drawing:") &&
      !value.startsWith("mark:"))
  ) {
    throw new TypeError("Chart entity id is invalid");
  }
  return value as ChartEntityId;
}

export function toEntityId(
  entity: Readonly<ChartEntityInput>,
  state: Readonly<ChartState>,
  scope: readonly [chartId: string, persistenceScopeId: string, dataContextId: string]
): ChartEntityId {
  if (entity.kind === "indicator") {
    return `indicator:${JSON.stringify([scope[0], scope[1], entity.value.instanceId])}`;
  }
  if (entity.kind === "drawing") {
    return `drawing:${JSON.stringify([
      ...scope,
      state.symbol.id,
      state.adjustMode,
      entity.value.id
    ])}`;
  }
  return `mark:${JSON.stringify([...scope, state.symbol.id, entity.value.id])}`;
}

function parseIndicatorInputValue(candidate: unknown, index: number): ChartIndicatorInput {
    const item = record(candidate, `Chart indicator ${index}`);
    onlyKeys(item, ["instanceId", "id", "params", "visible"], `Chart indicator ${index}`);
    const instanceId = item.instanceId === undefined
      ? undefined
      : identifier(item.instanceId, `Chart indicator ${index} instanceId`);
    const definition = indicatorDefinitions.get(item.id as ChartIndicator["id"]);
    if (definition === undefined) throw new TypeError(`Chart indicator ${index} is unsupported`);
    const id = definition.id;
    const params = record(item.params, `Chart indicator ${id} params`);
    const allowed = definition.params.map((parameter) => parameter.id);
    if (Object.keys(params).some((key) => !allowed.includes(key))) {
      throw new TypeError(`Chart indicator ${id} contains unsupported params`);
    }
    const parsedParams = Object.fromEntries(definition.params.map((parameterDefinition) => {
      const key = parameterDefinition.id;
      const raw = key in params ? params[key] : parameterDefinition.defaultValue;
      const parameter = finite(raw, `Chart indicator ${id} param ${key}`);
      if (parameter <= 0 || (integerIndicatorParams.has(key) && !Number.isInteger(parameter))) {
        throw new TypeError(`Chart indicator ${id} param ${key} is invalid`);
      }
      return [key, parameter] as const;
    }));
    if (
      typeof parsedParams.fast === "number" &&
      typeof parsedParams.slow === "number" &&
      parsedParams.fast >= parsedParams.slow
    ) throw new TypeError("Chart indicator MACD fast must be less than slow");
    if (
      id === "SAR" &&
      typeof parsedParams.step === "number" &&
      typeof parsedParams.max === "number" &&
      parsedParams.step > parsedParams.max
    ) throw new TypeError("Chart indicator SAR step must not exceed max");
    if (typeof item.visible !== "boolean") {
      throw new TypeError(`Chart indicator ${id} visibility must be boolean`);
    }
    return {
      ...(instanceId === undefined ? {} : { instanceId }),
      id,
      params: parsedParams,
      visible: item.visible
    };
}

export function parseIndicatorInput(value: unknown): ChartIndicatorInput {
  return parseIndicatorInputValue(value, 0);
}

export function parseIndicators(value: unknown): ChartIndicator[] {
  if (!Array.isArray(value)) throw new TypeError("Chart indicators must be an array");
  if (value.length > maxIndicators) {
    throw new TypeError(`Chart indicators must contain at most ${maxIndicators} items`);
  }
  const seen = new Set<string>();
  return value.map((candidate, index) => {
    const indicator = parseIndicatorInputValue(candidate, index);
    if (indicator.instanceId === undefined) {
      throw new TypeError(`Chart indicator ${index} instanceId is required`);
    }
    if (seen.has(indicator.instanceId)) {
      throw new TypeError(`Chart indicator instance ${indicator.instanceId} is duplicated`);
    }
    seen.add(indicator.instanceId);
    return { ...indicator, instanceId: indicator.instanceId };
  });
}

function parseDrawingStyle(value: unknown, index: number): ChartDrawingStyle | undefined {
  if (value === undefined) return undefined;
  const style = record(value, `Chart drawing ${index} style`);
  onlyKeys(
    style,
    ["color", "lineWidth", "lineDash", "fill", "textColor", "fontSize"],
    `Chart drawing ${index} style`
  );
  const lineWidth = style.lineWidth === undefined
    ? undefined
    : finite(style.lineWidth, `Chart drawing ${index} lineWidth`);
  const fontSize = style.fontSize === undefined
    ? undefined
    : finite(style.fontSize, `Chart drawing ${index} fontSize`);
  if ((lineWidth !== undefined && lineWidth <= 0) || (fontSize !== undefined && fontSize <= 0)) {
    throw new TypeError(`Chart drawing ${index} style dimensions must be positive`);
  }
  let lineDash: number[] | undefined;
  if (style.lineDash !== undefined) {
    if (!Array.isArray(style.lineDash) || style.lineDash.length > maxLineDashEntries) {
      throw new TypeError(`Chart drawing ${index} lineDash must be an array`);
    }
    lineDash = style.lineDash.map((raw, dashIndex) => {
      const dash = finite(raw, `Chart drawing ${index} lineDash ${dashIndex}`);
      if (dash < 0) throw new TypeError(`Chart drawing ${index} lineDash must be non-negative`);
      return dash;
    });
  }
  return {
    ...(optionalString(style.color, `Chart drawing ${index} color`) === undefined
      ? {}
      : { color: style.color as string }),
    ...(lineWidth === undefined ? {} : { lineWidth }),
    ...(lineDash === undefined ? {} : { lineDash }),
    ...(optionalString(style.fill, `Chart drawing ${index} fill`) === undefined
      ? {}
      : { fill: style.fill as string }),
    ...(optionalString(style.textColor, `Chart drawing ${index} textColor`) === undefined
      ? {}
      : { textColor: style.textColor as string }),
    ...(fontSize === undefined ? {} : { fontSize })
  };
}

export function parseDrawings(value: unknown): ChartDrawing[] {
  if (!Array.isArray(value)) throw new TypeError("Chart drawings must be an array");
  if (value.length > maxDrawings) {
    throw new TypeError(`Chart drawings must contain at most ${maxDrawings} items`);
  }
  const seen = new Set<string>();
  const metadataBudget = {
    remaining: maxJsonNodes,
    remainingCharacters: maxJsonCharacters
  };
  let totalAnchors = 0;
  let totalTextLength = 0;
  return value.map((candidate, index) => {
    const item = record(candidate, `Chart drawing ${index}`);
    onlyKeys(
      item,
      [
        "id",
        "type",
        "anchors",
        "style",
        "text",
        "visible",
        "locked",
        "interactive",
        "affectsPriceScale",
        "zIndex",
        "metadata"
      ],
      `Chart drawing ${index}`
    );
    const id = identifier(item.id, `Chart drawing ${index} id`);
    if (seen.has(id)) throw new TypeError(`Chart drawing ${id} is duplicated`);
    seen.add(id);
    const definition = drawingDefinitions.get(item.type as ChartDrawing["type"]);
    if (definition === undefined) {
      throw new TypeError(`Chart drawing ${index} type is unsupported`);
    }
    if (
      !Array.isArray(item.anchors) ||
      item.anchors.length > maxAnchorsPerDrawing ||
      (definition.drawingMode === "continuous"
        ? item.anchors.length < definition.anchorCount
        : item.anchors.length !== definition.anchorCount)
    ) {
      throw new TypeError(`Chart drawing ${index} anchor count is invalid`);
    }
    totalAnchors += item.anchors.length;
    if (totalAnchors > maxTotalAnchors) {
      throw new TypeError(`Chart drawings must contain at most ${maxTotalAnchors} anchors`);
    }
    const anchors = item.anchors.map((candidateAnchor, anchorIndex) => {
      const anchor = record(candidateAnchor, `Chart drawing ${index} anchor ${anchorIndex}`);
      onlyKeys(anchor, ["time", "price"], `Chart drawing ${index} anchor ${anchorIndex}`);
      const time = finite(anchor.time, `Chart drawing ${index} anchor ${anchorIndex} time`);
      if (time <= 0) throw new TypeError(`Chart drawing ${index} anchor time must be positive`);
      return {
        time,
        price: finite(anchor.price, `Chart drawing ${index} anchor ${anchorIndex} price`)
      };
    });
    if (item.visible !== undefined && typeof item.visible !== "boolean") {
      throw new TypeError(`Chart drawing ${index} visibility must be boolean`);
    }
    if (item.locked !== undefined && typeof item.locked !== "boolean") {
      throw new TypeError(`Chart drawing ${index} lock state must be boolean`);
    }
    if (item.interactive !== undefined && typeof item.interactive !== "boolean") {
      throw new TypeError(`Chart drawing ${index} interaction state must be boolean`);
    }
    if (item.affectsPriceScale !== undefined && typeof item.affectsPriceScale !== "boolean") {
      throw new TypeError(`Chart drawing ${index} price scale state must be boolean`);
    }
    const zIndex = item.zIndex === undefined
      ? undefined
      : finite(item.zIndex, `Chart drawing ${index} zIndex`);
    if (zIndex !== undefined && !Number.isInteger(zIndex)) {
      throw new TypeError(`Chart drawing ${index} zIndex must be an integer`);
    }
    const style = parseDrawingStyle(item.style, index);
    const text = optionalText(item.text, `Chart drawing ${index} text`);
    totalTextLength += text?.length ?? 0;
    if (totalTextLength > maxTotalTextLength) {
      throw new TypeError(`Chart drawings must contain at most ${maxTotalTextLength} text characters`);
    }
    const metadata = item.metadata === undefined
      ? undefined
      : jsonValue(item.metadata, `Chart drawing ${index} metadata`, metadataBudget);
    if (metadata !== undefined && (Array.isArray(metadata) || metadata === null || typeof metadata !== "object")) {
      throw new TypeError(`Chart drawing ${index} metadata must be an object`);
    }
    return {
      id,
      type: item.type as ChartDrawing["type"],
      anchors,
      ...(style === undefined ? {} : { style }),
      ...(text === undefined ? {} : { text }),
      ...(item.visible === undefined ? {} : { visible: item.visible as boolean }),
      ...(item.locked === undefined ? {} : { locked: item.locked as boolean }),
      ...(item.interactive === undefined ? {} : { interactive: item.interactive as boolean }),
      ...(item.affectsPriceScale === undefined
        ? {}
        : { affectsPriceScale: item.affectsPriceScale as boolean }),
      ...(zIndex === undefined ? {} : { zIndex }),
      ...(metadata === undefined ? {} : {
        metadata: metadata as Readonly<Record<string, ChartJsonValue>>
      })
    };
  });
}

export function parseMarks(value: unknown): ChartMark[] {
  if (!Array.isArray(value)) throw new TypeError("Chart marks must be an array");
  if (value.length > maxMarks) {
    throw new TypeError(`Chart marks must contain at most ${maxMarks} items`);
  }
  const seen = new Set<string>();
  return value.map((candidate, index) => {
    const item = record(candidate, `Chart mark ${index}`);
    onlyKeys(item, ["id", "time", "price", "label", "color"], `Chart mark ${index}`);
    const id = identifier(item.id, `Chart mark ${index} id`);
    if (seen.has(id)) throw new TypeError(`Chart mark ${id} is duplicated`);
    seen.add(id);
    const time = finite(item.time, `Chart mark ${index} time`);
    if (time <= 0) throw new TypeError(`Chart mark ${index} time must be positive`);
    const color = optionalString(item.color, `Chart mark ${index} color`);
    const label = optionalString(item.label, `Chart mark ${index} label`);
    return {
      id,
      time,
      price: finite(item.price, `Chart mark ${index} price`),
      ...(label === undefined ? {} : { label }),
      ...(color === undefined ? {} : { color })
    };
  });
}

export function parseEntityInput(value: unknown): ChartEntityInput {
  const entity = record(value, "Chart entity");
  onlyKeys(entity, ["kind", "value"], "Chart entity");
  const kind = parseEntityKind(entity.kind);
  if (kind === "indicator") {
    return { kind, value: parseIndicators([entity.value])[0]! };
  }
  if (kind === "drawing") {
    return { kind, value: parseDrawings([entity.value])[0]! };
  }
  return { kind, value: parseMarks([entity.value])[0]! };
}

export function parseEntity(value: unknown): ChartEntity {
  const entity = record(value, "Chart entity");
  onlyKeys(entity, ["id", "kind", "value"], "Chart entity");
  const id = parseEntityId(entity.id);
  const parsed = parseEntityInput({ kind: entity.kind, value: entity.value });
  if (!id.startsWith(`${parsed.kind}:`)) {
    throw new TypeError("Chart entity id does not match its kind");
  }
  return { id, ...parsed } as ChartEntity;
}

export function parseVisibleRange(value: unknown): ChartVisibleRange {
  const range = record(value, "Chart visible range");
  onlyKeys(range, ["from", "to"], "Chart visible range");
  const from = finite(range.from, "Chart visible range from");
  const to = finite(range.to, "Chart visible range to");
  if (from > to) throw new RangeError("Chart visible range must be ascending");
  return { from, to };
}

export function parseLayout(value: unknown): ChartLayoutV2 {
  const layout = record(value, "Chart layout");
  onlyKeys(
    layout,
    ["schemaVersion", "seriesType", "priceScaleMode", "indicators", "drawings", "gridVisible"],
    "Chart layout"
  );
  if (layout.schemaVersion !== 2) throw new TypeError("Chart layout schema version is unsupported");
  if (typeof layout.gridVisible !== "boolean") throw new TypeError("Chart layout grid visibility must be boolean");
  return {
    schemaVersion: 2,
    seriesType: parseSeriesType(layout.seriesType),
    priceScaleMode: parsePriceScaleMode(layout.priceScaleMode),
    indicators: parseIndicators(layout.indicators),
    drawings: parseDrawings(layout.drawings),
    gridVisible: layout.gridVisible
  };
}

export function toEngineDrawings(drawings: readonly ChartDrawing[]): DrawingObject[] {
  return drawings.map((drawing) => ({
    id: drawing.id,
    type: drawing.type,
    anchors: drawing.anchors.map((anchor) => ({ ...anchor })),
    ...(drawing.style === undefined
      ? {}
      : {
          style: {
            ...drawing.style,
            lineDash: drawing.style.lineDash === undefined
              ? undefined
              : [...drawing.style.lineDash]
          }
        }),
    ...(drawing.text === undefined ? {} : { text: drawing.text }),
    ...(drawing.visible === undefined ? {} : { visible: drawing.visible }),
    ...(drawing.locked === undefined ? {} : { locked: drawing.locked }),
    ...(drawing.interactive === undefined ? {} : { interactive: drawing.interactive }),
    ...(drawing.affectsPriceScale === undefined
      ? {}
      : { affectsPriceScale: drawing.affectsPriceScale }),
    ...(drawing.zIndex === undefined ? {} : { zIndex: drawing.zIndex }),
    ...(drawing.metadata === undefined ? {} : { metadata: structuredClone(drawing.metadata) })
  }));
}

export function fromEngineDrawings(drawings: readonly DrawingObject[]): ChartDrawing[] {
  return parseDrawings(drawings.map((drawing) => ({
    id: drawing.id,
    type: drawing.type,
    anchors: drawing.anchors.map((anchor) => ({ time: anchor.time, price: anchor.price })),
    ...(drawing.style === undefined ? {} : { style: drawing.style }),
    ...(drawing.text === undefined ? {} : { text: drawing.text }),
    ...(drawing.visible === undefined ? {} : { visible: drawing.visible }),
    ...(drawing.locked === undefined ? {} : { locked: drawing.locked }),
    ...(drawing.interactive === undefined ? {} : { interactive: drawing.interactive }),
    ...(drawing.affectsPriceScale === undefined
      ? {}
      : { affectsPriceScale: drawing.affectsPriceScale }),
    ...(drawing.zIndex === undefined ? {} : { zIndex: drawing.zIndex }),
    ...(drawing.metadata === undefined ? {} : { metadata: drawing.metadata })
  })));
}
