import { spawnSync } from "node:child_process";

const steps = [
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

for (const [index, step] of steps.entries()) {
  const stepNumber = index + 1;
  const envText = Object.entries(step.env ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  const commandText = [envText, step.command, ...step.args].filter(Boolean).join(" ");

  console.log(`\n[release-gate ${stepNumber}/${steps.length}] ${commandText}`);

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
