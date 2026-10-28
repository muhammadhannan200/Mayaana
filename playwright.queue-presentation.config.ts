import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/queue-presentation",
  testMatch: "*.spec.ts",
  outputDir: "./artifacts/issue-41-batch-2/test-results",
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/issue-41-batch-2/results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3104",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [320, 390, 768, 1280].map((width) => ({
    name: `chromium-${width}`,
    use: { browserName: "chromium", viewport: { width, height: 877 } },
  })),
  webServer: {
    command:
      "node node_modules/next/dist/bin/next dev tests/queue-presentation/fixture --hostname 127.0.0.1 --port 3104",
    url: "http://127.0.0.1:3104/secretary",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
    },
  },
});
