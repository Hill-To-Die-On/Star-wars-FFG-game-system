import { INTEGRATION_FORMAT, validateIntegrationPackage } from "./integration-protocol.mjs";

const reviews = new WeakMap();
const restoring = new WeakSet();
const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
// A local ownership label is not a book edition. Strip only this exact terminal label.
const sourceBookIdentity = (value) => normalize(value).replace(/ - owned playtest copy$/, "");
const specializationIdentity = (value) => normalize(String(value ?? "").replace(/\s+\([^)]*\)$/, ""));
const itemsFor = (actor) => Array.from(actor.items ?? []);
const snapshot = (actor) => JSON.stringify({
  uuid: actor.uuid, name: actor.name, type: actor.type, system: actor.system,
  items: itemsFor(actor).map(item => item.toObject ? item.toObject() : item),
});

function assertGM(actor, user) {
  if (!user?.isGM || !actor?.isOwner) throw new Error("Only a GM with access to this sheet can restore starter advancement.");
  if (actor.type !== "character" || !actor.uuid) throw new Error("Choose a saved player character sheet.");
}

function validateRecord(value) {
  if (!value || !/^[a-zA-Z0-9]{16}$/.test(value._id ?? "") || Object.keys(value).some(key => !["_id", "name", "type", "system", "img"].includes(key)) || value.type !== "specialization")
    throw new Error("Choose one native starter specialization JSON, without embedded effects or other documents.");
  const record = validateIntegrationPackage({
    format: INTEGRATION_FORMAT, version: 1, kind: "rulePack",
    source: { id: "private-starter-restoration", name: "Private starter restoration" },
    payload: { id: "starter", name: "Starter", version: "1", rules: [{
      key: "starter", name: value.name, type: value.type, system: value.system,
      ...(value.img ? { img: value.img } : {}),
    }] },
  }).payload.rules[0];
  delete record.key;
  const { tree, source, metadata } = record.system;
  const provenance = metadata?.starterCareerTree;
  if (provenance?.schema !== 1 || !String(provenance.character ?? "").trim() ||
      !String(provenance.sourceFilename ?? "").trim() || !/^[a-f0-9]{64}$/i.test(provenance.sourceSha256 ?? "") ||
      !Number.isInteger(provenance.physicalPdfPage) || provenance.physicalPdfPage < 1 ||
      !Number.isInteger(provenance.folioIdentityPage) || provenance.folioIdentityPage < 1 ||
      !normalize(source?.book) || String(source?.page) !== String(provenance.physicalPdfPage) ||
      !normalize(record.system.career))
    throw new Error("Starter JSON needs character, career, PDF filename/hash, identity page and matching physical chart page provenance.");
  if (!tree?.nodes?.length || typeof tree.verified !== "boolean" ||
      (tree.source && (normalize(tree.source.book) !== normalize(source.book) || String(tree.source.page) !== String(source.page))))
    throw new Error("Starter JSON needs a nonempty native tree with matching source and explicit verification status.");
  if (Object.keys(record.system).some(key => !["career", "careerSkills", "tree", "source", "metadata", "incomplete"].includes(key)) ||
      ["purchased", "owned", "purchasedIds"].some(key => Object.hasOwn(tree, key)) || tree.nodes.some(node => node.purchased || node.owned) ||
      metadata.starterRestoration)
    throw new Error("Restore only an unpurchased starter tree; purchased or previously restored records need individual review.");
  return { record, sourceId: value._id, provenance };
}

function assertActorMatch(actor, record, sourceId, provenance) {
  const name = normalize(actor.name), character = normalize(provenance.character);
  const suffix = name.slice(character.length);
  if (name !== character && !(name.startsWith(character) && /^(?: \([^\n]+\)| \[[^\n]+\]| [–—-] .+| copy(?: \d+)?)$/.test(suffix)))
    throw new Error("The named source character does not match this actor. Open that character's sheet.");
  if (normalize(actor.system.career) !== normalize(record.system.career))
    throw new Error("The source career does not match this actor.");
  if (normalize(actor.system.source?.book) && sourceBookIdentity(actor.system.source.book) !== sourceBookIdentity(record.system.source.book))
    throw new Error("The actor and starter chart cite conflicting source books.");
  const priorSource = actor.system.metadata?.starterCareerTree;
  if (priorSource && (priorSource.sourceSha256 !== provenance.sourceSha256 || normalize(priorSource.character) !== character))
    throw new Error("The actor has conflicting starter source provenance.");
  const nodeIds = new Set(record.system.tree.nodes.map(node => node.id));
  if ((actor.system.advancement ?? []).some(entry => nodeIds.has(entry.nodeId) || (sourceId && entry.itemId === sourceId) || normalize(entry.name) === normalize(record.name)))
    throw new Error("Existing advancement purchases conflict with this unpurchased starter record.");
  if (itemsFor(actor).some(item => item.id === sourceId || item._id === sourceId || (item.type === "specialization" && (
    specializationIdentity(item.name) === specializationIdentity(record.name) ||
    normalize(item.system?.metadata?.starterCareerTree?.character) === character ||
    (normalize(item.system?.career) === normalize(record.system.career) && normalize(item.name) === normalize(record.system.career)) ||
    item.system?.tree?.nodes?.some(node => nodeIds.has(node.id))
  )))) throw new Error("This starter tree is already attached or conflicts with an existing specialization. No item was changed.");
}

