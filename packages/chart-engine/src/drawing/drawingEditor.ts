import { createCommandHistory } from "../commands/history";
import type { DrawingEditorCommand, DrawingEditorEvent, DrawingEditorTool } from "./drawingCommands";
import {
  getDrawingEditHandles,
  getDrawingIdsInBounds,
  type DrawingEditHandle,
  type DrawingSelectionBounds
} from "./drawingInteraction";
import {
  resizeDrawing,
  rotateDrawing,
  type DrawingResizeOptions,
  type DrawingRotateOptions
} from "./drawingTransform";
import type {
  DrawingClipboard,
  DrawingEditorCapabilities,
  DrawingGroup,
  DrawingObjectManagerItem
} from "./drawingEditState";
import { mergeDrawingStyle } from "./drawingStyle";
import { builtInDrawingToolDefinitions } from "./drawingToolDefinitions";
import { createDrawingToolRegistry, type DrawingToolRegistry } from "./drawingToolRegistry";
import type { DrawingAnchor, DrawingObject, DrawingStyle } from "./drawingTypes";

export interface DrawingEditorPoint {
  x: number;
  y: number;
  time?: number;
  price?: number;
}

export interface DrawingEditorState {
  drawings: DrawingObject[];
  drawingGroups: DrawingGroup[];
  selectedDrawingIds: string[];
  activeTool: DrawingEditorTool;
  isCreating: boolean;
  previewDrawing?: DrawingObject;
}

export interface DrawingEditorCoordinateAdapter {
  toScreen(drawing: DrawingObject): DrawingObject;
  toDomain(drawing: DrawingObject): DrawingObject;
}

export interface DrawingEditorOptions {
  drawings: DrawingObject[];
  drawingGroups?: DrawingGroup[];
  onEvent?: (event: DrawingEditorEvent) => void;
  toolRegistry?: DrawingToolRegistry;
  coordinateAdapter?: DrawingEditorCoordinateAdapter;
}

export interface DrawingEditor {
  setTool(tool: DrawingEditorTool): void;
  pointerDown(point: DrawingEditorPoint): void;
  pointerMove(point: DrawingEditorPoint): void;
  pointerUp(point: DrawingEditorPoint): void;
  cancel(): void;
  selectDrawing(id: string): void;
  selectDrawings(ids: string[]): void;
  selectDrawingsInBounds(bounds: DrawingSelectionBounds, options?: { additive?: boolean }): void;
  bringSelectedForward(): void;
  sendSelectedBackward(): void;
  copySelected(): void;
  pasteCopied(offset: { dx: number; dy: number }): void;
  duplicateSelected(offset: { dx: number; dy: number }): void;
  nudgeSelected(delta: { dx: number; dy: number }): void;
  resizeSelected(options: DrawingResizeOptions): void;
  rotateSelected(options: DrawingRotateOptions): void;
  executeCommand(command: DrawingEditorCommand): void;
  updateSelectedStyle(style: DrawingStyle): void;
  updateSelectedMetadata(metadata: Record<string, unknown>): void;
  updateSelectedText(text: string): void;
  getObjectManagerItems(): DrawingObjectManagerItem[];
  getSelectedEditHandles(): DrawingEditHandle[];
  dragSelected(delta: { dx: number; dy: number }): void;
  dragAnchor(id: string, anchorIndex: number, point: DrawingEditorPoint): void;
  deleteSelected(): void;
  lockSelected(): void;
  unlockSelected(): void;
  hideSelected(): void;
  showSelected(): void;
  createGroup(drawingIds: string[], name: string): string;
  setGroupName(id: string, name: string): void;
  setGroupDrawings(id: string, drawingIds: string[]): void;
  setGroupVisible(id: string, visible: boolean): void;
  setGroupLocked(id: string, locked: boolean): void;
  moveGroup(id: string, direction: "forward" | "backward" | "front" | "back"): void;
  removeGroup(id: string): void;
  deleteGroupDrawings(id: string): void;
  undo(): void;
  redo(): void;
  getCapabilities(): DrawingEditorCapabilities;
  getState(): DrawingEditorState;
}

interface EditorSnapshot {
  drawings: DrawingObject[];
  drawingGroups: DrawingGroup[];
  selectedDrawingIds: string[];
}

