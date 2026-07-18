import { describe, expect, it } from "vitest";
import {
  commercialFinalGateSteps,
  commercialPackageGateSteps
} from "../check-commercial-release-gate.mjs";

const commands = (steps) => steps.map((step) => [step.command, ...step.args].join(" "));

describe("commercial release gate modes", () => {
  it("keeps the package-only gate independent from the reference host", () => {
    expect(commands(commercialPackageGateSteps)).toEqual([
      "npm run check:release-gate",
      "npm run check:workspace-release-gate"
    ]);
  });

  it("adds the authenticated TradingReviewSystem check only to the final gate", () => {
    expect(commands(commercialFinalGateSteps)).toEqual([
      "npm run check:release-gate",
      "npm run check:workspace-release-gate",
      "npm run check:trading-review-host"
    ]);
  });
});
