import type { DrawingEditorCommand } from "./drawingCommands";
import {
  getDrawingIdsInBounds,
  normalizeDrawingSelectionBounds,
  type DrawingSelectionBounds,
  type DrawingSelectionOptions
} from "./drawingInteraction";
import type { DrawingObject } from "./drawingTypes";

export interface DrawingSelectionBoxPoint {
  x: number;
  y: number;
}

export interface DrawingSelectionBoxOptions {
  drawings: DrawingObject[];
  startPoint: DrawingSelectionBoxPoint;
  currentSelectedDrawingIds?: string[];
  additive?: boolean;
  selectionOptions?: DrawingSelectionOptions;
}

export interface DrawingSelectionBoxOperation {
  drawings: DrawingObject[];
  startPoint: DrawingSelectionBoxPoint;
  currentSelectedDrawingIds: string[];
  additive: boolean;
  selectionOptions: DrawingSelectionOptions;
}

export interface DrawingSelectionBoxPreview {
  bounds: DrawingSelectionBounds;
  selectedDrawingIds: string[];
  command: DrawingEditorCommand;
}

export function beginDrawingSelectionBox(
  options: DrawingSelectionBoxOptions
): DrawingSelectionBoxOperation {
  const nonInteractiveIds = new Set(
    options.drawings
      .filter((drawing) => drawing.interactive === false)
      .map((drawing) => drawing.id)
  );
  return {
    drawings: options.drawings.map(cloneDrawing),
    startPoint: { ...options.startPoint },
    currentSelectedDrawingIds: (options.currentSelectedDrawingIds ?? [])
      .filter((id) => !nonInteractiveIds.has(id)),
    additive: options.additive === true,
    selectionOptions: { ...(options.selectionOptions ?? {}) }
  };
}

export function updateDrawingSelectionBox(
  operation: DrawingSelectionBoxOperation,
  point: DrawingSelectionBoxPoint
): DrawingSelectionBoxPreview {
  const bounds = normalizeDrawingSelectionBounds(operation.startPoint, point);
  const matchingIds = getDrawingIdsInBounds(
    operation.drawings,
    bounds,
    operation.selectionOptions
  );
  const selectedDrawingIds = operation.additive
    ? mergeUniqueIds(operation.currentSelectedDrawingIds, matchingIds)
    : matchingIds;

  return {
    bounds,
    selectedDrawingIds,
    command: getDrawingSelectionBoxCommand(operation, point)
  };
}

export function finishDrawingSelectionBox(
  operation: DrawingSelectionBoxOperation,
  point: DrawingSelectionBoxPoint
): DrawingEditorCommand {
  return getDrawingSelectionBoxCommand(operation, point);
}

export function getDrawingSelectionBoxCommand(
  operation: DrawingSelectionBoxOperation,
  point: DrawingSelectionBoxPoint
): DrawingEditorCommand {
  return {
    type: "selectDrawingsInBounds",
    bounds: normalizeDrawingSelectionBounds(operation.startPoint, point),
    additive: operation.additive
  };
}

function cloneDrawing(drawing: DrawingObject): DrawingObject {
  return JSON.parse(JSON.stringify(drawing)) as DrawingObject;
}

function mergeUniqueIds(first: string[], second: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const id of [...first, ...second]) {
    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    merged.push(id);
  }

  return merged;
}
