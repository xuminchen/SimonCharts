export interface ReversibleCommand<TState> {
  label: string;
  do(state: TState): TState;
  undo(state: TState): TState;
}

export interface CommandHistory<TState> {
  apply(command: ReversibleCommand<TState>): TState;
  undo(): TState;
  redo(): TState;
  current(): TState;
  canUndo(): boolean;
  canRedo(): boolean;
}

export function createCommandHistory<TState>(initialState: TState): CommandHistory<TState> {
  let state = initialState;
  const undoStack: ReversibleCommand<TState>[] = [];
  const redoStack: ReversibleCommand<TState>[] = [];

  return {
    apply(command) {
      state = command.do(state);
      undoStack.push(command);
      redoStack.length = 0;
      return state;
    },
    undo() {
      const command = undoStack.pop();

      if (!command) {
        return state;
      }

      state = command.undo(state);
      redoStack.push(command);
      return state;
    },
    redo() {
      const command = redoStack.pop();

      if (!command) {
        return state;
      }

      state = command.do(state);
      undoStack.push(command);
      return state;
    },
    current() {
      return state;
    },
    canUndo() {
      return undoStack.length > 0;
    },
    canRedo() {
      return redoStack.length > 0;
    }
  };
}
