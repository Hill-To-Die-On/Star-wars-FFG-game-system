import { bookAllowed } from "./rules.mjs";
import { referenceRuleLine } from "./character-origins.mjs";

export function specializationAllowed(item, campaign) {
  if (item?.type !== "specialization" || !bookAllowed(item.system?.source?.book, campaign)) return false;
  const line = referenceRuleLine(item);
  return !line || (campaign?.lines ?? []).includes(line);
}

/** Native prices also exclude already-owned specializations, including source-label variants. */
export function specializationChoices(actor, entries, campaign) {
  return Array.from(entries ?? []).flatMap(item => {
    if (!specializationAllowed(item, campaign)) return [];
    const id = String(item.id ?? item._id ?? "");
    if (!id) return [];
    try {
      const cost = actor.specializationPrice(item);
      return [{ id, name: item.name, cost, affordable: cost <= actor.system.xp.available,
        book: item.system?.source?.book ?? "", page: item.system?.source?.page ?? "" }];
    } catch { return []; }
  }).sort((a, b) => a.name.localeCompare(b.name) || a.book.localeCompare(b.book));
}
