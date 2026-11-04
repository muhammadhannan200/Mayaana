import path from "node:path";
import { defineConfig } from "@playwright/test";

const production = process.env.UI_AUDIT_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/demo-hydration",
  testMatch: "*.spec.ts",
  workers: 1,
  outputDir: "./artifacts/ui-audit/hydration-418/test-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/ui-audit/hydration-418/results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3106",
    timezoneId: "Asia/Damascus",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [320, 390, 768, 1280].map((width) => ({
    name: `chromium-${width}`,
    use: { browserName: "chromium", viewport: { width, height: 900 } },
  })),
  webServer: {
    command: `npm run ${production ? "start" : "dev"} -- --hostname 127.0.0.1 --port 3106`,
    url: "http://127.0.0.1:3106/",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      TZ: "UTC",
      NODE_OPTIONS: `--require="${path.resolve("tests/demo-hydration/server-clock.cjs").replaceAll("\\", "/")}"`,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
    },
  },
});
