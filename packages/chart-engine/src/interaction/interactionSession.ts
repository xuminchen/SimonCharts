import {
  defaultInteractionSessionState,
  type CursorMode,
  type InteractionInput,
  type InteractionPoint,
  type InteractionSession,
  type InteractionSessionEvent,
  type InteractionSessionOptions,
  type InteractionSessionState,
  type KeyboardSessionState
} from "./sessionTypes";

export function createInteractionSession(
  options: InteractionSessionOptions = {}
): InteractionSession {
  let state = cloneState(defaultInteractionSessionState);
  let active = true;

  function emit(event: InteractionSessionEvent): void {
    if (active) {
      options.onEvent?.(event);
    }
  }

  function setCursor(cursor: CursorMode): void {
    if (state.cursor === cursor) {
      return;
    }

    state = { ...state, cursor };
    emit({ type: "cursorChanged", cursor });
  }

  return {
    handleInput(input) {
      if (!active) {
        return;
      }

      if (input.type === "pointerMove") {
        state = { ...state, pointer: { mode: "hover", point: clonePoint(input.point) } };
        emit({ type: "pointerMoved", point: clonePoint(input.point) });
        setCursor("crosshair");
        return;
      }

      if (input.type === "pointerDown") {
        const mode = input.mode ?? "dragPan";
        state = {
          ...state,
          pointer: {
            mode,
            point: clonePoint(input.point),
            startPoint: clonePoint(input.point)
          }
        };
        emit({ type: "pointerDragStarted", point: clonePoint(input.point) });
        setCursor(mode === "dragPan" ? "grabbing" : mode === "drawing" ? "drawing" : "resize");
        return;
      }

      if (input.type === "pointerDrag") {
        const startPoint = state.pointer.startPoint;
        if (!startPoint) {
          return;
        }
        state = { ...state, pointer: { ...state.pointer, point: clonePoint(input.point) } };
        emit({
          type: "pointerDragged",
          point: clonePoint(input.point),
          startPoint: clonePoint(startPoint)
        });
        return;
      }

      if (input.type === "pointerUp") {
        if (!state.pointer.startPoint) {
          return;
        }
        state = { ...state, pointer: { mode: "hover", point: clonePoint(input.point) } };
        emit({ type: "pointerDragEnded", point: clonePoint(input.point) });
        setCursor("crosshair");
        return;
      }

      if (input.type === "pointerCancel") {
        state = { ...state, pointer: { mode: "canceled" } };
        setCursor("default");
        return;
      }

      if (input.type === "wheel") {
        if (input.deltaY === 0) {
          return;
        }
        emit({ type: "wheelZoomed", point: clonePoint(input.point), deltaY: input.deltaY });
        return;
      }

      if (input.type === "keyboardDown" || input.type === "keyboardUp") {
        state = { ...state, keyboard: toKeyboardState(input) };
        const command = toKeyboardCommand(input.type, input.key);
        if (command) {
          emit({ type: "keyboardCommand", command, key: input.key });
        }
        return;
      }

      if (input.type === "crosshair") {
        const crosshair = input.crosshair
          ? { visible: true as const, ...input.crosshair }
          : { visible: false as const };
        state = { ...state, crosshair };
        emit({ type: "crosshairChanged", crosshair: cloneCrosshair(crosshair) });
        return;
      }

      if (input.type === "tooltip") {
        state = { ...state, tooltip: cloneTooltip(input.tooltip) };
        emit({ type: "tooltipChanged", tooltip: cloneTooltip(state.tooltip) });
        return;
      }

      if (input.type === "cursor") {
        setCursor(input.cursor);
        return;
      }

      if (input.type === "magnet") {
        state = { ...state, magnet: cloneMagnet(input.magnet) };
        emit({ type: "magnetTargetChanged", magnet: cloneMagnet(state.magnet) });
        return;
      }

      if (input.type === "leave" || input.type === "blur") {
        state = {
          ...state,
          pointer: { mode: "idle" },
          crosshair: { visible: false },
          tooltip: { visible: false },
          cursor: "default",
          magnet: { mode: "off" },
          keyboard: createDefaultKeyboardState()
        };
        emit({ type: "crosshairChanged", crosshair: cloneCrosshair(state.crosshair) });
        emit({ type: "tooltipChanged", tooltip: cloneTooltip(state.tooltip) });
        emit({ type: "cursorChanged", cursor: state.cursor });
        emit({ type: "magnetTargetChanged", magnet: cloneMagnet(state.magnet) });
      }
    },
    getState() {
      return cloneState(state);
    },
    destroy() {
      active = false;
    }
  };
}

function toKeyboardState(
  input: Extract<InteractionInput, { type: "keyboardDown" | "keyboardUp" }>
): KeyboardSessionState {
  return {
    altKey: input.altKey ?? false,
    ctrlKey: input.ctrlKey ?? false,
    metaKey: input.metaKey ?? false,
    shiftKey: input.shiftKey ?? false,
    lastKey: input.key
  };
}

function createDefaultKeyboardState(): KeyboardSessionState {
  return {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false
  };
}

function toKeyboardCommand(
  type: "keyboardDown" | "keyboardUp",
  key: string
): "zoomIn" | "zoomOut" | "resetZoom" | undefined {
  if (type !== "keyboardDown") {
    return undefined;
  }
  if (key === "+" || key === "=") return "zoomIn";
  if (key === "-") return "zoomOut";
  if (key === "0") return "resetZoom";
  return undefined;
}

function cloneState(state: InteractionSessionState): InteractionSessionState {
  return {
    pointer: clonePointer(state.pointer),
    crosshair: cloneCrosshair(state.crosshair),
    tooltip: cloneTooltip(state.tooltip),
    cursor: state.cursor,
    magnet: cloneMagnet(state.magnet),
    keyboard: { ...state.keyboard }
  };
}

function clonePointer(
  pointer: InteractionSessionState["pointer"]
): InteractionSessionState["pointer"] {
  const next: InteractionSessionState["pointer"] = { mode: pointer.mode };
  if (pointer.point) {
    next.point = clonePoint(pointer.point);
  }
  if (pointer.startPoint) {
    next.startPoint = clonePoint(pointer.startPoint);
  }
  return next;
}

function cloneTooltip(
  tooltip: InteractionSessionState["tooltip"]
): InteractionSessionState["tooltip"] {
  const next: InteractionSessionState["tooltip"] = { visible: tooltip.visible };
  if (tooltip.sourceType) {
    next.sourceType = tooltip.sourceType;
  }
  if (tooltip.rows) {
    next.rows = tooltip.rows.map((row) => ({ ...row }));
  }
  return next;
}

function cloneCrosshair(
  crosshair: InteractionSessionState["crosshair"]
): InteractionSessionState["crosshair"] {
  return crosshair.visible ? { ...crosshair } : { visible: false };
}

function cloneMagnet(magnet: InteractionSessionState["magnet"]): InteractionSessionState["magnet"] {
  return magnet.target
    ? {
        ...magnet,
        target: { ...magnet.target, point: clonePoint(magnet.target.point) }
      }
    : { mode: magnet.mode };
}

function clonePoint(point: InteractionPoint): InteractionPoint {
  return { ...point };
}
