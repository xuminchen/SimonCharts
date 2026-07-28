import {
  builtInDrawingToolDefinitions,
  coreIndicatorDefinitions,
  type CandleSeries,
  type DrawingObject,
  type IndicatorResult,
  type IndicatorVisualOutput
} from "@simoncharts/chart-engine";
import type { CustomStudyCheckpoint } from "./data/calculationCheckpointStore";
import type { SeriesSelection } from "./data/pagedSeriesStore";
import type {
  ChartDrawing,
  ChartDrawingStyle,
  ChartDrawingTool,
  ChartEntity,
  ChartEntityId,
  ChartEntityInput,
  ChartEntityKind,
  ChartIndicator,
  ChartIndicatorId,
  ChartIndicatorInput,
  ChartCustomStudyDefinition,
  ChartCustomStudyId,
  ChartJsonValue,
  ChartLayoutV2,
  ChartMark,
  ChartPriceScaleMode,
  ChartConfigurableSeriesType,
  ChartSeriesProperties,
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
const maxStudyDefinitions = 32;
const maxStudyInputs = 16;
const maxStudyOutputs = 16;
const maxSeriesCountProperty = 10_000;
const maxLineBreakCount = 500;
const defaultSeriesProperties = Object.freeze({
  renko: Object.freeze({ type: "renko", brickSize: 1 }),
  lineBreak: Object.freeze({ type: "lineBreak", lineCount: 3 }),
  kagi: Object.freeze({ type: "kagi", reversalAmount: 2 }),
  pointAndFigure: Object.freeze({
    type: "pointAndFigure",
    boxSize: 1,
    reversalBoxes: 3
  })
}) satisfies Readonly<Record<ChartConfigurableSeriesType, ChartSeriesProperties>>;

export type StudyDefinitionCatalog = ReadonlyMap<string, Readonly<ChartCustomStudyDefinition>>;
const emptyStudyDefinitions: StudyDefinitionCatalog = new Map();

export function studyDefinitionKey(id: ChartCustomStudyId, version: string): string {
  return `${id}\u0000${version}`;
}

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

function optionalIdentifier(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : identifier(value, label);
}

function optionalFinite(value: unknown, label: string): number | undefined {
  return value === undefined ? undefined : finite(value, label);
}

function denseDataArray(
  value: unknown,
  label: string,
  maxLength: number,
  minLength = 0
): unknown[] {
  if (!Array.isArray(value) || value.length < minLength || value.length > maxLength) {
    throw new TypeError(`${label} must contain ${minLength}-${maxLength} items`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (
    keys.length !== value.length + 1 ||
    keys.some((key, index) => key !== (index === value.length ? "length" : String(index))) ||
    Object.values(descriptors).some((descriptor) => !("value" in descriptor))
  ) {
    throw new TypeError(`${label} must be a dense data array`);
  }
  return Array.from(
    { length: value.length },
    (_, index) => descriptors[String(index)]!.value
  );
}

export function parseStudyDefinitions(value: unknown): StudyDefinitionCatalog {
  if (value === undefined) return new Map();
  const candidates = denseDataArray(
    value,
    "Chart study definitions",
    maxStudyDefinitions
  );
  const definitions = new Map<string, Readonly<ChartCustomStudyDefinition>>();
  candidates.forEach((candidate, index) => {
    const item = record(candidate, `Chart study definition ${index}`);
    onlyKeys(
      item,
      ["id", "version", "title", "pane", "inputs", "outputs", "calculate"],
      `Chart study definition ${index}`
    );
    const id = identifier(item.id, `Chart study definition ${index} id`);
    if (!/^custom:[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
      throw new TypeError(`Chart study definition ${index} id must use the custom: namespace`);
    }
    const version = identifier(item.version, `Chart study definition ${id} version`);
    const title = identifier(item.title, `Chart study definition ${id} title`);
    if (item.pane !== "main" && item.pane !== "separate") {
      throw new TypeError(`Chart study definition ${id} pane is unsupported`);
    }
    const inputCandidates = denseDataArray(
      item.inputs,
      `Chart study definition ${id} inputs`,
      maxStudyInputs
    );
    const inputIds = new Set<string>();
    const inputs = inputCandidates.map((candidateInput, inputIndex) => {
      const input = record(candidateInput, `Chart study definition ${id} input ${inputIndex}`);
      onlyKeys(
        input,
        ["id", "title", "defaultValue", "minValue", "maxValue", "integer"],
        `Chart study definition ${id} input ${inputIndex}`
      );
      const inputId = identifier(input.id, `Chart study definition ${id} input ${inputIndex} id`);
      if (inputIds.has(inputId)) {
        throw new TypeError(`Chart study definition ${id} input ${inputId} is duplicated`);
      }
      inputIds.add(inputId);
      const defaultValue = finite(
        input.defaultValue,
        `Chart study definition ${id} input ${inputId} defaultValue`
      );
      const minValue = optionalFinite(
        input.minValue,
        `Chart study definition ${id} input ${inputId} minValue`
      );
      const maxValue = optionalFinite(
        input.maxValue,
        `Chart study definition ${id} input ${inputId} maxValue`
      );
      if (input.integer !== undefined && typeof input.integer !== "boolean") {
        throw new TypeError(`Chart study definition ${id} input ${inputId} integer must be boolean`);
      }
      if (
        (minValue !== undefined && maxValue !== undefined && minValue > maxValue) ||
        (minValue !== undefined && defaultValue < minValue) ||
        (maxValue !== undefined && defaultValue > maxValue) ||
        (input.integer === true && !Number.isInteger(defaultValue))
      ) {
        throw new TypeError(`Chart study definition ${id} input ${inputId} defaultValue is invalid`);
      }
      return Object.freeze({
        id: inputId,
        title: identifier(input.title, `Chart study definition ${id} input ${inputId} title`),
        defaultValue,
        ...(minValue === undefined ? {} : { minValue }),
        ...(maxValue === undefined ? {} : { maxValue }),
        ...(input.integer === undefined ? {} : { integer: input.integer })
      });
    });
    const outputCandidates = denseDataArray(
      item.outputs,
      `Chart study definition ${id} outputs`,
      maxStudyOutputs,
      1
    );
    const outputIds = new Set<string>();
    const outputs = outputCandidates.map((candidateOutput, outputIndex) => {
      const output = record(candidateOutput, `Chart study definition ${id} output ${outputIndex}`);
      const type = output.type;
      const commonKeys = ["id", "title", "type"];
      const allowed = type === "line"
        ? [...commonKeys, "color", "lineWidth"]
        : type === "histogram"
          ? [...commonKeys, "color"]
          : type === "band"
            ? [...commonKeys, "fill"]
            : type === "marker"
              ? [...commonKeys, "color"]
              : commonKeys;
      onlyKeys(output, allowed, `Chart study definition ${id} output ${outputIndex}`);
      if (!["line", "histogram", "band", "marker"].includes(String(type))) {
        throw new TypeError(`Chart study definition ${id} output ${outputIndex} type is unsupported`);
      }
      const outputId = identifier(output.id, `Chart study definition ${id} output ${outputIndex} id`);
      if (outputIds.has(outputId)) {
        throw new TypeError(`Chart study definition ${id} output ${outputId} is duplicated`);
      }
      outputIds.add(outputId);
      const base = {
        id: outputId,
        title: identifier(output.title, `Chart study definition ${id} output ${outputId} title`)
      };
      if (type === "line") {
        const lineWidth = optionalFinite(
          output.lineWidth,
          `Chart study definition ${id} output ${outputId} lineWidth`
        );
        const color = optionalIdentifier(
          output.color,
          `Chart study definition ${id} output ${outputId} color`
        );
        if (lineWidth !== undefined && lineWidth <= 0) {
          throw new TypeError(`Chart study definition ${id} output ${outputId} lineWidth is invalid`);
        }
        return Object.freeze({
          ...base,
          type,
          ...(color === undefined ? {} : { color }),
          ...(lineWidth === undefined ? {} : { lineWidth })
        });
      }
      if (type === "histogram") {
        const color = optionalIdentifier(
          output.color,
          `Chart study definition ${id} output ${outputId} color`
        );
        return Object.freeze({ ...base, type, ...(color === undefined ? {} : { color }) });
      }
      if (type === "band") {
        const fill = optionalIdentifier(
          output.fill,
          `Chart study definition ${id} output ${outputId} fill`
        );
        return Object.freeze({ ...base, type, ...(fill === undefined ? {} : { fill }) });
      }
      const color = optionalIdentifier(
        output.color,
        `Chart study definition ${id} output ${outputId} color`
      );
      return Object.freeze({
        ...base,
        type: "marker" as const,
        ...(color === undefined ? {} : { color })
      });
    });
    if (typeof item.calculate !== "function") {
      throw new TypeError(`Chart study definition ${id} calculate must be a function`);
    }
    const key = studyDefinitionKey(id as ChartCustomStudyId, version);
    if (definitions.has(key)) {
      throw new TypeError(`Chart study definition ${id}@${version} is duplicated`);
    }
    definitions.set(key, Object.freeze({
      id: id as ChartCustomStudyId,
      version,
      title,
      pane: item.pane,
      inputs: Object.freeze(inputs),
      outputs: Object.freeze(outputs),
      calculate: item.calculate as ChartCustomStudyDefinition["calculate"]
    }));
  });
  return definitions;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function alignedNumericValues(value: unknown, label: string, length: number): Array<number | null> {
  return denseDataArray(value, label, length, length).map((candidate, index) => {
    if (candidate === null) return null;
    return finite(candidate, `${label} ${index}`);
  });
}

export function calculateCustomStudyChunk(input: {
  readonly definition: Readonly<ChartCustomStudyDefinition>;
  readonly selection: Readonly<SeriesSelection>;
  readonly dataVersion: string;
  readonly params: Readonly<Record<string, number>>;
  readonly chunk: CandleSeries;
  readonly checkpoint?: Readonly<CustomStudyCheckpoint>;
}): { readonly result: IndicatorResult; readonly checkpoint: CustomStudyCheckpoint } {
  const candles = Object.freeze(input.chunk.candles.map((candle) => Object.freeze({ ...candle })));
  const params = deepFreeze(structuredClone(input.params));
  const previousState = input.checkpoint?.state === undefined
    ? undefined
    : deepFreeze(structuredClone(input.checkpoint.state));
  const calculationInput = Object.freeze({
    symbol: Object.freeze({ ...input.selection.symbol }),
    timeframe: input.selection.timeframe,
    adjustMode: input.selection.adjustMode,
    dataVersion: input.dataVersion,
    inputs: params,
    candles,
    processedCount: input.checkpoint?.processedCount ?? 0,
    ...(previousState === undefined ? {} : { previousState })
  });
  const calculated = record(
    input.definition.calculate(calculationInput),
    `Chart study ${input.definition.id} calculation result`
  );
  onlyKeys(
    calculated,
    ["outputs", "state"],
    `Chart study ${input.definition.id} calculation result`
  );
  const outputValues = record(
    calculated.outputs,
    `Chart study ${input.definition.id} calculation outputs`
  );
  const expectedIds = input.definition.outputs.map((output) => output.id);
  if (
    Object.keys(outputValues).length !== expectedIds.length ||
    Object.keys(outputValues).some((id) => !expectedIds.includes(id))
  ) {
    throw new TypeError(`Chart study ${input.definition.id} calculation output keys are invalid`);
  }
  const panelId = input.definition.pane === "main" ? "main" : input.definition.id;
  const outputs: IndicatorVisualOutput[] = input.definition.outputs.map((definition) => {
    const label = `Chart study ${input.definition.id} output ${definition.id}`;
    if (definition.type === "band") {
      const band = record(outputValues[definition.id], label);
      onlyKeys(band, ["upper", "lower"], label);
      const upper = alignedNumericValues(band.upper, `${label} upper`, candles.length);
      const lower = alignedNumericValues(band.lower, `${label} lower`, candles.length);
      return {
        type: "band",
        id: definition.id,
        label: definition.title,
        panelId,
        upper: upper.map((value, index) => ({ time: candles[index]!.time, value })),
        lower: lower.map((value, index) => ({ time: candles[index]!.time, value })),
        ...(definition.fill === undefined ? {} : { fill: definition.fill })
      };
    }
    const values = alignedNumericValues(
      outputValues[definition.id],
      label,
      candles.length
    );
    if (definition.type === "line") {
      return {
        type: "line",
        id: definition.id,
        label: definition.title,
        panelId,
        values: values.map((value, index) => ({ time: candles[index]!.time, value })),
        ...(definition.color === undefined ? {} : { color: definition.color }),
        ...(definition.lineWidth === undefined ? {} : { lineWidth: definition.lineWidth })
      };
    }
    if (definition.type === "histogram") {
      return {
        type: "histogram",
        id: definition.id,
        label: definition.title,
        panelId,
        values: values.flatMap((value, index) => value === null
          ? []
          : [{
              time: candles[index]!.time,
              value,
              ...(definition.color === undefined ? {} : { color: definition.color })
            }])
      };
    }
    return {
      type: "marker",
      id: definition.id,
      label: definition.title,
      panelId,
      marks: values.flatMap((price, index) => price === null
        ? []
        : [{
            id: `${definition.id}:${candles[index]!.time}`,
            time: candles[index]!.time,
            price,
            ...(definition.color === undefined ? {} : { color: definition.color })
          }])
    };
  });
  const state = calculated.state === undefined
    ? undefined
    : deepFreeze(jsonValue(calculated.state, `Chart study ${input.definition.id} state`));
  return {
    result: { outputs },
    checkpoint: {
      kind: "customStudy",
      id: input.definition.id,
      definitionVersion: input.definition.version,
      processedCount: calculationInput.processedCount + candles.length,
      ...(state === undefined ? {} : { state })
    }
  };
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
    const items = denseDataArray(value, label, maxJsonNodes);
    seen.add(value);
    try {
      return items.map((item, index) =>
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
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some((descriptor) => !("value" in descriptor))) {
    throw new TypeError(`${label} must contain only data properties`);
  }
  seen.add(value);
  try {
    const result: Record<string, ChartJsonValue> = {};
    for (const key of Object.keys(descriptors).filter(
      (candidate) => descriptors[candidate]!.enumerable
    ).sort()) {
      const item = descriptors[key]!.value;
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

function positiveSeriesNumber(value: unknown, label: string): number {
  const parsed = finite(value, label);
  if (parsed <= 0) throw new RangeError(`${label} must be positive`);
  return parsed;
}

function seriesCount(value: unknown, label: string, maximum = maxSeriesCountProperty): number {
  const parsed = finite(value, label);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0 ||
    parsed > maximum
  ) {
    throw new RangeError(`${label} must be an integer from 1 to ${maximum}`);
  }
  return parsed;
}

function parseSeriesProperty(value: unknown, index: number): ChartSeriesProperties {
  const label = `Chart series properties ${index}`;
  const property = record(value, label);
  if (property.type === "renko") {
    onlyKeys(property, ["type", "brickSize"], label);
    return { type: "renko", brickSize: positiveSeriesNumber(property.brickSize, `${label} brickSize`) };
  }
  if (property.type === "lineBreak") {
    onlyKeys(property, ["type", "lineCount"], label);
    return {
      type: "lineBreak",
      lineCount: seriesCount(property.lineCount, `${label} lineCount`, maxLineBreakCount)
    };
  }
  if (property.type === "kagi") {
    onlyKeys(property, ["type", "reversalAmount"], label);
    return {
      type: "kagi",
      reversalAmount: positiveSeriesNumber(property.reversalAmount, `${label} reversalAmount`)
    };
  }
  if (property.type === "pointAndFigure") {
    onlyKeys(property, ["type", "boxSize", "reversalBoxes"], label);
    const boxSize = positiveSeriesNumber(property.boxSize, `${label} boxSize`);
    const reversalBoxes = seriesCount(property.reversalBoxes, `${label} reversalBoxes`);
    if (!Number.isFinite(boxSize * reversalBoxes)) {
      throw new RangeError(`${label} reversal distance must be finite`);
    }
    return { type: "pointAndFigure", boxSize, reversalBoxes };
  }
  throw new TypeError(`${label} type is unsupported`);
}

export function parseSeriesProperties(value: unknown): ChartSeriesProperties[] {
  if (value === undefined) return [];
  const candidates = denseDataArray(value, "Chart series properties", 4);
  const seen = new Set<ChartConfigurableSeriesType>();
  return candidates.map((candidate, index) => {
    const parsed = parseSeriesProperty(candidate, index);
    if (seen.has(parsed.type)) {
      throw new TypeError(`Chart series properties contains duplicate ${parsed.type}`);
    }
    seen.add(parsed.type);
    return parsed;
  });
}

export function resolveSeriesProperties<T extends ChartConfigurableSeriesType>(
  type: T,
  properties: unknown
): Extract<ChartSeriesProperties, { readonly type: T }> {
  if (!Object.hasOwn(defaultSeriesProperties, type)) {
    throw new TypeError("Chart series properties type is unsupported");
  }
  const resolved = parseSeriesProperties(properties).find((property) => property.type === type)
    ?? defaultSeriesProperties[type];
  return structuredClone(resolved) as Extract<ChartSeriesProperties, { readonly type: T }>;
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

function parseIndicatorInputValue(
  candidate: unknown,
  index: number,
  studyDefinitions: StudyDefinitionCatalog = emptyStudyDefinitions
): ChartIndicatorInput {
    const item = record(candidate, `Chart indicator ${index}`);
    onlyKeys(
      item,
      ["instanceId", "id", "definitionVersion", "params", "visible"],
      `Chart indicator ${index}`
    );
    const instanceId = item.instanceId === undefined
      ? undefined
      : identifier(item.instanceId, `Chart indicator ${index} instanceId`);
    const id = identifier(item.id, `Chart indicator ${index} id`);
    const builtInDefinition = indicatorDefinitions.get(id as ChartIndicatorId);
    const definitionVersion = item.definitionVersion === undefined
      ? undefined
      : identifier(item.definitionVersion, `Chart indicator ${id} definitionVersion`);
    if (builtInDefinition !== undefined && definitionVersion !== undefined) {
      throw new TypeError(`Chart indicator ${id} definitionVersion is unsupported`);
    }
    if (builtInDefinition === undefined && definitionVersion === undefined) {
      throw new TypeError(`Chart indicator ${id} definitionVersion is required`);
    }
    const customDefinition = builtInDefinition === undefined
      ? studyDefinitions.get(studyDefinitionKey(id as ChartCustomStudyId, definitionVersion!))
      : undefined;
    if (builtInDefinition === undefined && customDefinition === undefined) {
      throw new TypeError(`Chart indicator ${index} is unsupported`);
    }
    const params = record(item.params, `Chart indicator ${id} params`);
    const parameterDefinitions = builtInDefinition?.params ?? customDefinition!.inputs;
    const allowed = parameterDefinitions.map((parameter) => parameter.id);
    if (Object.keys(params).some((key) => !allowed.includes(key))) {
      throw new TypeError(`Chart indicator ${id} contains unsupported params`);
    }
    const parsedParams = Object.fromEntries(parameterDefinitions.map((parameterDefinition) => {
      const key = parameterDefinition.id;
      const raw = key in params ? params[key] : parameterDefinition.defaultValue;
      const parameter = finite(raw, `Chart indicator ${id} param ${key}`);
      const invalidBuiltIn = builtInDefinition !== undefined && (
        parameter <= 0 ||
        (integerIndicatorParams.has(key) && !Number.isInteger(parameter))
      );
      const invalidCustom = customDefinition !== undefined && (
        ("minValue" in parameterDefinition &&
          parameterDefinition.minValue !== undefined &&
          parameter < parameterDefinition.minValue) ||
        ("maxValue" in parameterDefinition &&
          parameterDefinition.maxValue !== undefined &&
          parameter > parameterDefinition.maxValue) ||
        ("integer" in parameterDefinition &&
          parameterDefinition.integer === true &&
          !Number.isInteger(parameter))
      );
      if (invalidBuiltIn || invalidCustom) {
        throw new TypeError(`Chart indicator ${id} param ${key} is invalid`);
      }
      return [key, parameter] as const;
    }));
    if (
      id === "MACD" &&
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
      id: id as ChartIndicator["id"],
      ...(definitionVersion === undefined ? {} : { definitionVersion }),
      params: parsedParams,
      visible: item.visible
    } as ChartIndicatorInput;
}

export function parseIndicatorInput(
  value: unknown,
  studyDefinitions: StudyDefinitionCatalog = emptyStudyDefinitions
): ChartIndicatorInput {
  return parseIndicatorInputValue(value, 0, studyDefinitions);
}

export function mergeIndicatorInputs(
  current: Readonly<ChartIndicator>,
  value: unknown,
  studyDefinitions: StudyDefinitionCatalog = emptyStudyDefinitions
): ChartIndicator {
  const patch = record(value, "Chart study inputs");
  const parsed = parseIndicatorInputValue({
    ...current,
    params: { ...current.params, ...patch }
  }, 0, studyDefinitions);
  return {
    ...parsed,
    instanceId: current.instanceId
  } as ChartIndicator;
}

export function parseIndicators(
  value: unknown,
  studyDefinitions: StudyDefinitionCatalog = emptyStudyDefinitions
): ChartIndicator[] {
  if (!Array.isArray(value)) throw new TypeError("Chart indicators must be an array");
  if (value.length > maxIndicators) {
    throw new TypeError(`Chart indicators must contain at most ${maxIndicators} items`);
  }
  const seen = new Set<string>();
  return value.map((candidate, index) => {
    const indicator = parseIndicatorInputValue(candidate, index, studyDefinitions);
    if (indicator.instanceId === undefined) {
      throw new TypeError(`Chart indicator ${index} instanceId is required`);
    }
    if (seen.has(indicator.instanceId)) {
      throw new TypeError(`Chart indicator instance ${indicator.instanceId} is duplicated`);
    }
    seen.add(indicator.instanceId);
    return { ...indicator, instanceId: indicator.instanceId } as ChartIndicator;
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

export function parseEntityInput(
  value: unknown,
  studyDefinitions: StudyDefinitionCatalog = emptyStudyDefinitions
): ChartEntityInput {
  const entity = record(value, "Chart entity");
  onlyKeys(entity, ["kind", "value"], "Chart entity");
  const kind = parseEntityKind(entity.kind);
  if (kind === "indicator") {
    return { kind, value: parseIndicators([entity.value], studyDefinitions)[0]! };
  }
  if (kind === "drawing") {
    return { kind, value: parseDrawings([entity.value])[0]! };
  }
  return { kind, value: parseMarks([entity.value])[0]! };
}

export function parseEntity(
  value: unknown,
  studyDefinitions: StudyDefinitionCatalog = emptyStudyDefinitions
): ChartEntity {
  const entity = record(value, "Chart entity");
  onlyKeys(entity, ["id", "kind", "value"], "Chart entity");
  const id = parseEntityId(entity.id);
  const parsed = parseEntityInput(
    { kind: entity.kind, value: entity.value },
    studyDefinitions
  );
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

export function parseLayout(
  value: unknown,
  studyDefinitions: StudyDefinitionCatalog = emptyStudyDefinitions
): ChartLayoutV2 {
  const layout = record(value, "Chart layout");
  onlyKeys(
    layout,
    [
      "schemaVersion",
      "seriesType",
      "seriesProperties",
      "priceScaleMode",
      "indicators",
      "drawings",
      "gridVisible"
    ],
    "Chart layout"
  );
  if (layout.schemaVersion !== 2) throw new TypeError("Chart layout schema version is unsupported");
  if (typeof layout.gridVisible !== "boolean") throw new TypeError("Chart layout grid visibility must be boolean");
  return {
    schemaVersion: 2,
    seriesType: parseSeriesType(layout.seriesType),
    ...(layout.seriesProperties === undefined
      ? {}
      : { seriesProperties: parseSeriesProperties(layout.seriesProperties) }),
    priceScaleMode: parsePriceScaleMode(layout.priceScaleMode),
    indicators: parseIndicators(layout.indicators, studyDefinitions),
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
