import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const snapshotPath = path.join(projectRoot, "packages/chart-engine/api-surface.json");
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const runtimeModule = await import("@simoncharts/chart-engine");
const actual = Object.keys(runtimeModule).sort();
const expected = [...snapshot].sort();

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
