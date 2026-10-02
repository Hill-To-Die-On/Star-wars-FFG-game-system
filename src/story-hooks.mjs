import { bookAllowed } from "./rules.mjs";
import { careerBackgroundDefault, speciesBackgroundDefault, appendCareerStoryPrompts, appendSpeciesStoryPrompts } from "./career-story.mjs";

const title = (value) => String(value ?? "").trim();
const range = (metadata, suffix) => {
  const key = Object.keys(metadata ?? {}).find((candidate) =>
    new RegExp(`^d.?100.?${suffix}$`, "i").test(candidate));
  return Number(metadata?.[key]);
};

export function storyRollOptions(entries, mechanic, career, campaign) {
  if (!["obligation", "duty", "morality"].includes(mechanic)) throw new Error("Unknown story mechanic.");
  const all = Array.from(entries ?? []).filter((entry) =>
    entry?.system?.source?.table === mechanic && bookAllowed(entry.system.source.book, campaign) &&
    Number.isInteger(range(entry.system.metadata, "low")) && Number.isInteger(range(entry.system.metadata, "high")));
  const named = all.filter((entry) => title(entry.system.metadata.Career).toLowerCase() === title(career).toLowerCase());
  const core = all.filter((entry) => /core book/i.test(entry.system.source.book) && /^any\b/i.test(title(entry.system.metadata.Career)));
  const rows = named.length && named.some((entry) => range(entry.system.metadata, "low") === 1) ? named : core;
  return rows.sort((a, b) => range(a.system.metadata, "low") - range(b.system.metadata, "low"));
}

export function resolveStoryRoll(options, value, mechanic) {
  const roll = Number(value);
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) throw new Error("Story roll must be a d100 result.");
  const entry = Array.from(options ?? []).find((candidate) => range(candidate.system?.metadata, "low") <= roll && range(candidate.system?.metadata, "high") >= roll);
  if (!entry) throw new Error(`No ${mechanic} result covers d100 ${roll} in the enabled sources.`);
  const metadata = entry.system.metadata;
  const source = { table: mechanic, book: title(entry.system.source.book), page: title(entry.system.source.page) };
  const description = title(entry.system.description);
  if (/^roll twice$/i.test(title(entry.name))) return { mechanic, roll, rollTwice: true, source };
  if (mechanic === "morality") {
    const strength = title(metadata.Emotional_Strength), weakness = title(metadata.Emotional_Weakness);
    if (!strength || !weakness) throw new Error("The selected Morality result is incomplete.");
    return { mechanic, roll, strength, weakness, source, ...(description ? { description } : {}) };
  }
  const label = title(mechanic === "duty" ? metadata.Duty_Type : metadata.Obligation);
  if (!label) throw new Error(`The selected ${mechanic} result is incomplete.`);
  return { mechanic, roll, label, source, ...(description ? { description } : {}) };
}

export async function rollStoryHook(options, mechanic, rollD100) {
  let attempts = 0;
  const one = async (depth = 0) => {
    if (++attempts > 12) throw new Error("Story table kept returning reroll results; roll again.");
    const result = resolveStoryRoll(options, await rollD100(), mechanic);
    if (!result.rollTwice) return result;
    if (depth >= 2) return one(depth);
    const first = await one(depth + 1), second = await one(depth + 1);
    return mechanic === "morality"
      ? { ...first, strength: `${first.strength} / ${second.strength}`, weakness: `${first.weakness} / ${second.weakness}`, rolls: [result.roll, first.roll, second.roll] }
      : { ...first, label: `${first.label} / ${second.label}`, rolls: [result.roll, first.roll, second.roll] };
  };
  return one();
}

export function missingStoryMechanics(system, campaign) {
  const missing = [];
  if (campaign?.obligation && Number(system?.obligation?.value) > 0 && !title(system.obligation.label)) missing.push("obligation");
  if (campaign?.duty && Number(system?.duty?.value) > 0 && !title(system.duty.label)) missing.push("duty");
  if (campaign?.morality && Number(system?.morality?.value) > 0 && (!title(system.morality.strength) || !title(system.morality.weakness))) missing.push("morality");
  return missing;
}

