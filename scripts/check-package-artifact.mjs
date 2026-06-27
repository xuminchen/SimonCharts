import { spawnSync } from "node:child_process";

const expectedName = "@simoncharts/chart-engine";
const expectedVersion = "1.0.0-rc.0";
const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const packResult = spawnSync(
  "npm",
  ["pack", "--dry-run", "--json", "-w", expectedName],
  {
    cwd: process.cwd(),
    encoding: "utf8"
  }
);

if (packResult.status !== 0) {
  process.stderr.write(packResult.stderr);
  process.exit(packResult.status ?? 1);
}

const packs = JSON.parse(packResult.stdout);
const artifact = packs[0];

expect(Array.isArray(packs) && packs.length === 1, "expected one npm pack artifact");
expect(artifact?.name === expectedName, `package name must be ${expectedName}`);
expect(artifact?.version === expectedVersion, `package version must be ${expectedVersion}`);
expect(Array.isArray(artifact?.files), "npm pack artifact must include a files list");
expect(artifact?.bundled?.length === 0, "package must not bundle dependencies");

const files = new Set(artifact?.files?.map((file) => file.path) ?? []);
const requiredFiles = [
  "README.md",
  "package.json",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/extensions/chartExtension.d.ts",
  "dist/drawing/drawingInteraction.d.ts",
  "dist/drawing/drawingParameters.d.ts",
  "dist/drawing/drawingPropertySchema.d.ts",
  "dist/drawing/drawingRegistry.d.ts",
  "dist/drawing/drawingToolRegistry.d.ts",
  "dist/drawing/drawingTransform.d.ts",
  "dist/figures/figureRegistry.d.ts",
  "dist/render/staticRenderer.d.ts",
  "dist/series/seriesRegistry.d.ts",
  "dist/visuals/visualRegistry.d.ts"
];

for (const file of requiredFiles) {
  expect(files.has(file), `package artifact is missing ${file}`);
}

for (const file of files) {
  expect(
    file === "README.md" || file === "package.json" || file.startsWith("dist/"),
    `package artifact contains non-package path ${file}`
  );
  expect(!file.startsWith("src/"), `package artifact must not include source path ${file}`);
  expect(!file.includes("__tests__"), `package artifact must not include tests ${file}`);
  expect(!file.startsWith("apps/"), `package artifact must not include app path ${file}`);
  expect(!file.startsWith("scripts/"), `package artifact must not include scripts ${file}`);
  expect(!file.startsWith("docs/"), `package artifact must not include docs path ${file}`);
  expect(!file.startsWith("node_modules/"), `package artifact must not include node_modules ${file}`);
  expect(!file.endsWith(".tsbuildinfo"), `package artifact must not include build info ${file}`);
  expect(!file.endsWith(".ts") || file.endsWith(".d.ts"), `package artifact must not include source TypeScript ${file}`);
}

const runtimeFile = artifact?.files?.find((file) => file.path === "dist/index.js");
const declarationFile = artifact?.files?.find((file) => file.path === "dist/index.d.ts");

expect((runtimeFile?.size ?? 0) > 0, "dist/index.js must be non-empty");
expect((declarationFile?.size ?? 0) > 0, "dist/index.d.ts must be non-empty");
expect((artifact?.entryCount ?? 0) === files.size, "entry count must match unique file count");

if (failures.length > 0) {
  console.error("Package artifact integrity check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Package artifact integrity check passed for ${expectedName}@${expectedVersion} (${files.size} files).`
);
