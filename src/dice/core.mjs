// Mechanical face distributions. Symbol provenance is recorded in THIRD_PARTY_NOTICES.md.
const face = (
  success = 0,
  advantage = 0,
  failure = 0,
  threat = 0,
  triumph = 0,
  despair = 0,
  light = 0,
  dark = 0,
) =>
  Object.freeze({
    success,
    advantage,
    failure,
    threat,
    triumph,
    despair,
    light,
    dark,
  });
const B = face(),
  S = face(1),
  SS = face(2),
  A = face(0, 1),
  AA = face(0, 2),
  SA = face(1, 1);
const F = face(0, 0, 1),
  FF = face(0, 0, 2),
  T = face(0, 0, 0, 1),
  TT = face(0, 0, 0, 2),
  FT = face(0, 0, 1, 1);
export const DICE = Object.freeze({
  boost: {
    label: "Boost",
    term: "b",
    color: "#79cce7",
    ink: "#102730",
    faces: [B, B, S, SA, AA, A],
  },
  ability: {
    label: "Ability",
    term: "a",
    color: "#47ad68",
    ink: "#10271a",
    faces: [B, S, S, SS, A, A, SA, AA],
  },
  proficiency: {
    label: "Proficiency",
    term: "p",
    color: "#edc94e",
    ink: "#302408",
    faces: [B, S, S, SS, SS, A, SA, SA, SA, AA, AA, face(1, 0, 0, 0, 1)],
  },
  setback: {
    label: "Setback",
    term: "s",
    color: "#242a32",
    ink: "#ffffff",
    faces: [B, B, F, F, T, T],
  },
  difficulty: {
    label: "Difficulty",
    term: "k",
    color: "#7953ad",
    ink: "#ffffff",
    faces: [B, F, FF, T, T, T, TT, FT],
  },
  challenge: {
    label: "Challenge",
    term: "r",
    color: "#b93d4e",
    ink: "#ffffff",
    faces: [B, F, F, FF, FF, T, T, FT, FT, TT, TT, face(0, 0, 1, 0, 0, 1)],
  },
  force: {
    label: "Force",
    term: "w",
    color: "#edece6",
    ink: "#1b2637",
    faces: [
      face(0, 0, 0, 0, 0, 0, 0, 1),
      face(0, 0, 0, 0, 0, 0, 0, 1),
      face(0, 0, 0, 0, 0, 0, 0, 1),
      face(0, 0, 0, 0, 0, 0, 0, 1),
      face(0, 0, 0, 0, 0, 0, 0, 1),
      face(0, 0, 0, 0, 0, 0, 0, 1),
      face(0, 0, 0, 0, 0, 0, 0, 2),
      face(0, 0, 0, 0, 0, 0, 1),
      face(0, 0, 0, 0, 0, 0, 1),
      face(0, 0, 0, 0, 0, 0, 2),
      face(0, 0, 0, 0, 0, 0, 2),
      face(0, 0, 0, 0, 0, 0, 2),
    ],
  },
});
for (const die of Object.values(DICE)) {
  Object.freeze(die.faces);
  Object.freeze(die);
}
export const SYMBOLS = Object.keys(B);
export function count(value, name = "count", max = 100) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max)
    throw new RangeError(`${name} must be an integer from 0 to ${max}.`);
  return n;
}
export function normalizePool(input = {}) {
  for (const key of Object.keys(input))
    if (!(key in DICE)) throw new Error(`Unknown die: ${key}`);
  const pool = Object.fromEntries(
    Object.keys(DICE).map((key) => [key, count(input[key] ?? 0, key, 40)]),
  );
  if (Object.values(pool).reduce((a, b) => a + b, 0) > 80)
    throw new RangeError("A pool is limited to 80 dice.");
  return pool;
}
export function upgrade(base, upgraded, times = 1) {
  count(base);
  count(upgraded);
  count(times);
  for (let n = 0; n < times; n++) {
    if (base > 0) {
      base--;
      upgraded++;
    } else base++;
  }
  return [base, upgraded];
}
export function downgrade(base, upgraded, times = 1) {
  count(base);
  count(upgraded);
  count(times);
  const converted = Math.min(times, upgraded);
  return [base + converted, upgraded - converted];
}
export function skillPool(
  characteristic,
  rank,
  {
    difficulty = 2,
    boost = 0,
    setback = 0,
    upgradeAbility = 0,
    upgradeDifficulty = 0,
    downgradeAbility = 0,
    downgradeDifficulty = 0,
    force = 0,
  } = {},
) {
  count(characteristic, "characteristic", 10);
  count(rank, "rank", 10);
  count(difficulty, "difficulty", 10);
  let [ability, proficiency] = upgrade(
    Math.max(characteristic, rank) - Math.min(characteristic, rank),
    Math.min(characteristic, rank),
    upgradeAbility,
  );
  [ability, proficiency] = downgrade(ability, proficiency, downgradeAbility);
  let [negative, challenge] = upgrade(difficulty, 0, upgradeDifficulty);
  [negative, challenge] = downgrade(negative, challenge, downgradeDifficulty);
  return normalizePool({
    ability,
    proficiency,
    difficulty: negative,
    challenge,
    boost,
    setback,
    force,
  });
}
function outcomeFromRaw(raw) {
  const netSuccess = raw.success - raw.failure,
    netAdvantage = raw.advantage - raw.threat;
  return {
    raw,
    netSuccess,
    netAdvantage,
    success: Math.max(0, netSuccess),
    failure: Math.max(0, -netSuccess),
    advantage: Math.max(0, netAdvantage),
    threat: Math.max(0, -netAdvantage),
    triumph: raw.triumph,
    despair: raw.despair,
    light: raw.light,
    dark: raw.dark,
    passed: netSuccess > 0,
  };
}
export function resolveFaces(results) {
  const raw = Object.fromEntries(SYMBOLS.map((key) => [key, 0]));
  for (const { die, result, active = true } of results) {
    if (!active) continue;
    const symbols = DICE[die]?.faces[result - 1];
    if (!symbols || !Number.isInteger(result))
      throw new RangeError(`Invalid ${die} face: ${result}`);
    for (const key of SYMBOLS) raw[key] += symbols[key];
  }
  return outcomeFromRaw(raw);
}
export function applyAutomaticResults(outcome, additions = {}) {
  for (const key of Object.keys(additions))
    if (!SYMBOLS.includes(key) || !Number.isInteger(additions[key]))
      throw new Error(`Invalid automatic result: ${key}`);
  const raw = Object.fromEntries(
    SYMBOLS.map((key) => [
      key,
      Math.max(0, outcome.raw[key] + (additions[key] ?? 0)),
    ]),
  );
  return outcomeFromRaw(raw);
}
export function poolFormula(pool) {
  return (
    Object.entries(normalizePool(pool))
      .filter(([, n]) => n)
      .map(([key, n]) => `${n}d${DICE[key].term}`)
      .join(" + ") || "0"
  );
}
export function faceLabel(symbols) {
  // Triumph/Despair include a success/failure mechanically but use one emblem visually.
  const visible = {
    ...symbols,
    success: symbols.success - symbols.triumph,
    failure: symbols.failure - symbols.despair,
  };
  return (
    Object.entries(visible)
      .filter(([, n]) => n > 0)
      .map(([key, n]) => `${n > 1 ? `${n} ` : ""}${key}`)
      .join(", ") || "Blank"
  );
}
