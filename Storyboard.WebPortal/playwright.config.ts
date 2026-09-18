import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./visual-tests",
  timeout: 30000,
  expect: {
    timeout: 5000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01
    }
  },
  use: {
    viewport: { width: 1024, height: 768 },
    headless: true
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: false,
    timeout: 120000
  }
});