export function createDrawingEditor(options: DrawingEditorOptions): DrawingEditor {
  let drawings = cloneDrawings(options.drawings);
  let drawingGroups = validateDrawingGroups(options.drawingGroups ?? [], drawings);
  let selectedDrawingIds: string[] = [];
  let activeTool: DrawingEditorTool = "select";
  let pendingAnchors: DrawingAnchor[] = [];
  let pendingDrawingId: string | undefined;
  let previewDrawing: DrawingObject | undefined;
  let nextDrawingNumber = 1;
  let nextDrawingGroupNumber = 1;
  let clipboard: DrawingClipboard = { drawings: [] };
  const toolRegistry = options.toolRegistry ?? createBuiltInDrawingToolRegistry();
  const history = createCommandHistory<EditorSnapshot>(createSnapshot());

  const emit = (event: DrawingEditorEvent): void => {
    options.onEvent?.(event);
  };

  const api: DrawingEditor = {
    setTool(tool) {
      assertDrawingTool(tool, toolRegistry);
      cancelActiveCreation();
      activeTool = tool;
      emit({ type: "toolChanged", tool });
    },
    pointerDown(point) {
      if (activeTool === "select") {
        return;
      }

      if (isContinuousTool() && pendingAnchors.length > 0) {
        return;
      }

      const anchor = pointToDomainAnchor(point);
      const drawingId = pendingDrawingId ?? createDrawingId(drawings, nextDrawingNumber);

      if (isContinuousTool()) {
        const nextPendingAnchors = [anchor];
        const nextPreview = createPendingDrawing(nextPendingAnchors, drawingId);
        const projectedPreview = toScreenDrawing(nextPreview);

        reservePendingDrawingId(drawingId);
        pendingAnchors = nextPendingAnchors;
        emitPreview(nextPreview, projectedPreview);
        return;
      }

      const nextPendingAnchors = [...pendingAnchors, anchor];

      if (nextPendingAnchors.length < toolRegistry.require(activeTool).anchorCount) {
        const nextPreview = createPendingDrawing(nextPendingAnchors, drawingId);
        const projectedPreview = toScreenDrawing(nextPreview);

        reservePendingDrawingId(drawingId);
        pendingAnchors = nextPendingAnchors;
        emitPreview(nextPreview, projectedPreview);
        return;
      }

      const drawing: DrawingObject = {
        id: drawingId,
        type: activeTool,
        anchors: nextPendingAnchors.map((anchor) => ({ ...anchor }))
      };
      const projectedDrawing = toScreenDrawing(drawing);

      reservePendingDrawingId(drawingId);
      pendingAnchors = [];
      pendingDrawingId = undefined;
      clearPreview();
      commitSnapshot(
        "createDrawing",
        { drawings: [...drawings, drawing], selectedDrawingIds: [drawing.id] },
        () => {
          emit({ type: "drawingCreated", drawing: cloneDrawing(projectedDrawing) });
          emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
        }
      );
    },
    pointerMove(point) {
      if (activeTool === "select" || pendingAnchors.length === 0) {
        return;
      }

      const screenAnchor = pointToAnchor(point);
      const anchor = pointToDomainAnchor(point);

      if (isContinuousTool()) {
        const lastAnchor = pendingAnchors.at(-1);

        if (!lastAnchor || hasSameScreenPoint(toScreenAnchor(lastAnchor), screenAnchor)) {
          return;
        }

        const nextPendingAnchors = [...pendingAnchors, anchor];
        const nextPreview = createPendingDrawing(nextPendingAnchors);
        const projectedPreview = toScreenDrawing(nextPreview);

        pendingAnchors = nextPendingAnchors;
        emitPreview(nextPreview, projectedPreview);
        return;
      }

      emitPreview(createPendingDrawing([...pendingAnchors, anchor]));
    },
    pointerUp(point) {
      if (!isContinuousTool() || pendingAnchors.length === 0) {
        return;
      }

      const finalScreenAnchor = pointToAnchor(point);
      const finalAnchor = pointToDomainAnchor(point);
      const lastAnchor = pendingAnchors.at(-1);
      let nextPendingAnchors = pendingAnchors;

      if (lastAnchor && !hasSameScreenPoint(toScreenAnchor(lastAnchor), finalScreenAnchor)) {
        nextPendingAnchors = [...pendingAnchors, finalAnchor];
      }

      if (nextPendingAnchors.length < toolRegistry.require(activeTool).anchorCount) {
        cancelActiveCreation();
        return;
      }

      const drawing: DrawingObject = {
        id: requirePendingDrawingId(),
        type: activeTool,
        anchors: nextPendingAnchors.map((anchor) => ({ ...anchor }))
      };
      const projectedDrawing = toScreenDrawing(drawing);

      pendingAnchors = [];
      pendingDrawingId = undefined;
      clearPreview();
      commitSnapshot(
        "createDrawing",
        { drawings: [...drawings, drawing], selectedDrawingIds: [drawing.id] },
        () => {
          emit({ type: "drawingCreated", drawing: cloneDrawing(projectedDrawing) });
          emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
        }
      );
    },
    cancel() {
      cancelActiveCreation();
    },
    selectDrawing(id) {
      selectedDrawingIds = drawings.some(
        (drawing) => drawing.id === id && drawing.interactive !== false
      ) ? [id] : [];
      emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
    },
    selectDrawings(ids) {
      selectedDrawingIds = getExistingUniqueIds(ids);
      emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
    },
    selectDrawingsInBounds(bounds, options = {}) {
      const matchingIds = getDrawingIdsInBounds(toScreenDrawings(drawings), bounds);
      const nextIds = options.additive ? [...selectedDrawingIds, ...matchingIds] : matchingIds;

      selectedDrawingIds = getExistingUniqueIds(nextIds);
      emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
    },
    bringSelectedForward() {
      reorderSelected("forward");
    },
    sendSelectedBackward() {
      reorderSelected("backward");
    },
    copySelected() {
      clipboard = {
        drawings: selectedDrawingIds
          .map((id) => drawings.find((drawing) => drawing.id === id))
          .filter(isDrawingObject)
          .map(cloneDrawing)
      };
    },
    pasteCopied(offset) {
      pasteDrawings(clipboard.drawings, offset, "pasteDrawing");
    },
    duplicateSelected(offset) {
      const selectedDrawings = selectedDrawingIds
        .map((id) => drawings.find((drawing) => drawing.id === id))
        .filter((drawing): drawing is DrawingObject => Boolean(drawing));

      clipboard = { drawings: selectedDrawings.map(cloneDrawing) };
      pasteDrawings(clipboard.drawings, offset, "duplicateDrawing");
    },
    nudgeSelected(delta) {
      api.dragSelected(delta);
    },
    resizeSelected(options) {
      mutateSelectedGeometry("resizeDrawing", (drawing) => resizeDrawing(drawing, options));
    },
    rotateSelected(options) {
      mutateSelectedGeometry("rotateDrawing", (drawing) => rotateDrawing(drawing, options));
    },
    executeCommand(command) {
      executeCommand(command);
    },
    updateSelectedStyle(style) {
      mutateSelected("updateDrawingStyle", (drawing) => ({
        ...drawing,
        style: mergeDrawingStyle(drawing.style, style)
      }));
    },
    updateSelectedMetadata(metadata) {
      mutateSelected("updateDrawingMetadata", (drawing) => ({
        ...drawing,
        metadata: mergeDrawingMetadata(drawing.metadata, metadata)
      }));
    },
    updateSelectedText(text) {
      mutateSelected("updateDrawingText", (drawing) => ({ ...drawing, text }));
    },
    getObjectManagerItems() {
      const selectedIds = new Set(selectedDrawingIds);

      return drawings.map((drawing, index) => ({
        id: drawing.id,
        type: drawing.type,
        visible: drawing.visible !== false,
        locked: drawing.locked === true,
        selected: selectedIds.has(drawing.id),
        zIndex: index
      }));
    },
    getSelectedEditHandles() {
      return getSelectedDrawings().flatMap((drawing) =>
        getDrawingEditHandles(toScreenDrawing(drawing)).map((handle) => ({ ...handle }))
      );
    },
    dragSelected(delta) {
      const selectedIds = new Set(selectedDrawingIds);
      const updatedDrawings: DrawingObject[] = [];

      const nextDrawings = drawings.map((drawing) => {
        if (!selectedIds.has(drawing.id) || drawing.locked) {
          return drawing;
        }

        const updated = toDomainDrawing(
          moveDrawing(toScreenDrawing(drawing), delta.dx, delta.dy)
        );

        updatedDrawings.push(updated);
        return updated;
      });

      if (updatedDrawings.length === 0) {
        return;
      }

      const projectedUpdatedDrawings = updatedDrawings.map(toScreenDrawing);

      commitSnapshot(
        "moveDrawing",
        { drawings: nextDrawings, selectedDrawingIds },
        () => {
          for (const drawing of projectedUpdatedDrawings) {
            emit({ type: "drawingUpdated", drawing: cloneDrawing(drawing) });
          }
        }
      );
    },
    dragAnchor(id, anchorIndex, point) {
      const drawing = drawings.find((existing) => existing.id === id);

      if (
        !drawing ||
        drawing.locked ||
        drawing.interactive === false ||
        anchorIndex < 0 ||
        anchorIndex >= drawing.anchors.length
      ) {
        return;
      }

      const screenDrawing = toScreenDrawing(drawing);
      const updated = toDomainDrawing({
        ...screenDrawing,
        anchors: screenDrawing.anchors.map((anchor, index) =>
          index === anchorIndex ? { ...anchor, ...pointToAnchor(point) } : anchor
        )
      });
      const projectedUpdated = toScreenDrawing(updated);

      commitSnapshot(
        "dragAnchor",
        {
          drawings: drawings.map((existing) => (existing.id === updated.id ? updated : existing)),
          selectedDrawingIds
        },
        () => emit({ type: "drawingUpdated", drawing: cloneDrawing(projectedUpdated) })
      );
    },
    deleteSelected() {
      const selectedIds = new Set(selectedDrawingIds);
      const deletedIds = drawings
        .filter((drawing) => selectedIds.has(drawing.id) && !drawing.locked)
        .map((drawing) => drawing.id);

      if (deletedIds.length === 0) {
        return;
      }

      const nextSelectedDrawingIds = selectedDrawingIds.filter((id) => !deletedIds.includes(id));

      commitSnapshot(
        "deleteDrawing",
        {
          drawings: drawings.filter((drawing) => !selectedIds.has(drawing.id) || drawing.locked),
          drawingGroups: pruneDrawingGroups(drawingGroups, new Set(deletedIds)),
          selectedDrawingIds: nextSelectedDrawingIds
        },
        () => {
          for (const drawingId of deletedIds) {
            emit({ type: "drawingDeleted", drawingId });
          }
          emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
        }
      );
    },
    lockSelected() {
      setSelectedLocked(true);
    },
    unlockSelected() {
      setSelectedLocked(false);
    },
    hideSelected() {
      setSelectedVisible(false);
    },
    showSelected() {
      setSelectedVisible(true);
    },
    createGroup(drawingIds, name) {
      const memberIds = requireGroupMembers(drawingIds);
      assertMembersAvailable(memberIds);
      assertDrawingsUnlocked(memberIds);
      const id = createDrawingGroupId(drawingGroups, nextDrawingGroupNumber);
      const nextDrawings = compactGroupMembers(drawings, memberIds);
      const group = { id, name: normalizeDrawingGroupName(name), drawingIds: memberIds };

      commitSnapshot(
        "createDrawingGroup",
        {
          drawings: nextDrawings,
          drawingGroups: [...drawingGroups, group],
          selectedDrawingIds
        },
        emitDrawingGroupsChanged
      );
      nextDrawingGroupNumber = Number(id.slice("drawing-group:".length)) + 1;
      return id;
    },
    setGroupName(id, name) {
      const group = requireGroup(id);
      const nextName = normalizeDrawingGroupName(name);

      if (group.name === nextName) {
        return;
      }

      commitSnapshot(
        "renameDrawingGroup",
        {
          drawings,
          drawingGroups: drawingGroups.map((item) =>
            item.id === id ? { ...item, name: nextName } : item
          ),
          selectedDrawingIds
        },
        emitDrawingGroupsChanged
      );
    },
    setGroupDrawings(id, drawingIds) {
      const group = requireGroup(id);
      const memberIds = requireGroupMembers(drawingIds);
      assertGroupUnlocked(group);
      assertMembersAvailable(memberIds, id);
      assertDrawingsUnlocked(memberIds);
      const nextDrawings = compactGroupMembers(drawings, memberIds);
      const unchanged =
        arraysEqual(group.drawingIds, memberIds) &&
        arraysEqual(
          nextDrawings.map(({ id: drawingId }) => drawingId),
          drawings.map(({ id: drawingId }) => drawingId)
        );

      if (unchanged) {
        return;
      }

      commitSnapshot(
        "setDrawingGroupMembers",
        {
          drawings: nextDrawings,
          drawingGroups: drawingGroups.map((item) =>
            item.id === id ? { ...item, drawingIds: memberIds } : item
          ),
          selectedDrawingIds
        },
        emitDrawingGroupsChanged
      );
    },
    setGroupVisible(id, visible) {
      const group = requireGroup(id);
      assertGroupUnlocked(group);
      const memberIds = new Set(group.drawingIds);
      const nextDrawings = drawings.map((drawing) =>
        memberIds.has(drawing.id) && drawing.visible !== visible
          ? { ...drawing, visible }
          : drawing
      );

      if (arraysEqual(nextDrawings, drawings)) {
        return;
      }

      commitSnapshot(
        visible ? "showDrawingGroup" : "hideDrawingGroup",
        { drawings: nextDrawings, drawingGroups, selectedDrawingIds },
        emitDrawingGroupsChanged
      );
    },
    setGroupLocked(id, locked) {
      const group = requireGroup(id);
      const memberIds = new Set(group.drawingIds);
      const nextDrawings = drawings.map((drawing) =>
        memberIds.has(drawing.id) && drawing.locked !== locked
          ? { ...drawing, locked }
          : drawing
      );

      if (arraysEqual(nextDrawings, drawings)) {
        return;
      }

      commitSnapshot(
        locked ? "lockDrawingGroup" : "unlockDrawingGroup",
        { drawings: nextDrawings, drawingGroups, selectedDrawingIds },
        emitDrawingGroupsChanged
      );
    },
    moveGroup(id, direction) {
      const group = requireGroup(id);
      assertGroupUnlocked(group);
      const nextDrawings = moveDrawingGroup(drawings, drawingGroups, id, direction);

      if (arraysEqual(nextDrawings, drawings)) {
        return;
      }

      commitSnapshot(
        "moveDrawingGroup",
        { drawings: nextDrawings, drawingGroups, selectedDrawingIds },
        emitDrawingGroupsChanged
      );
    },
    removeGroup(id) {
      requireGroup(id);
      commitSnapshot(
        "removeDrawingGroup",
        {
          drawings,
          drawingGroups: drawingGroups.filter((group) => group.id !== id),
          selectedDrawingIds
        },
        emitDrawingGroupsChanged
      );
    },
    deleteGroupDrawings(id) {
      const group = requireGroup(id);
      assertGroupUnlocked(group);
      const memberIds = new Set(group.drawingIds);

      commitSnapshot(
        "deleteDrawingGroup",
        {
          drawings: drawings.filter((drawing) => !memberIds.has(drawing.id)),
          drawingGroups: drawingGroups.filter((item) => item.id !== id),
          selectedDrawingIds: selectedDrawingIds.filter(
            (drawingId) => !memberIds.has(drawingId)
          )
        },
        emitDrawingGroupsChanged
      );
    },
    undo() {
      cancelActiveCreation();
      restoreSnapshot(history.undo());
      emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
    },
    redo() {
      cancelActiveCreation();
      restoreSnapshot(history.redo());
      emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
    },
    getCapabilities() {
      return createCapabilities();
    },
    getState() {
      return {
        drawings: toScreenDrawings(drawings),
        drawingGroups: cloneDrawingGroups(drawingGroups),
        selectedDrawingIds: [...selectedDrawingIds],
        activeTool,
        isCreating: pendingAnchors.length > 0,
        previewDrawing: previewDrawing ? toScreenDrawing(previewDrawing) : undefined
      };
    }
  };

  return api;

  function executeCommand(command: DrawingEditorCommand): void {
    switch (command.type) {
      case "setTool":
        return api.setTool(command.tool);
      case "selectDrawing":
        return api.selectDrawing(command.drawingId);
      case "selectDrawings":
        return api.selectDrawings(command.drawingIds);
      case "selectDrawingsInBounds":
        return api.selectDrawingsInBounds(command.bounds, { additive: command.additive });
      case "dragAnchor":
        return api.dragAnchor(command.drawingId, command.anchorIndex, command.point);
      case "bringSelectedForward":
        return api.bringSelectedForward();
      case "sendSelectedBackward":
        return api.sendSelectedBackward();
      case "copySelected":
        return api.copySelected();
      case "pasteCopied":
        return api.pasteCopied(command.offset);
      case "duplicateSelected":
        return api.duplicateSelected(command.offset);
      case "dragSelected":
        return api.dragSelected(command.delta);
      case "nudgeSelected":
        return api.nudgeSelected(command.delta);
      case "resizeSelected":
        return api.resizeSelected(command.options);
      case "rotateSelected":
        return api.rotateSelected(command.options);
      case "updateSelectedStyle":
        return api.updateSelectedStyle(command.style);
      case "updateSelectedMetadata":
        return api.updateSelectedMetadata(command.metadata);
      case "updateSelectedText":
        return api.updateSelectedText(command.text);
      case "cancelCreation":
        return api.cancel();
      case "deleteSelected":
        return api.deleteSelected();
      case "lockSelected":
        return api.lockSelected();
      case "unlockSelected":
        return api.unlockSelected();
      case "hideSelected":
        return api.hideSelected();
      case "showSelected":
        return api.showSelected();
    }
  }

  function isContinuousTool(): boolean {
    return activeTool !== "select" && toolRegistry.require(activeTool).drawingMode === "continuous";
  }

  function createPendingDrawing(
    anchors = pendingAnchors,
    drawingId = requirePendingDrawingId()
  ): DrawingObject {
    if (activeTool === "select") {
      throw new Error("Cannot preview a drawing while the select tool is active");
    }

    return {
      id: drawingId,
      type: activeTool,
      anchors: anchors.map((anchor) => ({ ...anchor }))
    };
  }

  function reservePendingDrawingId(drawingId: string): void {
    if (pendingDrawingId) {
      return;
    }

    pendingDrawingId = drawingId;
    nextDrawingNumber = Number(pendingDrawingId.slice("drawing-".length)) + 1;
  }

  function requirePendingDrawingId(): string {
    if (!pendingDrawingId) {
      throw new Error("Active drawing creation has no reserved id");
    }

    return pendingDrawingId;
  }

  function emitPreview(
    drawing: DrawingObject | undefined,
    projectedDrawing = drawing ? toScreenDrawing(drawing) : undefined
  ): void {
    previewDrawing = drawing ? cloneDrawing(drawing) : undefined;
    emit({
      type: "drawingPreviewChanged",
      drawing: projectedDrawing ? cloneDrawing(projectedDrawing) : undefined
    });
  }

  function pointToDomainAnchor(point: DrawingEditorPoint): DrawingAnchor {
    const drawing: DrawingObject = {
      id: "pending-coordinate-conversion",
      type: activeTool === "select" ? "trendLine" : activeTool,
      anchors: [pointToAnchor(point)]
    };

    return { ...toDomainDrawing(drawing).anchors[0] };
  }

  function toScreenAnchor(anchor: DrawingAnchor): DrawingAnchor {
    return {
      ...toScreenDrawing({
        id: "pending-coordinate-projection",
        type: activeTool === "select" ? "trendLine" : activeTool,
        anchors: [anchor]
      }).anchors[0]
    };
  }

  function toScreenDrawing(drawing: DrawingObject): DrawingObject {
    if (!options.coordinateAdapter) {
      return cloneDrawing(drawing);
    }

    return cloneDrawing(options.coordinateAdapter.toScreen(cloneDrawing(drawing)));
  }

  function toScreenDrawings(sourceDrawings: DrawingObject[]): DrawingObject[] {
    return sourceDrawings.map(toScreenDrawing);
  }

  function toDomainDrawing(drawing: DrawingObject): DrawingObject {
    if (!options.coordinateAdapter) {
      return cloneDrawing(drawing);
    }

    return cloneDrawing(options.coordinateAdapter.toDomain(cloneDrawing(drawing)));
  }

  function clearPreview(): void {
    if (previewDrawing) {
      emitPreview(undefined);
    }
  }

  function cancelActiveCreation(): void {
    if (pendingAnchors.length === 0) {
      return;
    }

    pendingAnchors = [];
    pendingDrawingId = undefined;
    emitPreview(undefined);
    emit({ type: "creationCanceled" });
  }

  function getExistingUniqueIds(ids: string[]): string[] {
    const existingIds = new Set(
      drawings
        .filter((drawing) => drawing.interactive !== false)
        .map((drawing) => drawing.id)
    );
    const seenIds = new Set<string>();
    const nextSelectedDrawingIds: string[] = [];

    for (const id of ids) {
      if (!existingIds.has(id) || seenIds.has(id)) {
        continue;
      }

      seenIds.add(id);
      nextSelectedDrawingIds.push(id);
    }

    return nextSelectedDrawingIds;
  }

  function createCapabilities(): DrawingEditorCapabilities {
    const selectedDrawings = getSelectedDrawings();
    const editableSelectedDrawings = selectedDrawings.filter((drawing) => !drawing.locked);

    return {
      selectedDrawingCount: selectedDrawings.length,
      editableSelectedDrawingCount: editableSelectedDrawings.length,
      clipboardDrawingCount: clipboard.drawings.length,
      pendingAnchorCount: pendingAnchors.length,
      hasSelection: selectedDrawings.length > 0,
      hasEditableSelection: editableSelectedDrawings.length > 0,
      canBringSelectedForward: canReorderSelected("forward"),
      canSendSelectedBackward: canReorderSelected("backward"),
      canCopy: selectedDrawings.length > 0,
      canPaste: clipboard.drawings.length > 0,
      canDuplicate: selectedDrawings.length > 0,
      canNudge: editableSelectedDrawings.length > 0,
      canDelete: editableSelectedDrawings.length > 0,
      canLock: selectedDrawings.some((drawing) => !drawing.locked),
      canUnlock: selectedDrawings.some((drawing) => drawing.locked === true),
      canHide: editableSelectedDrawings.some((drawing) => drawing.visible !== false),
      canShow: editableSelectedDrawings.some((drawing) => drawing.visible === false),
      canCancelCreation: pendingAnchors.length > 0,
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    };
  }

  function getSelectedDrawings(): DrawingObject[] {
    return selectedDrawingIds
      .map((id) => drawings.find((drawing) => drawing.id === id))
      .filter(isDrawingObject);
  }

  function canReorderSelected(direction: "forward" | "backward"): boolean {
    const selectedIds = getReorderSelectedIds();

    if (!selectedIds) {
      return false;
    }
    return !arraysEqual(
      reorderDrawingsBySelection(drawings, drawingGroups, selectedIds, direction),
      drawings
    );
  }

  function reorderSelected(direction: "forward" | "backward"): void {
    const selectedIds = getReorderSelectedIds();

    if (!selectedIds) {
      return;
    }

    const nextDrawings = reorderDrawingsBySelection(
      drawings,
      drawingGroups,
      selectedIds,
      direction
    );

    if (arraysEqual(nextDrawings, drawings)) {
      return;
    }

    commitSnapshot(
      "reorderDrawing",
      { drawings: nextDrawings, selectedDrawingIds },
      () => {
        emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
      }
    );
  }

  function getReorderSelectedIds(): Set<string> | undefined {
    const selectedIds = new Set(selectedDrawingIds);

    for (const group of drawingGroups) {
      if (!group.drawingIds.some((id) => selectedIds.has(id))) {
        continue;
      }
      if (
        drawings.some(
          (drawing) => group.drawingIds.includes(drawing.id) && drawing.locked
        )
      ) {
        return undefined;
      }
      for (const id of group.drawingIds) {
        selectedIds.add(id);
      }
    }

    return selectedIds;
  }

  function pasteDrawings(
    sourceDrawings: DrawingObject[],
    offset: { dx: number; dy: number },
    label: string
  ): void {
    if (sourceDrawings.length === 0) {
      return;
    }

    const nextDrawings = [...drawings];
    const pastedDrawings: DrawingObject[] = [];
    let nextAvailableDrawingNumber = nextDrawingNumber;

    for (const sourceDrawing of sourceDrawings) {
      const id = createDrawingId(nextDrawings, nextAvailableDrawingNumber);
      nextAvailableDrawingNumber = Number(id.slice("drawing-".length)) + 1;

      const pastedDrawing = toDomainDrawing(
        moveDrawing(
          { ...toScreenDrawing(sourceDrawing), id },
          offset.dx,
          offset.dy
        )
      );

      nextDrawings.push(pastedDrawing);
      pastedDrawings.push(pastedDrawing);
    }

    const projectedPastedDrawings = pastedDrawings.map(toScreenDrawing);

    commitSnapshot(
      label,
      {
        drawings: nextDrawings,
        selectedDrawingIds: pastedDrawings.map((drawing) => drawing.id)
      },
      () => {
        nextDrawingNumber = nextAvailableDrawingNumber;
        for (const drawing of projectedPastedDrawings) {
          emit({ type: "drawingCreated", drawing: cloneDrawing(drawing) });
        }
        emit({ type: "selectionChanged", selectedDrawingIds: [...selectedDrawingIds] });
      }
    );
  }

  function setSelectedLocked(locked: boolean): void {
    const selectedIds = new Set(selectedDrawingIds);
    const updatedDrawings: DrawingObject[] = [];

    const nextDrawings = drawings.map((drawing) => {
      if (!selectedIds.has(drawing.id) || drawing.locked === locked) {
        return drawing;
      }

      const updated = { ...drawing, locked };

      updatedDrawings.push(updated);
      return updated;
    });

    if (updatedDrawings.length === 0) {
      return;
    }

    const projectedUpdatedDrawings = updatedDrawings.map(toScreenDrawing);

    commitSnapshot(
      locked ? "lockDrawing" : "unlockDrawing",
      { drawings: nextDrawings, selectedDrawingIds },
      () => {
        for (const drawing of projectedUpdatedDrawings) {
          emit({ type: "drawingUpdated", drawing: cloneDrawing(drawing) });
        }
      }
    );
  }

  function setSelectedVisible(visible: boolean): void {
    mutateSelected(visible ? "showDrawing" : "hideDrawing", (drawing) =>
      drawing.visible === visible ? drawing : { ...drawing, visible }
    );
  }

  function mutateSelectedGeometry(
    label: string,
    update: (drawing: DrawingObject) => DrawingObject
  ): void {
    mutateSelected(label, (drawing) =>
      toDomainDrawing(update(toScreenDrawing(drawing)))
    );
  }

  function mutateSelected(
    label: string,
    update: (drawing: DrawingObject) => DrawingObject
  ): void {
    const selectedIds = new Set(selectedDrawingIds);
    const updatedDrawings: DrawingObject[] = [];

    const nextDrawings = drawings.map((drawing) => {
      if (!selectedIds.has(drawing.id) || drawing.locked) {
        return drawing;
      }

      const updated = update(drawing);

      if (updated === drawing) {
        return drawing;
      }

      updatedDrawings.push(updated);
      return updated;
    });

    if (updatedDrawings.length === 0) {
      return;
    }

    const projectedUpdatedDrawings = updatedDrawings.map(toScreenDrawing);

    commitSnapshot(
      label,
      { drawings: nextDrawings, selectedDrawingIds },
      () => {
        for (const drawing of projectedUpdatedDrawings) {
          emit({ type: "drawingUpdated", drawing: cloneDrawing(drawing) });
        }
      }
    );
  }

  function emitDrawingGroupsChanged(): void {
    emit({
      type: "drawingGroupsChanged",
      drawingGroups: cloneDrawingGroups(drawingGroups)
    });
  }

  function requireGroup(id: string): DrawingGroup {
    const group = drawingGroups.find((item) => item.id === id);

    if (!group) {
      throw new Error(`Unknown drawing group: ${id}`);
    }

    return group;
  }

  function requireGroupMembers(ids: string[]): string[] {
    if (ids.length === 0) {
      throw new Error("Drawing group must contain at least one drawing");
    }

    const uniqueIds = new Set(ids);

    if (uniqueIds.size !== ids.length) {
      throw new Error("Drawing group cannot contain duplicate drawings");
    }

    const orderedIds = drawings
      .filter((drawing) => uniqueIds.has(drawing.id))
      .map((drawing) => drawing.id);

    if (orderedIds.length !== ids.length) {
      throw new Error("Drawing group contains an unknown drawing");
    }

    return orderedIds;
  }

  function assertMembersAvailable(ids: string[], exceptGroupId?: string): void {
    const groupedIds = new Set(
      drawingGroups
        .filter((group) => group.id !== exceptGroupId)
        .flatMap((group) => group.drawingIds)
    );

    if (ids.some((id) => groupedIds.has(id))) {
      throw new Error("A drawing can belong to only one group");
    }
  }

  function assertDrawingsUnlocked(ids: string[]): void {
    const memberIds = new Set(ids);

    if (drawings.some((drawing) => memberIds.has(drawing.id) && drawing.locked)) {
      throw new Error("Locked drawings cannot be changed through a group");
    }
  }

  function assertGroupUnlocked(group: DrawingGroup): void {
    assertDrawingsUnlocked(group.drawingIds);
  }

  function commitSnapshot(
    label: string,
    nextSnapshot: Omit<EditorSnapshot, "drawingGroups"> & {
      drawingGroups?: DrawingGroup[];
    },
    afterCommit?: () => void
  ): void {
    const beforeSnapshot = createSnapshot();
    const completeNextSnapshot: EditorSnapshot = {
      ...nextSnapshot,
      drawingGroups: cloneDrawingGroups(nextSnapshot.drawingGroups ?? drawingGroups)
    };
    const appliedSnapshot = history.apply({
      label,
      do() {
        return cloneSnapshot(completeNextSnapshot);
      },
      undo() {
        return cloneSnapshot(beforeSnapshot);
      }
    });

    restoreSnapshot(appliedSnapshot);
    afterCommit?.();
  }

  function createSnapshot(): EditorSnapshot {
    return {
      drawings: cloneDrawings(drawings),
      drawingGroups: cloneDrawingGroups(drawingGroups),
      selectedDrawingIds: [...selectedDrawingIds]
    };
  }

  function restoreSnapshot(snapshot: EditorSnapshot): void {
    drawings = cloneDrawings(snapshot.drawings);
    drawingGroups = cloneDrawingGroups(snapshot.drawingGroups);
    selectedDrawingIds = [...snapshot.selectedDrawingIds];
  }
}

