import { spawnSync } from "node:child_process";
import { access, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const projectRoot = process.cwd();
const packageName = "@simoncharts/charts";
const expectedVersion = "1.0.0-rc.18";
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
    "--skipLibCheck",
    "--lib", "ES2022,DOM",
    "src/main.ts"
  ], hostRoot);

  const vite = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
  run(process.execPath, [vite, "build", "--outDir", "dist", "--emptyOutDir"], hostRoot);
  await access(path.join(hostRoot, "dist", "index.html"));
  console.log(`External JavaScript/TypeScript workspace consumer check passed for ${packageName}@${expectedVersion}.`);
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

function consumerSource() {
  return `import {
  ChartDatafeedError,
  createChart,
  type ChartDatafeed,
  type ChartEvent,
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
const chart = createChart(container, {
  chartId: "external-consumer",
  persistenceScopeId: "consumer-user",
  dataContextId: "snapshot:consumer-v1",
  initialSymbol: symbol,
  dataCutoffTime: 1_784_192_400_000,
  datafeed
});
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
    void dataVersion;
    void phase;
    void view;
  }
});
chart.setTimeframe("5m");
chart.setView("intraday");
chart.setView("timeframe");
const visibleRange: Readonly<ChartVisibleRange> | undefined = chart.getVisibleRange();
void visibleRange;
unsubscribeEvents();
unsubscribe();
chart.destroy();
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
