import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const testDir = path.dirname(fileURLToPath(import.meta.url));
const sourceScriptPath = path.join(testDir, "../check-public-types.mjs");
const fixtureRoots = [];

afterEach(async () => {
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("check-public-types", () => {
  it("passes when type exports match the snapshot", async () => {
    const root = await createFixture({
      exports: ["Zeta", "Alpha"],
      snapshot: ["Alpha", "Zeta"]
    });

    const result = await runGuard(root);

    expect(result.stdout).toContain("Public type API guard passed (2 type symbols).");
    expect(result.stderr).toBe("");
  });

  it("fails with added and removed type symbols when the snapshot differs", async () => {
    const root = await createFixture({
      exports: ["Alpha", "RuntimeOnly"],
      snapshot: ["Alpha", "SnapshotOnly"]
    });

    try {
      await runGuard(root);
      throw new Error("Expected public type API guard to fail.");
    } catch (error) {
      expect(error.code).toBe(1);
      expect(error.stdout).toBe("");
      expect(error.stderr).toContain("Public type API surface changed.");
      expect(error.stderr).toContain("Added type symbols:\n  + RuntimeOnly");
      expect(error.stderr).toContain("Removed type symbols:\n  - SnapshotOnly");
    }
  });

  it("fails when the snapshot is not an array", async () => {
    const root = await createFixture({
      exports: ["Alpha"],
      snapshot: { types: ["Alpha"] }
    });

    try {
      await runGuard(root);
      throw new Error("Expected public type API guard to fail.");
    } catch (error) {
      expect(error.code).toBe(1);
      expect(error.stdout).toBe("");
      expect(error.stderr).toContain("Public type API snapshot must be an array of symbol names.");
    }
  });

  it("fails when the snapshot contains non-string entries", async () => {
    const root = await createFixture({
      exports: ["Alpha"],
      snapshot: ["Alpha", 1]
    });

    try {
      await runGuard(root);
      throw new Error("Expected public type API guard to fail.");
    } catch (error) {
      expect(error.code).toBe(1);
      expect(error.stdout).toBe("");
      expect(error.stderr).toContain("Public type API snapshot must be an array of symbol names.");
    }
  });

  it("fails when the snapshot is not sorted", async () => {
    const root = await createFixture({
      exports: ["Alpha", "Zeta"],
      snapshot: ["Zeta", "Alpha"]
    });

    try {
      await runGuard(root);
      throw new Error("Expected public type API guard to fail.");
    } catch (error) {
      expect(error.code).toBe(1);
      expect(error.stdout).toBe("");
      expect(error.stderr).toContain("Public type API snapshot must be sorted.");
    }
  });

  it("writes sorted type symbols with a trailing newline in write mode", async () => {
    const root = await createFixture({
      exports: ["Zeta", "Alpha", "Middle"],
      snapshot: ["Stale"]
    });

    const result = await runGuard(root, ["--write"]);
    const snapshot = await readFile(path.join(root, "packages/chart-engine/api-types.json"), "utf8");

    expect(result.stdout).toContain("Public type API snapshot written (3 symbols).");
    expect(result.stderr).toBe("");
    expect(snapshot).toBe(`${JSON.stringify(["Alpha", "Middle", "Zeta"], null, 2)}\n`);
  });
});

async function createFixture({ exports, snapshot }) {
  const root = await mkdtemp(path.join(tmpdir(), "check-public-types-"));
  fixtureRoots.push(root);

  await mkdir(path.join(root, "packages/chart-engine/src"), { recursive: true });
  await writeFile(path.join(root, "packages/chart-engine/api-types.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  await writeFile(
    path.join(root, "packages/chart-engine/src/index.ts"),
    `${exports.map((name) => `export type ${name} = { value: string };`).join("\n")}\n`
  );

  return root;
}

async function runGuard(root, args = []) {
  return execFileAsync("node", [sourceScriptPath, ...args], { cwd: root });
}