export function applyStoryHooks(system, hooks) {
  const result = structuredClone(system);
  result.creation ??= {};
  result.creation.storyRolls ??= [];
  for (const hook of hooks) {
    if (!["obligation", "duty", "morality"].includes(hook?.mechanic)) throw new Error("Unknown story mechanic.");
    const mechanic = hook.mechanic;
    if (mechanic === "morality") {
      result.morality ??= {};
      result.morality.strength ||= title(hook.strength);
      result.morality.weakness ||= title(hook.weakness);
    } else {
      result[mechanic] ??= {};
      result[mechanic].label ||= title(hook.label);
    }
    if (!result.creation.storyRolls.some((saved) => saved.mechanic === mechanic))
      result.creation.storyRolls.push({ mechanic, roll: hook.roll, rolls: hook.rolls ?? [hook.roll], source: hook.source,
        ...(title(hook.description) ? { description: title(hook.description) } : {}) });
  }
  return result;
}

const MECHANICS = ["obligation", "duty", "morality"];
const hookProse = (mechanic, system) => {
  if (mechanic === "morality") {
    const strength = title(system.morality?.strength), weakness = title(system.morality?.weakness);
    return strength && weakness
      ? `Their ${strength.toLowerCase()} can guide difficult choices, while ${weakness.toLowerCase()} may complicate them under pressure.`
      : "No emotional strength and weakness have been chosen yet.";
  }
  const label = title(system[mechanic]?.label);
  if (!label) return `No ${mechanic} has been chosen for this character.`;
  return mechanic === "obligation"
    ? `Their ${label.toLowerCase()} obligation remains a source of promises and pressure.`
    : `Their ${label.toLowerCase()} duty gives them a cause to serve and choices to weigh.`;
};

export function storyHookCards(system) {
  const rolls = system?.creation?.storyRolls ?? [];
  return MECHANICS.map((mechanic) => {
    const saved = rolls.find((entry) => entry.mechanic === mechanic),
      chosen = mechanic === "morality"
        ? [title(system?.morality?.strength), title(system?.morality?.weakness)].filter(Boolean).join(" / ")
        : title(system?.[mechanic]?.label),
      value = Number(system?.[mechanic]?.value ?? 0);
    return {
      type: mechanic[0].toUpperCase() + mechanic.slice(1),
      mechanic, chosen: chosen || "Unchosen", value,
      prose: title(saved?.description) || hookProse(mechanic, system),
      roll: saved?.roll, source: saved?.source,
      inactive: !chosen || mechanic === "duty" && value === 0,
    };
  });
}

export function storyBackgroundParagraph(system) {
  const species = Object.hasOwn(system?.creation ?? {}, "speciesBackground")
      ? title(system.creation.speciesBackground) : speciesBackgroundDefault(system?.species),
    career = Object.hasOwn(system?.creation ?? {}, "careerBackground")
      ? title(system.creation.careerBackground) : careerBackgroundDefault(system?.career),
    hooks = MECHANICS.filter((mechanic) => mechanic === "morality"
      ? title(system?.morality?.strength) && title(system?.morality?.weakness)
      : title(system?.[mechanic]?.label) && Number(system?.[mechanic]?.value) > 0)
      .map((mechanic) => hookProse(mechanic, system));
  return [species, career, ...hooks].filter(Boolean).join(" ");
}

/** Remove only the exact text emitted by earlier generators; keep owner writing untouched. */
export function separateLegacyBiography(system) {
  let biography = title(system?.biography), changed = false;
  const species = title(system?.species), career = title(system?.career);
  const generated = [
    species && `Species origin · ${species}\n${speciesBackgroundDefault(species)}`,
    career && `Career origin · ${career}\n${careerBackgroundDefault(career)}`,
    species && appendSpeciesStoryPrompts("", species),
    career && appendCareerStoryPrompts("", career),
    ...MECHANICS.map((mechanic) => {
      const sentence = mechanic === "morality"
        ? `${title(system?.morality?.strength)} guides difficult choices; ${title(system?.morality?.weakness)} may complicate them under pressure.`
        : `${title(system?.[mechanic]?.label)} can enter a future session as a person, pressure or promise the character must address.`;
      return `Story hook · ${mechanic[0].toUpperCase()}${mechanic.slice(1)}\n${sentence}`;
    }),
  ].filter(Boolean);
  for (const block of generated) if (biography.includes(block)) {
    biography = biography.replace(block, "").trim(); changed = true;
  }
  return { biography: biography.replace(/\n{3,}/g, "\n\n"), changed };
}
