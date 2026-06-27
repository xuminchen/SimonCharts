import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const scanRoots = ["apps", path.join("scripts", "fixtures")];
const sourceExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx"]);
const violations = [];

for (const root of scanRoots) {
  await scanDirectory(path.join(projectRoot, root));
}

if (violations.length > 0) {
  console.error("SDK import guard failed.");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("SDK import guard passed.");

async function scanDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }

      await scanDirectory(entryPath);
      continue;
    }

    if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name))) {
      continue;
    }

    await scanFile(entryPath);
  }
}

async function scanFile(filePath) {
  const content = await readFile(filePath, "utf8");
  const relativePath = path.relative(projectRoot, filePath);

  if (content.includes("@simoncharts/chart-engine/")) {
    violations.push(`${relativePath}: imports @simoncharts/chart-engine internal subpath`);
  }

  if (content.includes("packages/chart-engine/src")) {
    violations.push(`${relativePath}: imports packages/chart-engine/src directly`);
  }
}
