export const SKILL_VIEWS = Object.freeze({
  grouped: "Grouped",
  alphabetical: "A–Z",
});

const customSection = (skills, column, label = "Custom") => ({
  label: column === 0 ? label : `${label} · continued`,
  skills,
  custom: label === "Custom",
  addCustom: column === 0,
});

export function buildSkillColumns(skills, customSkills, view = "grouped") {
  if (!Object.hasOwn(SKILL_VIEWS, view))
    throw new Error(`Unknown skill view: ${view}`);
  if (view === "alphabetical") {
    const ordered = [...skills, ...customSkills].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      ),
      base = Math.floor(ordered.length / 3),
      remainder = ordered.length % 3,
      columns = [];
    let offset = 0;
    for (let column = 0; column < 3; column += 1) {
      const length = base + (column < remainder ? 1 : 0),
        slice = ordered.slice(offset, offset + length);
      offset += length;
      columns.push({
        sections: [customSection(slice, column, "Alphabetical")],
      });
    }
    return columns;
  }
  const generalSkills = skills.filter((skill) => skill.category === "General"),
    generalSplit = Math.ceil(generalSkills.length / 2),
    customSkillColumns = [[], [], []];
  customSkills.forEach((skill, index) =>
    customSkillColumns[index % customSkillColumns.length].push(skill),
  );
  return [
    {
      sections: [
        { label: "General", skills: generalSkills.slice(0, generalSplit) },
        customSection(customSkillColumns[0], 0),
      ],
    },
    {
      sections: [
        { label: "General", skills: generalSkills.slice(generalSplit) },
        ...(customSkillColumns[1].length
          ? [customSection(customSkillColumns[1], 1)]
          : []),
      ],
    },
    {
      sections: [
        {
          label: "Combat",
          skills: skills.filter((skill) => skill.category === "Combat"),
        },
        {
          label: "Knowledge",
          skills: skills.filter((skill) => skill.category === "Knowledge"),
        },
        ...(customSkillColumns[2].length
          ? [customSection(customSkillColumns[2], 2)]
          : []),
      ],
    },
  ];
}
