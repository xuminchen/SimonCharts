import type { DrawingEditorCommand } from "./drawingCommands";

export interface DrawingHotkeyBinding {
  key: string;
  command: DrawingEditorCommand;
}

export const defaultDrawingHotkeyBindings: readonly DrawingHotkeyBinding[] = Object.freeze([
  freezeBinding({ key: "Backspace", command: { type: "deleteSelected" } }),
  freezeBinding({ key: "Delete", command: { type: "deleteSelected" } }),
  freezeBinding({ key: "Meta+c", command: { type: "copySelected" } }),
  freezeBinding({ key: "Meta+v", command: { type: "pasteCopied", offset: { dx: 12, dy: 12 } } }),
  freezeBinding({
    key: "Meta+d",
    command: { type: "duplicateSelected", offset: { dx: 12, dy: 12 } }
  }),
  freezeBinding({ key: "Meta+ArrowUp", command: { type: "bringSelectedForward" } }),
  freezeBinding({ key: "Meta+ArrowDown", command: { type: "sendSelectedBackward" } }),
  freezeBinding({ key: "Escape", command: { type: "cancelCreation" } })
]);

export function getDrawingCommandForHotkey(
  bindings: readonly DrawingHotkeyBinding[],
  key: string
): DrawingEditorCommand | undefined {
  const binding = bindings.find((entry) => entry.key === key);

  return binding ? cloneDrawingCommand(binding.command) : undefined;
}

function freezeBinding(binding: DrawingHotkeyBinding): DrawingHotkeyBinding {
  freezeCommand(binding.command);

  return Object.freeze(binding);
}

function freezeCommand(command: DrawingEditorCommand): DrawingEditorCommand {
  if ("offset" in command) {
    Object.freeze(command.offset);
  }

  return Object.freeze(command);
}

function cloneDrawingCommand(command: DrawingEditorCommand): DrawingEditorCommand {
  return JSON.parse(JSON.stringify(command)) as DrawingEditorCommand;
}
