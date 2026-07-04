import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const releaseGateSteps = [
  { command: "npm", args: ["run", "test"] },
  { command: "npm", args: ["run", "typecheck"] },
  { command: "npm", args: ["run", "guard:engine-boundary"] },
  { command: "npm", args: ["run", "guard:public-api"] },
  { command: "npm", args: ["run", "guard:public-types"] },
  { command: "npm", args: ["run", "guard:sdk-imports"] },
  { command: "npm", args: ["run", "build"] },
  { command: "npm", args: ["run", "check:host-smoke"] },
  { command: "npm", args: ["run", "check:package-consumer"] },
  { command: "npm", args: ["run", "check:package-types"] },
  { command: "npm", args: ["run", "check:performance"] },
  { command: "npm", args: ["run", "check:release-readiness"] },
  { command: "npm", args: ["run", "check:package-artifact"] },
  { command: "npm", args: ["pack", "--dry-run", "-w", "@simoncharts/chart-engine"] },
  {
    command: "npm",
    args: ["run", "test:e2e"],
    env: { PLAYWRIGHT_CHANNEL: "chrome" }
  }
];

export function runReleaseGate() {
  for (const [index, step] of releaseGateSteps.entries()) {
    const stepNumber = index + 1;
    const envText = Object.entries(step.env ?? {})
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    const commandText = [envText, step.command, ...step.args].filter(Boolean).join(" ");

    console.log(`\n[release-gate ${stepNumber}/${releaseGateSteps.length}] ${commandText}`);

    const result = spawnSync(step.command, step.args, {
      cwd: process.cwd(),
      env: { ...process.env, ...step.env },
      stdio: "inherit"
    });

    if (result.status !== 0) {
      const exitStatus = result.status ?? 1;

      console.error(`[release-gate] failed: ${commandText}`);
      process.exit(exitStatus);
    }
  }

  console.log("\n[release-gate] passed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReleaseGate();
}
