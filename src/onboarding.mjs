import { normalizeBookTitle, validateCampaign } from "./rules.mjs";
export const ONBOARDING_VERSION = 1;
export const BOOKSHELF_STORAGE_KEY = "star-wars-ffg.bookshelf.v1";
export const COPYRIGHT_REMINDER = "Use books and PDFs you lawfully own or have permission to use. The catalogue supplies references and structured data, not the rulebooks. Do not distribute copyrighted PDFs, scans, book text or artwork without permission. Selecting a book is a catalogue filter; it does not grant a licence to copy or share it.";
export function normalizeBookshelf(value) {
  if (!value || !Array.isArray(value.books) || value.books.length > 500 || value.books.some(book => typeof book !== "string" || book.length > 200)) return null;
  const seen = new Set(), books = [];
  for (const entry of value.books) {
    const book = entry.trim(), key = normalizeBookTitle(book);
    if (key && !seen.has(key)) { seen.add(key); books.push(book); }
  }
  return { version: 1, books, bookMode: value.bookMode === "all" ? "all" : "owned", includeUnreferenced: value.includeUnreferenced === true };
}
export const bookshelfFromCampaign = campaign => normalizeBookshelf({ ...campaign, books: campaign.books ?? [] });
const fingerprint = value => JSON.stringify({ ...value, books: value.books.map(normalizeBookTitle).sort() });
export function applyBookshelf(current, draft, expected) {
  if (expected && fingerprint(bookshelfFromCampaign(current)) !== fingerprint(expected)) throw new Error("The campaign bookshelf changed in another window. Reopen setup before saving.");
  const profile = normalizeBookshelf(draft);
  if (!profile) throw new Error("Choose a valid bookshelf.");
  const { version, ...books } = profile;
  return validateCampaign({ ...current, ...books });
}
export const needsOnboarding = progress => !(Number(progress?.version) >= ONBOARDING_VERSION);
export function readRememberedBooks(storage) {
  try { return normalizeBookshelf(JSON.parse(storage.getItem(BOOKSHELF_STORAGE_KEY))); } catch { return null; }
}
export function rememberBooks(storage, profile) {
  try {
    if (profile === null) storage.removeItem(BOOKSHELF_STORAGE_KEY);
    else { const normalized = normalizeBookshelf(profile); if (!normalized) return false; storage.setItem(BOOKSHELF_STORAGE_KEY, JSON.stringify(normalized)); }
    return true;
  } catch { return false; }
}
export const INTERFACE_TOUR = [
  {id:"welcome",title:"Your Star Wars table",content:"<p>Foundry still manages scenes, actors, journals and permissions. This short tour covers the controls added by Star Wars FFG. Exit at any time; replay it from Settings → Welcome & interface tour.</p>"},
  {id:"dice",title:"Narrative dice beside chat",sidebarTab:"chat",target:".sf-compact-dice",content:"<p>The compact tray adds the seven narrative dice. Click to add; Shift-click or right-click to remove. The chat visibility control also applies to these rolls. Disable the tray under Appearance & accessibility if preferred.</p><p>On a character sheet, click a skill to build its pool. Auto considers the actor and supported effects; Modify and Manual let the table review difficulty and situational dice before rolling.</p>"},
  {id:"actors",title:"Characters, vehicles and the group",sidebarTab:"actors",target:"#actors",content:"<p>Create a character, adversary, vehicle or group from Actors. Sheets add guided creation, book-filtered origins, clickable skills, connected talent trees and action/manoeuvre indicators. Vehicle sheets add Crew & Passengers; double-click a crew portrait to open its sheet.</p><p>Source references and unresolved rules remain visible. Missing automation calls for a GM ruling.</p>"},
  {id:"range",title:"Ranges and targeting",target:"#scene-controls",content:"<p>The Star Wars scene controls manage range bands, single/multiple origins and Theatre-of-the-Mind calibration. Personal and vehicle ranges follow the attacker and scene.</p><p>Targeting shows a legal firing path, range, defence and a pool preview. Choose Send dice to pool to review it before rolling. Vehicles also offer weapon, gunner and firing/defence arc choices.</p>"},
  {id:"combat",title:"Combat at the table",sidebarTab:"combat",target:"#combat",content:"<p>Combat adds shared initiative slots, selected-token action/manoeuvre lights, linked minion groups and vehicle crew workflows. The GM chooses whether players may manage their indicators.</p><p>Chat tools review narrative-symbol spending, damage and recovery. A proposal is not an applied effect; read the preview and source before approving.</p>"},
  {id:"journals",title:"Journals and reference material",sidebarTab:"journal",target:"#journal",content:"<p>Journals use the system's paper-and-datapad styling. The Artwork credits journal records the interface art source. The reference catalogue locates book/page entries from the campaign's bookshelf.</p><p>PDF adventure import is an optional Director of Realms feature. It is not needed to play this system with a human GM.</p>"},
  {id:"settings",title:"Settings, help and replay",sidebarTab:"settings",target:"#settings",content:"<p>Configure Settings groups setup, appearance, combat automation, reference tools, imports and help. World settings belong to the GM; client settings affect this browser.</p><p>Help & rules coverage explains automation limits. The GM selects a Transaction authority browser for shared changes. Replay this tour or reopen book setup from Welcome & interface tour.</p>"}
];

export function getBookshelfStorage() { try { return globalThis.localStorage; } catch { return undefined; } }
