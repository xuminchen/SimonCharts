import { describe, expect, it } from "vitest";
import { releaseGateSteps } from "../check-release-gate.mjs";

describe("check-release-gate", () => {
  it("keeps the release gate command sequence stable", () => {
    expect(releaseGateSteps.map(formatStep)).toEqual([
      "npm run test",
      "npm run typecheck",
      "npm run guard:engine-boundary",
      "npm run guard:public-api",
      "npm run guard:public-types",
      "npm run guard:sdk-imports",
      "npm run build",
      "npm run check:host-smoke",
      "npm run check:package-consumer",
      "npm run check:package-types",
      "npm run check:performance",
      "npm run check:release-readiness",
      "npm run check:package-artifact",
      "npm pack --dry-run -w @simoncharts/chart-engine",
      "PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=1"
    ]);
  });

  it("runs build before host smoke and package checks", () => {
    const commands = releaseGateSteps.map(formatStep);
    const buildIndex = commands.indexOf("npm run build");

    for (const command of [
      "npm run check:host-smoke",
      "npm run check:package-consumer",
      "npm run check:package-types",
      "npm run check:package-artifact",
      "npm pack --dry-run -w @simoncharts/chart-engine"
    ]) {
      expect(buildIndex).toBeLessThan(commands.indexOf(command));
    }
  });

  it("runs e2e against Chrome", () => {
    expect(releaseGateSteps.at(-1)).toMatchObject({
      command: "npm",
      args: ["run", "test:e2e", "--", "--workers=1"],
      env: { PLAYWRIGHT_CHANNEL: "chrome" }
    });
  });
});

function formatStep(step) {
  const envText = Object.entries(step.env ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");

  return [envText, step.command, ...step.args].filter(Boolean).join(" ");
}
