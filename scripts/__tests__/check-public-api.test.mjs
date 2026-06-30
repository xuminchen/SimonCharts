import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const testDir = path.dirname(fileURLToPath(import.meta.url));
const sourceScriptPath = path.join(testDir, "../check-public-api.mjs");
const fixtureRoots = [];

afterEach(async () => {
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("check-public-api", () => {
  it("passes when runtime exports match the snapshot", async () => {
    const root = await createFixture({
      exports: ["zeta", "alpha"],
      snapshot: ["alpha", "zeta"]
    });

    const result = await runGuard(root);

    expect(result.stdout).toContain("Public API guard passed (2 runtime exports).");
    expect(result.stderr).toBe("");
  });

  it("fails with added and removed exports when the snapshot differs", async () => {
    const root = await createFixture({
      exports: ["alpha", "runtimeOnly"],
      snapshot: ["alpha", "snapshotOnly"]
    });

    try {
      await runGuard(root);
      throw new Error("Expected public API guard to fail.");
    } catch (error) {
      expect(error.code).toBe(1);
      expect(error.stdout).toBe("");
      expect(error.stderr).toContain("Public API surface changed.");
      expect(error.stderr).toContain("Added exports:\n  + runtimeOnly");
      expect(error.stderr).toContain("Removed exports:\n  - snapshotOnly");
    }
  });

  it("writes sorted runtime exports with a trailing newline in write mode", async () => {
    const root = await createFixture({
      exports: ["zeta", "alpha", "middle"],
      snapshot: ["stale"]
    });

    const result = await runGuard(root, ["--write"]);
    const snapshot = await readFile(path.join(root, "packages/chart-engine/api-surface.json"), "utf8");

    expect(result.stdout).toContain("Public API snapshot written (3 runtime exports).");
    expect(result.stderr).toBe("");
    expect(snapshot).toBe(`${JSON.stringify(["alpha", "middle", "zeta"], null, 2)}\n`);
  });
});

async function createFixture({ exports, snapshot }) {
  const root = await mkdtemp(path.join(tmpdir(), "check-public-api-"));
  fixtureRoots.push(root);

  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "packages/chart-engine"), { recursive: true });
  await mkdir(path.join(root, "node_modules/@simoncharts/chart-engine"), { recursive: true });

  await cp(sourceScriptPath, path.join(root, "scripts/check-public-api.mjs"));
  await writeFile(
    path.join(root, "packages/chart-engine/api-surface.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`
  );
  await writeFile(
    path.join(root, "node_modules/@simoncharts/chart-engine/package.json"),
    `${JSON.stringify({ name: "@simoncharts/chart-engine", type: "module", exports: "./index.mjs" }, null, 2)}\n`
  );
  await writeFile(
    path.join(root, "node_modules/@simoncharts/chart-engine/index.mjs"),
    exports.map((name) => `export const ${name} = ${JSON.stringify(name)};`).join("\n")
  );

  return root;
}

async function runGuard(root, args = []) {
  return execFileAsync("node", ["scripts/check-public-api.mjs", ...args], { cwd: root });
}
