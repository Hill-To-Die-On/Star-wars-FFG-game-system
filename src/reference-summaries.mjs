const value = (input) => String(input ?? "").trim();
const numeric = (input) => input !== null && input !== undefined &&
  value(input) !== "" && /^[-+]?\d+(?:\.\d+)?$/.test(value(input));
const field = (row, ...keys) => keys.map((key) => row?.[key]).find((entry) => value(entry));
const short = (input) => value(input).replace(/\s+/g, " ").slice(0, 100);
const sentence = (parts) => parts.length
  ? `Recorded values: ${parts.join(", ")}.`
  : "Other properties are not recorded.";

// Original catalogue summaries use bounded structured fields. Source prose and
// unreviewed effect strings are intentionally excluded.
export function referenceSummary(table, row = {}) {
  if (table === "species") {
    const characteristics = ["Brawn", "Agility", "Intellect", "Cunning", "Willpower", "Presence"]
      .filter((key) => numeric(row[key])).map((key) => `${key} ${row[key]}`);
    const starting = [
      ...(numeric(row.Wound_Base) ? [`wound base ${row.Wound_Base}`] : []),
      ...(numeric(row.Strain_Base) ? [`strain base ${row.Strain_Base}`] : []),
      ...(numeric(row.XP) ? [`starting XP ${row.XP}`] : []),
    ];
    if (!characteristics.length && !starting.length)
      return "Species starting values are not recorded. Abilities and exceptions need source review.";
    return [
      characteristics.length ? `Starting characteristics: ${characteristics.join(", ")}.` : "",
      starting.length ? `Recorded bases: ${starting.join(", ")}.` : "",
      "Abilities and exceptions need source review.",
    ].filter(Boolean).join(" ");
  }
  if (table === "vehicles") {
    const hull = short(field(row, "Hull", "Purpose")) || "Vehicle";
    const maker = short(row.Manufacturer);
    const crew = short(row.Crew);
    const intro = `A ${hull}${maker ? ` listed with ${maker} as manufacturer` : ""}${crew ? ` and a crew of ${crew}` : ""}.`;
    const profile = [
      ["Silhouette", "silhouette"], ["Armor", "armor"],
      ["Speed", "speed"], ["Handling", "handling"],
    ].filter(([key]) => numeric(row[key])).map(([key, label]) => `${label} ${row[key]}`);
    const status = value(row.Weapons_Status);
    return [intro, profile.length ? `Recorded profile: ${profile.join(", ")}.` : "Profile statistics are not recorded.",
      status === "source review required" ? "Standard armament needs source review." : ""].filter(Boolean).join(" ");
  }
  if (table === "equipment") {
    const category = short(row.Equipment_Type) || "Gear";
    const career = short(row.Career);
    const properties = [
      ["Price", "cr"], ["Encumbrance", "encumbrance"], ["Rarity", "rarity"],
    ].filter(([key]) => numeric(row[key])).map(([key, label]) =>
      label === "cr" ? `${row[key]} cr` : `${label} ${row[key]}`);
    return `${category} equipment${career ? ` catalogued with ${career}` : ""}. ${sentence(properties)}`;
  }
  if (["weapons", "vehicle_weapons"].includes(table)) {
    const skill = short(row.Skill);
    const properties = [
      ["Damage", "damage"], ["Critical", "critical"],
    ].filter(([key]) => value(row[key])).map(([key, label]) => `${label} ${short(row[key])}`);
    const range = short(field(row, "Range", "Weapon_Range"));
    if (range) properties.push(`${range} range`);
    const qualities = short(row.Qualities);
    if (qualities) properties.push(qualities);
    return `${table === "vehicle_weapons" ? "Vehicle" : "Personal"} weapon${skill ? ` using ${skill}` : ""}. ${sentence(properties)}`;
  }
  if (table === "armour") {
    const properties = [["Soak", "soak"], ["Defense", "defense"], ["Encumbrance", "encumbrance"]]
      .filter(([key]) => numeric(row[key])).map(([key, label]) => `${label} ${row[key]}`);
    return `Armor. ${sentence(properties)}`;
  }
  if (["attachments", "vehicle_attachments"].includes(table)) {
    const kind = short(field(row, "Attachment_Type", "Vehicle_Category"));
    const points = field(row, "HP_Required", "HP");
    const properties = [
      ...(numeric(points) ? [`${points} hard point${Number(points) === 1 ? "" : "s"}`] : []),
      ...(numeric(row.Price) ? [`${row.Price} cr`] : []),
      ...(numeric(row.Rarity) ? [`rarity ${row.Rarity}`] : []),
    ];
    return `${kind ? `${kind} attachment` : "Attachment"}. ${sentence(properties)}`;
  }
  return "";
}
