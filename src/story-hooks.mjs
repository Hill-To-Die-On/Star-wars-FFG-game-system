import { bookAllowed } from "./rules.mjs";

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
  if (/^roll twice$/i.test(title(entry.name))) return { mechanic, roll, rollTwice: true, source };
  if (mechanic === "morality") {
    const strength = title(metadata.Emotional_Strength), weakness = title(metadata.Emotional_Weakness);
    if (!strength || !weakness) throw new Error("The selected Morality result is incomplete.");
    return { mechanic, roll, strength, weakness, source };
  }
  const label = title(mechanic === "duty" ? metadata.Duty_Type : metadata.Obligation);
  if (!label) throw new Error(`The selected ${mechanic} result is incomplete.`);
  return { mechanic, roll, label, source };
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
  const result = structuredClone(system), added = [];
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
      result.creation.storyRolls.push({ mechanic, roll: hook.roll, rolls: hook.rolls ?? [hook.roll], source: hook.source });
    const heading = `Story hook · ${mechanic[0].toUpperCase()}${mechanic.slice(1)}`;
    if (!String(result.biography ?? "").includes(heading)) {
      const sentence = mechanic === "morality"
        ? `${result.morality.strength} guides difficult choices; ${result.morality.weakness} may complicate them under pressure.`
        : `${result[mechanic].label} can enter a future session as a person, pressure or promise the character must address.`;
      added.push(`${heading}\n${sentence}`);
    }
  }
  result.biography = [title(result.biography), ...added].filter(Boolean).join("\n\n");
  return result;
}
