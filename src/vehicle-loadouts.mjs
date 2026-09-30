import { SYSTEM_ID } from "./config.mjs";

const dataOf = item => item?.toObject?.() ?? item;
const idOf = item => item.id ?? item._id;
const marker = item => item?.flags?.[SYSTEM_ID]?.vehicleMount;
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const fingerprint = item => {
  const system = item.system ?? {};
  return JSON.stringify(stable({ name: item.name, type: item.type,
    text: Object.fromEntries(["description", "skill", "damage", "range", "qualities", "scale"].map(k => [k, String(system[k] ?? "")])),
    numbers: Object.fromEntries(["price", "rarity", "encumbrance", "hardpoints", "critical"].map(k => [k, Number(system[k] ?? 0)])),
    quantity: Number(system.quantity ?? 1), equipped: !!system.equipped, restricted: !!system.restricted,
    effects: system.effects ?? [], metadata: system.metadata ?? {},
    source: Object.fromEntries(["table", "id", "book", "page"].map(k => [k, String(system.source?.[k] ?? "")])),
    incomplete: system.incomplete ?? [],
  }));
};
const mountKey = item => { const m = marker(item); return m ? `${m.vehicleId}:${m.mountId}` : null; };

export function stampVehicleMount(item) {
  const copy = structuredClone(dataOf(item));
  copy.flags ??= {}; copy.flags[SYSTEM_ID] ??= {};
  copy.flags[SYSTEM_ID].vehicleMountSnapshot = fingerprint(copy);
  return copy;
}

export function planVehicleLoadout(entry, actor) {
  const current = Array.from(actor.items ?? []).map(dataOf);
  const wanted = Array.from(entry.items ?? []).map(dataOf).filter(item => marker(item));
  const desired = new Map(wanted.map(item => [mountKey(item), item]));
  const remove = [];
  for (const item of current) {
    const key = mountKey(item);
    if (!key) continue;
    const untouched = !Array.from(item.effects ?? []).length &&
      item.flags?.[SYSTEM_ID]?.vehicleMountSnapshot === fingerprint(item);
    if (desired.has(key)) {
      if (!untouched || fingerprint(item) === fingerprint(desired.get(key))) desired.delete(key);
      else remove.push(idOf(item));
    } else if (untouched) remove.push(idOf(item));
  }
  return { remove, create: [...desired.values()].map(item => {
    const copy = stampVehicleMount(item); delete copy._id; delete copy.id; return copy;
  }) };
}

// Only untouched defaults are replaced. Hand-added weapons, modifications and
// active effects survive a model change. Repeat selection cannot duplicate guns.
export async function applyVehicleLoadout(actor, entry) {
  const plan = planVehicleLoadout(entry, actor);
  const batch = globalThis.crypto.randomUUID();
  const old = Array.from(actor.items ?? []).map(dataOf).filter(item => plan.remove.includes(idOf(item)));
  try {
    for (const item of plan.create) {
      item.flags[SYSTEM_ID].vehicleLoadoutBatch = batch;
      await actor.createEmbeddedDocuments("Item", [item]);
    }
    if (plan.remove.length) await actor.deleteEmbeddedDocuments("Item", plan.remove);
    return plan;
  } catch (error) {
    try {
      const added = Array.from(actor.items ?? []).filter(item => item.flags?.[SYSTEM_ID]?.vehicleLoadoutBatch === batch).map(idOf);
      if (added.length) await actor.deleteEmbeddedDocuments("Item", added);
      const missing = old.filter(item => !Array.from(actor.items ?? []).some(current => idOf(current) === idOf(item)));
      if (missing.length) await actor.createEmbeddedDocuments("Item", missing, { keepId: true });
    } catch {
      error.message += " Some weapon changes could not be rolled back; inspect the vehicle inventory before retrying.";
      error.rollbackIncomplete = true;
    }
    throw error;
  }
}
