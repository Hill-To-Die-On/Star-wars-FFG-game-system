/** Presentation-only grouping: Foundry retains the original inputs, permissions, search and save handler. */
export const SETTINGS_GROUPS = [
  {id:"setup",label:"1 · Campaign setup",keys:["welcomeMenu","campaignMenu","ownedBooksMenu","allowHomebrewIdentities"]},
  {id:"appearance",label:"2 · Appearance & accessibility",keys:["sheetTheme","interfaceTheme","compactChatDice","altitudeShadows"]},
  {id:"combat",label:"3 · Combat & turn automation",keys:["turnTrackerControl","automaticTurnRolls","automaticTurnMovement","combatRangeAssistant","combatRangeFollowTurn","animatedTargetTrace"]},
  {id:"play",label:"4 · Play tools & references",keys:["consoleMenu","referenceMenu"]},
  {id:"imports",label:"5 · Imports & private sources",keys:["integrationMenu","libraryMenu","adversariesMenu","gmSourceLibraryMenu","gmSourceKeyMenu"],advanced:true},
  {id:"help",label:"6 · Help & diagnostics",keys:["supportMenu"]}
];
export function groupSystemSettings(root) {
  if(root.querySelector(".sf-settings-group"))return;
  const rows=[...root.querySelectorAll(".form-group")].filter(row=>row.querySelector('[name^="star-wars-ffg."], [data-key^="star-wars-ffg."]'));
  if(!rows.length)return;
  const parent=rows[0].parentElement;
  if(parent.querySelector(":scope > .sf-settings-group"))return;
  const byKey=new Map(rows.map(row=>{const field=row.querySelector('[name^="star-wars-ffg."], [data-key^="star-wars-ffg."]');return[(field.name||field.dataset.key).split(".").at(-1),row];}));
  for(const group of SETTINGS_GROUPS) {
    const members=group.keys.map(key=>byKey.get(key)).filter(Boolean);
    if(!members.length)continue;
    // Native search re-renders filtered category content. Never collapse matching results.
    const container=document.createElement("fieldset");container.className="sf-settings-group";
    const legend=document.createElement("legend");legend.textContent=group.label;container.append(legend);
    for(const row of members)container.append(row);
    for(const key of group.keys)byKey.delete(key);
    parent.append(container);
  }
  for(const row of byKey.values())parent.append(row);
}
export function styleSystemWindow(app, html) {
  const root=html instanceof HTMLElement ? html : app.element;
  if(!root?.classList || !root.matches(".application,.app"))return;
  const name=app.constructor?.name??"";
  const configuration=root.classList.contains("sf-native-settings") || name.includes("Config") || root.id==="settings-config" || root.classList.contains("config");
  if(configuration) {
    root.classList.add("sf-native-settings");root.classList.remove("star-wars","sf-themed-window");
    return;
  }
  const journal=root.matches(".journal-sheet,.journal-entry-sheet,.journal-entry-page") || name.includes("Journal");
  if(journal && !document.body.dataset.starWarsTheme) {
    root.classList.remove("star-wars","sf-themed-window","sf-journal-window");
    delete root.dataset.theme;
    return;
  }
  const system=root.classList.contains("star-wars") || root.id.startsWith("star-wars-") || [...root.classList].some(c=>c.startsWith("sf-"));
  const dialog=name==="DialogV2" || root.matches("dialog.application");
  if(system || dialog || (journal && document.body.dataset.starWarsTheme)) {
    root.classList.add("star-wars","sf-themed-window");
    if(journal)root.classList.add("sf-journal-window");
    if(journal || !root.dataset.theme)root.dataset.theme=document.body.dataset.starWarsTheme??"frontier";
  }
}
export function refreshWindowPresentation() {
  for(const app of foundry.applications.instances.values())if(app.rendered)styleSystemWindow(app,app.element);
}
export function registerWindowPresentation() {
  Hooks.on("renderApplicationV2",styleSystemWindow);
  Hooks.on("renderApplication",styleSystemWindow);
  Hooks.on("renderSettingsConfig",(app,html)=>{styleSystemWindow(app,html);groupSystemSettings(html instanceof HTMLElement ? html : app.element);});
}
