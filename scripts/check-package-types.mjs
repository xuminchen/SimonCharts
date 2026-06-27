import { spawnSync } from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const tscPath = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");
const fixturePath = path.join(projectRoot, "scripts", "fixtures", "package-consumer-types.ts");

const result = spawnSync(
  process.execPath,
  [
    tscPath,
    "--noEmit",
    "--target",
    "ES2022",
    "--module",
    "ESNext",
    "--moduleResolution",
    "Bundler",
    "--strict",
    "--skipLibCheck",
    fixturePath
  ],
  {
    cwd: projectRoot,
    stdio: "inherit"
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Package type consumer check passed.");

