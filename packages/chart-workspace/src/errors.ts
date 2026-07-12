export type ChartWorkspaceErrorCode =
  | "INVALID_CONFIGURATION"
  | "SYMBOL_SEARCH_FAILED"
  | "INITIAL_DATA_FAILED"
  | "NO_VALID_DATA"
  | "HISTORY_DATA_FAILED"
  | "INVALID_DATA"
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "RENDER_FAILED";

export type ChartWorkspaceErrorScope =
  | "configuration"
  | "search"
  | "initial-data"
  | "history-data"
  | "storage"
  | "render";

export interface ChartWorkspaceError {
  code: ChartWorkspaceErrorCode;
  scope: ChartWorkspaceErrorScope;
  recoverable: boolean;
  message: string;
  context?: Readonly<Record<string, unknown>>;
}

export function createWorkspaceError(
  code: ChartWorkspaceErrorCode,
  scope: ChartWorkspaceErrorScope,
  recoverable: boolean,
  message: string,
  context?: Readonly<Record<string, unknown>>
): ChartWorkspaceError {
  return {
    code,
    scope,
    recoverable,
    message,
    ...(context === undefined ? {} : { context: Object.freeze({ ...context }) })
  };
}
