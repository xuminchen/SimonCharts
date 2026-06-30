import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const snapshotPath = path.join(projectRoot, "packages/chart-engine/api-surface.json");
const shouldWrite = process.argv.includes("--write");
const runtimeModule = await import("@simoncharts/chart-engine");
const actual = Object.keys(runtimeModule).sort();

if (shouldWrite) {
  await writeFile(snapshotPath, `${JSON.stringify(actual, null, 2)}\n`);
  console.log(`Public API snapshot written (${actual.length} runtime exports).`);
  process.exit(0);
}

const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));

if (!Array.isArray(snapshot)) {
  console.error("Public API snapshot must be an array of export names.");
  process.exit(1);
}

if (snapshot.some((name) => typeof name !== "string")) {
  console.error("Public API snapshot must contain only string export names.");
  process.exit(1);
}

const expected = [...snapshot].sort();

if (JSON.stringify(snapshot) !== JSON.stringify(expected)) {
  console.error("Public API snapshot must be sorted.");
  process.exit(1);
}

const added = actual.filter((name) => !expected.includes(name));
const removed = expected.filter((name) => !actual.includes(name));

if (added.length > 0 || removed.length > 0) {
  console.error("Public API surface changed.");

  if (added.length > 0) {
    console.error(`Added exports:\n${added.map((name) => `  + ${name}`).join("\n")}`);
  }

  if (removed.length > 0) {
    console.error(`Removed exports:\n${removed.map((name) => `  - ${name}`).join("\n")}`);
  }

  console.error("Update packages/chart-engine/api-surface.json intentionally if this is expected.");
  process.exit(1);
}

console.log(`Public API guard passed (${actual.length} runtime exports).`);
