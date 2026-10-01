import { groupSystemSettings } from "./settings-groups.mjs";
export { SETTINGS_GROUPS, groupSystemSettings } from "./settings-groups.mjs";

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
