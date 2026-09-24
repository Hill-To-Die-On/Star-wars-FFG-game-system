const LABELS = {
  Item: "Equipment & advancement",
  Actor: "Actors & vehicles",
  JournalEntry: "Places & references",
  GMNotes: "Private GM source notes",
};

export function libraryPackName(kind) {
  if (!Object.hasOwn(LABELS, kind)) throw new Error("Unknown library kind.");
  return `star-wars-${kind === "GMNotes" ? "gm-notes" : kind.toLowerCase()}`;
}

export const libraryPackLabel = (kind) => `Star Wars FFG · ${LABELS[kind]}`;

function matchesLibrary(pack, kind) {
  const suffix = kind === "GMNotes" ? "gm-notes" : kind.toLowerCase();
  const labels = kind === "Actor" ? [LABELS.Actor, "Vehicles"] : [LABELS[kind]];
  return (
    pack.collection.startsWith("world.") &&
    pack.collection.endsWith(`-${suffix}`) &&
    pack.documentName === (kind === "GMNotes" ? "JournalEntry" : kind) &&
    labels.some((label) => pack.metadata.label.endsWith(` · ${label}`))
  );
}

export function getLibraryPack(kind, packs = game.packs) {
  const current = packs.get(`world.${libraryPackName(kind)}`);
  if (current) return current;
  // Identify an existing library by its purpose, not its old branding prefix.
  // Reuse its persisted ID so document UUIDs and encrypted notes stay valid.
  const matches = [...packs.values()].filter((pack) =>
    matchesLibrary(pack, kind),
  );
  if (matches.length > 1)
    throw new Error(
      `Multiple ${LABELS[kind]} libraries found; resolve the duplicate packs before importing.`,
    );
  return matches[0];
}

export function refreshLibraryLabels(packs = game.packs) {
  for (const pack of packs.values())
    for (const kind of Object.keys(LABELS))
      if (
        pack.collection === `world.${libraryPackName(kind)}` ||
        matchesLibrary(pack, kind)
      )
        pack.metadata.label = libraryPackLabel(kind);
}
