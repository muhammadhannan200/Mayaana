import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/persistence",
  outputDir: "artifacts/persistence/results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/persistence/results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3101",
    browserName: "chromium",
    viewport: { width: 390, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
