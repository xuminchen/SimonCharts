import { describe, expect, it } from "vitest";
import { formatShanghaiTime } from "../runtime/shanghaiTimeFormatter";

describe("Shanghai time formatter", () => {
  it("formats intraday timestamps with Shanghai date and time", () => {
    const epoch = Date.UTC(2026, 5, 5, 1, 30);
    for (const timeframe of ["1m", "5m", "15m", "30m", "60m"] as const) {
      expect(formatShanghaiTime(epoch, timeframe)).toBe("2026-06-05 09:30");
    }
  });

  it("formats daily and higher timestamps without a clock", () => {
    const epoch = Date.UTC(2026, 5, 5, 16, 30);
    for (const timeframe of ["1d", "1w", "1mo"] as const) {
      expect(formatShanghaiTime(epoch, timeframe)).toBe("2026-06-06");
    }
  });
});