function pointToAnchor(point: DrawingEditorPoint): DrawingAnchor {
  return {
    x: point.x,
    y: point.y,
    time: point.time,
    price: point.price
  };
}

function hasSameScreenPoint(left: DrawingAnchor, right: DrawingAnchor): boolean {
  return left.x === right.x && left.y === right.y;
}

function moveDrawing(drawing: DrawingObject, dx: number, dy: number): DrawingObject {
  return {
    ...drawing,
    anchors: drawing.anchors.map((anchor) => ({
      ...anchor,
      x: typeof anchor.x === "number" ? anchor.x + dx : anchor.x,
      y: typeof anchor.y === "number" ? anchor.y + dy : anchor.y
    }))
  };
}

function createDrawingId(drawings: DrawingObject[], nextDrawingNumber: number): string {
  const existingIds = new Set(drawings.map((drawing) => drawing.id));
  let currentNumber = nextDrawingNumber;

  while (existingIds.has(`drawing-${currentNumber}`)) {
    currentNumber += 1;
  }

  return `drawing-${currentNumber}`;
}

function createDrawingGroupId(groups: DrawingGroup[], nextGroupNumber: number): string {
  const existingIds = new Set(groups.map((group) => group.id));
  let currentNumber = nextGroupNumber;

  while (existingIds.has(`drawing-group:${currentNumber}`)) {
    currentNumber += 1;
  }

  return `drawing-group:${currentNumber}`;
}

