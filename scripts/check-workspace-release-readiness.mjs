import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const expectedVersion = "1.0.0-rc.42";
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const exists = async (relativePath) => {
  try { await access(path.join(root, relativePath)); return true; } catch { return false; }
};

const rootPackage = await readJson("package.json");
const workspacePackage = await readJson("packages/chart-workspace/package.json");
const playgroundPackage = await readJson("apps/workspace-playground/package.json");
const lockfile = await readJson("package-lock.json");

expect(workspacePackage.name === "@simoncharts/charts", "charts package name must be stable");
expect(workspacePackage.version === expectedVersion, `workspace version must be ${expectedVersion}`);
expect(workspacePackage.private === true, "workspace must remain a private delivered package");
expect(workspacePackage.license === "UNLICENSED", "workspace license must remain explicit");
expect(workspacePackage.repository?.directory === "packages/chart-workspace", "workspace repository directory is required");
expect(workspacePackage.main === "./dist/index.js", "workspace main must point to dist/index.js");
expect(workspacePackage.types === "./dist/index.d.ts", "workspace types must point to dist/index.d.ts");
expect(workspacePackage.exports?.["."]?.types === "./dist/index.d.ts", "workspace root export must expose declarations");
expect(workspacePackage.exports?.["./styles.css"] === "./dist/styles.css", "workspace must export its stylesheet");
expect(
  JSON.stringify(workspacePackage.files) === JSON.stringify([
    "dist/index.js",
    "dist/index.d.ts",
    "dist/createChart.d.ts",
    "dist/contracts.d.ts",
    "dist/errors.d.ts",
    "dist/styles.css",
    "README.md"
  ]),
  "workspace files must match the public package allowlist"
);
expect(playgroundPackage.dependencies?.["@simoncharts/charts"] === expectedVersion, "workspace playground version must match");
expect(lockfile.packages?.["packages/chart-workspace"]?.version === expectedVersion, "lockfile workspace version must match");
expect(lockfile.packages?.["apps/workspace-playground"]?.dependencies?.["@simoncharts/charts"] === expectedVersion, "lockfile workspace playground version must match");
expect(lockfile.packages?.["node_modules/@simoncharts/charts"]?.resolved === "packages/chart-workspace", "lockfile charts workspace link is required");
expect(lockfile.packages?.["node_modules/@simoncharts/chart-workspace"] === undefined, "lockfile must not retain the old public package name");

for (const script of [
  "guard:workspace-public-api",
  "guard:workspace-public-types",
  "check:workspace-package-artifact",
  "check:workspace-consumer",
  "check:workspace-release-readiness",
  "check:workspace-release-gate",
  "check:commercial-package-gate",
  "check:commercial-release-gate",
  "pack:workspace",
  "test:workspace:e2e",
  "check:trading-review-host"
]) {
  expect(typeof rootPackage.scripts?.[script] === "string", `root script ${script} is required`);
}

for (const file of [
  "README.md",
  "CHANGELOG.md",
  "packages/chart-workspace/README.md",
  "packages/chart-workspace/api-surface.json",
  "packages/chart-workspace/api-types.json",
  "scripts/pack-chart-workspace.mjs",
  "scripts/__tests__/pack-chart-workspace.test.mjs",
  "scripts/check-commercial-release-gate.mjs",
  "scripts/__tests__/check-commercial-release-gate.test.mjs"
]) {
  expect(await exists(file), `${file} is required`);
}

if (failures.length > 0) {
  console.error("Workspace release readiness check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Workspace release readiness check passed for @simoncharts/charts@${expectedVersion}.`);
