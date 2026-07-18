import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const commercialPackageGateSteps = Object.freeze([
  Object.freeze({ command: "npm", args: Object.freeze(["run", "check:release-gate"]) }),
  Object.freeze({ command: "npm", args: Object.freeze(["run", "check:workspace-release-gate"]) })
]);

export const commercialFinalGateSteps = Object.freeze([
  ...commercialPackageGateSteps,
  Object.freeze({ command: "npm", args: Object.freeze(["run", "check:trading-review-host"]) })
]);

export function runCommercialReleaseGate({ packageOnly = false } = {}) {
  const steps = packageOnly ? commercialPackageGateSteps : commercialFinalGateSteps;
  const label = packageOnly ? "commercial-package-gate" : "commercial-final-gate";
  for (const [index, step] of steps.entries()) {
    const commandText = [step.command, ...step.args].join(" ");
    console.log(`\n[${label} ${index + 1}/${steps.length}] ${commandText}`);
    const result = spawnSync(step.command, step.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit"
    });
    if (result.status !== 0) {
      console.error(`[${label}] failed: ${commandText}`);
      process.exit(result.status ?? 1);
    }
  }
  console.log(`\n[${label}] passed.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCommercialReleaseGate({ packageOnly: process.argv.includes("--package-only") });
}
