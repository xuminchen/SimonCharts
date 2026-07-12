import { access, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

async function readJson(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function fileExists(relativePath) {
  try {
    await access(path.join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

const rootPackage = await readJson("package.json");
const enginePackage = await readJson("packages/chart-engine/package.json");
const playgroundPackage = await readJson("apps/playground/package.json");
const lockfile = await readJson("package-lock.json");

const expectedVersion = "1.0.0-rc.1";

expect(enginePackage.name === "@simoncharts/chart-engine", "chart-engine package name must be stable");
expect(enginePackage.version === expectedVersion, `chart-engine version must be ${expectedVersion}`);
expect(typeof enginePackage.description === "string" && enginePackage.description.length > 0, "description is required");
expect(enginePackage.license === "UNLICENSED", "license must be explicit while no repository license exists");
expect(Array.isArray(enginePackage.keywords) && enginePackage.keywords.includes("chart-engine"), "keywords must include chart-engine");
expect(enginePackage.repository?.url === "git+https://github.com/xuminchen/SimonCharts.git", "repository url must point to SimonCharts");
expect(enginePackage.repository?.directory === "packages/chart-engine", "repository directory must point to the package");
expect(enginePackage.homepage === "https://github.com/xuminchen/SimonCharts#readme", "homepage must point to repository README");
expect(enginePackage.sideEffects === false, "package must remain side-effect free");
expect(enginePackage.main === "./dist/index.js", "main must point to dist/index.js");
expect(enginePackage.module === "./dist/index.js", "module must point to dist/index.js");
expect(enginePackage.types === "./dist/index.d.ts", "types must point to dist/index.d.ts");
expect(enginePackage.exports?.["."]?.types === "./dist/index.d.ts", "root export must expose declarations");
expect(enginePackage.exports?.["."]?.import === "./dist/index.js", "root export must expose ESM runtime");
expect(enginePackage.exports?.["."]?.default === "./dist/index.js", "root export must expose default runtime");
expect(Array.isArray(enginePackage.files) && enginePackage.files.includes("dist"), "published files must include dist");
expect(playgroundPackage.dependencies?.["@simoncharts/chart-engine"] === expectedVersion, "playground must consume the RC package version");
expect(lockfile.packages?.["packages/chart-engine"]?.version === expectedVersion, "lockfile package version must match RC version");
expect(
  lockfile.packages?.["apps/playground"]?.dependencies?.["@simoncharts/chart-engine"] === expectedVersion,
  "lockfile playground dependency must match RC version"
);

const requiredScripts = [
  "test",
  "typecheck",
  "guard:engine-boundary",
  "guard:public-api",
  "guard:public-types",
  "guard:sdk-imports",
  "check:package-consumer",
  "check:package-artifact",
  "check:host-smoke",
  "check:package-types",
  "check:performance",
  "check:release-gate",
  "check:release-readiness",
  "build",
  "test:e2e"
];

for (const script of requiredScripts) {
  expect(typeof rootPackage.scripts?.[script] === "string", `root script ${script} is required`);
}

const requiredDocs = [
  "README.md",
  "packages/chart-engine/README.md",
  "packages/chart-engine/api-surface.json",
  "packages/chart-engine/api-types.json",
  "CHANGELOG.md",
  "docs/engine/release-candidate.md",
  "docs/superpowers/plans/2026-06-27-chart-engine-v1-0-release-candidate-writing-plan.md",
  "docs/superpowers/plans/2026-06-27-chart-engine-v1-0-release-candidate-implementation-plan.md"
];

for (const doc of requiredDocs) {
  expect(await fileExists(doc), `${doc} is required`);
}

if (failures.length > 0) {
  console.error("Release readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Release readiness check passed for @simoncharts/chart-engine@${expectedVersion}.`);