function validateDrawingGroups(
  groups: DrawingGroup[],
  drawings: DrawingObject[]
): DrawingGroup[] {
  const normalizedGroups = groups.map((group) => ({
    ...group,
    name: normalizeDrawingGroupName(group.name),
    drawingIds: [...group.drawingIds]
  }));
  const drawingIndex = new Map(drawings.map((drawing, index) => [drawing.id, index]));
  const groupIds = new Set<string>();
  const groupedDrawingIds = new Set<string>();

  for (const group of normalizedGroups) {
    if (!group.id.trim() || groupIds.has(group.id)) {
      throw new Error("Drawing group ids must be non-empty and unique");
    }
    if (group.drawingIds.length === 0) {
      throw new Error("Drawing groups require a name and at least one drawing");
    }

    groupIds.add(group.id);
    const memberIds = new Set(group.drawingIds);

    if (memberIds.size !== group.drawingIds.length) {
      throw new Error("Drawing group cannot contain duplicate drawings");
    }

    const indices = group.drawingIds.map((id) => drawingIndex.get(id));

    if (
      indices.some((index) => index === undefined) ||
      indices.some((index, offset) => index !== (indices[0] as number) + offset)
    ) {
      throw new Error("Drawing group members must exist and be contiguous");
    }

    for (const id of group.drawingIds) {
      if (groupedDrawingIds.has(id)) {
        throw new Error("A drawing can belong to only one group");
      }
      groupedDrawingIds.add(id);
    }
  }

  return cloneDrawingGroups(normalizedGroups);
}

