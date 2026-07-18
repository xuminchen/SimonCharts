import { defineConfig } from "@playwright/test";


const baseURL = process.env.TRADING_REVIEW_FRONTEND_URL;
if (!baseURL) throw new Error("TRADING_REVIEW_FRONTEND_URL is required");

export default defineConfig({
  testDir: "./tests/reference-host",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})
  }
});
