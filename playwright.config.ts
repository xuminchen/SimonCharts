import { defineConfig } from "@playwright/test";

export default defineConfig({
  testMatch: "**/*.spec.ts",
  projects: [
    { name: "engine-playground", testDir: "apps/playground/tests", use: { baseURL: "http://127.0.0.1:5173", ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) } },
    { name: "workspace-playground", testDir: "apps/workspace-playground/tests", use: { baseURL: "http://127.0.0.1:5174", ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) } }
  ],
  webServer: [
    { command: "npm run dev -w @simoncharts/playground -- --host 127.0.0.1", url: "http://127.0.0.1:5173", reuseExistingServer: !process.env.CI },
    { command: "npm run dev -w @simoncharts/workspace-playground", url: "http://127.0.0.1:5174", reuseExistingServer: !process.env.CI }
  ]
});
