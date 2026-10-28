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

test("the installed Star Wars FFG manifest targets Foundry 14", async ({ request }) => {
  const response = await request.get("systems/star-wars-ffg/system.json");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.id).toBe("star-wars-ffg");
  expect(manifest.compatibility).toMatchObject({ minimum: "14", maximum: "14" });
});
