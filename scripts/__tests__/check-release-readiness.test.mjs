import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const testDir = path.dirname(fileURLToPath(import.meta.url));
const sourceScriptPath = path.join(testDir, "../check-release-readiness.mjs");
const fixtureRoots = [];
const expectedVersion = "1.0.0-rc.0";

afterEach(async () => {
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("check-release-readiness", () => {
  it("passes with a minimal valid fixture", async () => {
    const root = await createFixture();

    const result = await runCheck(root);

    expect(result.stdout).toContain("Release readiness check passed for @simoncharts/chart-engine@1.0.0-rc.0.");
    expect(result.stderr).toBe("");
  });

  it("fails when the runtime API snapshot is missing", async () => {
    const root = await createFixture({ omit: "packages/chart-engine/api-surface.json" });

    try {
      await runCheck(root);
      throw new Error("Expected release readiness check to fail.");
    } catch (error) {
      expect(error.code).toBe(1);
      expect(error.stdout).toBe("");
      expect(error.stderr).toContain("packages/chart-engine/api-surface.json is required");
    }
  });

  it("fails when the type API snapshot is missing", async () => {
    const root = await createFixture({ omit: "packages/chart-engine/api-types.json" });

    try {
      await runCheck(root);
      throw new Error("Expected release readiness check to fail.");
    } catch (error) {
      expect(error.code).toBe(1);
      expect(error.stdout).toBe("");
      expect(error.stderr).toContain("packages/chart-engine/api-types.json is required");
    }
  });
});

async function createFixture({ omit } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "check-release-readiness-"));
  fixtureRoots.push(root);

  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "packages/chart-engine"), { recursive: true });
  await mkdir(path.join(root, "apps/playground"), { recursive: true });
  await mkdir(path.join(root, "docs/engine"), { recursive: true });
  await mkdir(path.join(root, "docs/superpowers/plans"), { recursive: true });

  await cp(sourceScriptPath, path.join(root, "scripts/check-release-readiness.mjs"));
  await writeJson("package.json", rootPackageFixture());
  await writeJson("packages/chart-engine/package.json", enginePackageFixture());
  await writeJson("apps/playground/package.json", playgroundPackageFixture());
  await writeJson("package-lock.json", lockfileFixture());

  const requiredDocs = [
    "README.md",
    "packages/chart-engine/README.md",
    "packages/chart-engine/api-surface.json",
    "packages/chart-engine/api-types.json",
    "CHANGELOG.md",
    "docs/engine/release-candidate.md",
    "docs/superpowers/plans/2026-06-27-chart-engine-v1-0-release-candidate-writing-plan.md",
    "docs/superpowers/plans/2026-06-27-chart-engine-v1-0-release-candidate-implementation-plan.md"
  ];

  for (const doc of requiredDocs) {
    if (doc !== omit) {
      await writeFile(path.join(root, doc), "\n");
    }
  }

  return root;

  async function writeJson(relativePath, value) {
    await writeFile(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
  }
}

async function runCheck(root) {
  return execFileAsync("node", ["scripts/check-release-readiness.mjs"], { cwd: root });
}

function rootPackageFixture() {
  const scripts = {};
  for (const script of [
    "test",
    "typecheck",
    "guard:engine-boundary",
    "guard:public-api",
    "guard:public-types",
    "guard:sdk-imports",
    "check:package-consumer",
    "check:package-artifact",
    "check:host-smoke",
    "check:package-types",
    "check:performance",
    "check:release-gate",
    "check:release-readiness",
    "build",
    "test:e2e"
  ]) {
    scripts[script] = "echo fixture";
  }

  return {
    name: "simoncharts",
    version: "0.0.0",
    private: true,
    type: "module",
    scripts
  };
}

function enginePackageFixture() {
  return {
    name: "@simoncharts/chart-engine",
    version: expectedVersion,
    description: "Host-independent chart engine kernel for SimonCharts.",
    license: "UNLICENSED",
    keywords: ["charts", "canvas", "technical-analysis", "drawing-tools", "chart-engine"],
    repository: {
      type: "git",
      url: "git+https://github.com/xuminchen/SimonCharts.git",
      directory: "packages/chart-engine"
    },
    homepage: "https://github.com/xuminchen/SimonCharts#readme",
    sideEffects: false,
    main: "./dist/index.js",
    module: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
        default: "./dist/index.js"
      }
    },
    files: ["dist"]
  };
}

function playgroundPackageFixture() {
  return {
    name: "@simoncharts/playground",
    version: "0.0.0",
    private: true,
    type: "module",
    dependencies: {
      "@simoncharts/chart-engine": expectedVersion
    }
  };
}

function lockfileFixture() {
  return {
    name: "simoncharts",
    version: "0.0.0",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: "simoncharts",
        version: "0.0.0"
      },
      "apps/playground": {
        name: "@simoncharts/playground",
        version: "0.0.0",
        dependencies: {
          "@simoncharts/chart-engine": expectedVersion
        }
      },
      "packages/chart-engine": {
        name: "@simoncharts/chart-engine",
        version: expectedVersion,
        license: "UNLICENSED"
      }
    }
  };
}
