import catalogue from "../data/weapon-qualities.json" with { type: "json" };

// Keys the catalogue may use; only the pool keys below change dice automatically.
const AUTOMATION_KEYS = new Set(["attackBoostPerRating","attackDifficultyIncrease","optionalMode","extraHitPerActivation","blast","breach","armorIgnoredPerRating",
  "personalSoakIgnoredPerRating","damageOverTime","applyStatus","weaponImmuneToSunder","armorSoakIgnoresPierceAndBreach","difficultyIncreaseIfBelow",
  "defenseMeleePerRating","defenseRangedPerRating","followUpAttack","attackSetbackPerRating","autoThreat","baseDamageModifier","armor","damageToSystemStrain",
  "droidDamageToStrain","attacksBeforeReloadPerRating","reloadCost","consumesAmmo","maxExtraHitsPerRating","sameTargetOnly","pierce","soakIgnoredPerRating",
  "prepManeuversPerRating","cooldownRoundsPerRating","strainPerRating","ignoresSoak","damageToStrain","toggleMode","toggleCost","whenToggled",
  "damageTargetItemStepsPerActivation","autoAdvantage","pilotingEscapeDifficultyPerRating","criticalBonusPerRating"]);
const ACTIVATION_KEYS = new Set(["advantage","perRating","repeatable","onMissAdvantage","triggersOnMiss","extraAdvantagePerTargetSilhouetteAbove1","maxActivationsPerRating"]);
const key = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function validateWeaponQualities(data = catalogue) {
  if (data?.format !== "star-wars-weapon-qualities" || data.version !== 1 || !Array.isArray(data.qualities))
    throw new Error("Invalid weapon quality catalogue format.");
  const ids = new Set();
  for (const quality of data.qualities) {
    if (!/^[a-z-]+$/.test(quality.id) || ids.has(quality.id)) throw new Error(`Invalid or repeated weapon quality: ${quality.id}.`);
    ids.add(quality.id);
    if (!quality.name || !quality.summary || !["passive","active"].includes(quality.kind) || typeof quality.rated !== "boolean")
      throw new Error(`Incomplete weapon quality: ${quality.id}.`);
    if ((quality.kind === "active") !== Number.isInteger(quality.activation?.advantage)
      || Object.keys(quality.activation ?? {}).some((name) => !ACTIVATION_KEYS.has(name)))
      throw new Error(`Invalid activation for ${quality.id}.`);
    if (Object.keys(quality.automation ?? {}).some((name) => !AUTOMATION_KEYS.has(name)))
      throw new Error(`Unknown automation for ${quality.id}.`);
    if (!Array.isArray(quality.sources) || !quality.sources.length || quality.sources.some((source) => !source.book || !/^\d+/.test(source.page)))
      throw new Error(`Missing source for ${quality.id}.`);
  }
  return data;
}
validateWeaponQualities();
const byKey = new Map(catalogue.qualities.map((quality) => [key(quality.name), quality]));
const cite = (quality) => `EotE ${quality.sources[0].page}`;

/** Splits a weapon's free-text qualities; unrecognised entries keep their text and no id. */
export function parseQualities(text) {
  return String(text ?? "").split(/[,;]/).map((part) => part.trim()).filter(Boolean).map((part) => {
    const match = /^(.*?)(?:\s+(\d+))?$/.exec(part), quality = byKey.get(key(match[1]));
    return quality ? { id: quality.id, name: quality.name, rating: match[2] ? Number(match[2]) : null } : { id: null, name: part, rating: null };
  });
}
export function qualityRating(item, id) {
  const found = parseQualities(item?.system?.qualities).find((quality) => quality.id === id);
  return found ? found.rating ?? 1 : 0;
}

/** Passive pool changes for a weapon check, each with its printed source. */
export function qualityCheckEffects(item, actor) {
  const result = { boost: 0, setback: 0, difficulty: 0, advantage: 0, threat: 0, reasons: [] };
  if (item?.type !== "weapon") return result;
  for (const { id, name, rating } of parseQualities(item.system?.qualities)) {
    const quality = id && catalogue.qualities.find((row) => row.id === id), automation = quality?.automation ?? {}, value = rating ?? 1;
    if (!quality) continue;
    const label = `${name}${rating ? ` ${rating}` : ""}`;
    if (automation.attackBoostPerRating) { result.boost += value * automation.attackBoostPerRating; result.reasons.push(`${label}: ${value * automation.attackBoostPerRating} boost (${cite(quality)}).`); }
    if (automation.attackSetbackPerRating) { result.setback += value * automation.attackSetbackPerRating; result.reasons.push(`${label}: ${value * automation.attackSetbackPerRating} setback (${cite(quality)}).`); }
    if (automation.autoAdvantage) { result.advantage += automation.autoAdvantage; result.reasons.push(`${label}: ${automation.autoAdvantage} automatic advantage (${cite(quality)}).`); }
    if (automation.autoThreat) { result.threat += automation.autoThreat; result.reasons.push(`${label}: ${automation.autoThreat} automatic threat (${cite(quality)}).`); }
    const short = automation.difficultyIncreaseIfBelow;
    if (short) {
      const characteristic = String(short.characteristic).toLowerCase(), have = Number(actor?.system?.characteristics?.[characteristic] ?? 0),
        added = Math.max(0, value - have) * (short.perPointShort ?? 1);
      if (added) { result.difficulty += added; result.reasons.push(`${label}: ${short.characteristic} ${have} adds ${added} difficulty (${cite(quality)}).`); }
    }
  }
  return result;
}

/** Active qualities as reviewed spending presets; the GM still confirms each activation. */
export function activeQualityOptions(item) {
  if (item?.type !== "weapon") return [];
  return parseQualities(item.system?.qualities).flatMap(({ id, name, rating }) => {
    const quality = id && catalogue.qualities.find((row) => row.id === id);
    if (quality?.kind !== "active") return [];
    const activation = quality.activation, extra = activation.extraAdvantagePerTargetSilhouetteAbove1;
    return [{ id: quality.id, label: `Activate ${name}${rating ? ` ${rating}` : ""}`, cost: { advantage: activation.advantage },
      note: `${quality.summary}${extra ? ` Costs ${extra} more advantage for each target silhouette above 1.` : ""}${activation.onMissAdvantage ? ` On a miss it costs ${activation.onMissAdvantage} advantage.` : ""}${activation.repeatable ? " Can be activated more than once." : ""}`,
      source: { book: quality.sources[0].book, page: quality.sources[0].page, verification: "gm-reviewed" } }];
  });
}
