import { defineConfig } from "@playwright/test";

const widths = [320, 390, 768, 1280];
const production = process.env.UI_AUDIT_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/ui-audit",
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/ui-audit/results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: widths.map((width) => ({
    name: `chromium-${width}`,
    use: { browserName: "chromium", viewport: { width, height: 900 } },
  })),
  webServer: {
    command: `npm run ${production ? "start" : "dev"} -- --hostname 127.0.0.1 --port 3100`,
    url: "http://127.0.0.1:3100/",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
    },
  },
});
