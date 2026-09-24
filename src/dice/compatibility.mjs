import { DICE } from "./core.mjs";

export function normalizeNarrativeTerm(data) {
  if (typeof data?.class !== "string") return data;
  for (const [key, die] of Object.entries(DICE)) {
    const suffix = `${die.label}Die`;
    if (!data.class.endsWith(suffix) || data.faces !== die.faces.length)
      continue;
    const prefix = data.class.slice(0, -suffix.length);
    if (!/^[A-Z][A-Za-z0-9]*$/.test(prefix) || prefix === "StarWars") continue;
    const marker = `${prefix[0].toLowerCase()}${prefix.slice(1)}Die`;
    if (data.options?.[marker] !== key) continue;
    const options = { ...data.options, starWarsDie: key };
    delete options[marker];
    return { ...data, class: `StarWars${suffix}`, options };
  }
  return data;
}

const installed = new WeakSet();
export function registerDiceCompatibility(RollTerm) {
  if (installed.has(RollTerm)) return;
  const fromData = RollTerm.fromData;
  RollTerm.fromData = function (data) {
    return fromData.call(this, normalizeNarrativeTerm(data));
  };
  installed.add(RollTerm);
}
