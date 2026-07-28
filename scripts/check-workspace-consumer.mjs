import { spawnSync } from "node:child_process";
import { access, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const projectRoot = process.cwd();
const packageName = "@simoncharts/charts";
const expectedVersion = "1.0.0-rc.37";
let tempRoot;

try {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "simoncharts-workspace-consumer-"));
  const pack = run("npm", ["pack", "--json", "-w", packageName, "--pack-destination", tempRoot], projectRoot);
  const artifacts = JSON.parse(pack.stdout);
  const artifact = artifacts[0];
  expect(Array.isArray(artifacts) && artifacts.length === 1, "expected one packed workspace artifact");
  expect(artifact?.name === packageName, `package name must be ${packageName}`);
  expect(artifact?.version === expectedVersion, `package version must be ${expectedVersion}`);
  const tarball = path.join(tempRoot, path.basename(artifact.filename));
  const hostRoot = path.join(tempRoot, "host");
  await mkdir(path.join(hostRoot, "src"), { recursive: true });
  await writeFile(path.join(hostRoot, "package.json"), JSON.stringify({ private: true, type: "module" }, null, 2));
  await writeFile(path.join(hostRoot, "index.html"), '<main id="app"></main><script type="module" src="/src/main.ts"></script>\n');
  await writeFile(path.join(hostRoot, "src/main.ts"), consumerSource());
  await writeFile(path.join(hostRoot, "runtime.mjs"), runtimeConsumerSource());

  run("npm", ["install", "--ignore-scripts", "--package-lock=false", "--fund=false", "--audit=false", tarball], hostRoot);
  const installedRoot = path.join(hostRoot, "node_modules", "@simoncharts", "charts");
  expect(!(await lstat(installedRoot)).isSymbolicLink(), "installed workspace must not be a workspace symlink");
  const installedPackage = JSON.parse(await readFile(path.join(installedRoot, "package.json"), "utf8"));
  expect(installedPackage.version === expectedVersion, "installed workspace version mismatch");

  run(process.execPath, ["runtime.mjs"], hostRoot);

  const tsc = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");
  run(process.execPath, [
    tsc,
    "--noEmit",
    "--target", "ES2022",
    "--module", "ESNext",
    "--moduleResolution", "Bundler",
    "--strict",
    "--lib", "ES2022,DOM",
    "src/main.ts"
  ], hostRoot);

  const vite = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
  run(process.execPath, [vite, "build", "--outDir", "dist", "--emptyOutDir"], hostRoot);
  await access(path.join(hostRoot, "dist", "index.html"));
  await checkBrowserConsumer(path.join(hostRoot, "dist"));
  console.log(`External JavaScript/TypeScript Chrome/Edge workspace consumer check passed for ${packageName}@${expectedVersion}.`);
} catch (error) {
  if (typeof error?.stdout === "string") process.stdout.write(error.stdout);
  if (typeof error?.stderr === "string") process.stderr.write(error.stderr);
  console.error(error?.message ?? error);
  process.exitCode = typeof error?.status === "number" ? error.status : 1;
} finally {
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    const error = new Error(`Command failed: ${command} ${args.join(" ")}`);
    error.stdout = result.stdout ?? "";
    error.stderr = result.stderr ?? "";
    error.status = result.status ?? 1;
    throw error;
  }
  return result;
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function checkBrowserConsumer(distRoot) {
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(distRoot, relativePath);
    if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        "content-type": filePath.endsWith(".html")
          ? "text/html; charset=utf-8"
          : filePath.endsWith(".css")
            ? "text/css; charset=utf-8"
            : "text/javascript; charset=utf-8"
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    expect(address && typeof address === "object", "consumer server did not bind a TCP port");
    for (const channel of ["chrome", "msedge"]) {
      const browser = await chromium.launch({ channel, headless: true });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(20_000);
        await page.goto(`http://127.0.0.1:${address.port}`);
        await page.waitForFunction(() =>
          ["ready", "failed"].includes(document.documentElement.dataset.simonchartsConsumer ?? "")
        );
        const result = await page.evaluate(() => ({
          status: document.documentElement.dataset.simonchartsConsumer,
          error: document.documentElement.dataset.simonchartsConsumerError
        }));
        expect(result.status === "ready", `${channel} packed consumer failed: ${result.error ?? "unknown error"}`);
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function consumerSource() {
  return `import {
  ChartDatafeedError,
  advancedChartFeatures,
  createChart,
  type ChartDatafeed,
  type ChartCustomStudyDefinition,
  type ChartDrawing,
  type ChartEntityId,
  type ChartEvent,
  type ChartExecution,
  type ChartIndicatorEntityId,
  type ChartLayoutV2,
  type ChartMark,
  type ChartSeriesProperties,
  type ChartSelectableEntityId,
  type ChartStudyApi,
  type ChartThemeOverrides,
  type ChartVisibleRange,
  type ChartState
} from "@simoncharts/charts";
import "@simoncharts/charts/styles.css";

const symbol = { id: "stock:SSE:600000", code: "600000", name: "浦发银行", exchange: "SSE", kind: "stock" } as const;
const datafeed: ChartDatafeed = {
  async getCapabilities() {
    return { series: [
      { timeframe: "1d", adjustModes: ["forward"] },
      { timeframe: "5m", adjustModes: ["none"] }
    ] };
  },
  async searchSymbols() { return [symbol]; },
  async loadSeries(request) {
    if (request.dataCutoffTime !== 1_784_192_400_000) throw new Error("cutoff missing");
    return {
      candles: [{ time: 1_784_192_400_000, open: 10, high: 11, low: 9, close: 10.5, volume: 100, turnover: 1_050 }],
      hasMoreBefore: false,
      dataVersion: "consumer-v1"
    };
  }
};
const container = document.querySelector<HTMLElement>("#app");
if (!container) throw new Error("consumer mount missing");
const studyDefinitions = [{
  id: "custom:consumer.range",
  version: "1",
  title: "Consumer Range",
  pane: "separate",
  inputs: [{ id: "factor", title: "Factor", defaultValue: 1, minValue: 0.1 }],
  outputs: [{ id: "range", title: "Range", type: "histogram", color: "#7c3aed" }],
  calculate: ({ candles, inputs }) => ({
    outputs: {
      range: candles.map((candle) => (candle.high - candle.low) * inputs.factor)
    }
  })
}] satisfies readonly ChartCustomStudyDefinition[];
const executions: readonly ChartExecution[] = [{
  id: "consumer-buy",
  time: 1_784_192_400_000,
  firstTime: 1_784_192_340_000,
  lastTime: 1_784_192_400_000,
  side: "buy",
  price: 10,
  quantity: 100,
  label: "B",
  tQuantity: 0
}];
const themeOverrides: ChartThemeOverrides = {
  backgroundColor: "#102030",
  upColor: "#ff00ff"
};
const chart = createChart(container, {
  chartId: "external-consumer",
  persistenceScopeId: "consumer-user",
  dataContextId: "snapshot:consumer-v1",
  initialSymbol: symbol,
  dataCutoffTime: 1_784_192_400_000,
  datafeed,
  executions,
  themeOverrides,
  studyDefinitions,
  features: [...advancedChartFeatures, "executions"]
});
const drawings: readonly ChartDrawing[] = [{
  id: "consumer-support",
  type: "horizontalLine",
  anchors: [{ time: 1_784_192_400_000, price: 10 }],
  interactive: false,
  affectsPriceScale: true,
  metadata: { source: "external-consumer" }
}];
const marks: readonly ChartMark[] = [{
  id: "consumer-event",
  time: 1_784_192_400_000,
  price: 10.5,
  label: "E"
}];
const layout: ChartLayoutV2 = {
  schemaVersion: 2,
  seriesType: "candles",
  priceScaleMode: "linear",
  indicators: [{
    instanceId: "ma-5",
    id: "MA",
    params: { period: 5 },
    visible: true
  }],
  drawings,
  gridVisible: true
};
const states: Readonly<ChartState>[] = [];
const events: Readonly<ChartEvent>[] = [];
const safeFailure = new ChartDatafeedError("UNAVAILABLE", "consumer data unavailable", true);
if (!safeFailure.recoverable) throw new Error("safe datafeed error contract missing");
const unsubscribe = chart.subscribe((state) => states.push(state));
const unsubscribeEvents = chart.subscribeEvents((event) => {
  events.push(event);
  if (event.type === "data-loaded") {
    const dataVersion: string = event.dataVersion;
    const phase: "initial" | "history" = event.phase;
    const view = event.state.view;
    if (phase === "initial") {
      chart.importLayout(JSON.parse(JSON.stringify(layout)));
      const exportedLayout: ChartLayoutV2 = chart.exportLayout();
      const exportedDrawings: readonly ChartDrawing[] = chart.getDrawings();
      const exportedMarks: readonly ChartMark[] = chart.getMarks();
      void exportedLayout;
      void exportedDrawings;
      void exportedMarks;
    }
    void dataVersion;
    void phase;
    void view;
  } else if (event.type === "selection-changed") {
    const selection: readonly ChartSelectableEntityId[] = event.selection;
    void selection;
  } else if (event.type === "drawing-clicked") {
    const drawingId: ChartSelectableEntityId = event.entity.id;
    void drawingId;
  } else if (event.type === "study-clicked") {
    const studyId: ChartSelectableEntityId = event.entity.id;
    void studyId;
  } else if (event.type === "execution-clicked") {
    const clickedExecutions: readonly ChartExecution[] = event.executions;
    void clickedExecutions;
  }
});
const unsubscribeCrosshair = chart.subscribeCrosshair((event) => {
  if (event.type === "crosshair-moved") {
    const time: number = event.crosshair.time;
    const price: number = event.crosshair.price;
    const referencePrice: number | null = event.crosshair.referencePrice;
    const change: number | null = event.crosshair.change;
    const open: number = event.crosshair.candle.open;
    const dataVersion: string = event.crosshair.dataVersion;
    for (const study of event.crosshair.studies) {
      const studyId: ChartIndicatorEntityId = study.entityId;
      for (const output of study.outputs) {
        const rawValue: number | null = output.type === "band"
          ? output.upper
          : output.value;
        void rawValue;
      }
      void studyId;
    }
    void time;
    void price;
    void referencePrice;
    void change;
    void open;
    void dataVersion;
  }
  if (event.type === "crosshair-left") {
    const leaveType: "crosshair-left" = event.type;
    void leaveType;
  }
});
async function verifyConsumer(): Promise<void> {
if (!await chart.dataReady()) throw new Error("initial chart presentation was not usable");
const layoutBeforeTheme = chart.exportLayout();
if (
  chart.getTheme() !== "dark" ||
  chart.getThemeOverrides().backgroundColor !== "#102030"
) {
  throw new Error("initial theme overrides were not exposed by the packed package");
}
chart.setThemeOverrides({ downColor: "#00ffff" });
chart.setTheme("light");
const themeRoot = document.querySelector<HTMLElement>("#app .sc-workspace");
if (
  !themeRoot ||
  chart.getTheme() !== "light" ||
  chart.getThemeOverrides().downColor !== "#00ffff" ||
  chart.getThemeOverrides().backgroundColor !== undefined ||
  getComputedStyle(themeRoot).getPropertyValue("--sc-bg").trim() !== "#ffffff" ||
  getComputedStyle(themeRoot).getPropertyValue("--sc-down").trim() !== "#00ffff" ||
  JSON.stringify(chart.exportLayout()) !== JSON.stringify(layoutBeforeTheme)
) {
  throw new Error("runtime theme replacement changed layout or failed to repaint the packed package");
}
chart.setThemeOverrides({});
chart.setTheme("dark");
chart.setTimeframe("5m");
if (!await chart.dataReady()) throw new Error("timeframe presentation was not usable");
chart.setView("intraday");
if (!await chart.dataReady()) throw new Error("intraday presentation was not usable");
chart.setView("timeframe");
if (!await chart.dataReady()) throw new Error("timeframe view was not usable");
chart.setExecutions(executions);
chart.setExecutionsVisible(false);
chart.setExecutionsVisible(true);
const renkoProperties: ChartSeriesProperties = { type: "renko", brickSize: 2 };
chart.setSeriesProperties(renkoProperties);
chart.setSeriesType("renko");
if (!await chart.dataReady()) throw new Error("configured Renko presentation was not usable");
const seriesLayout = chart.exportLayout();
if (
  chart.getSeriesProperties("renko").brickSize !== 2 ||
  seriesLayout.seriesProperties?.[0]?.type !== "renko"
) {
  throw new Error("series properties were not exported from the packed package");
}
chart.setSeriesType("area");
chart.importLayout(seriesLayout);
if (
  !await chart.dataReady() ||
  chart.getSeriesType() !== "renko" ||
  chart.getSeriesProperties("renko").brickSize !== 2
) {
  throw new Error("series properties did not round-trip through the packed package");
}
chart.setSeriesType("area");
chart.setPriceScaleMode("percentage");
chart.setIndicators(layout.indicators);
const customStudyId: ChartIndicatorEntityId = chart.createStudy({
  instanceId: "consumer-range",
  id: "custom:consumer.range",
  definitionVersion: "1",
  params: {},
  visible: true
});
const customStudyApi = chart.getStudyApi(customStudyId);
if (!customStudyApi) throw new Error("custom study handle was not created");
if (
  chart.getStudyById(customStudyId)?.definitionVersion !== "1" ||
  customStudyApi.getInputs().factor !== 1
) {
  throw new Error("custom study definition was not resolved from the packed package");
}
customStudyApi.setInputs({ factor: 2 });
if (!await chart.dataReady()) throw new Error("custom study recalculation did not become usable");
const selectedStudy: ChartSelectableEntityId = customStudyId;
chart.setSelection([selectedStudy]);
if (
  chart.getSelection()[0] !== selectedStudy ||
  Object.hasOwn(chart.exportLayout(), "selection")
) {
  throw new Error("selection API was not usable or leaked into layout");
}
chart.clearSelection();
if (chart.getSelection().length !== 0) {
  throw new Error("selection API did not clear");
}
const customLayout = chart.exportLayout();
if (!customLayout.indicators.some((study) =>
  study.id === "custom:consumer.range" &&
  study.definitionVersion === "1" &&
  study.params.factor === 2
)) {
  throw new Error("custom study version or inputs were not exported");
}
if (!chart.removeEntity(customStudyId)) throw new Error("custom study entity was not removed");
chart.importLayout(customLayout);
if (!await chart.dataReady() || chart.getStudyById(customStudyId)?.params.factor !== 2) {
  throw new Error("custom study layout did not restore through the packed package");
}
if (Object.values(localStorage).join("\\n").includes("custom:consumer.range")) {
  throw new Error("host-owned custom study leaked into browser indicator persistence");
}
const ma20StudyId: ChartIndicatorEntityId = chart.createStudy({
  id: "MA",
  params: { period: 20 },
  visible: true
});
const ma20Study = chart.getStudyById(ma20StudyId);
if (
  ma20Study?.id !== "MA" ||
  chart.getAllStudies().filter((study) => study.id === "MA").length !== 2
) {
  throw new Error("study instance API did not preserve same-definition studies");
}
const ma20StudyApi: ChartStudyApi | undefined = chart.getStudyApi(ma20StudyId);
if (!ma20StudyApi) throw new Error("study handle API did not return its study");
ma20StudyApi.setInputs({ period: 30 });
ma20StudyApi.setVisible(false);
if (ma20StudyApi.getInputs().period !== 30 || ma20StudyApi.isVisible()) {
  throw new Error("study handle API did not update live entity state");
}
if (!ma20StudyApi.remove()) throw new Error("study handle API did not remove its study");
chart.setDrawings(drawings);
chart.setMarks(marks);
chart.setDrawingTool("trendLine");
chart.setGridVisible(false);
chart.undoDrawing();
chart.redoDrawing();
const visibleRange: Readonly<ChartVisibleRange> | undefined = chart.getVisibleRange();
const markEntityId: ChartEntityId = chart.createEntity({
  kind: "mark",
  value: {
    id: "consumer-api-event",
    time: 1_784_192_400_000,
    price: 10.5,
    label: "API"
  }
});
const markEntity = chart.getEntity(markEntityId);
if (markEntity?.kind === "mark") {
  chart.updateEntity({
    ...markEntity,
    value: { ...markEntity.value, label: "UPDATED" }
  });
}
const markEntities = chart.getEntities("mark");
if (!markEntities.some((entity) => entity.id === markEntityId)) {
  throw new Error("entity API did not return its created mark");
}
if (!chart.removeEntity(markEntityId)) throw new Error("entity API did not remove its mark");
void visibleRange;
unsubscribeCrosshair();
unsubscribeEvents();
unsubscribe();
chart.destroy();
}
void verifyConsumer().then(
  () => { document.documentElement.dataset.simonchartsConsumer = "ready"; },
  (error: unknown) => {
    document.documentElement.dataset.simonchartsConsumer = "failed";
    document.documentElement.dataset.simonchartsConsumerError = error instanceof Error ? error.message : String(error);
    throw error;
  }
);
`;
}

function runtimeConsumerSource() {
  return `import * as chartsSdk from "@simoncharts/charts";

const exports = Object.keys(chartsSdk).sort();
if (JSON.stringify(exports) !== JSON.stringify(["ChartDatafeedError", "advancedChartFeatures", "createChart", "createChartError", "defaultChartFeatures"])) {
  throw new Error(\`unexpected runtime exports: \${exports.join(",")}\`);
}
const error = chartsSdk.createChartError(
  "INVALID_DATA",
  "initial-data",
  false,
  "external JavaScript consumer",
  { source: "packed-tarball" }
);
if (error.code !== "INVALID_DATA" || error.context?.source !== "packed-tarball") {
  throw new Error("charts JavaScript API is not usable from the packed package root");
}
const datafeedError = new chartsSdk.ChartDatafeedError(
  "NOT_CONFIGURED",
  "market data is not configured",
  false
);
if (datafeedError.code !== "NOT_CONFIGURED" || datafeedError.recoverable) {
  throw new Error("charts datafeed error contract is not usable from JavaScript");
}
`;
}
