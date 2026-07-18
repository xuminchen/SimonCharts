import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();
const entryPath = path.join(projectRoot, "packages/chart-workspace/src/index.ts");
const snapshotPath = path.join(projectRoot, "packages/chart-workspace/api-surface.json");
const shouldWrite = process.argv.includes("--write");
const source = await readFile(entryPath, "utf8");
const sourceFile = ts.createSourceFile(entryPath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const actual = [];

for (const statement of sourceFile.statements) {
  if (!ts.isExportDeclaration(statement) || statement.isTypeOnly || !statement.exportClause) continue;
  if (!ts.isNamedExports(statement.exportClause)) continue;
  for (const element of statement.exportClause.elements) {
    if (!element.isTypeOnly) actual.push(element.name.text);
  }
}

actual.sort();

if (shouldWrite) {
  await writeFile(snapshotPath, `${JSON.stringify(actual, null, 2)}\n`);
  console.log(`Workspace public API snapshot written (${actual.length} runtime exports).`);
  process.exit(0);
}

const expected = JSON.parse(await readFile(snapshotPath, "utf8"));
if (
  !Array.isArray(expected) ||
  expected.some((name) => typeof name !== "string") ||
  JSON.stringify(expected) !== JSON.stringify([...expected].sort())
) {
  console.error("Workspace public API snapshot must be a sorted array of strings.");
  process.exit(1);
}
const added = actual.filter((name) => !expected.includes(name));
const removed = expected.filter((name) => !actual.includes(name));
if (added.length > 0 || removed.length > 0) {
  console.error("Workspace public API surface changed.");
  if (added.length > 0) console.error(`Added exports:\n${added.map((name) => `  + ${name}`).join("\n")}`);
  if (removed.length > 0) console.error(`Removed exports:\n${removed.map((name) => `  - ${name}`).join("\n")}`);
  console.error("Update packages/chart-workspace/api-surface.json intentionally if this is expected.");
  process.exit(1);
}

console.log(`Workspace public API guard passed (${actual.length} runtime exports).`);
