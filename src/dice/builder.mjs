import { normalizePool, skillPool, upgrade, downgrade } from "./core.mjs";
import { applyTalentPool } from "../talent-rules.mjs";

export const ROLL_DICE = Object.freeze([
  "ability",
  "proficiency",
  "boost",
  "difficulty",
  "challenge",
  "setback",
  "force",
]);

export const DIFFICULTY_PRESETS = Object.freeze([
  { value: 0, label: "Simple" },
  { value: 1, label: "Easy" },
  { value: 2, label: "Average" },
  { value: 3, label: "Hard" },
  { value: 4, label: "Daunting" },
  { value: 5, label: "Formidable" },
]);

export const RANGE_DIFFICULTY = Object.freeze({
  engaged: 1,
  short: 1,
  medium: 2,
  long: 3,
  extreme: 4,
});

const RANGE_ORDER = Object.keys(RANGE_DIFFICULTY);
const MELEE_SKILLS = new Set(["brawl", "melee", "lightsaber"]);
const RANGED_SKILLS = new Set(["rangedLight", "rangedHeavy", "gunnery"]);

export function automaticCheckPool({
  characteristic,
  rank,
  difficulty = 2,
  skill = "",
  weaponRange = "",
  rangeBand = "",
  defense = 0,
  adversary = 0,
  combat: combatOverride,
  melee: meleeOverride,
  talentRules,
} = {}) {
  const reasons = [],
    melee = meleeOverride ?? MELEE_SKILLS.has(skill),
    combat =
      combatOverride ?? (MELEE_SKILLS.has(skill) || RANGED_SKILLS.has(skill));
  let error = "",
    taskDifficulty = difficulty;
  if (combat) {
    taskDifficulty = melee ? 2 : RANGE_DIFFICULTY[rangeBand];
    if (!Number.isInteger(taskDifficulty)) error = "Choose a valid range band.";
    const rangeIndex = RANGE_ORDER.indexOf(rangeBand),
      weaponRangeIndex = RANGE_ORDER.indexOf(weaponRange);
    if (
      !error &&
      weaponRangeIndex >= 0 &&
      rangeIndex > weaponRangeIndex
    )
      error = `Target is beyond the weapon's ${weaponRange} range.`;
    if (!error && rangeBand === "engaged") {
      if (skill === "rangedLight") taskDifficulty += 1;
      if (skill === "rangedHeavy") taskDifficulty += 2;
      if (skill === "gunnery")
        error = "Gunnery cannot be used while engaged with an opponent.";
    }
  }
  const basePool = skillPool(characteristic, rank, {
      difficulty: Number.isInteger(taskDifficulty) ? taskDifficulty : 0,
      setback: combat ? defense : 0,
      upgradeDifficulty: combat ? adversary : 0,
    }),
    pool = talentRules ? applyTalentPool(basePool, talentRules) : basePool;
  reasons.push(
    `${characteristic} characteristic + rank ${rank}: ${pool.ability} ability, ${pool.proficiency} proficiency`,
  );
  if (combat)
    reasons.push(
      melee
        ? `Melee check: difficulty ${taskDifficulty}`
        : `${rangeBand || "No"} range: difficulty ${taskDifficulty ?? 0}`,
    );
  else reasons.push(`Selected task difficulty: ${taskDifficulty}`);
  if (combat && defense) reasons.push(`Target defense: ${defense} setback`);
  if (combat && adversary)
    reasons.push(
      `Target adversary rating: ${adversary} difficulty upgrade${adversary === 1 ? "" : "s"}`,
    );
  if (talentRules?.reasons?.length) reasons.push(...talentRules.reasons);
  return {
    pool,
    reasons,
    error,
    combat,
    melee,
    difficulty: taskDifficulty,
    automaticResults: talentRules?.automaticResults ?? {},
    talentDecisions: talentRules?.decisions ?? [],
  };
}

export function adjustPool(pool, die, delta) {
  if (!ROLL_DICE.includes(die))
    throw new Error(`Unknown roll-builder die: ${die}`);
  if (!Number.isInteger(delta))
    throw new Error("Dice adjustments must be whole numbers.");
  const current = normalizePool(pool);
  return normalizePool({
    ...current,
    [die]: Math.max(0, Math.min(40, current[die] + delta)),
  });
}

export function setDifficulty(pool, value) {
  if (!Number.isInteger(value) || value < 0 || value > 5)
    throw new RangeError("Difficulty preset must be from 0 to 5.");
  return normalizePool({ ...normalizePool(pool), difficulty: value, challenge: 0 });
}

export function shiftUpgrade(pool, side, direction = 1) {
  const current = normalizePool(pool);
  if (![-1, 1].includes(direction))
    throw new Error("Upgrade direction must be 1 or -1.");
  const keys =
    side === "positive"
      ? ["ability", "proficiency"]
      : side === "negative"
        ? ["difficulty", "challenge"]
        : null;
  if (!keys) throw new Error("Choose the positive or negative pool.");
  const values =
    direction === 1
      ? upgrade(current[keys[0]], current[keys[1]], 1)
      : downgrade(current[keys[0]], current[keys[1]], 1);
  return normalizePool({
    ...current,
    [keys[0]]: values[0],
    [keys[1]]: values[1],
  });
}
