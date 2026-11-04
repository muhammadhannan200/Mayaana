import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Dedicated port: concurrent agents must not reuse each other's app servers.
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:3142" },
  webServer: {
    ...base.webServer,
    command: `npm run ${process.env.UI_AUDIT_PRODUCTION === "1" ? "start" : "dev"} -- --hostname 127.0.0.1 --port 3142`,
    url: "http://127.0.0.1:3142/",
  },
});
