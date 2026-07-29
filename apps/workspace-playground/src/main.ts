import {
  advancedChartFeatures,
  createChart,
  type ChartCustomStudyDefinition,
  type ChartInstance,
  type ChartLocale,
  type ChartOptions,
  type ChartTheme,
  type ChartThemeOverrides
} from "@simoncharts/charts";
import "@simoncharts/charts/styles.css";
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
  errors: 0,
  frameCallbackDurations: []
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
    const started = performance.now();
    try {
      callback(time);
    } finally {
      counters.frameCallbackDurations.push(performance.now() - started);
    }
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
const executionOverflow = params.get("executionOverflow") === "1";
const executionTimeRange = params.get("executionTimeRange") === "1";
const invalidExecutionRange = params.get("invalidExecutionRange") === "1";
const executionAnchorTime = Date.UTC(2026, 5, 5, 1, 33);
const customStudies = params.get("customStudies") === "1";
let customStudyFailurePending = params.get("customStudyFailure") === "once";
const studyDefinitions = customStudies
  ? ([
      {
        id: "custom:fixture.average",
        version: "1",
        title: "Fixture Average",
        pane: "main",
        inputs: [{ id: "factor", title: "Factor", defaultValue: 1, minValue: 0.1 }],
        outputs: [{ id: "average", title: "Average", type: "line", color: "#7c3aed" }],
        calculate: ({ candles, inputs }) => {
          window.__customStudyCalls += 1;
          if (customStudyFailurePending) {
            customStudyFailurePending = false;
            throw new Error("fixture custom study failure");
          }
          return {
            outputs: { average: candles.map((candle) => candle.close * inputs.factor) }
          };
        }
      },
      {
        id: "custom:fixture.range",
        version: "1",
        title: "Fixture Range",
        pane: "separate",
        inputs: [],
        outputs: [{
          id: "range",
          title: "Range",
          type: "histogram",
          color: "#ea580c"
        }],
        calculate: ({ candles }) => {
          window.__customStudyCalls += 1;
          return {
            outputs: { range: candles.map((candle) => candle.high - candle.low) }
          };
        }
      }
    ] satisfies readonly ChartCustomStudyDefinition[])
  : undefined;
window.__customStudyCalls = 0;
let chart: ChartInstance | undefined;
let retriedRenderError = false;

if (params.get("nonElement") === "1") {
  try {
    createChart(null as unknown as HTMLElement, { chartId: "invalid-container", persistenceScopeId: "fixture-user", dataContextId: "fixture-current", initialSymbol: stock, datafeed: dataSource });
  } catch (error) {
    document.body.dataset.nonElementError = error instanceof TypeError ? "TypeError" : "UnexpectedError";
  }
} else {
  const invalid = params.get("invalid");
  const options = {
    chartId: invalid === "workspace" ? "" : "workspace-playground",
    persistenceScopeId: "fixture-user",
    dataContextId: invalid === "context" ? "" : "fixture-current",
    initialSymbol: invalid === "symbol"
      ? { ...stock, id: "" }
      : invalid === "precision"
        ? { ...stock, pricePrecision: 9 }
        : stock,
    ...(executionTimeRange
      ? {
          initialTimeframe: "1m",
          executions: [{
            id: "broker-split-summary",
            firstTime: Date.UTC(2026, 5, 5, 1, 31),
            lastTime: executionAnchorTime,
            time: executionAnchorTime,
            side: "buy" as const,
            price: 100,
            quantity: 300,
            label: "B"
          }]
        }
      : invalidExecutionRange
        ? {
            initialTimeframe: "1m",
            executions: [{
              id: "invalid-broker-split-summary",
              firstTime: Date.UTC(2026, 5, 5, 1, 31),
              time: executionAnchorTime,
              side: "buy" as const,
              price: 100,
              quantity: 300,
              label: "B"
            }]
          }
        : executionOverflow
      ? {
          initialTimeframe: "1m",
          executions: Array.from({ length: 30 }, (_, index) => ({
            id: `fill-${index + 1}`,
            time: Date.UTC(2026, 5, 5, 1, 30) + 499 * 60_000 + (index + 1) * 1_000,
            side: "buy" as const,
            price: 100 + index / 100,
            quantity: 100 + index,
            amount: (100 + index / 100) * (100 + index),
            fee: 5,
            tQuantity: 0,
            label: "B"
          }))
        }
      : {}),
    datafeed: invalid === "datasource" ? {} : dataSource,
    ...(invalid === "features"
      ? { features: ["not-a-feature"] }
      : params.get("minimal") === "1"
        ? {}
        : {
            features: executionOverflow || executionTimeRange || invalidExecutionRange
              ? [...advancedChartFeatures, "executions"]
              : advancedChartFeatures
          }),
    theme: (params.get("theme") ?? "dark") as ChartTheme,
    ...(params.get("themeOverrides") === "1"
      ? {
          themeOverrides: {
            backgroundColor: "#123456",
            surfaceColor: "#234567",
            surfaceHoverColor: "#345678",
            borderColor: "#456789",
            gridColor: "#56789a",
            textColor: "#6789ab",
            mutedTextColor: "#789abc",
            accentColor: "#89abcd",
            upColor: "#ff00ff",
            downColor: "#00ffff",
            intradayAverageColor: "#abcdef"
          } satisfies ChartThemeOverrides
        }
      : {}),
    locale: (params.get("locale") ?? "zh-CN") as ChartLocale,
    ...(studyDefinitions === undefined ? {} : { studyDefinitions }),
    onError: (error) => {
      counters.errors += 1;
      if (
        params.get("retryOnRenderError") === "1" &&
        error.code === "RENDER_FAILED" &&
        !retriedRenderError
      ) {
        retriedRenderError = true;
        chart?.retry();
        window.__reentrantDataReady = chart?.dataReady();
      }
    }
  } as ChartOptions;
  chart = createChart(container, options);
  window.__chart = chart;
  if (customStudies) {
    window.__customStudyIds = [
      chart.createStudy({
        instanceId: "fixture-average",
        id: "custom:fixture.average",
        definitionVersion: "1",
        params: {},
        visible: true
      }),
      chart.createStudy({
        instanceId: "fixture-range",
        id: "custom:fixture.range",
        definitionVersion: "1",
        params: {},
        visible: true
      })
    ];
  }
  if (invalid) {
    chart.setSymbol(stock);
    chart.setTimeframe("5m");
    chart.setAdjustMode("backward");
    chart.retry();
  }
}

destroy.addEventListener("click", () => {
  chart?.destroy();
  chart?.destroy();
});

declare global {
  interface Window {
    __chart?: ChartInstance;
    __reentrantDataReady?: Promise<boolean>;
    __hostCounters: HostCounters;
    __customStudyCalls: number;
    __customStudyIds?: readonly string[];
  }
}
