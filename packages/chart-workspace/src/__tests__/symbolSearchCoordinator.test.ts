import { describe, expect, it } from "vitest";
import type { ChartSymbol, ChartWorkspaceDataSource } from "../index";
import {
  createSymbolSearchCoordinator,
  type SymbolSearchCoordinatorEvent
} from "../data/symbolSearchCoordinator";

describe("symbol search coordinator", () => {
  it("publishes only the newest valid cloned result", async () => {
    let firstResolve!: (value: readonly ChartSymbol[]) => void;
    const first = new Promise<readonly ChartSymbol[]>((resolve) => (firstResolve = resolve));
    const signals: AbortSignal[] = [];
    const dataSource: ChartWorkspaceDataSource = {
      searchSymbols(_query, signal) {
        signals.push(signal);
        return signals.length === 1
          ? first
          : Promise.resolve([
              { id: "index", code: "000001", name: "上证指数", exchange: "SSE", kind: "index" }
            ]);
      },
      async loadSeries() {
        throw new Error("unused");
      }
    };
    const events: SymbolSearchCoordinatorEvent[] = [];
    const coordinator = createSymbolSearchCoordinator({ dataSource, onEvent: (event) => events.push(event) });

    const stale = coordinator.search("浦发");
    const current = coordinator.search("上证");
    firstResolve([
      { id: "stock", code: "600000", name: "浦发银行", exchange: "SSE", kind: "stock" }
    ]);
    await Promise.all([stale, current]);

    expect(signals[0].aborted).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "results", query: "上证" });
    if (events[0]?.type === "results") expect(Object.isFrozen(events[0].symbols[0])).toBe(true);
  });

  it("rejects the entire malformed or duplicate result", async () => {
    const dataSource: ChartWorkspaceDataSource = {
      async searchSymbols() {
        return [
          { id: "same", code: "600000", name: "A", exchange: "SSE", kind: "stock" },
          { id: "same", code: "000001", name: "B", exchange: "SSE", kind: "index" }
        ];
      },
      async loadSeries() {
        throw new Error("unused");
      }
    };
    const events: SymbolSearchCoordinatorEvent[] = [];
    const coordinator = createSymbolSearchCoordinator({ dataSource, onEvent: (event) => events.push(event) });

    await coordinator.search("same");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "searchFailed" });
  });
});
