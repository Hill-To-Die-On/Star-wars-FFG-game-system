export const STARTING_GROUP_ASSETS = Object.freeze([
  Object.freeze({ id: "edge-ship", line: "edge", kind: "vehicle", label: "Shared light freighter" }),
  Object.freeze({ id: "age-lambda", line: "age", kind: "vehicle", label: "Commandered Lambda-class shuttle" }),
  Object.freeze({ id: "age-y-wings", line: "age", kind: "vehicle", label: "Y-wing squadron" }),
  Object.freeze({ id: "age-base", line: "age", kind: "base", label: "Base of operations" }),
  Object.freeze({ id: "force-ship", line: "force", kind: "vehicle", label: "Shared starship" }),
  Object.freeze({ id: "force-holocron", line: "force", kind: "artifact", label: "Holocron" }),
  Object.freeze({ id: "force-mentor", line: "force", kind: "mentor", label: "Mentor" }),
]);

export function startingAssetOptions(campaign = {}) {
  const lines = new Set(campaign.lines ?? []);
  const ageChoice = `age-${campaign.ageStartingResource ?? "lambda"}`;
  return STARTING_GROUP_ASSETS.filter(option => lines.has(option.line) && (option.line !== "age" || option.id === ageChoice));
}

const field = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const validId = id => /^[A-Za-z0-9]+$/.test(id);

export function planStartingAsset(system, input, { campaign, vehicles = [], id, at } = {}) {
  const option = startingAssetOptions(campaign).find(candidate => candidate.id === input.choice);
  if (!option) throw new Error("Choose a starting asset supported by this campaign.");
  const name = field(input.name, 120), actorId = field(input.actorId, 80);
  if (!name) throw new Error("Name the starting group asset.");
  if (actorId && option.kind !== "vehicle") throw new Error("Only a vehicle starting asset can have a vehicle link.");
  if (actorId && !vehicles.some(actor => actor.id === actorId && actor.type === "vehicle"))
    throw new Error("Link a vehicle the group can access.");
  const asset = { choice: option.id, name, actorId, status: field(input.status, 80), description: field(input.description, 2000) };
  const current = system.startingAsset ?? {};
  const recorded = Object.values(system.resourceLedger ?? {}).some(entry => entry?.kind === "starting-asset" && entry.name === name);
  const existingAsset = recorded && current.choice === option.id && current.name === name && (!current.actorId || current.actorId === actorId);
  const change = { "system.startingAsset": asset };
  if (!existingAsset) {
    if (!validId(id) || system.resourceLedger?.[id]) throw new Error("A fresh resource ledger ID is required.");
    change[`system.resourceLedger.${id}`] = { kind: "starting-asset", name, change: 0,
      note: `${option.label}: ${name}${asset.description ? `. ${asset.description}` : ""}`, at: field(at, 80), scene: "" };
  }
  if (option.kind === "base" && !system.base?.name) change["system.base.name"] = name;
  return change;
}

export function sharedGearBalance(ledger = {}) {
  const gear = new Map();
  for (const entry of Object.values(ledger)) {
    if (entry?.kind !== "gear") continue;
    const name = field(entry.name, 120), key = name.toLocaleLowerCase();
    if (!name) continue;
    const current = gear.get(key) ?? { name, quantity: 0 };
    current.quantity += Number(entry.change) || 0;
    gear.set(key, current);
  }
  return [...gear.values()].filter(item => item.quantity > 0).sort((a, b) => a.name.localeCompare(b.name));
}

export function planResourceEntry(system, input, { id, at, scene = "" } = {}) {
  if (!validId(id) || system.resourceLedger?.[id]) throw new Error("A fresh resource ledger ID is required.");
  const kind = field(input.kind, 30), name = field(input.name, 120), note = field(input.note, 2000), change = Number(input.change ?? 0);
  if (!["credits", "gear", "note"].includes(kind)) throw new Error("Choose credits, gear, or a resource note.");
  if (!name) throw new Error("Name this resource change.");
  if (!Number.isSafeInteger(change) || Math.abs(change) > 1000000000000) throw new Error("Enter a whole resource change.");
  if (kind === "note" && change !== 0) throw new Error("A resource note cannot change a balance.");
  if (kind !== "note" && change === 0) throw new Error("Enter a non-zero credit or gear change.");
  const updates = { [`system.resourceLedger.${id}`]: { kind, name, change, note, at: field(at, 80), scene: field(scene, 120) } };
  if (kind === "credits") {
    const balance = Number(system.credits ?? 0);
    if (!Number.isSafeInteger(balance) || balance < 0) throw new Error("The group credit balance is invalid.");
    if (balance + change < 0) throw new Error("Insufficient shared credits.");
    updates["system.credits"] = balance + change;
  }
  if (kind === "gear" && change < 0) {
    const available = sharedGearBalance(system.resourceLedger ?? {}).find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())?.quantity ?? 0;
    if (available + change < 0) throw new Error(`Only ${available} ${name} available in the shared ledger.`);
  }
  return updates;
}
