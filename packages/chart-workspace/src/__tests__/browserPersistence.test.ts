import { describe, expect, it, vi } from "vitest";
import type { ChartSymbol } from "../index";
import {
  createBrowserPersistence,
  defaultLayoutState,
  defaultPreferences,
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
const drawings = [{
  id: "d1",
  type: "trendLine" as const,
  anchors: [{ time: 1, price: 10 }, { time: 2, price: 11 }],
  interactive: false,
  affectsPriceScale: true
}];

describe("browser persistence", () => {
  it("starts the advanced inspector collapsed", () => {
    expect(defaultLayoutState.bottomPanel).toMatchObject({ height: 300, collapsed: true, activeTab: "objects" });
  });

  it("persists timeframe favorites and fills the default favorites into legacy preferences", () => {
    const storage = new MemoryStorage();
    const persistence = createBrowserPersistence("trs", "user-1", "current", storage, vi.fn());
    persistence.savePreferences({
      ...defaultPreferences,
      favoriteTimeframes: ["5m", "1d", "intraday"],
      seriesProperties: [{ type: "renko", brickSize: 2 }]
    });
    expect(persistence.loadPreferences().favoriteTimeframes).toEqual(["5m", "1d", "intraday"]);
    expect(persistence.loadPreferences().seriesProperties).toEqual([
      { type: "renko", brickSize: 2 }
    ]);

    storage.setItem("simoncharts:workspace:v1:trs:user-1:preferences", JSON.stringify({
      schemaVersion: 1,
      value: { seriesType: "candles", priceScaleMode: "linear", gridVisible: false }
    }));
    expect(persistence.loadPreferences()).toEqual({
      ...defaultPreferences,
      gridVisible: false
    });
  });

  it("truncates legacy timeframe favorites beyond the current limit", () => {
    const storage = new MemoryStorage();
    const onError = vi.fn<BrowserPersistenceErrorHandler>();
    const persistence = createBrowserPersistence("trs", "user-1", "current", storage, onError);
    storage.setItem("simoncharts:workspace:v1:trs:user-1:preferences", JSON.stringify({
      schemaVersion: 1,
      value: {
        seriesType: "area",
        priceScaleMode: "percentage",
        gridVisible: false,
        favoriteTimeframes: ["1m", "5m", "15m", "30m", "60m"]
      }
    }));

    expect(persistence.loadPreferences()).toEqual({
      seriesType: "area",
      priceScaleMode: "percentage",
      gridVisible: false,
      favoriteTimeframes: ["1m", "5m", "15m", "30m"]
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("fails closed on invalid persisted series properties", () => {
    const storage = new MemoryStorage();
    const onError = vi.fn<BrowserPersistenceErrorHandler>();
    const persistence = createBrowserPersistence("trs", "user-1", "current", storage, onError);
    const key = "simoncharts:workspace:v1:trs:user-1:preferences";
    storage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      value: {
        ...defaultPreferences,
        seriesProperties: [{ type: "renko", brickSize: 0 }]
      }
    }));

    expect(persistence.loadPreferences()).toEqual(defaultPreferences);
    expect(storage.getItem(key)).toBeNull();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "STORAGE_READ_FAILED" })
    );
  });

  it("round-trips validated sparse series visual overrides", () => {
    const storage = new MemoryStorage();
    const persistence = createBrowserPersistence("trs", "user-1", "current", storage, vi.fn());
    const seriesVisualOverrides = [
      { type: "candles" as const, upColor: "#ef4444", downColor: "#22c55e" },
      { type: "line" as const, color: "#2962ff", lineWidth: 2 }
    ];

    persistence.savePreferences({
      ...defaultPreferences,
      seriesVisualOverrides
    });
    seriesVisualOverrides[0]!.upColor = "#000000";

    expect(persistence.loadPreferences().seriesVisualOverrides).toEqual([
      { type: "candles", upColor: "#ef4444", downColor: "#22c55e" },
      { type: "line", color: "#2962ff", lineWidth: 2 }
    ]);
  });

  it("fails closed on invalid persisted series visual overrides", () => {
    const storage = new MemoryStorage();
    const onError = vi.fn<BrowserPersistenceErrorHandler>();
    const persistence = createBrowserPersistence("trs", "user-1", "current", storage, onError);
    const key = "simoncharts:workspace:v1:trs:user-1:preferences";
    storage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      value: {
        ...defaultPreferences,
        seriesVisualOverrides: [{ type: "line", color: "#2962ff", lineWidth: 0 }]
      }
    }));

    expect(persistence.loadPreferences()).toEqual(defaultPreferences);
    expect(storage.getItem(key)).toBeNull();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "STORAGE_READ_FAILED" })
    );
  });

  it("isolates drawings by workspace, persistence scope, data context, symbol, and adjustment but not timeframe", () => {
    const storage = new MemoryStorage();
    const persistence = createBrowserPersistence("trs", "user-1", "cutoff:2026-07-16", storage, vi.fn());
    persistence.saveDrawings(stock, "forward", drawings);

    expect(persistence.loadDrawings(stock, "forward")).toEqual(drawings);
    expect(persistence.loadDrawings(stock, "backward")).toEqual([]);
    expect(persistence.loadDrawings({ ...stock, id: "stock:SZSE:000001" }, "forward")).toEqual([]);
    expect(createBrowserPersistence("trs", "user-2", "cutoff:2026-07-16", storage, vi.fn()).loadDrawings(stock, "forward")).toEqual([]);
    expect(createBrowserPersistence("trs", "user-1", "cutoff:2026-07-15", storage, vi.fn()).loadDrawings(stock, "forward")).toEqual([]);
    expect(storage.entries().map(([key]) => key).join(" ")).not.toContain("1m");
  });

  it("discards only a corrupted namespace and reports a safe read error", () => {
    const storage = new MemoryStorage();
    const onError = vi.fn<BrowserPersistenceErrorHandler>();
    const persistence = createBrowserPersistence("trs", "user-1", "current", storage, onError);
    persistence.savePreferences({ ...defaultPreferences, gridVisible: false });
    storage.setItem("simoncharts:workspace:v1:trs:user-1:layout", "{bad-json");

    expect(persistence.loadLayout()).toEqual(defaultLayoutState);
    expect(persistence.loadPreferences().gridVisible).toBe(false);
    expect(storage.getItem("simoncharts:workspace:v1:trs:user-1:layout")).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "STORAGE_READ_FAILED" }));
    expect(onError.mock.calls[0][0]).not.toHaveProperty("context");
  });

  it("fails closed on persisted duplicate entity ids", () => {
    const storage = new MemoryStorage();
    const onError = vi.fn<BrowserPersistenceErrorHandler>();
    const persistence = createBrowserPersistence("trs", "user-1", "current", storage, onError);
    persistence.saveIndicators([
      { instanceId: "ma-primary", id: "MA", params: { period: 5 }, visible: true },
      { instanceId: "ma-primary", id: "MA", params: { period: 10 }, visible: true }
    ]);
    persistence.saveDrawings(stock, "forward", [drawings[0]!, drawings[0]!]);

    expect(persistence.loadIndicators()).toEqual([]);
    expect(persistence.loadDrawings(stock, "forward")).toEqual([]);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ code: "STORAGE_READ_FAILED" })
    );
    expect(onError).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ code: "STORAGE_READ_FAILED" })
    );
  });

  it("keeps legacy indicator storage untouched when reading V2 instances", () => {
    const storage = new MemoryStorage();
    const legacyKey = "simoncharts:workspace:v1:trs:user-1:indicators";
    storage.setItem(legacyKey, JSON.stringify([
      { id: "MA", params: { period: 5 }, visible: true }
    ]));
    const onError = vi.fn<BrowserPersistenceErrorHandler>();
    const persistence = createBrowserPersistence("trs", "user-1", "current", storage, onError);

    expect(persistence.loadIndicators()).toEqual([]);
    expect(storage.getItem(legacyKey)).not.toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports safe write failures without changing runtime input", () => {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
    const onError = vi.fn<BrowserPersistenceErrorHandler>();
    const persistence = createBrowserPersistence("secret-workspace", "user-1", "current", storage, onError);
    const layout = structuredClone(defaultLayoutState);

    persistence.saveLayout(layout);
    expect(layout).toEqual(defaultLayoutState);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "STORAGE_WRITE_FAILED" }));
    expect(onError.mock.calls[0][0]).not.toHaveProperty("context");
    expect(JSON.stringify(onError.mock.calls)).not.toContain("secret-workspace");
  });
});
