import { availableTalents } from "./advancement.mjs";

const identity = (value) =>
  String(value ?? "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "");

const actorItems = (actor) =>
  Array.from(actor.items?.contents ?? actor.items ?? []);

const advancement = (actor) => Array.from(actor.system?.advancement ?? []);

export function signatureAttachmentCandidates(actor, ability) {
  const careers = new Set(
    Array.from(ability.system?.eligibleCareers ?? [], identity).filter(Boolean),
  );
  return actorItems(actor).filter(
    (item) =>
      item.type === "specialization" &&
      careers.has(identity(item.system?.career)),
  );
}

export function validateSignatureAttachment(actor, ability, specializationId) {
  if (ability.type !== "signatureAbility")
    throw new Error("Choose a signature ability.");
  const specialization = signatureAttachmentCandidates(actor, ability).find(
    (item) => item.id === specializationId,
  );
  if (!specialization)
    throw new Error(
      "This signature ability must attach to a specialization from its listed career.",
    );
  return specialization;
}

export function signatureLinkState(actor, ability) {
  const linkedId = String(ability.system?.linkedSpecializationId ?? ""),
    specialization = signatureAttachmentCandidates(actor, ability).find(
      (item) => item.id === linkedId,
    );
  if (!specialization)
    return {
      linked: false,
      unlocked: false,
      specialization: null,
      matchingNodeIds: [],
      purchasedMatchingNodeIds: [],
    };
  const nodes = Array.from(specialization.system?.tree?.nodes ?? []),
    lastRow = Math.max(-1, ...nodes.map((node) => Number(node.row))),
    matching = Array.from(ability.system?.matchingNodes ?? [], Boolean),
    matchingNodeIds = nodes
      .filter(
        (node) =>
          Number(node.row) === lastRow && matching[Number(node.col)] === true,
      )
      .map((node) => node.id),
    purchased = new Set(
      advancement(actor)
        .filter((entry) => entry.itemId === specialization.id)
        .map((entry) => entry.nodeId),
    ),
    purchasedMatchingNodeIds = matchingNodeIds.filter((id) =>
      purchased.has(id),
    );
  return {
    linked: true,
    unlocked: purchasedMatchingNodeIds.length > 0,
    specialization,
    matchingNodeIds,
    purchasedMatchingNodeIds,
  };
}

export function availableSignatureNodes(actor, ability) {
  if (
    ability.type !== "signatureAbility" ||
    ability.system?.tree?.verified !== true
  )
    return [];
  const purchased = advancement(actor)
    .filter((entry) => entry.itemId === ability.id)
    .map((entry) => entry.nodeId);
  const link = signatureLinkState(actor, ability);
  if (!link.linked || (!purchased.length && !link.unlocked)) return [];
  return availableTalents(ability.system.tree, purchased, []);
}

export function signatureAbilityStatus(actor, ability) {
  const link = signatureLinkState(actor, ability),
    purchased = advancement(actor).filter(
      (entry) => entry.itemId === ability.id && entry.nodeId,
    );
  return {
    name: ability.name,
    source: ability.system?.source ?? {},
    eligibleCareers: Array.from(ability.system?.eligibleCareers ?? []),
    category: String(ability.system?.abilityCategory ?? ""),
    verified: ability.system?.tree?.verified === true,
    linkedSpecializationId:
      link.specialization?.id ?? ability.system?.linkedSpecializationId ?? "",
    linkedSpecialization: link.specialization?.name ?? "",
    matchingNodeIds: link.matchingNodeIds,
    linkUnlocked: link.unlocked,
    purchased: purchased.map((entry) => ({
      nodeId: entry.nodeId,
      name: entry.name,
      cost: entry.cost,
    })),
    available: availableSignatureNodes(actor, ability).map((node) => ({
      id: node.id,
      name: node.name,
      cost: node.cost,
      activation: node.activation ?? "",
      summary: node.summary ?? "",
      effects: node.effects ?? [],
    })),
  };
}
