import { SYSTEM_ID, SYSTEM_PATH, ITEM_TYPES } from "./config.mjs";
import { CharacterData, VehicleData, ItemData } from "./models.mjs";
import { StarfallActor, StarfallItem } from "./documents.mjs";
import {
  StarfallActorSheet,
  StarfallItemSheet,
  importDialog,
  campaignDialog,
} from "./sheets.mjs";
import { registerDice, registerDiceSoNice, rollPool } from "./dice/foundry.mjs";
import { DEFAULT_CAMPAIGN } from "./rules.mjs";
import { directorAdapter, actorContext } from "./director-adapter.mjs";
import { importLibrary } from "./library.mjs";
import { DICE } from "./dice/core.mjs";
import { StarfallCombat } from "./combat.mjs";
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
class ConsoleMenu extends foundry.applications.api.ApplicationV2 {
  render() {
    openConsole();
    return this;
  }
}
export async function openConsole() {
  const { DialogV2 } = foundry.applications.api;
  const destiny = game.settings.get(SYSTEM_ID, "destiny");
  await DialogV2.wait({
    window: { title: "Starfall · Session console" },
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
  CONFIG.Actor.documentClass = StarfallActor;
  CONFIG.Item.documentClass = StarfallItem;
  CONFIG.Combat.documentClass = StarfallCombat;
  CONFIG.Actor.dataModels = Object.fromEntries(
    ["character", "minion", "rival", "nemesis"].map((type) => [
      type,
      CharacterData,
    ]),
  );
  CONFIG.Actor.dataModels.vehicle = VehicleData;
  CONFIG.Item.dataModels = Object.fromEntries(
    ITEM_TYPES.map((type) => [type, ItemData]),
  );
  foundry.documents.collections.Actors.registerSheet(
    SYSTEM_ID,
    StarfallActorSheet,
    {
      types: ["character", "minion", "rival", "nemesis", "vehicle"],
      makeDefault: true,
      label: "Starfall sheet",
    },
  );
  foundry.documents.collections.Items.registerSheet(
    SYSTEM_ID,
    StarfallItemSheet,
    { types: ITEM_TYPES, makeDefault: true, label: "Starfall reference sheet" },
  );
  registerDice();
  game.settings.register(SYSTEM_ID, "campaign", {
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_CAMPAIGN,
  });
  game.settings.register(SYSTEM_ID, "destiny", {
    scope: "world",
    config: false,
    type: Object,
    default: { light: 0, dark: 0 },
  });
  game.settings.registerMenu(SYSTEM_ID, "campaignMenu", {
    name: "Campaign rulebooks",
    label: "Choose rules & sources",
    hint: "Blend the three lines and their independent story mechanics.",
    icon: "fas fa-book",
    type: CampaignMenu,
    restricted: true,
  });
  game.settings.registerMenu(SYSTEM_ID, "libraryMenu", {
    name: "Private library",
    label: "Import database",
    hint: "Populate world compendiums from a local Starfall library JSON.",
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
  game.system.api = Object.freeze({
    rollPool,
    importLibrary,
    actorContext,
    directorOfRealms: directorAdapter,
    openConsole,
    campaignDialog,
    importDialog,
  });
});
Hooks.once("diceSoNiceReady", (dice3d) =>
  registerDiceSoNice(dice3d).catch((e) =>
    ui.notifications.error(`Starfall dice: ${e.message}`),
  ),
);
Hooks.on("preCreateActor", (actor, data) => {
  const vehicle = data.type === "vehicle";
  actor.updateSource({
    img:
      data.img ??
      `${SYSTEM_PATH}/assets/${vehicle ? "vehicle" : "character"}.svg`,
    prototypeToken: {
      actorLink: data.type === "character",
      bar1: { attribute: vehicle ? "hullTrauma" : "wounds" },
      bar2: { attribute: vehicle ? "systemStrain" : "strain" },
    },
  });
});
Hooks.on("renderActorDirectory", (_app, html) => {
  if (html.querySelector(".sf-launcher")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sf-launcher";
  button.textContent = "Starfall · Dice & Destiny";
  button.addEventListener("click", openConsole);
  html.querySelector(".directory-footer")?.append(button);
});
Hooks.once("ready", () => {
  Hooks.callAll("starfallReady", game.system.api);
  console.info("Starfall | Narrative toolkit ready");
});
