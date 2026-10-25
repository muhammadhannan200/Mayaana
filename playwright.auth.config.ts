import { defineConfig } from "@playwright/test";

if (process.env.AUTH_TEST_LOCAL !== "1")
  throw new Error("Run npm run test:auth to provision an isolated stack.");

export default defineConfig({
  testDir: "./tests/auth",
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  reporter: [["list"], ["json", { outputFile: "artifacts/auth/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:3102",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3102",
    url: "http://127.0.0.1:3102",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
