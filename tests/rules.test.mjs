import test from "node:test";
import assert from "node:assert/strict";
import {
  DICE,
  resolveFaces,
  skillPool,
  upgrade,
  downgrade,
  poolFormula,
  normalizePool,
} from "../src/dice/core.mjs";
import {
  damageAfterSoak,
  minionState,
  weaponDamage,
  initiativeScore,
} from "../src/mechanics.mjs";
import {
  talentPurchase,
  availableTalents,
  skillPurchase,
  characteristicPurchase,
  specializationCost,
  validateTree,
} from "../src/advancement.mjs";
import {
  validateCampaign,
  campaignGuidance,
  DEFAULT_CAMPAIGN,
  resolveSheetTheme,
  resolveInterfaceTheme,
} from "../src/rules.mjs";
test("all seven physical distributions match their independent symbol totals", () => {
  const expected = {
    boost: [6, 2, 4, 0, 0, 0, 0, 0, 0],
    ability: [8, 5, 5, 0, 0, 0, 0, 0, 0],
    proficiency: [12, 10, 8, 0, 0, 1, 0, 0, 0],
    setback: [6, 0, 0, 2, 2, 0, 0, 0, 0],
    difficulty: [8, 0, 0, 4, 6, 0, 0, 0, 0],
    challenge: [12, 0, 0, 9, 8, 0, 1, 0, 0],
    force: [12, 0, 0, 0, 0, 0, 0, 8, 8],
  };
  for (const [key, totals] of Object.entries(expected)) {
    const die = DICE[key];
    const raw = resolveFaces(
      die.faces.map((_, i) => ({ die: key, result: i + 1 })),
    ).raw;
    assert.deepEqual([die.faces.length, ...Object.values(raw)], totals, key);
  }
});
test("triumph and despair survive cancellation of their embedded success and failure", () => {
  const r = resolveFaces([
    { die: "proficiency", result: 12 },
    { die: "challenge", result: 12 },
  ]);
  assert.equal(r.netSuccess, 0);
  assert.equal(r.passed, false);
  assert.equal(r.triumph, 1);
  assert.equal(r.despair, 1);
});
test("advantage resolves independently and force pips do not cancel", () => {
  const r = resolveFaces([
    { die: "boost", result: 5 },
    { die: "setback", result: 5 },
    { die: "force", result: 7 },
    { die: "force", result: 10 },
  ]);
  assert.equal(r.advantage, 1);
  assert.equal(r.light, 2);
  assert.equal(r.dark, 2);
  assert.equal(r.passed, false);
});
test("pool uses the higher trait and upgrades the lower, including zero-rank skills", () => {
  assert.deepEqual(
    [skillPool(3, 2).ability, skillPool(3, 2).proficiency],
    [1, 2],
  );
  assert.deepEqual(skillPool(3, 2), skillPool(2, 3));
  assert.equal(skillPool(4, 0).ability, 4);
  assert.deepEqual(upgrade(0, 2, 3), [1, 3]);
  assert.deepEqual(downgrade(0, 2, 4), [2, 0]);
});
test("reject invalid pools and face results without coercing unknown dice", () => {
  for (const pool of [
    { ability: -1 },
    { ability: 1.2 },
    { unknown: 1 },
    { ability: 41 },
    { ability: 40, proficiency: 40, boost: 1 },
  ])
    assert.throws(() => normalizePool(pool));
  assert.throws(() => resolveFaces([{ die: "ability", result: 0 }]));
  assert.equal(poolFormula({ ability: 2, difficulty: 1 }), "2da + 1dk");
  assert.ok(
    Object.values(DICE).every((d) => !["d", "c", "f"].includes(d.term)),
    "Preserve standard numeric, coin and Fate dice",
  );
});
test("every valid characteristic/rank combination preserves positive pool size", () => {
  for (let a = 0; a <= 7; a++)
    for (let b = 0; b <= 10; b++) {
      const p = skillPool(a, b);
      assert.equal(p.ability + p.proficiency, Math.max(a, b));
      assert.equal(p.proficiency, Math.min(a, b));
    }
});
test("damage and minion defeat use thresholds, not remaining HP", () => {
  assert.equal(damageAfterSoak(8, 5, 2), 5);
  assert.equal(damageAfterSoak(4, 7, 0, 1), 4);
  assert.equal(damageAfterSoak(5, 3, 0, 1, "vehicle"), 3);
  assert.throws(() => damageAfterSoak(5, 3, 1, 0, "vehicle"));
  assert.equal(minionState(3, 5, 5).remaining, 3);
  assert.equal(minionState(3, 6, 5).remaining, 2);
  assert.equal(minionState(3, 16, 5).remaining, 0);
  assert.equal(weaponDamage("+2", 3, 2), 7);
  assert.equal(weaponDamage("6", 3, 2), 8);
  assert.throws(() => weaponDamage("special", 3, 2));
});
const tree = {
  nodes: [
    {
      id: "a",
      name: "Start",
      row: 0,
      col: 0,
      cost: 5,
      entry: true,
      ranked: false,
    },
    { id: "b", name: "Known", row: 1, col: 0, cost: 10, ranked: false },
    { id: "c", name: "Deep", row: 2, col: 0, cost: 15, ranked: true },
    { id: "d", name: "Other", row: 1, col: 1, cost: 10, ranked: true },
  ],
  edges: [
    ["a", "b"],
    ["b", "c"],
  ],
};
test("talent graph blocks disconnected and unaffordable purchases", () => {
  assert.throws(() => talentPurchase(tree, [], "c", 100));
  assert.throws(() => talentPurchase(tree, [], "a", 4));
  assert.throws(() => talentPurchase(tree, ["a"], "a", 100));
  assert.deepEqual(
    availableTalents(tree, ["a"], ["Known"]).map((n) => n.id),
    ["c"],
  );
  assert.equal(talentPurchase(tree, [], "a", 20).xp, 15);
  assert.throws(() => validateTree({ ...tree, edges: [["a", "missing"]] }));
});
test("XP progression enforces creation caps and career pricing", () => {
  assert.deepEqual(skillPurchase(1, true, 20), { rank: 2, xp: 10, cost: 10 });
  assert.equal(skillPurchase(1, false, 20).cost, 15);
  assert.throws(() => skillPurchase(2, true, 100, true));
  assert.throws(() => skillPurchase(5, true, 100));
  assert.throws(() => characteristicPurchase(2, 100, "play"));
  assert.equal(characteristicPurchase(2, 100, "creation").xp, 70);
  assert.equal(specializationCost(2, false), 40);
  assert.equal(specializationCost(2, false, true), 30);
});
test("mixed campaigns retain three mechanics independently", () => {
  const c = validateCampaign(DEFAULT_CAMPAIGN);
  assert.equal(c.lines.length, 3);
  assert.ok(c.obligation && c.duty && c.morality);
  assert.match(campaignGuidance(c), /Do not grant a second starting package/);
  assert.throws(() => validateCampaign({ lines: [] }));
});
test("automatic themes follow the actor line and campaign lead", () => {
  assert.equal(resolveSheetTheme("auto", "edge"), "frontier");
  assert.equal(resolveSheetTheme("auto", "age"), "rebellion");
  assert.equal(resolveSheetTheme("auto", "force"), "mystic");
  assert.equal(
    resolveSheetTheme("auto", undefined, ["age", "force"]),
    "rebellion",
  );
  assert.equal(
    resolveSheetTheme("mystic", "edge", ["edge"]),
    "mystic",
    "a manual sheet choice overrides the ruleset",
  );
  assert.equal(resolveInterfaceTheme("default", ["edge"]), null);
  assert.equal(resolveInterfaceTheme("auto", ["force"]), "mystic");
});
test("initiative prioritizes success, then advantage, then PC tie", () => {
  assert.ok(
    initiativeScore({ netSuccess: 2, netAdvantage: 0 }) >
      initiativeScore({ netSuccess: 1, netAdvantage: 80 }),
  );
  assert.ok(
    initiativeScore({ netSuccess: 1, netAdvantage: 1 }, true) >
      initiativeScore({ netSuccess: 1, netAdvantage: 1 }, false),
  );
});
