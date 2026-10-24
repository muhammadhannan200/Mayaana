import { defineConfig } from "@playwright/test";

if (
  process.env.CLINICAL_TEST_LOCAL !== "1" ||
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55431"
)
  throw new Error("Use the isolated clinical runner.");
export default defineConfig({
  testDir: "./tests/clinical-browser",
  workers: 1,
  timeout: 150_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/clinical/results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3103",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [320, 390, 768, 1280].map((width) => ({
    name: `clinical-${width}`,
    use: { browserName: "chromium", viewport: { width, height: 900 } },
  })),
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3103",
    url: "http://127.0.0.1:3103",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
