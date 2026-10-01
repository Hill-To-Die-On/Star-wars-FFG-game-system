/** End-to-end specs in e2e/ drive a licensed Foundry server, which hosted CI cannot provide.
 * Set FOUNDRY_URL to run them, plus FOUNDRY_STORAGE_STATE for an authenticated session and
 * optionally CHROMIUM_PATH. Without FOUNDRY_URL they skip. Use an isolated validation world,
 * never a campaign world.
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  // A subfolder, because Playwright empties its output folder before every run.
  outputDir: "test-results/e2e",
  // Specs share one Foundry world.
  workers: 1,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: process.env.FOUNDRY_URL,
    storageState: process.env.FOUNDRY_STORAGE_STATE,
    viewport: { width: 1500, height: 1100 },
    // Same WebGL settings as tests/foundry-smoke.mjs; Foundry's canvas needs them headless.
    launchOptions: {
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
});
