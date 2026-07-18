export type ChartErrorCode =
  | "INVALID_CONFIGURATION"
  | "SYMBOL_SEARCH_FAILED"
  | "INITIAL_DATA_FAILED"
  | "NO_VALID_DATA"
  | "HISTORY_DATA_FAILED"
  | "INVALID_DATA"
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "RENDER_FAILED";

export type ChartErrorScope =
  | "configuration"
  | "search"
  | "initial-data"
  | "history-data"
  | "storage"
  | "render";

export interface ChartError {
  code: ChartErrorCode;
  scope: ChartErrorScope;
  recoverable: boolean;
  message: string;
  context?: Readonly<Record<string, unknown>>;
}

export type ChartDatafeedErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "NO_DATA"
  | "UNAVAILABLE";

const chartDatafeedErrorCodes: readonly ChartDatafeedErrorCode[] = [
  "NOT_CONFIGURED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "NO_DATA",
  "UNAVAILABLE"
];

export class ChartDatafeedError extends Error {
  readonly code: ChartDatafeedErrorCode;
  readonly recoverable: boolean;

  constructor(code: ChartDatafeedErrorCode, message: string, recoverable: boolean) {
    if (!chartDatafeedErrorCodes.includes(code)) {
      throw new TypeError("Chart datafeed error code is invalid");
    }
    if (typeof message !== "string" || message.trim().length === 0) {
      throw new TypeError("Chart datafeed error message is required");
    }
    if (typeof recoverable !== "boolean") {
      throw new TypeError("Chart datafeed error recoverable flag is required");
    }
    super(message);
    this.name = "ChartDatafeedError";
    this.code = code;
    this.recoverable = recoverable;
  }
}

export function createChartError(
  code: ChartErrorCode,
  scope: ChartErrorScope,
  recoverable: boolean,
  message: string,
  context?: Readonly<Record<string, unknown>>
): ChartError {
  return {
    code,
    scope,
    recoverable,
    message,
    ...(context === undefined ? {} : { context: Object.freeze({ ...context }) })
  };
}
