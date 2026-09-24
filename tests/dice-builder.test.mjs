import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustPool,
  setDifficulty,
  shiftUpgrade,
  automaticCheckPool,
} from "../src/dice/builder.mjs";

test("manual pool builder adjusts exact dice, presets and upgrades", () => {
  const base = { ability: 2, proficiency: 1, difficulty: 2 };
  assert.equal(adjustPool(base, "boost", 1).boost, 1);
  assert.equal(adjustPool(base, "ability", -20).ability, 0);
  assert.deepEqual(
    [
      setDifficulty({ ...base, challenge: 2 }, 4).difficulty,
      setDifficulty({ ...base, challenge: 2 }, 4).challenge,
    ],
    [4, 0],
  );
  const positive = shiftUpgrade(base, "positive");
  assert.deepEqual([positive.ability, positive.proficiency], [1, 2]);
  const negative = shiftUpgrade(base, "negative");
  assert.deepEqual([negative.difficulty, negative.challenge], [1, 1]);
  assert.throws(() => adjustPool(base, "unknown", 1));
});

test("automatic builder combines skill, range, target defense and adversary rating", () => {
  const short = automaticCheckPool({
    characteristic: 4,
    rank: 2,
    skill: "rangedLight",
    weaponRange: "medium",
    rangeBand: "short",
    defense: 1,
    adversary: 1,
  });
  assert.equal(short.error, "");
  assert.deepEqual(
    Object.fromEntries(Object.entries(short.pool).filter(([, value]) => value)),
    { ability: 2, proficiency: 2, challenge: 1, setback: 1 },
  );
  assert.match(short.reasons.join(" "), /Target defense/);
  assert.match(short.reasons.join(" "), /adversary rating/);
});

test("automatic attack difficulty respects range, engaged weapon rules and reach", () => {
  assert.equal(
    automaticCheckPool({
      characteristic: 3,
      rank: 2,
      skill: "rangedHeavy",
      weaponRange: "long",
      rangeBand: "engaged",
    }).difficulty,
    3,
  );
  assert.equal(
    automaticCheckPool({
      characteristic: 3,
      rank: 2,
      skill: "melee",
      weaponRange: "engaged",
      rangeBand: "engaged",
      defense: 2,
    }).pool.setback,
    2,
  );
  assert.match(
    automaticCheckPool({
      characteristic: 3,
      rank: 2,
      skill: "gunnery",
      weaponRange: "long",
      rangeBand: "engaged",
    }).error,
    /cannot be used/,
  );
  assert.match(
    automaticCheckPool({
      characteristic: 3,
      rank: 2,
      skill: "rangedLight",
      weaponRange: "short",
      rangeBand: "long",
    }).error,
    /beyond/,
  );
});

test("automatic general checks use the chosen task difficulty without combat assumptions", () => {
  const result = automaticCheckPool({
    characteristic: 3,
    rank: 1,
    skill: "charm",
    difficulty: 4,
    defense: 3,
    adversary: 2,
  });
  assert.equal(result.combat, false);
  assert.equal(result.pool.difficulty, 4);
  assert.equal(result.pool.setback, 0);
  assert.equal(result.pool.challenge, 0);
});

test("custom skills can opt into melee or ranged automatic combat handling", () => {
  const melee = automaticCheckPool({
    characteristic: 3,
    rank: 2,
    skill: "custom:dueling",
    combat: true,
    melee: true,
    rangeBand: "engaged",
    defense: 1,
  });
  assert.equal(melee.combat, true);
  assert.equal(melee.melee, true);
  assert.equal(melee.difficulty, 2);
  assert.equal(melee.pool.setback, 1);

  const ranged = automaticCheckPool({
    characteristic: 3,
    rank: 1,
    skill: "custom:siegecraft",
    combat: true,
    melee: false,
    rangeBand: "long",
  });
  assert.equal(ranged.melee, false);
  assert.equal(ranged.difficulty, 3);
});

test("automatic pools include learned passive talent dice and fixed results", () => {
  const talentRules = {
      pool: {
        add: {
          ability: 0,
          proficiency: 0,
          boost: 1,
          difficulty: 0,
          challenge: 0,
          setback: 0,
          force: 1,
        },
        remove: {
          ability: 0,
          proficiency: 0,
          boost: 0,
          difficulty: 0,
          challenge: 0,
          setback: 1,
          force: 0,
        },
      },
      automaticResults: { advantage: 1 },
      reasons: ["Command: +1 boost"],
      decisions: [],
    },
    result = automaticCheckPool({
      characteristic: 3,
      rank: 2,
      skill: "leadership",
      difficulty: 2,
      combat: true,
      melee: false,
      rangeBand: "short",
      defense: 1,
      talentRules,
    });
  assert.equal(result.pool.boost, 1);
  assert.equal(result.pool.force, 1);
  assert.equal(result.pool.setback, 0);
  assert.equal(result.automaticResults.advantage, 1);
  assert.match(result.reasons.join(" "), /Command/);
});
