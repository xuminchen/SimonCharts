import { describe, expect, it, vi } from "vitest";
import type { ChartSymbol } from "../index";
import {
  createBrowserPersistence,
  defaultLayoutState,
  type BrowserPersistenceErrorHandler
} from "../persistence/browserPersistence";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
  entries() { return [...this.values.entries()]; }
}

const stock: ChartSymbol = { id: "stock:SSE:600000", code: "600000", name: "浦发银行", exchange: "SSE", kind: "stock" };
const drawings = [{ id: "d1", type: "trendLine" as const, anchors: [{ time: 1, price: 10 }, { time: 2, price: 11 }] }];

describe("browser persistence", () => {
  it("isolates drawing namespaces by workspace, symbol, and adjustment but not timeframe", () => {
    const storage = new MemoryStorage();
    const persistence = createBrowserPersistence("trs", storage, vi.fn());
    persistence.saveDrawings(stock, "forward", drawings);

    expect(persistence.loadDrawings(stock, "forward")).toEqual(drawings);
    expect(persistence.loadDrawings(stock, "backward")).toEqual([]);
    expect(persistence.loadDrawings({ ...stock, id: "stock:SZSE:000001" }, "forward")).toEqual([]);
    expect(storage.entries().map(([key]) => key).join(" ")).not.toContain("1m");
  });

  it("discards only a corrupted namespace and reports a safe read error", () => {
    const storage = new MemoryStorage();
    const onError = vi.fn<BrowserPersistenceErrorHandler>();
    const persistence = createBrowserPersistence("trs", storage, onError);
    persistence.savePreferences({ seriesType: "candles", priceScaleMode: "linear", gridVisible: false });
    storage.setItem("simoncharts:workspace:v1:trs:layout", "{bad-json");

    expect(persistence.loadLayout()).toEqual(defaultLayoutState);
    expect(persistence.loadPreferences().gridVisible).toBe(false);
    expect(storage.getItem("simoncharts:workspace:v1:trs:layout")).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "STORAGE_READ_FAILED" }));
    expect(onError.mock.calls[0][0]).not.toHaveProperty("context");
  });

  it("reports safe write failures without changing runtime input", () => {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
    const onError = vi.fn<BrowserPersistenceErrorHandler>();
    const persistence = createBrowserPersistence("secret-workspace", storage, onError);
    const layout = structuredClone(defaultLayoutState);

    persistence.saveLayout(layout);
    expect(layout).toEqual(defaultLayoutState);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "STORAGE_WRITE_FAILED" }));
    expect(onError.mock.calls[0][0]).not.toHaveProperty("context");
    expect(JSON.stringify(onError.mock.calls)).not.toContain("secret-workspace");
  });
});
