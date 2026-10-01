import { SYSTEM_ID } from "./config.mjs";

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
  hud.setAttribute("aria-label", `Shared Destiny: ${light} light, ${dark} dark. Open Dice and Destiny.`);
  hud.title = `Shared Destiny · ${light} light · ${dark} dark. Open Dice and Destiny.`;
  hud.innerHTML = `<span class="sf-destiny-title">Destiny</span>
    <span class="sf-destiny-light">Light <strong>${light}</strong></span>
    <span class="sf-destiny-dark">Dark <strong>${dark}</strong></span>`;
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
