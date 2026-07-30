import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const packageName = "@simoncharts/charts";
const expectedVersion = "1.0.0-rc.49";
const failures = [];
const result = spawnSync("npm", ["pack", "--dry-run", "--json", "-w", packageName], {
  cwd: process.cwd(),
  encoding: "utf8"
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const artifacts = JSON.parse(result.stdout);
const artifact = artifacts[0];
const files = new Set(artifact?.files?.map((file) => file.path) ?? []);
const allowedFiles = new Set([
  "README.md",
  "package.json",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/createChart.d.ts",
  "dist/contracts.d.ts",
  "dist/errors.d.ts",
  "dist/styles.css"
]);
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(Array.isArray(artifacts) && artifacts.length === 1, "expected one workspace artifact");
expect(artifact?.name === packageName, `package name must be ${packageName}`);
expect(artifact?.version === expectedVersion, `package version must be ${expectedVersion}`);
expect(Array.isArray(artifact?.files), "workspace artifact must include a files list");
expect(artifact?.bundled?.length === 0, "workspace package must not bundle npm dependencies");

for (const file of allowedFiles) {
  expect(files.has(file), `workspace artifact is missing ${file}`);
}
expect(files.size === allowedFiles.size, "workspace artifact contains undeclared files");
expect(!files.has("dist/createChartWorkspace.d.ts"), "charts artifact must not expose createChartWorkspace declarations");

for (const file of files) {
  expect(allowedFiles.has(file), `workspace artifact contains undeclared file ${file}`);
}

const bundle = await readFile(path.join(process.cwd(), "packages/chart-workspace/dist/index.js"), "utf8");
expect(!/Date\.UTC\(2026,\s*0,\s*1\)/.test(bundle), "workspace bundle must not execute the test candle generator");
expect(!bundle.includes("fixture-2026-06-23"), "workspace bundle must not contain test candle data");

if (failures.length > 0) {
  console.error("Workspace package artifact check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Workspace artifact check passed for ${packageName}@${expectedVersion} (${files.size} files).`);