/** Review one owned source record. This never creates an item or spends XP. */
export function reviewStarterAdvancement(actor, value, user) {
  assertGM(actor, user);
  const { record, sourceId, provenance } = validateRecord(value);
  assertActorMatch(actor, record, sourceId, provenance);
  const tree = record.system.tree;
  const linked = new Set(tree.edges.flat());
  const review = {
    actorUuid: actor.uuid, actorName: actor.name, character: provenance.character,
    career: record.system.career, name: record.name, source: structuredClone(record.system.source),
    filename: provenance.sourceFilename, sourceSha256: provenance.sourceSha256,
    identityPage: provenance.folioIdentityPage, page: provenance.physicalPdfPage,
    nodes: tree.nodes.length, links: tree.edges.length,
    isolatedNodes: tree.nodes.filter(node => !node.entry && !linked.has(node.id)).length,
    readOnly: !tree.verified, heldReason: provenance.heldReason ?? "",
    nodeReview: tree.nodes.map(node => ({ name: node.name, cost: node.cost, row: node.row, col: node.col })),
  };
  reviews.set(review, { actor, snapshot: snapshot(actor), record, sourceId, provenance });
  return review;
}

/** Attach only the reviewed missing item. Never call acquisition, purchase or actor.update. */
export async function restoreStarterAdvancement(actor, review, confirmation, user) {
  assertGM(actor, user);
  const state = reviews.get(review);
  if (!state || state.actor !== actor || confirmation?.actorUuid !== actor.uuid ||
      confirmation?.character !== state.provenance.character || confirmation?.sourceReviewed !== true)
    throw new Error("Confirm this actor's identity and owned PDF source before restoration.");
  if (restoring.has(actor)) throw new Error("Starter restoration is already in progress for this actor.");
  if (snapshot(actor) !== state.snapshot) throw new Error("This actor changed after review. Review the file again before restoring.");
  assertActorMatch(actor, state.record, state.sourceId, state.provenance);
  restoring.add(actor);
  reviews.delete(review);
  const before = JSON.stringify({ xp: actor.system.xp, advancement: actor.system.advancement });
  const record = structuredClone(state.record);
  // Retain the stable source ID so another GM cannot attach the same record under a new ID.
  record._id = state.sourceId;
  record.system.metadata.starterRestoration = {
    actorUuid: actor.uuid, actorName: actor.name, sourceRecordId: state.sourceId ?? "",
    character: state.provenance.character, sourceSha256: state.provenance.sourceSha256,
    unpurchased: true,
  };
  try {
    const created = await actor.createEmbeddedDocuments("Item", [record], { keepId: true });
    const item = created?.[0];
    if (created?.length !== 1 || !item || item.name !== record.name || item.type !== "specialization" ||
        item.system.career !== record.system.career ||
        ["book", "page", "table", "id"].some(key => String(item.system.source?.[key] ?? "") !== String(record.system.source?.[key] ?? "")) ||
        JSON.stringify(item.system.tree) !== JSON.stringify(record.system.tree) ||
        item.system.metadata?.starterRestoration?.actorUuid !== actor.uuid ||
        JSON.stringify({ xp: actor.system.xp, advancement: actor.system.advancement }) !== before)
      throw new Error("Restoration is incomplete or actor state changed. Inspect the sheet before trying again; no automatic retry was made.");
    return item;
  } catch (error) {
    throw new Error(`Starter restoration could not be confirmed. Inspect the sheet before retrying: ${error.message}`);
  } finally {
    restoring.delete(actor);
  }
}
