const clean = (value, limit, label) => {
  const result = String(value ?? "").trim();
  if (result.length > limit)
    throw new Error(`${label} cannot exceed ${limit} characters.`);
  return result;
};

const cleanSource = (source = {}) => ({
  book: clean(source.book, 160, "Source book"),
  page: clean(source.page, 32, "Source page"),
  table: clean(source.table, 80, "Source table"),
  id: clean(source.id, 80, "Source id"),
});

export function normalizeMotivation(value, { id = value?.id } = {}) {
  const name = clean(value?.name, 160, "Motivation name");
  if (!name) throw new Error("A motivation needs a name.");
  const motivationId = clean(id, 64, "Motivation id");
  if (!motivationId) throw new Error("A motivation needs a stable id.");
  return {
    id: motivationId,
    name,
    category: clean(value?.category, 100, "Motivation category"),
    description: clean(value?.description, 4000, "Motivation guidance"),
    active: value?.active !== false,
    source: cleanSource(value?.source),
  };
}

export function appendMotivation(values, value, { id } = {}) {
  const motivations = Array.from(values ?? [], (entry) =>
      normalizeMotivation(entry),
    ),
    motivation = normalizeMotivation(value, { id });
  if (motivations.some((entry) => entry.id === motivation.id))
    throw new Error("Motivation ids must be unique.");
  return [...motivations, motivation];
}

export function replaceMotivation(values, id, value) {
  let found = false;
  const motivations = Array.from(values ?? [], (entry) => {
    const current = normalizeMotivation(entry);
    if (current.id !== id) return current;
    found = true;
    return normalizeMotivation(value, { id });
  });
  if (!found) throw new Error("Motivation was not found.");
  return motivations;
}

export function discardMotivation(values, id) {
  const motivations = Array.from(values ?? [], (entry) =>
      normalizeMotivation(entry),
    ),
    remaining = motivations.filter((entry) => entry.id !== id);
  if (remaining.length === motivations.length)
    throw new Error("Motivation was not found.");
  return remaining;
}

export function motivationSummary(system, { includeInactive = false } = {}) {
  const motivations = Array.from(system?.motivations ?? [])
    .filter((entry) => includeInactive || entry.active !== false)
    .map((entry) => {
      const name = String(entry.name ?? "").trim(),
        category = String(entry.category ?? "").trim();
      return name ? (category ? `${category}: ${name}` : name) : "";
    })
    .filter(Boolean);
  return motivations.join("; ") || String(system?.motivation ?? "").trim();
}