function normalizeDrawingGroupName(name: string): string {
  const normalized = name.trim();
  if (!normalized || name.length > 256) {
    throw new Error("Drawing group name must contain 1 to 256 characters");
  }
  return normalized;
}

function compactGroupMembers(
  drawings: DrawingObject[],
  orderedMemberIds: string[]
): DrawingObject[] {
  const memberIds = new Set(orderedMemberIds);
  const memberIndices = drawings.flatMap((drawing, index) =>
    memberIds.has(drawing.id) ? [index] : []
  );
  const firstMemberIndex = memberIndices[0]!;
  const lastMemberIndex = memberIndices.at(-1)!;
  if (
    drawings
      .slice(firstMemberIndex, lastMemberIndex + 1)
      .some((drawing) => drawing.locked && !memberIds.has(drawing.id))
  ) {
    throw new Error("Drawing groups cannot cross a locked drawing");
  }
  const memberDrawings = drawings.filter((drawing) => memberIds.has(drawing.id));
  const lastMemberId = memberDrawings.at(-1)?.id;
  const nextDrawings: DrawingObject[] = [];

  for (const drawing of drawings) {
    if (!memberIds.has(drawing.id)) {
      nextDrawings.push(drawing);
    } else if (drawing.id === lastMemberId) {
      nextDrawings.push(...memberDrawings);
    }
  }

  return nextDrawings;
}

