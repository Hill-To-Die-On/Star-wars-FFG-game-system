/** Opt-in integration test. Requires a running, licensed, isolated Foundry world.
 * FOUNDRY_URL, FOUNDRY_STORAGE_STATE and optional CHROMIUM_PATH configure Playwright.
 * Creates one synthetic actor in an explicitly selected isolated validation world.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
const url = process.env.FOUNDRY_URL,
  storageState = process.env.FOUNDRY_STORAGE_STATE,
  testWorld = process.env.FOUNDRY_TEST_WORLD ?? "star-wars-validation";
if (!testWorld.endsWith("-validation"))
  throw new Error("The smoke test requires a dedicated validation world.");
if (!url || !storageState)
  throw new Error(
    "Set FOUNDRY_URL and FOUNDRY_STORAGE_STATE for an authenticated isolated world.",
  );
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const context = await browser.newContext({
      storageState,
      viewport: { width: 1500, height: 1100 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${url}/game`);
  await page.waitForFunction(() => globalThis.game?.ready);
  assert.equal(
    await page.evaluate(() => game.world.id),
    testWorld,
    "Never run this fixture in a campaign world",
  );
  const id = await page.evaluate(async () => {
    const tree = {
      verified: true,
      nodes: [
        {
          id: "entry",
          name: "Shared training",
          entry: true,
          ranked: false,
          row: 0,
          col: 0,
          cost: 5,
        },
        {
          id: "deep",
          name: "Advanced training",
          ranked: true,
          row: 1,
          col: 0,
          cost: 10,
        },
      ],
      edges: [["entry", "deep"]],
    };
    const first = {
      name: "Test path A",
      type: "specialization",
      system: { career: "Test career", tree },
    };
    const actor = await Actor.create({
      name: "Star Wars FFG integration fixture",
      type: "character",
      system: {
        career: "Test career",
        phase: "play",
        xp: { available: 100, total: 100 },
      },
      items: [first],
    });
    const second = new Item({ ...first, name: "Test path B" });
    await actor.acquireSpecialization(second);
    actor.sheet.activeTab = "advancement";
    await actor.sheet.render({ force: true });
    return actor.id;
  });
  await page.locator(".sf-tree").first().locator('[data-node="entry"]').click();
  await page.waitForFunction(
    (id) => game.actors.get(id).system.xp.available === 75,
    id,
  );
  assert.match(
    await page
      .locator(".sf-tree")
      .nth(1)
      .locator('[data-node="entry"]')
      .innerText(),
    /Learned elsewhere/,
  );
  assert.equal(
    await page
      .locator(".sf-tree")
      .nth(1)
      .locator('[data-node="deep"]')
      .isEnabled(),
    true,
  );
  await page.locator(".sf-tree").nth(1).locator('[data-node="deep"]').click();
  await page.waitForFunction(
    (id) => game.actors.get(id).system.xp.available === 65,
    id,
  );
  const faces = await page.evaluate(async () =>
    (
      await new foundry.dice.Roll("1d20 + 1d100 + 1dc + 1df").evaluate()
    ).dice.map((d) => d.faces),
  );
  assert.deepEqual(faces, [20, 100, 2, 3]);
  await page.reload();
  await page.waitForFunction(() => globalThis.game?.ready);
  assert.deepEqual(
    await page.evaluate((id) => {
      const a = game.actors.get(id);
      return [a.system.xp.available, a.items.size, a.system.advancement.length];
    }, id),
    [65, 2, 3],
  );
  assert.deepEqual(errors, []);
  console.log(
    "Foundry smoke passed: multiple paths, shared talents, mouse purchases, persisted XP and ordinary dice.",
  );
} finally {
  await browser.close();
}
