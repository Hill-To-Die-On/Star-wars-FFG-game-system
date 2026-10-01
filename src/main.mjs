import { registerSupportTools, supportApi } from "./support-foundry.mjs";
import { SYSTEM_ID, THEMES, ITEM_TYPES } from "./config.mjs";
import { registerTabletopWorkflows, tabletopApi } from "./tabletop-foundry.mjs";
import {
  CharacterData,
  AdversaryData,
  VehicleData,
  GroupData,
  ItemData,
} from "./models.mjs";
import { GroupSheet, refreshGroupSheets } from "./group-sheet.mjs";
import { openGroupRecord } from "./group-launcher.mjs";
import { StarWarsActor, StarWarsItem } from "./documents.mjs";
import {
  StarWarsActorSheet,
  StarWarsItemSheet,
  importDialog,
  importSwaDialog,
  campaignDialog,
  checkDialog,
} from "./sheets.mjs";
import { registerVehicleCrew, crewApi } from "./vehicle-crew-foundry.mjs";
import { registerDice, registerDiceSoNice, rollPool } from "./dice/foundry.mjs";
import { registerTurnEconomy, readTurnBudget, performTurnCommand, rotateToken } from "./turn-economy-foundry.mjs";
import { registerAltitudeShadows } from "./altitude-shadows-foundry.mjs";
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
import {
  registerActorArtwork,
  resetVehicleTokenFootprint,
} from "./actor-artwork-foundry.mjs";
import { actorIconDescriptor } from "./actor-icons.mjs";
import {
  vehicleFootprintMeters,
  vehicleTokenDimensions,
} from "./vehicle-footprints.mjs";
import { configureXpTransactions } from "./xp-transactions.mjs";
import { selectTransactionAuthority } from "./document-transactions.mjs";
import { registerMinionGroups } from "./minion-groups-foundry.mjs";
import { registerDorDamageEffects } from "./dor-damage-vfx.mjs";
import { registerDestinyHud, refreshDestinyHud } from "./destiny-hud.mjs";
import { registerSettingsGroups } from "./settings-groups.mjs";
import { registerHomebrewIdentities } from "./homebrew-identities.mjs";
import { renderAboutContent } from "./about.mjs";
import { openDataReview } from "./data-review.mjs";
import { localize as t, registerUiLocalisation } from "./localization.mjs";
class AboutMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    foundry.applications.api.DialogV2.wait({
      classes: ["star-wars"],
      window: { title: t("SWFFG.System.About", "About Star Wars FFG") },
      position: { width: 420 },
      content: renderAboutContent({
        systemTitle: game.system?.title,
        systemId: game.system?.id,
        systemVersion: game.system?.version,
        foundryVersion: game.version,
      }),
      buttons: [{ action: "close", label: t("SWFFG.Common.Close", "Close") }],
      rejectClose: false,
    }).catch((error) => ui.notifications.error(error.message));
    return this;
  }
}
class ReferenceMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    openReferenceBrowser();
    return this;
  }
}
class DataReviewMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    openDataReview();
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
class TransactionAuthorityMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    selectTransactionAuthority().catch((error) => ui.notifications.error(error.message));
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
    classes: ["star-wars"],
    window: { title: t("SWFFG.UI.SessionConsole", "Star Wars FFG · Session console") },
    position: { width: 540 },
    content: `<div class="sf-dialog"><p>${t("SWFFG.UI.SharedDestinyLabel", "Shared Destiny:")} <strong>${destiny.light} light · ${destiny.dark} dark</strong></p><div class="sf-form-grid">${Object.entries(
      DICE,
    )
      .map(
        ([key, die]) =>
          `<label>${die.label}<input name="${key}" type="number" min="0" max="40" value="0"></label>`,
      )
      .join(
        "",
      )}</div><p>${t("SWFFG.UI.SessionConsoleHelp", "These controls persist world state. The GM manages Destiny flips for the table.")}</p></div>`,
    buttons: [
      {
        action: "roll",
        label: t("SWFFG.UI.RollPool", "Roll pool"),
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
              label: t("SWFFG.UI.UseLight", "Use light"),
              callback: () => flipDestiny("light"),
            },
            {
              action: "dark",
              label: t("SWFFG.UI.UseDark", "Use dark"),
              callback: () => flipDestiny("dark"),
            },
            { action: "reset", label: t("SWFFG.UI.SeedDestiny", "Seed Destiny"), callback: seedDestiny },
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
  registerHomebrewIdentities(refreshThemedSheets);
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
    name: t("SWFFG.UI.DefaultSheetTheme", "Default sheet theme"),
    hint: t("SWFFG.UI.DefaultSheetThemeHint", "Automatic matches each character's creation rules and uses the campaign's first enabled ruleset for vehicles and groups. A sheet's own theme control can override this setting."),
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
    name: t("SWFFG.UI.FoundryInterfaceTheme", "Foundry interface theme"),
    hint: t("SWFFG.UI.FoundryInterfaceThemeHint", "Style the space backdrop, sidebar, chat, combat tracker, journals, windows, scene controls, player list and hotbar. Automatic follows the first enabled campaign ruleset; choose a scheme here to override it."),
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
    onChange: value => { refreshGroupSheets(); refreshDestinyHud(value); },
  });
  registerDestinyHud(openConsole);
  game.settings.register(SYSTEM_ID, "gmSourceKeys", {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });
  game.settings.register(SYSTEM_ID, "compactChatDice", {
    name: t("SWFFG.UI.CompactDiceTray", "Compact dice tray by chat"),
    hint: t("SWFFG.UI.CompactDiceTrayHint", "Show a minimal seven-die pool beside the chat bar. It uses the active chat visibility button for public, GM, blind or self rolls."),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: refreshCompactChatDice,
  });
  registerCompactChatDice();
  registerRangeOverlay();
  registerActorArtwork();
  registerAltitudeShadows();
  registerTurnEconomy();
  registerVehicleCrew({openCheck:checkDialog});
  registerMinionGroups();
  registerDorDamageEffects();
  registerSettingsGroups();
  registerTabletopWorkflows();
  registerSupportTools();
  game.settings.registerMenu(SYSTEM_ID, "aboutMenu", {
    name: t("SWFFG.Settings.About.Name", "About Star Wars FFG"),
    label: t("SWFFG.Settings.About.Label", "About"),
    hint: t("SWFFG.Settings.About.Hint", "Show the system and Foundry versions loaded in this game session."),
    icon: "fas fa-circle-info",
    type: AboutMenu,
    restricted: false,
  });
  game.settings.registerMenu(SYSTEM_ID, "transactionAuthorityMenu", {
    name: t("SWFFG.UI.TransactionAuthority", "Transaction authority"),
    label: t("SWFFG.UI.UseThisGmTab", "Use this GM tab"),
    hint: t("SWFFG.UI.TransactionAuthorityHint", "Select the single GM tab that processes XP, turn, crew and tabletop transactions."),
    icon: "fas fa-shield-halved",
    type: TransactionAuthorityMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "gmSourceKeyMenu", {
    name: t("SWFFG.UI.GmSourceKey", "GM source key"),
    label: t("SWFFG.UI.BackupRestoreKey", "Backup or restore key"),
    hint: t("SWFFG.UI.GmSourceKeyHint", "Keep a private backup to unlock encrypted source notes on another GM browser."),
    icon: "fas fa-key",
    type: GMSourceKeyMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "gmSourceLibraryMenu", {
    name: t("SWFFG.UI.GmSourceLibrary", "GM source library"),
    label: t("SWFFG.UI.SearchPrivateSources", "Search private sources"),
    hint: t("SWFFG.UI.GmSourceLibraryHint", "Search imported descriptions, abilities and rules in this GM browser."),
    icon: "fas fa-book-open",
    type: GMSourceLibraryMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "campaignMenu", {
    name: t("SWFFG.UI.CampaignRulesAdventure", "Campaign rules & adventure state"),
    label: t("SWFFG.UI.ChooseCampaignRules", "Choose campaign rules"),
    hint: t("SWFFG.UI.CampaignRulesHint", "Enable one or more rule lines, combine their story mechanics, and lock completed character origins when play begins."),
    icon: "fas fa-book",
    type: CampaignMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "referenceMenu", {
    name: t("SWFFG.Settings.Reference.Name", "Reference catalogue"),
    label: t("SWFFG.Settings.Reference.Label", "Search database"),
    hint: t("SWFFG.Settings.Reference.Hint", "Find names, statistics, notes and book pages in the bundled database."),
    icon: "fas fa-magnifying-glass",
    type: ReferenceMenu,
    restricted: false,
  });
  game.settings.registerMenu(SYSTEM_ID, "dataReviewMenu", {
    name: t("SWFFG.Settings.DataReview.Name", "Rule data review"),
    label: t("SWFFG.Settings.DataReview.Label", "Review missing data"),
    hint: t("SWFFG.Settings.DataReview.Hint", "Edit and validate missing source references, paraphrases and declarative talent or equipment rules."),
    icon: "fas fa-clipboard-check",
    type: DataReviewMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "ownedBooksMenu", {
    name: t("SWFFG.Settings.OwnedBooks.Name", "Owned books"),
    label: t("SWFFG.Settings.OwnedBooks.Label", "Choose available books"),
    hint: t("SWFFG.Settings.OwnedBooks.Hint", "Apply one reference filter for the GM and players."),
    icon: "fas fa-book-open",
    type: OwnedBooksMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "libraryMenu", {
    name: t("SWFFG.UI.PrivateLibrary", "Private library"),
    label: t("SWFFG.UI.ImportDatabase", "Import database"),
    hint: t("SWFFG.UI.PrivateLibraryHint", "Populate world compendiums from a local Star Wars FFG library JSON."),
    icon: "fas fa-file-import",
    type: LibraryMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "consoleMenu", {
    name: t("SWFFG.Settings.Console.Name", "Session console"),
    label: t("SWFFG.Settings.Console.Label", "Dice & Destiny"),
    hint: t("SWFFG.Settings.Console.Hint", "Roll custom dice and manage the shared Destiny pool."),
    icon: "fas fa-dice",
    type: ConsoleMenu,
    restricted: false,
  });
  game.settings.registerMenu(SYSTEM_ID, "integrationMenu", {
    name: t("SWFFG.UI.ExternalToolsRules", "External tools & community rules"),
    label: t("SWFFG.UI.ImportCharacterRules", "Import character or rules"),
    hint: t("SWFFG.UI.ExternalToolsHint", "Review a versioned interchange package from a character builder or community-rules site."),
    icon: "fas fa-plug",
    type: IntegrationMenu,
    restricted: false,
  });
  game.settings.registerMenu(SYSTEM_ID, "adversariesMenu", {
    name: t("SWFFG.UI.SwAdversaries", "SW Adversaries"),
    label: t("SWFFG.UI.ImportAdversaries", "Import adversaries"),
    hint: t("SWFFG.UI.ImportAdversariesHint", "Read a local swa.stoogoff.com JSON export into this world's actor compendium."),
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
    openGroupRecord,
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
    crew: crewApi,
    tabletop: tabletopApi,
    support: supportApi,
    turns: Object.freeze({ read:readTurnBudget, perform:performTurnCommand, rotateToken }),
    actorIcons: Object.freeze({
      describe: actorIconDescriptor,
      vehicleFootprint: vehicleFootprintMeters,
      vehicleTokenDimensions,
      resetVehicleTokenFootprint,
    }),
  });
});
Hooks.once("diceSoNiceReady", (dice3d) =>
  registerDiceSoNice(dice3d).catch((e) =>
    ui.notifications.error(`Star Wars FFG dice: ${e.message}`),
  ),
);
Hooks.on("renderActorDirectory", (_app, html) => {
  if (html.querySelector(".sf-launcher")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sf-launcher";
  button.textContent = "Star Wars FFG · Dice & Destiny";
  button.addEventListener("click", openConsole);
  html.querySelector(".directory-footer")?.append(button);
  const groupRecord = document.createElement("button");
  groupRecord.type = "button";
  groupRecord.textContent = "Star Wars FFG · Open Group Record";
  groupRecord.addEventListener("click", () => openGroupRecord().catch(error => ui.notifications.error(error.message)));
  html.querySelector(".directory-footer")?.append(groupRecord);
  const references = document.createElement("button");
  references.type = "button";
  references.textContent = "Star Wars FFG · Reference catalogue";
  references.addEventListener("click", openReferenceBrowser);
  html.querySelector(".directory-footer")?.append(references);
  if (game.user.isGM) {
    const review = document.createElement("button");
    review.type = "button";
    review.textContent = "Star Wars FFG · Review rule data";
    review.addEventListener("click", () => openDataReview());
    html.querySelector(".directory-footer")?.append(review);
  }
});
Hooks.once("ready", () => {
  registerUiLocalisation();
  configureXpTransactions({
    socket: game.socket,
    currentUser: () => game.user,
    users: () => game.users,
    getActor: (uuid) => fromUuid(uuid),
    execute: (actor, operation, args) =>
      actor._executeXpTransaction(operation, args),
  });
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
