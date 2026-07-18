import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const packageRoot = path.join(projectRoot, "packages/chart-workspace");
const snapshotPath = path.join(packageRoot, "api-types.json");
const declarationPaths = [
  "dist/createChart.d.ts",
  "dist/contracts.d.ts",
  "dist/errors.d.ts",
  "dist/index.d.ts"
];
const shouldWrite = process.argv.includes("--write");

const actual = Object.fromEntries(await Promise.all(declarationPaths.map(async (relativePath) => [
  relativePath,
  (await readFile(path.join(packageRoot, relativePath), "utf8")).replaceAll("\r\n", "\n")
])));

if (shouldWrite) {
  await writeFile(snapshotPath, `${JSON.stringify(actual, null, 2)}\n`);
  console.log(`Workspace emitted declaration snapshot written (${declarationPaths.length} files).`);
  process.exit(0);
}

const expected = JSON.parse(await readFile(snapshotPath, "utf8"));
if (
  typeof expected !== "object" ||
  expected === null ||
  Array.isArray(expected) ||
  JSON.stringify(Object.keys(expected)) !== JSON.stringify(declarationPaths) ||
  Object.values(expected).some((content) => typeof content !== "string")
) {
  console.error("Workspace public type snapshot must contain the ordered emitted declaration files.");
  process.exit(1);
}

const changed = declarationPaths.filter((relativePath) => expected[relativePath] !== actual[relativePath]);
if (changed.length > 0) {
  console.error("Workspace emitted public declaration signatures changed.");
  for (const relativePath of changed) console.error(`  ~ ${relativePath}`);
  console.error("Build, review the emitted declarations, then update packages/chart-workspace/api-types.json intentionally.");
  process.exit(1);
}

console.log(`Workspace emitted declaration guard passed (${declarationPaths.length} files).`);
