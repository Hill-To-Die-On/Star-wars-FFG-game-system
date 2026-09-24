/** Shared records have no combat statistics; Destiny always comes from world state. */
export function groupSummary(system, destiny = { light: 0, dark: 0 }) {
  const members = Object.entries(system.members ?? {}).map(([id, member]) => ({
    id,
    ...member,
  }));
  return {
    base: { ...system.base },
    members,
    obligationTotal: members.reduce(
      (sum, member) => sum + (Number(member.obligation) || 0),
      0,
    ),
    dutyTotal: members.reduce(
      (sum, member) => sum + (Number(member.duty) || 0),
      0,
    ),
    credits: system.credits,
    resources: system.resources,
    possessions: system.possessions,
    contacts: system.contacts,
    notes: system.notes,
    destiny: { ...destiny },
  };
}
export function memberFromCharacter(actor, member = {}) {
  if (actor.type !== "character")
    throw new Error("Link a player character to this group record.");
  const s = actor.system;
  return {
    ...member,
    actorId: actor.id,
    characterName: actor.name,
    obligation: s.obligation.value,
    obligationType: s.obligation.label,
    motivation: s.motivation,
    duty: s.duty.value,
    dutyType: s.duty.label,
    morality: s.morality.value,
  };
}
