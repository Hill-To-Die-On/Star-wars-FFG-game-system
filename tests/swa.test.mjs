import test from "node:test";
import assert from "node:assert/strict";
import { convertSwa } from "../src/swa-import.mjs";
import { validateBundle } from "../src/library.mjs";

const base = () => ({
  id: "test-space-warden",
  name: "Test Space Warden",
  type: "Rival",
  characteristics: {
    Brawn: 3,
    Agility: 2,
    Intellect: 2,
    Cunning: 1,
    Willpower: 2,
    Presence: 1,
  },
  derived: { soak: 4, wounds: 12, defence: [1, 2] },
  skills: { "Ranged: Light": 2, "Knowledge: Lore": 1 },
  tags: ["book:test", "adventure:Synthetic validation", "species:Human"],
});
test("SWA import maps native stats, includes references and drops all prose", async () => {
  const input = {
    ...base(),
    description: "PRIVATE_PROSE",
    notes: "PRIVATE_PROSE",
    gear: "PRIVATE_PROSE",
    talents: [{ name: "Reflect 2", description: "PRIVATE_PROSE" }],
    abilities: [{ name: "Test Ability", description: "PRIVATE_PROSE" }],
    weapons: [
      {
        name: "Test Sidearm",
        skill: "Ranged: Light",
        damage: 6,
        critical: 3,
        range: "Medium",
        qualities: ["Stun Setting"],
        description: "PRIVATE_PROSE",
      },
    ],
  };
  const bundle = await convertSwa(input),
    actor = bundle.documents.Actor[0];
  assert.equal(validateBundle(bundle), bundle);
  assert.equal(actor.type, "rival");
  assert.deepEqual(actor.system.wounds, { value: 0, max: 12 });
  assert.equal(actor.system.strain.max, 0);
  assert.deepEqual(actor.system.defense, { melee: 1, ranged: 2 });
  assert.equal(actor.system.skills.rangedLight.rank, 2);
  assert.equal(actor.system.skills.lore.rank, 1);
  assert.equal(actor.items[0].system.damage, "6");
  assert.equal(actor.items[1].system.rank, 2);
  assert.equal(JSON.stringify(bundle).includes("PRIVATE_PROSE"), false);
  assert.equal(
    actor.flags["star-wars-ffg"].swa.url,
    "https://swa.stoogoff.com/#test-space-warden",
  );
  assert.equal(
    actor._id,
    (await convertSwa({ ...input, description: "updated prose" })).documents
      .Actor[0]._id,
  );
});
test("SWA minions keep group skills and a per-member wound threshold", async () => {
  const actor = (
    await convertSwa({
      ...base(),
      type: "Minion",
      skills: ["Ranged: Heavy", "Athletics"],
    })
  ).documents.Actor[0];
  assert.equal(actor.system.groupSize, 1);
  assert.equal(actor.system.skills.rangedHeavy.group, true);
  assert.equal(actor.system.skills.rangedHeavy.rank, 0);
  assert.equal(actor.system.wounds.max, 12);
});
test("SWA incomplete references cannot masquerade as usable zero-damage weapons", async () => {
  const input = {
    ...base(),
    type: "Nemesis",
    talents: ["Force Rating 2"],
    weapons: ["Test Rifle", { name: "Partial Sidearm", skill: "Brawl" }],
  };
  delete input.derived.soak;
  const bundle = await convertSwa(input),
    actor = bundle.documents.Actor[0];
  assert.equal(actor.system.forceRating, 2);
  assert.deepEqual(actor.system.incomplete, ["strain.max", "soak"]);
  assert.equal(bundle.report.weaponReferences, 2);
  assert.ok(actor.items.slice(0, 2).every((item) => item.type === "reference"));
});
test("SWA invalid and duplicate records fail before any import writes", async () => {
  for (const input of [
    [],
    [base(), base()],
    { ...base(), type: "Vehicle" },
    { ...base(), name: "<script>bad</script>" },
    { ...base(), skills: { Brawl: 9 } },
    { ...base(), derived: { soak: -1, wounds: 2 } },
  ])
    await assert.rejects(convertSwa(input));
});
