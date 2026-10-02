import { SYSTEM_ID } from "../config.mjs";
import { DICE, normalizePool } from "./core.mjs";
import { rollPool } from "./foundry.mjs";
import { turnCostHTML } from "../turn-economy-foundry.mjs";

export const COMPACT_DICE_GROUPS = Object.freeze([
  Object.freeze(["boost", "ability", "proficiency"]),
  Object.freeze(["setback", "difficulty", "challenge"]),
  Object.freeze(["force"]),
]);

const CHAT_ROLL_MODES = Object.freeze({
  public: "publicroll",
  gm: "gmroll",
  blind: "blindroll",
  self: "selfroll",
  ic: "publicroll",
});

export const emptyCompactPool = () =>
  Object.fromEntries(Object.keys(DICE).map((key) => [key, 0]));

export function adjustCompactPool(pool, die, delta) {
  if (!(die in DICE)) throw new Error(`Unknown compact-tray die: ${die}`);
  if (!Number.isInteger(delta))
    throw new Error("Compact-tray adjustments must be whole numbers.");
  const current = normalizePool(pool),
    total = Object.values(current).reduce((sum, value) => sum + value, 0);
  if (delta > 0 && total >= 80) return current;
  return normalizePool({
    ...current,
    [die]: Math.max(0, Math.min(40, current[die] + delta)),
  });
}

export const chatModeToRollMode = (mode) =>
  CHAT_ROLL_MODES[mode] ?? "publicroll";

const emptyCompactContext = () => ({
  label: "",
  actor: null,
  turnCost: "none",
  automaticResults: {},
  ruleNotes: [],
});

let compactPool = emptyCompactPool(),
  compactContext = emptyCompactContext(),
  hooksRegistered = false,
  refreshQueued = false;

function renderAllCompactPools() {
  for (const tray of globalThis.document?.querySelectorAll?.(
    ".sf-compact-dice",
  ) ?? [])
    renderCompactPool(tray);
}

export function getCompactPoolState() {
  return {
    pool: { ...compactPool },
    context: {
      ...compactContext,
      automaticResults: { ...compactContext.automaticResults },
      ruleNotes: [...compactContext.ruleNotes],
    },
  };
}

export function loadCompactPool(pool, context = {}) {
  compactPool = normalizePool(pool);
  compactContext = {
    label: typeof context.label === "string" ? context.label : "",
    actor: context.actor ?? null,
    turnCost: ["action","maneuver"].includes(context.turnCost) ? context.turnCost : "none",
    automaticResults: { ...(context.automaticResults ?? {}) },
    ruleNotes: Array.isArray(context.ruleNotes) ? [...context.ruleNotes] : [],
  };
  renderAllCompactPools();
  return getCompactPoolState();
}

function clearCompactPool() {
  compactPool = emptyCompactPool();
  compactContext = emptyCompactContext();
  renderAllCompactPools();
}

const dieButtonHTML = (key) =>
  `<button type="button" class="sf-compact-die" data-compact-die="${key}" data-count="0" aria-label="Add ${DICE[key].label} die" title="${DICE[key].label}: click to add, Shift-click or right-click to remove">
    <span class="sf-die-shape sf-die-${key}" aria-hidden="true"></span>
    <span class="sf-compact-count" aria-hidden="true">0</span>
  </button>`;

const compactTrayHTML = () =>
  `<div class="sf-compact-dice" role="group" aria-label="Star Wars FFG quick dice pool">
    ${COMPACT_DICE_GROUPS.map(
      (group) =>
        `<span class="sf-compact-group">${group.map(dieButtonHTML).join("")}</span>`,
    ).join("")}
    <span class="sf-compact-actions">
      <button type="button" data-compact-clear aria-label="Clear quick dice pool" title="Clear pool"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      <button type="button" data-compact-roll aria-label="Roll quick dice pool" title="Roll pool"><i class="fa-solid fa-dice" aria-hidden="true"></i></button>
    </span>
    <span data-compact-turn-cost></span>
  </div>`;

function renderCompactPool(tray) {
  const total = Object.values(compactPool).reduce(
    (sum, value) => sum + value,
    0,
  );
  for (const button of tray.querySelectorAll("[data-compact-die]")) {
    const count = compactPool[button.dataset.compactDie];
    button.dataset.count = count;
    button.querySelector(".sf-compact-count").textContent = count;
    button.setAttribute(
      "aria-label",
      `${DICE[button.dataset.compactDie].label}: ${count} selected. Activate to add; Shift-activate to remove.`,
    );
  }
  tray.querySelector("[data-compact-clear]").disabled = total === 0;
  tray.querySelector("[data-compact-roll]").disabled = total === 0;
  const turn = tray.querySelector("[data-compact-turn-cost]");
  if (turn) turn.innerHTML = turnCostHTML(compactContext.actor,compactContext.turnCost);
}

function selectedRollMode(tray) {
  const controls =
      tray.parentElement?.querySelector("#message-modes") ??
      document.querySelector("#message-modes"),
    selected = controls?.querySelector('[data-mode][aria-pressed="true"]');
  return chatModeToRollMode(selected?.dataset.mode);
}

function selectedActor() {
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;
}

function bindCompactTray(tray) {
  tray.addEventListener("change",event=>{
    if (event.target.name === "turnCost") compactContext.turnCost = event.target.value;
  });
  const update = (die, delta) => {
    compactPool = adjustCompactPool(compactPool, die, delta);
    renderAllCompactPools();
  };
  tray.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-compact-die")) {
      update(button.dataset.compactDie, event.shiftKey ? -1 : 1);
      return;
    }
    if (button.hasAttribute("data-compact-clear")) {
      clearCompactPool();
      return;
    }
    if (!button.hasAttribute("data-compact-roll")) return;
    button.disabled = true;
    try {
      const actor = selectedActor();
      await rollPool(compactPool, {
        label: compactContext.label || "Quick narrative pool",
        actor: compactContext.actor ?? actor,
        turnCost: compactContext.turnCost,
        rollMode: selectedRollMode(tray),
        automaticResults: compactContext.automaticResults,
        ruleNotes: compactContext.ruleNotes,
      });
      clearCompactPool();
    } catch (error) {
      ui.notifications.error(error.message);
      renderCompactPool(tray);
    }
  });
  tray.addEventListener("contextmenu", (event) => {
    const button = event.target.closest("[data-compact-die]");
    if (!button) return;
    event.preventDefault();
    update(button.dataset.compactDie, -1);
  });
  renderCompactPool(tray);
}

export function refreshCompactChatDice() {
  document
    .querySelectorAll(".sf-compact-dice")
    .forEach((tray) => tray.remove());
  if (!game.settings.get(SYSTEM_ID, "compactChatDice")) return;
  const parents = new Set(
    Array.from(document.querySelectorAll("#chat-message"), (input) =>
      input.parentElement,
    ).filter(Boolean),
  );
  for (const parent of parents) {
    const input = parent.querySelector(":scope > #chat-message"),
      fragment = document.createRange().createContextualFragment(compactTrayHTML()),
      tray = fragment.querySelector(".sf-compact-dice");
    parent.insertBefore(fragment, input);
    bindCompactTray(tray);
  }
}

function queueCompactRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    refreshCompactChatDice();
  });
}

export function registerCompactChatDice() {
  if (hooksRegistered) return;
  hooksRegistered = true;
  for (const hook of ["renderChatLog", "renderSidebar", "collapseSidebar"])
    Hooks.on(hook, queueCompactRefresh);
}
