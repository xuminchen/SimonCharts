import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const workspaceReleaseGateSteps = [
  { command: "npm", args: ["run", "test", "--", "packages/chart-workspace/src/__tests__"] },
  { command: "npm", args: ["run", "typecheck", "-w", "@simoncharts/charts"] },
  { command: "npm", args: ["run", "typecheck", "-w", "@simoncharts/workspace-playground"] },
  { command: "npm", args: ["run", "build", "-w", "@simoncharts/charts"] },
  { command: "npm", args: ["run", "guard:workspace-public-api"] },
  { command: "npm", args: ["run", "guard:workspace-public-types"] },
  { command: "npm", args: ["run", "check:workspace-release-readiness"] },
  { command: "npm", args: ["run", "check:workspace-package-artifact"] },
  { command: "npm", args: ["run", "check:workspace-consumer"] },
  { command: "npm", args: ["pack", "--dry-run", "-w", "@simoncharts/charts"] },
  {
    command: "npm",
    args: ["run", "test:workspace:e2e"],
    env: { PLAYWRIGHT_CHANNEL: "chrome" }
  },
  {
    command: "npm",
    args: ["run", "test:workspace:e2e"],
    env: { PLAYWRIGHT_CHANNEL: "msedge" }
  }
];

export function runWorkspaceReleaseGate() {
  for (const [index, step] of workspaceReleaseGateSteps.entries()) {
    const envText = Object.entries(step.env ?? {}).map(([key, value]) => `${key}=${value}`).join(" ");
    const commandText = [envText, step.command, ...step.args].filter(Boolean).join(" ");
    console.log(`\n[workspace-release ${index + 1}/${workspaceReleaseGateSteps.length}] ${commandText}`);
    const result = spawnSync(step.command, step.args, {
      cwd: process.cwd(),
      env: { ...process.env, ...step.env },
      stdio: "inherit"
    });
    if (result.status !== 0) {
      console.error(`[workspace-release] failed: ${commandText}`);
      process.exit(result.status ?? 1);
    }
  }
  console.log("\n[workspace-release] passed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runWorkspaceReleaseGate();
}
