import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";


const required = [
  "TRADING_REVIEW_FRONTEND_URL",
  "TRADING_REVIEW_HOST_ROOT",
  "TRADING_REVIEW_USERNAME",
  "TRADING_REVIEW_PASSWORD",
  "TRADING_REVIEW_TRADE_DATE"
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(2);
}

const version = "1.0.0-rc.34";
const artifactName = `simoncharts-charts-${version}.tgz`;
const candidatePath = path.resolve("dist", "packages", artifactName);
const expectedDigests = {
  sha256: readFileSync(`${candidatePath}.sha256`, "utf8").trim().split(/\s+/)[0],
  sha512: readFileSync(`${candidatePath}.sha512`, "utf8").trim().split(/\s+/)[0]
};
const hostRoot = path.resolve(process.env.TRADING_REVIEW_HOST_ROOT);
const vendoredPath = path.join(hostRoot, "vendor", artifactName);
for (const artifactPath of [candidatePath, vendoredPath]) {
  const artifact = readFileSync(artifactPath);
  for (const [algorithm, expected] of Object.entries(expectedDigests)) {
    const actual = createHash(algorithm).update(artifact).digest("hex");
    if (actual !== expected) {
      throw new Error(`${artifactPath} has unexpected ${algorithm}: ${actual}`);
    }
  }
}

const hostPackage = JSON.parse(readFileSync(path.join(hostRoot, "package.json"), "utf8"));
const hostLock = JSON.parse(readFileSync(path.join(hostRoot, "package-lock.json"), "utf8"));
const installedPackage = JSON.parse(
  readFileSync(path.join(hostRoot, "node_modules", "@simoncharts", "charts", "package.json"), "utf8")
);
const expectedDependency = `file:vendor/${artifactName}`;
if (hostPackage.dependencies?.["@simoncharts/charts"] !== expectedDependency) {
  throw new Error(`TradingReviewSystem must pin @simoncharts/charts to ${expectedDependency}`);
}
const lockEntry = hostLock.packages?.["node_modules/@simoncharts/charts"];
if (lockEntry?.version !== version || lockEntry?.resolved !== expectedDependency) {
  throw new Error("TradingReviewSystem package-lock does not pin the accepted Charts artifact");
}
if (installedPackage.version !== version) {
  throw new Error(`TradingReviewSystem has Charts ${installedPackage.version} installed; expected ${version}`);
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  command,
  ["playwright", "test", "--config", "playwright.trading-review.config.ts"],
  { cwd: process.cwd(), env: process.env, stdio: "inherit" }
);
process.exit(result.status ?? 1);