function moveDrawingGroup(
  drawings: DrawingObject[],
  groups: DrawingGroup[],
  groupId: string,
  direction: "forward" | "backward" | "front" | "back"
): DrawingObject[] {
  const units = createDrawingUnits(drawings, groups);
  const currentIndex = units.findIndex((unit) => unit.groupId === groupId);
  const isLocked = (unit: DrawingUnit): boolean =>
    unit.drawings.some((drawing) => drawing.locked);
  let targetIndex = currentIndex;
  if (direction === "forward") {
    if (units[currentIndex + 1] && !isLocked(units[currentIndex + 1]!)) {
      targetIndex += 1;
    }
  } else if (direction === "backward") {
    if (units[currentIndex - 1] && !isLocked(units[currentIndex - 1]!)) {
      targetIndex -= 1;
    }
  } else if (direction === "front") {
    while (units[targetIndex + 1] && !isLocked(units[targetIndex + 1]!)) {
      targetIndex += 1;
    }
  } else {
    while (units[targetIndex - 1] && !isLocked(units[targetIndex - 1]!)) {
      targetIndex -= 1;
    }
  }

  if (currentIndex === targetIndex) {
    return drawings;
  }

  const [unit] = units.splice(currentIndex, 1);
  units.splice(targetIndex, 0, unit);
  return units.flatMap((item) => item.drawings);
}

