import { spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const projectRoot = process.cwd();
const packageName = "@simoncharts/chart-engine";
const expectedVersion = "1.0.0-rc.0";

let tempRoot;

try {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "simoncharts-host-smoke-"));

  if (isPathInside(tempRoot, projectRoot)) {
    throw new Error(`Temporary host project must be outside the repository: ${tempRoot}`);
  }

  const packResult = run("npm", [
    "pack",
    "--json",
    "-w",
    packageName,
    "--pack-destination",
    tempRoot
  ], {
    cwd: projectRoot
  });
  const packArtifacts = JSON.parse(packResult.stdout);
  const artifact = packArtifacts[0];

  expect(Array.isArray(packArtifacts) && packArtifacts.length === 1, "expected one npm pack artifact");
  expect(artifact?.name === packageName, `package name must be ${packageName}`);
  expect(artifact?.version === expectedVersion, `package version must be ${expectedVersion}`);
  expect(
    artifact?.files?.some((file) => file.path === "dist/index.js"),
    "packed artifact must include dist/index.js; run npm run build before this check"
  );
  expect(
    artifact?.files?.some((file) => file.path === "dist/index.d.ts"),
    "packed artifact must include dist/index.d.ts; run npm run build before this check"
  );

  const tarballPath = await resolveTarballPath(tempRoot, artifact);
  const hostRoot = path.join(tempRoot, "host");

  await mkdir(hostRoot);
  await writeFile(
    path.join(hostRoot, "package.json"),
    JSON.stringify({ private: true, type: "module" }, null, 2)
  );
  await writeFile(
    path.join(hostRoot, "host-smoke.mjs"),
    createHostSmokeScript(),
    "utf8"
  );

  run("npm", [
    "install",
    "--ignore-scripts",
    "--package-lock=false",
    "--fund=false",
    "--audit=false",
    tarballPath
  ], {
    cwd: hostRoot
  });

  const installedPackageRoot = path.join(hostRoot, "node_modules", "@simoncharts", "chart-engine");
  const installedPackageStat = await lstat(installedPackageRoot);

  expect(!installedPackageStat.isSymbolicLink(), "installed chart-engine package must not be a workspace symlink");

  const installedPackage = JSON.parse(
    await readFile(path.join(installedPackageRoot, "package.json"), "utf8")
  );

  expect(installedPackage.name === packageName, `installed package name must be ${packageName}`);
  expect(installedPackage.version === expectedVersion, `installed package version must be ${expectedVersion}`);

  run(process.execPath, ["host-smoke.mjs"], { cwd: hostRoot });

  console.log(`Isolated host smoke check passed for ${packageName}@${expectedVersion}.`);
} catch (error) {
  if (typeof error?.stdout === "string") {
    process.stdout.write(error.stdout);
  }

  if (typeof error?.stderr === "string") {
    process.stderr.write(error.stderr);
  }

  console.error(error?.message ?? error);
  process.exitCode = typeof error?.status === "number" ? error.status : 1;
} finally {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: "utf8"
  });

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
  if (!condition) {
    throw new Error(message);
  }
}

async function resolveTarballPath(packDestination, artifact) {
  const filename = artifact?.filename;
  const candidates = [
    filename ? path.join(packDestination, path.basename(filename)) : undefined,
    filename
  ].filter(Boolean);

  for (const candidate of candidates) {
    const candidatePath = path.isAbsolute(candidate) ? candidate : path.join(projectRoot, candidate);

    try {
      const stat = await lstat(candidatePath);

      if (stat.isFile()) {
        return candidatePath;
      }
    } catch {
      // Try the next npm output shape.
    }
  }

  throw new Error("Unable to locate packed chart-engine tarball");
}

