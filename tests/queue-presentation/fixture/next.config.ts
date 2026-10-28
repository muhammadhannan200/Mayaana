import path from "node:path";
import type { NextConfig } from "next";

// Separate, explicitly synthetic app. Never aliases actions in the real app.
const root = path.resolve(import.meta.dirname, "../../..");
const config: NextConfig = {
  devIndicators: false,
  turbopack: {
    root,
    resolveAlias: {
      "@/app/clinical-actions": "./clinical-actions.ts",
    },
  },
};
export default config;