function reorderDrawingsBySelection(
  drawings: DrawingObject[],
  groups: DrawingGroup[],
  selectedIds: Set<string>,
  direction: "forward" | "backward"
): DrawingObject[] {
  const units = createDrawingUnits(drawings, groups);
  const isSelected = (unit: DrawingUnit): boolean =>
    unit.drawings.some((drawing) => selectedIds.has(drawing.id));
  const isLocked = (unit: DrawingUnit): boolean =>
    unit.drawings.some((drawing) => drawing.locked);

  if (direction === "forward") {
    for (let index = units.length - 2; index >= 0; index -= 1) {
      const unit = units[index];
      const nextUnit = units[index + 1];

      if (
        isSelected(unit) &&
        !isLocked(unit) &&
        !isSelected(nextUnit) &&
        !isLocked(nextUnit)
      ) {
        units[index] = nextUnit;
        units[index + 1] = unit;
      }
    }
  } else {
    for (let index = 1; index < units.length; index += 1) {
      const unit = units[index];
      const previousUnit = units[index - 1];

      if (
        isSelected(unit) &&
        !isLocked(unit) &&
        !isSelected(previousUnit) &&
        !isLocked(previousUnit)
      ) {
        units[index] = previousUnit;
        units[index - 1] = unit;
      }
    }
  }

  return units.flatMap((unit) => unit.drawings);
}

