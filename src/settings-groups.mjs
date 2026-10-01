/** Foundry keeps control of each setting; this only groups its existing rows. */
export const SETTINGS_GROUPS = Object.freeze([
  { label: "Campaign setup", keys: ["campaignMenu", "ownedBooksMenu", "allowHomebrewIdentities"] },
  { label: "Appearance", keys: ["sheetTheme", "interfaceTheme", "compactChatDice", "altitudeShadows"] },
  { label: "Combat & turns", keys: ["turnTrackerControl", "automaticTurnRolls", "automaticTurnMovement", "combatRangeAssistant", "combatRangeFollowTurn", "animatedTargetTrace"] },
  { label: "Play tools", keys: ["consoleMenu", "referenceMenu", "transactionAuthorityMenu"] },
  { label: "Imports & private sources", keys: ["integrationMenu", "libraryMenu", "adversariesMenu", "gmSourceLibraryMenu", "gmSourceKeyMenu"] },
  { label: "Help & diagnostics", keys: ["aboutMenu", "supportMenu"] },
]);

export function groupSystemSettings(root) {
  if (!root?.querySelectorAll || root.querySelector(".sf-settings-group")) return;
  const rows = [...root.querySelectorAll(".form-group")].map(row => ({
    row,
    field: row.querySelector('[name^="star-wars-ffg."], [data-key^="star-wars-ffg."]'),
  })).filter(item => item.field);
  if (!rows.length) return;
  const parent = rows[0].row.parentElement;
  const byKey = new Map(rows.filter(item => item.row.parentElement === parent).map(({ row, field }) => [(field.name || field.dataset.key).split(".").at(-1), row]));
  if (!byKey.size) return;
  root.classList.add("sf-native-settings");
  const addGroup = (label, members) => {
    if (!members.length) return;
    const panel = document.createElement("fieldset");
    panel.className = "sf-settings-group";
    const legend = document.createElement("legend");
    legend.textContent = label;
    panel.append(legend);
    for (const member of members) panel.append(member);
    parent.append(panel);
  };
  for (const group of SETTINGS_GROUPS) {
    const members = group.keys.map(key => byKey.get(key)).filter(Boolean);
    addGroup(group.label, members);
    for (const key of group.keys) byKey.delete(key);
  }
  addGroup("Other Star Wars settings", [...byKey.values()]);
}

export function registerSettingsGroups() {
  Hooks.on("renderSettingsConfig", (app, html) => {
    const root = html?.querySelectorAll ? html : app.element;
    groupSystemSettings(root);
  });
}
