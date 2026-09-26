import { SYSTEM_ID, SYSTEM_PATH, THEMES, ITEM_TYPES } from "./config.mjs";
import {
  CharacterData,
  AdversaryData,
  VehicleData,
  GroupData,
  ItemData,
} from "./models.mjs";
import { GroupSheet, refreshGroupSheets } from "./group-sheet.mjs";
import { StarWarsActor, StarWarsItem } from "./documents.mjs";
import {
  StarWarsActorSheet,
  StarWarsItemSheet,
  importDialog,
  importSwaDialog,
  campaignDialog,
} from "./sheets.mjs";
import { registerDice, registerDiceSoNice, rollPool } from "./dice/foundry.mjs";
import {
  refreshCompactChatDice,
  registerCompactChatDice,
} from "./dice/compact-tray.mjs";
import {
  DEFAULT_CAMPAIGN,
  resolveInterfaceTheme,
} from "./rules.mjs";
import { directorAdapter, actorContext } from "./director-adapter.mjs";
import { ensureArtworkCreditsJournal } from "./artwork-credits.mjs";
import { importLibrary, refreshLibraryLabels } from "./library.mjs";
import { convertSwa } from "./swa-import.mjs";
import { convertSwaSource } from "./swa-source.mjs";
import { DICE } from "./dice/core.mjs";
import { StarWarsCombat } from "./combat.mjs";
import {
  refreshGMNotes,
  searchGMSourceNotes,
  gmSourceKeyDialog,
  gmSourceLibrary,
} from "./gm-notes.mjs";
import {
  openReferenceBrowser,
  openOwnedBooks,
  refreshReferenceBrowsers,
  searchReferences,
  getReference,
  importPublishedLibrary,
} from "./reference-browser.mjs";
import {
  integrationApi,
  openIntegrationImport,
  processIntegrationHandoff,
} from "./integration-api.mjs";
import {
  rangeOverlayApi,
  registerRangeOverlay,
} from "./range-overlay/foundry.mjs";
class ReferenceMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    openReferenceBrowser();
    return this;
  }
}
class OwnedBooksMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    openOwnedBooks();
    return this;
  }
}
class LibraryMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    importDialog();
    return this;
  }
}
class CampaignMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    campaignDialog().catch((e) => ui.notifications.error(e.message));
    return this;
  }
}
class AdversariesMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    importSwaDialog();
    return this;
  }
}
class ConsoleMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    openConsole();
    return this;
  }
}
class IntegrationMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    openIntegrationImport();
    return this;
  }
}
class GMSourceKeyMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    gmSourceKeyDialog().catch((error) => ui.notifications.error(error.message));
    return this;
  }
}
class GMSourceLibraryMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    gmSourceLibrary().catch((error) => ui.notifications.error(error.message));
    return this;
  }
}
export function applyInterfaceTheme() {
  const selection = game.settings.get(SYSTEM_ID, "interfaceTheme");
  const campaign = game.settings.get(SYSTEM_ID, "campaign");
  const theme = resolveInterfaceTheme(selection, campaign.lines);
  if (theme) document.body.dataset.starWarsTheme = theme;
  else delete document.body.dataset.starWarsTheme;
}
function refreshThemedSheets() {
  for (const actor of game.actors ?? [])
    for (const app of Object.values(actor.apps))
      if (app.rendered) app.render({ force: true });
}
export async function openConsole() {
  const { DialogV2 } = foundry.applications.api;
  const destiny = game.settings.get(SYSTEM_ID, "destiny");
  await DialogV2.wait({
    window: { title: "Star Wars FFG · Session console" },
    position: { width: 540 },
    content: `<div class="sf-dialog"><p>Shared Destiny: <strong>${destiny.light} light · ${destiny.dark} dark</strong></p><div class="sf-form-grid">${Object.entries(
      DICE,
    )
      .map(
        ([key, die]) =>
          `<label>${die.label}<input name="${key}" type="number" min="0" max="40" value="0"></label>`,
      )
      .join(
        "",
      )}</div><p>These controls persist world state. The GM manages Destiny flips for the table.</p></div>`,
    buttons: [
      {
        action: "roll",
        label: "Roll pool",
        callback: async (_e, b) => {
          try {
            await rollPool(Object.fromEntries(new FormData(b.form)));
          } catch (e) {
            ui.notifications.error(e.message);
          }
        },
      },
      ...(game.user.isGM
        ? [
            {
              action: "light",
              label: "Use light",
              callback: () => flipDestiny("light"),
            },
            {
              action: "dark",
              label: "Use dark",
              callback: () => flipDestiny("dark"),
            },
            { action: "reset", label: "Seed Destiny", callback: seedDestiny },
          ]
        : []),
    ],
    rejectClose: false,
  });
}
async function flipDestiny(side) {
  if (!game.user.isGM) return;
  const current = game.settings.get(SYSTEM_ID, "destiny");
  if (current[side] < 1)
    return ui.notifications.warn(`No ${side} Destiny point is available.`);
  await game.settings.set(SYSTEM_ID, "destiny", {
    ...current,
    [side]: current[side] - 1,
    [side === "light" ? "dark" : "light"]:
      current[side === "light" ? "dark" : "light"] + 1,
  });
  ui.notifications.info(
    `${side} Destiny point spent. Apply its effect to the next pool.`,
  );
}
async function seedDestiny() {
  if (!game.user.isGM) return;
  const pcs = game.actors.filter(
    (a) => a.type === "character" && a.hasPlayerOwner,
  );
  const result = await rollPool(
    { force: Math.max(1, pcs.length) },
    { label: "Session Destiny pool" },
  );
  await game.settings.set(SYSTEM_ID, "destiny", {
    light: result.outcome.light,
    dark: result.outcome.dark,
  });
}
Hooks.once("init", () => {
  CONFIG.Actor.documentClass = StarWarsActor;
  CONFIG.Item.documentClass = StarWarsItem;
  CONFIG.Combat.documentClass = StarWarsCombat;
  CONFIG.Actor.dataModels = Object.fromEntries(
    ["character", "minion", "rival", "nemesis"].map((type) => [
      type,
      type === "character" ? CharacterData : AdversaryData,
    ]),
  );
  CONFIG.Actor.dataModels.vehicle = VehicleData;
  CONFIG.Actor.dataModels.group = GroupData;
  CONFIG.Item.dataModels = Object.fromEntries(
    ITEM_TYPES.map((type) => [type, ItemData]),
  );
  foundry.documents.collections.Actors.registerSheet(
    SYSTEM_ID,
    StarWarsActorSheet,
    {
      types: ["character", "minion", "rival", "nemesis", "vehicle"],
      makeDefault: true,
      label: "Star Wars FFG sheet",
    },
  );
  foundry.documents.collections.Items.registerSheet(
    SYSTEM_ID,
    StarWarsItemSheet,
    {
      types: ITEM_TYPES,
      makeDefault: true,
      label: "Star Wars FFG reference sheet",
    },
  );
  foundry.documents.collections.Actors.registerSheet(SYSTEM_ID, GroupSheet, {
    types: ["group"],
    makeDefault: true,
    label: "Star Wars FFG group sheet",
  });
  registerDice();
  game.settings.register(SYSTEM_ID, "campaign", {
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_CAMPAIGN,
    onChange: () => {
      applyInterfaceTheme();
      refreshReferenceBrowsers();
      refreshThemedSheets();
    },
  });
  game.settings.register(SYSTEM_ID, "sheetTheme", {
    name: "Default sheet theme",
    hint: "Automatic matches each character's creation rules and uses the campaign's first enabled ruleset for vehicles and groups. A sheet's own theme control can override this setting.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      auto: "Automatic (ruleset)",
      ...Object.fromEntries(
        Object.entries(THEMES).map(([key, theme]) => [key, theme.name]),
      ),
    },
    default: "auto",
    onChange: refreshThemedSheets,
  });
  game.settings.register(SYSTEM_ID, "interfaceTheme", {
    name: "Foundry interface theme",
    hint: "Style the space backdrop, sidebar, chat, combat tracker, journals, windows, scene controls, player list and hotbar. Automatic follows the first enabled campaign ruleset; choose a scheme here to override it.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      auto: "Automatic (campaign ruleset)",
      ...Object.fromEntries(
        Object.entries(THEMES).map(([key, theme]) => [key, theme.name]),
      ),
      default: "Foundry default",
    },
    default: "auto",
    onChange: applyInterfaceTheme,
  });
  game.settings.register(SYSTEM_ID, "skillView", {
    scope: "client",
    config: false,
    type: String,
    default: "grouped",
  });
  game.settings.register(SYSTEM_ID, "destiny", {
    scope: "world",
    config: false,
    type: Object,
    default: { light: 0, dark: 0 },
    onChange: refreshGroupSheets,
  });
  game.settings.register(SYSTEM_ID, "gmSourceKeys", {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });
  game.settings.register(SYSTEM_ID, "compactChatDice", {
    name: "Compact dice tray by chat",
    hint: "Show a minimal seven-die pool beside the chat bar. It uses the active chat visibility button for public, GM, blind or self rolls.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: refreshCompactChatDice,
  });
  registerCompactChatDice();
  registerRangeOverlay();
  game.settings.registerMenu(SYSTEM_ID, "gmSourceKeyMenu", {
    name: "GM source key",
    label: "Backup or restore key",
    hint: "Keep a private backup to unlock encrypted source notes on another GM browser.",
    icon: "fas fa-key",
    type: GMSourceKeyMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "gmSourceLibraryMenu", {
    name: "GM source library",
    label: "Search private sources",
    hint: "Search imported descriptions, abilities and rules in this GM browser.",
    icon: "fas fa-book-open",
    type: GMSourceLibraryMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "campaignMenu", {
    name: "Campaign rules & adventure state",
    label: "Choose campaign rules",
    hint: "Enable one or more rule lines, combine their story mechanics, and lock completed character origins when play begins.",
    icon: "fas fa-book",
    type: CampaignMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "referenceMenu", {
    name: "Reference catalogue",
    label: "Search database",
    hint: "Find names, statistics, notes and book pages in the bundled database.",
    icon: "fas fa-magnifying-glass",
    type: ReferenceMenu,
    restricted: false,
  });
  game.settings.registerMenu(SYSTEM_ID, "ownedBooksMenu", {
    name: "Owned books",
    label: "Choose available books",
    hint: "Apply one reference filter for the GM and players.",
    icon: "fas fa-book-open",
    type: OwnedBooksMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "libraryMenu", {
    name: "Private library",
    label: "Import database",
    hint: "Populate world compendiums from a local Star Wars FFG library JSON.",
    icon: "fas fa-file-import",
    type: LibraryMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "consoleMenu", {
    name: "Session console",
    label: "Dice & Destiny",
    hint: "Roll custom dice and manage the shared Destiny pool.",
    icon: "fas fa-dice",
    type: ConsoleMenu,
    restricted: false,
  });
  game.settings.registerMenu(SYSTEM_ID, "integrationMenu", {
    name: "External tools & community rules",
    label: "Import character or rules",
    hint: "Review a versioned interchange package from a character builder or community-rules site.",
    icon: "fas fa-plug",
    type: IntegrationMenu,
    restricted: false,
  });
  game.settings.registerMenu(SYSTEM_ID, "adversariesMenu", {
    name: "SW Adversaries",
    label: "Import adversaries",
    hint: "Read a local swa.stoogoff.com JSON export into this world's actor compendium.",
    icon: "fas fa-file-import",
    type: AdversariesMenu,
    restricted: true,
  });
  game.system.api = Object.freeze({
    rollPool,
    importLibrary,
    actorContext,
    directorOfRealms: directorAdapter,
    openConsole,
    campaignDialog,
    importDialog,
    importSwaDialog,
    convertSwa,
    convertSwaSource,
    openReferenceBrowser,
    openOwnedBooks,
    searchReferences,
    getReference,
    importPublishedLibrary,
    searchGMSourceNotes,
    integration: integrationApi,
    range: rangeOverlayApi,
  });
});
Hooks.once("diceSoNiceReady", (dice3d) =>
  registerDiceSoNice(dice3d).catch((e) =>
    ui.notifications.error(`Star Wars FFG dice: ${e.message}`),
  ),
);
Hooks.on("preCreateActor", (actor, data) => {
  const vehicle = data.type === "vehicle";
  const group = data.type === "group";
  actor.updateSource({
    img:
      data.img ??
      `${SYSTEM_PATH}/assets/${vehicle ? "vehicle" : "character"}.svg`,
    prototypeToken: {
      actorLink: group || data.type === "character",
      bar1: { attribute: group ? null : vehicle ? "hullTrauma" : "wounds" },
      bar2: { attribute: group ? null : vehicle ? "systemStrain" : "strain" },
    },
  });
});
Hooks.on("renderActorDirectory", (_app, html) => {
  if (html.querySelector(".sf-launcher")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sf-launcher";
  button.textContent = "Star Wars FFG · Dice & Destiny";
  button.addEventListener("click", openConsole);
  html.querySelector(".directory-footer")?.append(button);
  const references = document.createElement("button");
  references.type = "button";
  references.textContent = "Star Wars FFG · Reference catalogue";
  references.addEventListener("click", openReferenceBrowser);
  html.querySelector(".directory-footer")?.append(references);
});
Hooks.once("ready", () => {
  applyInterfaceTheme();
  refreshLibraryLabels();
  refreshCompactChatDice();
  ui.compendium.render();
  refreshGMNotes().catch((error) =>
    ui.notifications.error(`GM source notes: ${error.message}`),
  );
  ensureArtworkCreditsJournal().catch((error) =>
    ui.notifications.error(`Artwork credits: ${error.message}`),
  );
  processIntegrationHandoff();
  Hooks.callAll("starWarsFFGReady", game.system.api);
  console.info("Star Wars FFG | Narrative toolkit ready");
});