interface DrawingUnit {
  groupId?: string;
  drawings: DrawingObject[];
}

function createDrawingUnits(
  drawings: DrawingObject[],
  groups: DrawingGroup[]
): DrawingUnit[] {
  const groupByDrawingId = new Map<string, DrawingGroup>();
  const drawingById = new Map(drawings.map((drawing) => [drawing.id, drawing]));

  for (const group of groups) {
    for (const drawingId of group.drawingIds) {
      groupByDrawingId.set(drawingId, group);
    }
  }

  const visitedGroups = new Set<string>();
  const units: DrawingUnit[] = [];

  for (const drawing of drawings) {
    const group = groupByDrawingId.get(drawing.id);

    if (!group) {
      units.push({ drawings: [drawing] });
    } else if (!visitedGroups.has(group.id)) {
      visitedGroups.add(group.id);
      units.push({
        groupId: group.id,
        drawings: group.drawingIds.map((id) => drawingById.get(id) as DrawingObject)
      });
    }
  }
  return units;
}

function pruneDrawingGroups(
  groups: DrawingGroup[],
  deletedDrawingIds: Set<string>
): DrawingGroup[] {
  return groups
    .map((group) => ({
      ...group,
      drawingIds: group.drawingIds.filter((id) => !deletedDrawingIds.has(id))
    }))
    .filter((group) => group.drawingIds.length > 0);
}

function cloneDrawings(drawings: DrawingObject[]): DrawingObject[] {
  return drawings.map(cloneDrawing);
}

function cloneDrawingGroups(groups: DrawingGroup[]): DrawingGroup[] {
  return groups.map((group) => ({
    ...group,
    drawingIds: [...group.drawingIds]
  }));
}

function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    drawings: cloneDrawings(snapshot.drawings),
    drawingGroups: cloneDrawingGroups(snapshot.drawingGroups),
    selectedDrawingIds: [...snapshot.selectedDrawingIds]
  };
}

function arraysEqual<T>(left: T[], right: T[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function cloneDrawing(drawing: DrawingObject): DrawingObject {
  return JSON.parse(JSON.stringify(drawing)) as DrawingObject;
}

function mergeDrawingMetadata(
  current: Record<string, unknown> | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...(current ?? {}),
    ...patch
  };
}

function isDrawingObject(drawing: DrawingObject | undefined): drawing is DrawingObject {
  return drawing !== undefined;
}

function createBuiltInDrawingToolRegistry(): DrawingToolRegistry {
  const registry = createDrawingToolRegistry();

  for (const definition of builtInDrawingToolDefinitions) {
    registry.register(definition);
  }

  return registry;
}

function assertDrawingTool(tool: DrawingEditorTool, registry: DrawingToolRegistry): void {
  if (tool === "select") {
    return;
  }

  registry.require(tool);
}
