import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertArtifactDoesNotExist,
  sha256File,
  sha512File,
  workspaceArtifactFilename
} from "../pack-chart-workspace.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("immutable workspace pack helpers", () => {
  it("derives the npm tarball filename from the scoped package", () => {
    expect(workspaceArtifactFilename("@simoncharts/charts", "1.0.0-rc.12"))
      .toBe("simoncharts-charts-1.0.0-rc.12.tgz");
  });

  it("refuses to overwrite an existing artifact", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "workspace-pack-test-"));
    temporaryDirectories.push(directory);
    const artifact = path.join(directory, "artifact.tgz");
    await writeFile(artifact, "existing");

    await expect(assertArtifactDoesNotExist(artifact))
      .rejects.toThrow("Refusing to overwrite existing artifact");
  });

  it("accepts a missing destination and produces a deterministic SHA-512", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "workspace-pack-test-"));
    temporaryDirectories.push(directory);
    const missing = path.join(directory, "missing.tgz");
    await mkdir(path.dirname(missing), { recursive: true });
    await expect(assertArtifactDoesNotExist(missing)).resolves.toBeUndefined();

    const source = path.join(directory, "source.tgz");
    await writeFile(source, "workspace");
    expect(await sha512File(source)).toBe(
      "cbbc82ad06ebbed283d29769f47d460baf82c5a1b75aff0964b0f3ecc5ff4374d4e72231a6fc75f5edab0aa58441171f02a30a894fd2ef6062fb72cad62479b5"
    );
    expect(await sha256File(source)).toBe(
      "21a3230e03772a58aff1b3709a9e232850916337e1fba95c434076b6668c6e08"
    );
  });
});
