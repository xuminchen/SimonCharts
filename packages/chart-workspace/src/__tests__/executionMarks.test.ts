import { describe, expect, it } from "vitest";
import type { Candle, ChartExecution } from "../contracts";
import {
  createExecutionMarkerOutput,
  executionCandleIndex,
  executionsFromMark,
  executionTooltipRows
} from "../runtime/executionMarks";

const at = (value: string): number => Date.parse(value);
const candle = (time: number, low = 9, high = 11): Candle => ({
  time,
  open: 10,
  high,
  low,
  close: 10,
  volume: 100,
  turnover: 1_000
});
const execution = (input: Partial<ChartExecution> & Pick<ChartExecution, "id" | "time" | "side">): ChartExecution => ({
  price: 10,
  quantity: 100,
  ...input
});

describe("execution marks", () => {
  it("maps a non-boundary minute execution to its containing latest candle", () => {
    const candles = [
      candle(at("2026-07-17T01:30:00Z")),
      candle(at("2026-07-17T01:35:00Z"))
    ];

    expect(executionCandleIndex(candles, at("2026-07-17T01:39:59Z"), "5m")).toBe(1);
    expect(executionCandleIndex(candles, at("2026-07-17T01:40:00Z"), "5m")).toBeUndefined();
  });

  it("maps opening-auction executions to the first same-day minute candle only", () => {
    const candles = [
      candle(at("2026-07-16T01:30:00Z")),
      candle(at("2026-07-17T01:30:00Z"))
    ];

    expect(executionCandleIndex(candles, at("2026-07-17T01:25:00Z"), "1m")).toBe(1);
    expect(executionCandleIndex(candles, at("2026-07-17T01:25:01Z"), "5m")).toBe(1);
    expect(executionCandleIndex(candles, at("2026-07-16T16:00:00Z"), "1m")).toBeUndefined();
    expect(executionCandleIndex(candles, at("2026-07-16T01:25:00Z"), "1m")).toBe(0);
  });

  it("keeps only exact A-share session closes in the preceding minute bucket", () => {
    const candles = [
      candle(at("2026-07-17T03:25:00Z")),
      candle(at("2026-07-17T06:55:00Z"))
    ];

    expect(executionCandleIndex(candles, at("2026-07-17T03:30:00Z"), "5m")).toBe(0);
    expect(executionCandleIndex(candles, at("2026-07-17T04:00:00Z"), "5m")).toBeUndefined();
    expect(executionCandleIndex(candles, at("2026-07-17T07:00:00Z"), "5m")).toBe(1);
  });

  it.each([
    ["1d", "2026-07-17T01:30:00Z"],
    ["1w", "2026-07-13T01:30:00Z"],
    ["1mo", "2026-07-01T01:30:00Z"]
  ] as const)("maps executions by Shanghai %s bucket", (timeframe, candleTime) => {
    const candles = [candle(at(candleTime)), candle(at("2026-08-03T01:30:00Z"))];
    expect(executionCandleIndex(candles, at("2026-07-17T06:59:59Z"), timeframe)).toBe(0);
  });

  it("groups same-candle executions while retaining every tooltip row", () => {
    const candles = [candle(at("2026-07-17T01:30:00Z"))];
    const output = createExecutionMarkerOutput([
      execution({ id: "b2", time: at("2026-07-17T01:31:00Z"), side: "buy", price: 10.2, quantity: 200, label: "T买", tQuantity: 100 }),
      execution({ id: "b1", time: at("2026-07-17T01:30:30Z"), side: "buy", price: 9.8, label: "T买" }),
      execution({ id: "s1", time: at("2026-07-17T01:31:30Z"), side: "sell", label: "S" })
    ], candles, "5m");

    expect(output?.marks).toHaveLength(2);
    const buy = output?.marks.find((mark) => mark.direction === "below")!;
    expect(buy).toMatchObject({ label: "T买 ×2", price: 10.2 });
    expect(executionsFromMark(buy).map((row) => row.id)).toEqual(["b1", "b2"]);
  });

  it("keeps every execution accessible when one marker contains many fills", () => {
    const candleTime = at("2026-07-17T01:30:00Z");
    const executions = Array.from({ length: 30 }, (_, index) => execution({
      id: `fill-${index + 1}`,
      time: candleTime + index * 1_000,
      side: "buy",
      price: 10 + index / 100,
      label: "B"
    }));
    const output = createExecutionMarkerOutput(executions, [candle(candleTime)], "5m")!;
    const mark = output.marks[0]!;
    const tooltipRows = executionTooltipRows(mark, "zh-CN");

    expect(mark.label).toBe("B ×30");
    expect(executionsFromMark(mark).map((row) => row.id)).toEqual(executions.map((row) => row.id));
    expect(tooltipRows).toHaveLength(90);
    expect(tooltipRows).toContainEqual({ label: "#30 时间", value: expect.any(String) });
    expect(tooltipRows).toContainEqual({ label: "价格", value: "10.29" });
  });

  it("stacks different execution types on the same candle and side", () => {
    const candles = [candle(at("2026-07-17T01:30:00Z"))];
    const output = createExecutionMarkerOutput([
      execution({ id: "b", time: at("2026-07-17T01:30:30Z"), side: "buy", label: "B" }),
      execution({ id: "tb", time: at("2026-07-17T01:31:00Z"), side: "buy", label: "T买", tQuantity: 100 })
    ], candles, "5m")!;

    expect(output.marks.map((mark) => mark.metadata?.stackIndex)).toEqual([0, 1]);
  });

  it("preserves host order when executions share the same timestamp", () => {
    const candles = [candle(at("2026-07-17T01:30:00Z"))];
    const output = createExecutionMarkerOutput([
      execution({ id: "10", time: at("2026-07-17T01:30:30Z"), side: "buy", label: "B" }),
      execution({ id: "2", time: at("2026-07-17T01:30:30Z"), side: "buy", label: "B" })
    ], candles, "5m")!;

    expect(executionsFromMark(output.marks[0]!).map((row) => row.id)).toEqual(["10", "2"]);
  });

  it("formats legacy, single, and per-execution time ranges without changing marker grouping", () => {
    const candleTime = at("2026-07-17T01:30:00Z");
    const ranged = [
      execution({
        id: "legacy",
        time: at("2026-07-17T01:33:10Z"),
        side: "buy",
        label: "B"
      }),
      execution({
        id: "single",
        time: at("2026-07-17T01:32:00Z"),
        firstTime: at("2026-07-17T01:32:00Z"),
        lastTime: at("2026-07-17T01:32:00Z"),
        side: "buy",
        label: "B"
      }),
      execution({
        id: "range",
        time: at("2026-07-17T01:33:30Z"),
        firstTime: at("2026-07-17T01:31:00Z"),
        lastTime: at("2026-07-17T01:33:30Z"),
        side: "buy",
        label: "B"
      })
    ];
    const candles = [candle(candleTime)];
    const output = createExecutionMarkerOutput(ranged, candles, "5m")!;
    const control = createExecutionMarkerOutput(
      ranged.map(({ firstTime: _firstTime, lastTime: _lastTime, ...row }) => row),
      candles,
      "5m"
    )!;

    expect(output.marks).toHaveLength(1);
    expect(output.marks.map(({ metadata: _metadata, ...mark }) => mark))
      .toEqual(control.marks.map(({ metadata: _metadata, ...mark }) => mark));
    expect(output.marks[0]!.time).toBe(candleTime);

    const timeRows = executionTooltipRows(output.marks[0]!, "zh-CN")
      .filter((row) => row.label.includes("时间"))
      .map((row) => row.value);
    expect(timeRows).toHaveLength(3);
    expect(timeRows.some((value) => value.includes("09:33:10"))).toBe(true);
    expect(timeRows.find((value) => value.includes("09:32:00"))?.match(/09:32:00/g)).toHaveLength(1);
    const range = timeRows.find((value) => value.includes("09:31:00"));
    expect(range).toContain("09:31:00");
    expect(range).toContain("09:33:30");
  });

  it("anchors adjusted daily markers to candle low/high while keeping real prices in metadata", () => {
    const candles = [candle(at("2026-07-17T01:30:00Z"), 8.5, 11.5)];
    const output = createExecutionMarkerOutput([
      execution({ id: "b", time: at("2026-07-17T02:00:00Z"), side: "buy", price: 35 }),
      execution({ id: "s", time: at("2026-07-17T03:00:00Z"), side: "sell", price: 36 })
    ], candles, "1d");

    expect(output?.marks.find((mark) => mark.direction === "below")?.price).toBe(8.5);
    expect(output?.marks.find((mark) => mark.direction === "above")?.price).toBe(11.5);
    expect(executionsFromMark(output!.marks[0]!).map((row) => row.price)).toContain(35);
  });

  it("keeps amount, fee, T quantity, and regular quantity in tooltip rows", () => {
    const candles = [candle(at("2026-07-17T01:30:00Z"))];
    const output = createExecutionMarkerOutput([
      execution({
        id: "t",
        time: at("2026-07-17T01:30:30Z"),
        side: "buy",
        label: "T买",
        quantity: 300,
        amount: 3_000,
        fee: 5,
        tQuantity: 100
      })
    ], candles, "5m")!;

    expect(executionTooltipRows(output.marks[0]!, "zh-CN")).toEqual(expect.arrayContaining([
      { label: "金额", value: "3,000" },
      { label: "费用", value: "5" },
      { label: "T 数量", value: "100" },
      { label: "普通数量", value: "200" }
    ]));
  });

  it("shows zero T quantity and the full ordinary quantity for an unmatched execution", () => {
    const candles = [candle(at("2026-07-17T01:30:00Z"))];
    const output = createExecutionMarkerOutput([
      execution({
        id: "ordinary",
        time: at("2026-07-17T01:30:30Z"),
        side: "sell",
        label: "S",
        quantity: 300,
        tQuantity: 0
      })
    ], candles, "5m")!;

    expect(executionTooltipRows(output.marks[0]!, "zh-CN")).toEqual(expect.arrayContaining([
      { label: "T 数量", value: "0" },
      { label: "普通数量", value: "300" }
    ]));
  });
});
