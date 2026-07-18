import { describe, expect, it } from "vitest";
import { workspaceReleaseGateSteps } from "../check-workspace-release-gate.mjs";

const format = (step) => [
  Object.entries(step.env ?? {}).map(([key, value]) => `${key}=${value}`).join(" "),
  step.command,
  ...step.args
].filter(Boolean).join(" ");

describe("workspace release gate", () => {
  it("builds before artifact and external consumer checks", () => {
    const commands = workspaceReleaseGateSteps.map(format);
    const build = commands.indexOf("npm run build -w @simoncharts/charts");
    expect(build).toBeGreaterThan(-1);
    expect(build).toBeLessThan(commands.indexOf("npm run check:workspace-package-artifact"));
    expect(build).toBeLessThan(commands.indexOf("npm run check:workspace-consumer"));
  });

  it("ends with Chrome and Edge workspace host acceptance", () => {
    expect(workspaceReleaseGateSteps.at(-2)).toMatchObject({
      command: "npm",
      args: ["run", "test:workspace:e2e"],
      env: { PLAYWRIGHT_CHANNEL: "chrome" }
    });
    expect(workspaceReleaseGateSteps.at(-1)).toMatchObject({
      command: "npm",
      args: ["run", "test:workspace:e2e"],
      env: { PLAYWRIGHT_CHANNEL: "msedge" }
    });
  });
});
