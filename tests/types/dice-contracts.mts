import {
  DICE, SYMBOLS, normalizePool, skillPool, resolveFaces, applyAutomaticResults,
  poolFormula, faceLabel, upgrade, downgrade
} from "../../src/dice/core.mjs";

const pool = normalizePool({ ability: 2, proficiency: 1, difficulty: 2 });
const ability: number = pool.ability;
const formula: string = poolFormula(pool);
const outcome = resolveFaces([{ die: "ability", result: 8 }, { die: "challenge", result: 12, active: false }]);
const passed: boolean = outcome.passed;
const triumph: number = outcome.triumph;
const dark: number = outcome.raw.dark;
const adjusted = applyAutomaticResults(outcome, { success: 1, advantage: -1 });
const label: string = faceLabel(adjusted.raw);
const firstFace = DICE.force.faces[0];
if (firstFace) faceLabel(firstFace);
skillPool(3, 2, { upgradeDifficulty: 1, force: 2 });
const [base, improved]: [number, number] = upgrade(2, 1, 1);
const downgraded: [number, number] = downgrade(base, improved);
for (const symbol of SYMBOLS) { const total: number = outcome.raw[symbol]; void total; }

// Each expected error fails compilation if the actual implementation becomes untyped.
// @ts-expect-error A misspelled die key must not silently become an ad-hoc field.
normalizePool({ purple: 2 });
// @ts-expect-error Skill modifiers accept mechanical counts, not text.
skillPool(3, 2, { setback: "two" });
// @ts-expect-error Faces are keyed by the seven native narrative dice.
resolveFaces([{ die: "d20", result: 1 }]);
// @ts-expect-error Unknown narrative symbols are not valid additions.
applyAutomaticResults(outcome, { criticalSuccess: 1 });
// @ts-expect-error Result flags remain boolean.
const invalidPassed: number = outcome.passed;
// @ts-expect-error Pool amounts remain numeric.
const invalidAbility: string = pool.ability;

void [ability, formula, passed, triumph, dark, label, downgraded, invalidPassed, invalidAbility];