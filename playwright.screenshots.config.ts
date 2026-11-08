import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "tests/screenshots",
  projects: [{ name: "screenshots", use: { viewport: { width: 1440, height: 900 } } }],
});