function isPathInside(candidate, parent) {
  const relativePath = path.relative(parent, candidate);

  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function createHostSmokeScript() {
  return `import {
  calculateCoreIndicator,
  createChartEngine,
  createChartExtension,
  createChartExtensionLifecycle,
  createDrawingEditor,
  createDrawingRendererRegistry,
  createDrawingToolRegistry,
  createEngineCapabilityManifest,
  deserializeChartLayoutSnapshot,
  engineApiVersion,
  fixtureDailyCandleSeries,
  serializeChartLayoutSnapshot
} from "@simoncharts/chart-engine";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const manifest = createEngineCapabilityManifest();

assert(manifest.packageName === "@simoncharts/chart-engine", "capability manifest package name mismatch");
assert(manifest.apiVersion === engineApiVersion, "capability manifest API version mismatch");
assert(manifest.seriesTypes.length === 17, "capability manifest must expose 17 series types");
assert(manifest.drawingTypes.length === 63, "capability manifest must expose 63 drawing types");

const engine = createChartEngine({
  series: fixtureDailyCandleSeries,
  seriesType: "candles"
});
const engineEvents = [];
const unsubscribe = engine.subscribe((event) => engineEvents.push(event.type));
const viewport = {
  visibleRange: { from: 2, to: 22 },
  candleWidth: 9,
  scrollOffset: 1,
  priceScaleMode: "linear"
};
const drawing = {
  id: "host-trend-line",
  type: "trendLine",
  anchors: [
    { x: 10, y: 20, time: fixtureDailyCandleSeries.candles[0].time, price: 100 },
    { x: 80, y: 60, time: fixtureDailyCandleSeries.candles[10].time, price: 112 }
  ]
};

engine.setViewport(viewport);
engine.setDrawings([drawing]);

const engineState = engine.getState();

assert(engineState.series.candles.length === fixtureDailyCandleSeries.candles.length, "chart engine state lost series candles");
assert(engineState.seriesType === "candles", "chart engine state lost series type");
assert(engineState.viewport.visibleRange.from === 2, "chart engine state lost viewport");
assert(engineState.drawings.length === 1, "chart engine state lost drawings");
assert(engineEvents.includes("viewportChanged"), "chart engine did not emit neutral viewport event");

unsubscribe();

const serializedLayout = serializeChartLayoutSnapshot({
  viewport: engineState.viewport,
  drawings: engineState.drawings,
  indicatorIds: ["MA"]
});
const roundTripLayout = deserializeChartLayoutSnapshot(serializedLayout);

assert(roundTripLayout.viewport.visibleRange.to === engineState.viewport.visibleRange.to, "layout snapshot viewport round-trip failed");
assert(roundTripLayout.drawings[0]?.id === "host-trend-line", "layout snapshot drawing round-trip failed");
assert(roundTripLayout.indicatorIds.join(",") === "MA", "layout snapshot indicators round-trip failed");

const editor = createDrawingEditor({ drawings: [drawing] });

editor.executeCommand({ type: "selectDrawing", drawingId: "host-trend-line" });
editor.executeCommand({ type: "updateSelectedStyle", style: { color: "#0f766e", lineWidth: 2 } });
editor.executeCommand({ type: "dragSelected", delta: { dx: 3, dy: -4 } });

const editedDrawing = editor.getState().drawings.find((item) => item.id === "host-trend-line");

assert(editor.getState().selectedDrawingIds[0] === "host-trend-line", "drawing editor command selection failed");
assert(editedDrawing?.style?.color === "#0f766e", "drawing editor command style update failed");
assert(editedDrawing?.anchors[0]?.x === 13, "drawing editor command drag failed");
assert(editor.getCapabilities().canUndo, "drawing editor command history did not update");

const ma = calculateCoreIndicator("MA", fixtureDailyCandleSeries, { period: 5 });
const maOutput = ma.outputs[0];

assert(maOutput?.type === "line", "MA indicator must return line output");
assert(maOutput.values.some((point) => point.value !== null), "MA indicator must return calculated values");

const drawingRenderers = createDrawingRendererRegistry();
const drawingTools = createDrawingToolRegistry();
const lifecycle = createChartExtensionLifecycle({ drawingRenderers, drawingTools });
const extension = createChartExtension(
  { id: "host.smoke", label: "Host Smoke", version: "1.0.0" },
  {
    drawingRenderers: [
      {
        type: "host.measurement-box",
        render() {},
        hitTest(customDrawing) {
          return { drawingId: customDrawing.id, distance: 0 };
        }
      }
    ],
    drawingTools: [
      {
        type: "host.measurement-box",
        label: "Measurement Box",
        category: "measurement",
        totalStep: 2,
        anchorCount: 2,
        drawingMode: "step",
        defaultStyle: { color: "#2563eb", lineWidth: 2 },
        hotkeyId: "drawing.host.measurement-box"
      }
    ]
  }
);
const validation = lifecycle.validateInstall(extension);

assert(validation.valid, "extension lifecycle install validation failed");

const installResult = lifecycle.install(extension);

assert(installResult.installed.drawingRenderers === 1, "extension lifecycle did not install renderer");
assert(installResult.installed.drawingTools === 1, "extension lifecycle did not install tool");
assert(lifecycle.isInstalled("host.smoke"), "extension lifecycle did not record install");
assert(drawingTools.require("host.measurement-box").label === "Measurement Box", "extension lifecycle tool registration failed");

const uninstallResult = lifecycle.uninstall("host.smoke");

assert(uninstallResult.uninstalled.drawingRenderers === 1, "extension lifecycle did not uninstall renderer");
assert(uninstallResult.uninstalled.drawingTools === 1, "extension lifecycle did not uninstall tool");
assert(!lifecycle.isInstalled("host.smoke"), "extension lifecycle did not clear install state");
assert(drawingTools.get("host.measurement-box") === undefined, "extension lifecycle did not remove tool");

engine.destroy();
`;
}
