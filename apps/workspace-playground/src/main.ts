import {
  createChartWorkspace,
  type ChartWorkspace,
  type ChartWorkspaceOptions
} from "@simoncharts/chart-workspace";
import "@simoncharts/chart-workspace/styles.css";
import "./styles.css";
import {
  createFixtureDataSource,
  readFixtureControls,
  stock,
  type FixtureRequestLog,
  type HostCounters
} from "./fixtures/createFixtureDataSource";

const counters: HostCounters = {
  activeRequests: 0,
  activeObservers: 0,
  activeAnimationFrames: 0,
  activeEventListeners: 0,
  abortedRequests: 0,
  errors: 0
};
window.__hostCounters = counters;
const requests: FixtureRequestLog[] = [];
window.__workspaceRequests = requests;

const nativeAddEventListener = EventTarget.prototype.addEventListener;
const nativeRemoveEventListener = EventTarget.prototype.removeEventListener;
const trackedListeners = new WeakMap<EventTarget, Map<string, Set<EventListenerOrEventListenerObject>>>();
const isWorkspaceTarget = (target: EventTarget): boolean =>
  target === window || (target instanceof Node && Boolean(document.querySelector("#app")?.contains(target)));
EventTarget.prototype.addEventListener = function(type, listener, options) {
  nativeAddEventListener.call(this, type, listener, options);
  if (!listener || !isWorkspaceTarget(this)) return;
  const byType = trackedListeners.get(this) ?? new Map<string, Set<EventListenerOrEventListenerObject>>();
  const listeners = byType.get(type) ?? new Set<EventListenerOrEventListenerObject>();
  if (!listeners.has(listener)) {
    listeners.add(listener);
    counters.activeEventListeners += 1;
  }
  byType.set(type, listeners);
  trackedListeners.set(this, byType);
};
EventTarget.prototype.removeEventListener = function(type, listener, options) {
  nativeRemoveEventListener.call(this, type, listener, options);
  if (!listener) return;
  const listeners = trackedListeners.get(this)?.get(type);
  if (listeners?.delete(listener)) counters.activeEventListeners -= 1;
};

const NativeResizeObserver = window.ResizeObserver;
window.ResizeObserver = class InstrumentedResizeObserver implements ResizeObserver {
  private readonly observer: ResizeObserver;
  private active = false;
  constructor(callback: ResizeObserverCallback) { this.observer = new NativeResizeObserver(callback); }
  observe(target: Element, options?: ResizeObserverOptions) {
    if (!this.active) { this.active = true; counters.activeObservers += 1; }
    this.observer.observe(target, options);
  }
  unobserve(target: Element) { this.observer.unobserve(target); }
  disconnect() {
    if (this.active) { this.active = false; counters.activeObservers -= 1; }
    this.observer.disconnect();
  }
} as typeof ResizeObserver;

const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
const activeFrames = new Set<number>();
window.requestAnimationFrame = (callback) => {
  const id = nativeRequestAnimationFrame((time) => {
    if (activeFrames.delete(id)) counters.activeAnimationFrames -= 1;
    if (counters.lastSeriesResolvedAt !== undefined && counters.firstFrameAfterSeriesResolvedAt === undefined) {
      counters.firstFrameAfterSeriesResolvedAt = performance.now();
    }
    callback(time);
  });
  activeFrames.add(id);
  counters.activeAnimationFrames += 1;
  return id;
};
window.cancelAnimationFrame = (id) => {
  if (activeFrames.delete(id)) counters.activeAnimationFrames -= 1;
  nativeCancelAnimationFrame(id);
};

const container = document.querySelector<HTMLElement>("#app");
if (!container) throw new Error("Workspace host is missing");
const destroy = document.createElement("button");
destroy.type = "button";
destroy.dataset.testid = "destroy-workspace";
destroy.className = "host-destroy-workspace";
destroy.textContent = "销毁 Workspace";
document.body.append(destroy);

const params = new URLSearchParams(location.search);
const controls = readFixtureControls(location.search);
const dataSource = createFixtureDataSource(controls, counters, requests);
let workspace: ChartWorkspace | undefined;

if (params.get("nonElement") === "1") {
  try {
    createChartWorkspace(null as unknown as HTMLElement, { workspaceId: "invalid-container", initialSymbol: stock, dataSource });
  } catch (error) {
    document.body.dataset.nonElementError = error instanceof TypeError ? "TypeError" : "UnexpectedError";
  }
} else {
  const invalid = params.get("invalid");
  const options = {
    workspaceId: invalid === "workspace" ? "" : "workspace-playground",
    initialSymbol: invalid === "symbol" ? { ...stock, id: "" } : stock,
    dataSource: invalid === "datasource" ? {} : dataSource,
    onError: () => { counters.errors += 1; }
  } as ChartWorkspaceOptions;
  workspace = createChartWorkspace(container, options);
  if (invalid) {
    workspace.setSymbol(stock);
    workspace.setTimeframe("5m");
    workspace.setAdjustMode("backward");
    workspace.retry();
  }
}

destroy.addEventListener("click", () => {
  workspace?.destroy();
  workspace?.destroy();
});

declare global {
  interface Window {
    __hostCounters: HostCounters;
  }
}
