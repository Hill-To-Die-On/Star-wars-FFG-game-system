import { test, expect } from "@playwright/test";

test.skip(
  !process.env.FOUNDRY_URL,
  "Set FOUNDRY_URL to an isolated Foundry server to run end-to-end tests.",
);

test("Foundry serves its entry page", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/.+/);
});
