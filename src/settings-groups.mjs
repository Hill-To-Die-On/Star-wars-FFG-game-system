/** Foundry keeps control of each setting; this only groups its existing rows. */
import { localize } from "./localization.mjs";

export const SETTINGS_GROUPS = Object.freeze([
  { label: "Campaign setup", key: "SWFFG.Settings.Groups.CampaignSetup", keys: ["campaignMenu", "ownedBooksMenu", "allowHomebrewIdentities"] },
  { label: "Appearance", key: "SWFFG.Settings.Groups.Appearance", keys: ["sheetTheme", "interfaceTheme", "compactChatDice", "altitudeShadows"] },
  { label: "Combat & turns", key: "SWFFG.Settings.Groups.CombatTurns", keys: ["turnTrackerControl", "automaticTurnRolls", "automaticTurnMovement", "combatRangeAssistant", "combatRangeFollowTurn", "animatedTargetTrace"] },
  { label: "Play tools", key: "SWFFG.Settings.Groups.PlayTools", keys: ["consoleMenu", "referenceMenu", "transactionAuthorityMenu"] },
  { label: "Imports & private sources", key: "SWFFG.Settings.Groups.ImportsSources", keys: ["integrationMenu", "libraryMenu", "adversariesMenu", "gmSourceLibraryMenu", "gmSourceKeyMenu"] },
  { label: "Help & diagnostics", key: "SWFFG.Settings.Groups.HelpDiagnostics", keys: ["aboutMenu", "supportMenu"] },
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
  const addGroup = (group, members) => {
    if (!members.length) return;
    const panel = document.createElement("fieldset");
    panel.className = "sf-settings-group";
    const legend = document.createElement("legend");
    legend.textContent = localize(group.key, group.label);
    panel.append(legend);
    for (const member of members) panel.append(member);
    parent.append(panel);
  };
  for (const group of SETTINGS_GROUPS) {
    const members = group.keys.map(key => byKey.get(key)).filter(Boolean);
    addGroup(group, members);
    for (const key of group.keys) byKey.delete(key);
  }
  addGroup({ key: "SWFFG.Settings.Groups.Other", label: "Other Star Wars settings" }, [...byKey.values()]);
}

export function registerSettingsGroups() {
  Hooks.on("renderSettingsConfig", (app, html) => {
    const root = html?.querySelectorAll ? html : app.element;
    groupSystemSettings(root);
  });
}
