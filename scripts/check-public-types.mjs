import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();
const entryPath = path.join(projectRoot, "packages/chart-engine/src/index.ts");
const snapshotPath = path.join(projectRoot, "packages/chart-engine/api-types.json");
const shouldWrite = process.argv.includes("--write");

const program = ts.createProgram([entryPath], {
  allowJs: false,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  skipLibCheck: true,
  strict: true,
  target: ts.ScriptTarget.ES2022
});

const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length > 0) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName(fileName) {
      return fileName;
    },
    getCurrentDirectory() {
      return projectRoot;
    },
    getNewLine() {
      return "\n";
    }
  }));
  process.exit(1);
}

const sourceFile = program.getSourceFile(entryPath);

if (!sourceFile) {
  console.error(`Unable to load public type entrypoint: ${entryPath}`);
  process.exit(1);
}

const checker = program.getTypeChecker();
const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

if (!moduleSymbol) {
  console.error(`Unable to resolve module symbol for ${entryPath}`);
  process.exit(1);
}

const actual = checker
  .getExportsOfModule(moduleSymbol)
  .map((symbol) => symbol.getName())
  .sort();

if (shouldWrite) {
  await writeFile(snapshotPath, `${JSON.stringify(actual, null, 2)}\n`);
  console.log(`Public type API snapshot written (${actual.length} symbols).`);
  process.exit(0);
}

const expected = JSON.parse(await readFile(snapshotPath, "utf8"));

if (!Array.isArray(expected) || expected.some((name) => typeof name !== "string")) {
  console.error("Public type API snapshot must be an array of symbol names.");
  process.exit(1);
}

const sortedExpected = [...expected].sort();

if (JSON.stringify(expected) !== JSON.stringify(sortedExpected)) {
  console.error("Public type API snapshot must be sorted.");
  process.exit(1);
}

const added = actual.filter((name) => !expected.includes(name));
const removed = expected.filter((name) => !actual.includes(name));

if (added.length > 0 || removed.length > 0) {
  console.error("Public type API surface changed.");

  if (added.length > 0) {
    console.error(`Added type symbols:\n${added.map((name) => `  + ${name}`).join("\n")}`);
  }

  if (removed.length > 0) {
    console.error(`Removed type symbols:\n${removed.map((name) => `  - ${name}`).join("\n")}`);
  }

  console.error("Run `node scripts/check-public-types.mjs --write` intentionally if this is expected.");
  process.exit(1);
}

console.log(`Public type API guard passed (${actual.length} type symbols).`);
