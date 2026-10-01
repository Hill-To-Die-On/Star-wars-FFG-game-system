import { SYSTEM_ID } from "./config.mjs";
import { localize as t } from "./localization.mjs";

const HUD_ID = "sf-destiny-hud";

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

export function refreshDestinyHud(pool = globalThis.game?.settings?.get(SYSTEM_ID, "destiny")) {
  const hud = globalThis.document?.getElementById(HUD_ID);
  if (!hud) return;
  const light = count(pool?.light);
  const dark = count(pool?.dark);
  const shared = t("SWFFG.UI.SharedDestiny", "Shared Destiny");
  const lightLabel = t("SWFFG.HUD.Light", "Light");
  const darkLabel = t("SWFFG.HUD.Dark", "Dark");
  const open = t("SWFFG.Common.Open", "Open");
  const diceDestiny = t("SWFFG.UI.DiceDestiny", "Dice & Destiny");
  const destiny = t("SWFFG.HUD.Destiny", "Destiny");
  hud.setAttribute("aria-label", `${shared}: ${light} ${lightLabel}, ${dark} ${darkLabel}. ${open} ${diceDestiny}.`);
  hud.title = `${shared} · ${light} ${lightLabel} · ${dark} ${darkLabel}. ${open} ${diceDestiny}.`;
  hud.innerHTML = `<span class="sf-destiny-title">${destiny}</span>
    <span class="sf-destiny-light">${lightLabel} <strong>${light}</strong></span>
    <span class="sf-destiny-dark">${darkLabel} <strong>${dark}</strong></span>`;
}

export function registerDestinyHud(openConsole) {
  Hooks.once("ready", () => {
    if (!document.getElementById(HUD_ID)) {
      const hud = document.createElement("button");
      hud.type = "button";
      hud.id = HUD_ID;
      hud.className = "sf-destiny-hud";
      hud.addEventListener("click", openConsole);
      document.body.append(hud);
    }
    refreshDestinyHud();
  });
}
