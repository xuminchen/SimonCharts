import { constants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function workspaceArtifactFilename(name, version) {
  if (typeof name !== "string" || typeof version !== "string" || !name || !version) {
    throw new TypeError("Workspace package name and version are required");
  }
  return `${name.replace(/^@/, "").replaceAll("/", "-")}-${version}.tgz`;
}

export async function assertArtifactDoesNotExist(filePath) {
  try {
    await access(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Refusing to overwrite existing artifact: ${filePath}`);
}

export async function sha512File(filePath) {
  return createHash("sha512").update(await readFile(filePath)).digest("hex");
}

export async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function run(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
  return result;
}

export async function packChartWorkspace(root = projectRoot) {
  const packagePath = path.join(root, "packages/chart-workspace/package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  if (packageJson.name !== "@simoncharts/charts") {
    throw new Error("Unexpected workspace package name");
  }

  const filename = workspaceArtifactFilename(packageJson.name, packageJson.version);
  const outputDirectory = path.join(root, "dist/packages");
  const destination = path.join(outputDirectory, filename);
  const sha512Path = `${destination}.sha512`;
  const sha256Path = `${destination}.sha256`;
  await assertArtifactDoesNotExist(destination);
  await assertArtifactDoesNotExist(sha512Path);
  await assertArtifactDoesNotExist(sha256Path);

  run("npm", ["run", "check:commercial-package-gate"], root);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "simoncharts-workspace-pack-"));
  try {
    const pack = run(
      "npm",
      ["pack", "--json", "-w", packageJson.name, "--pack-destination", tempRoot],
      root,
      true
    );
    const artifacts = JSON.parse(pack.stdout);
    const artifact = artifacts[0];
    if (
      !Array.isArray(artifacts) ||
      artifacts.length !== 1 ||
      artifact?.name !== packageJson.name ||
      artifact?.version !== packageJson.version ||
      path.basename(artifact?.filename ?? "") !== filename
    ) {
      throw new Error("Packed workspace metadata does not match package metadata");
    }

    const packedPath = path.join(tempRoot, filename);
    const sha512 = await sha512File(packedPath);
    const sha256 = await sha256File(packedPath);
    await mkdir(outputDirectory, { recursive: true });
    await assertArtifactDoesNotExist(destination);
    await assertArtifactDoesNotExist(sha512Path);
    await assertArtifactDoesNotExist(sha256Path);
    await copyFile(packedPath, destination, constants.COPYFILE_EXCL);
    try {
      await writeFile(sha512Path, `${sha512}  ${filename}\n`, { flag: "wx" });
      await writeFile(sha256Path, `${sha256}  ${filename}\n`, { flag: "wx" });
    } catch (error) {
      await rm(destination, { force: true });
      await rm(sha512Path, { force: true });
      await rm(sha256Path, { force: true });
      throw error;
    }

    console.log(`Immutable workspace artifact: ${destination}`);
    console.log(`SHA-256: ${sha256}`);
    console.log(`SHA-512: ${sha512}`);
    console.log(`SHA-256 file: ${sha256Path}`);
    console.log(`SHA-512 file: ${sha512Path}`);
    return Object.freeze({ destination, sha256Path, sha512Path, sha256, sha512 });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await packChartWorkspace();
}
