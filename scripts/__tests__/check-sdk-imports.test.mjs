import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const testDir = path.dirname(fileURLToPath(import.meta.url));
const sourceScriptPath = path.join(testDir, "../check-sdk-imports.mjs");
const fixtureRoots = [];

afterEach(async () => {
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("check-sdk-imports", () => {
  it("passes package-root imports", async () => {
    const root = await createFixture({
      "apps/host.ts": 'import { createChartEngine } from "@simoncharts/chart-engine";\n'
    });

    const result = await runGuard(root);

    expect(result.stdout).toContain("SDK import guard passed.");
    expect(result.stderr).toBe("");
  });

  it("fails package internal subpath imports", async () => {
    const root = await createFixture({
      "apps/host.ts": 'import { hidden } from "@simoncharts/chart-engine/internal";\n'
    });

    await expectGuardFailure(root, [
      "SDK import guard failed.",
      "apps/host.ts: imports @simoncharts/chart-engine internal subpath"
    ]);
  });

  it("fails direct chart-engine source imports", async () => {
    const root = await createFixture({
      "scripts/fixtures/host.ts": 'import { hidden } from "../../packages/chart-engine/src/index";\n'
    });

    await expectGuardFailure(root, [
      "SDK import guard failed.",
      "scripts/fixtures/host.ts: imports packages/chart-engine/src directly"
    ]);
  });

  it("ignores forbidden text under node_modules and dist", async () => {
    const root = await createFixture({
      "apps/node_modules/package/index.ts": 'import "@simoncharts/chart-engine/internal";\n',
      "apps/dist/bundle.js": 'import "../../packages/chart-engine/src/index";\n',
      "scripts/fixtures/node_modules/package/index.ts": 'import "@simoncharts/chart-engine/internal";\n',
      "scripts/fixtures/dist/bundle.js": 'import "../../packages/chart-engine/src/index";\n'
    });

    const result = await runGuard(root);

    expect(result.stdout).toContain("SDK import guard passed.");
    expect(result.stderr).toBe("");
  });
});

async function createFixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), "check-sdk-imports-"));
  fixtureRoots.push(root);

  await mkdir(path.join(root, "apps"), { recursive: true });
  await mkdir(path.join(root, "scripts/fixtures"), { recursive: true });

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  return root;
}

async function runGuard(root) {
  return execFileAsync("node", [sourceScriptPath], { cwd: root });
}

async function expectGuardFailure(root, messages) {
  try {
    await runGuard(root);
    throw new Error("Expected SDK import guard to fail.");
  } catch (error) {
    expect(error.code).toBe(1);
    expect(error.stdout).toBe("");
    for (const message of messages) {
      expect(error.stderr).toContain(message);
    }
  }
}
