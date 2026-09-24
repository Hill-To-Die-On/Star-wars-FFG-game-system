import {
  DICE,
  applyAutomaticResults,
  faceLabel,
  resolveFaces,
  poolFormula,
  normalizePool,
} from "./core.mjs";
import { SYSTEM_ID, SYSTEM_PATH } from "../config.mjs";
import { escapeHTML } from "../mechanics.mjs";
import { registerDiceCompatibility } from "./compatibility.mjs";
export function registerDice() {
  for (const [key, config] of Object.entries(DICE)) {
    const cls = class extends foundry.dice.terms.Die {
      static DENOMINATION = config.term;
      constructor(data = {}) {
        super({ ...data, faces: config.faces.length });
        this.options.starWarsDie = key;
      }
      get total() {
        return this.results.reduce(
          (n, r) =>
            n +
            (r.active === false
              ? 0
              : (config.faces[r.result - 1]?.success ?? 0) -
                (config.faces[r.result - 1]?.failure ?? 0)),
          0,
        );
      }
      getResultLabel(result) {
        return `<img class="sf-die-face" src="${SYSTEM_PATH}/assets/dice/${key}-${result.result}.png" alt="${faceLabel(config.faces[result.result - 1])}">`;
      }
    };
    Object.defineProperty(cls, "name", {
      value: `StarWars${config.label}Die`,
    });
    CONFIG.Dice.terms[config.term] = cls;
    CONFIG.Dice.termTypes[cls.name] = cls;
  }
  registerDiceCompatibility(foundry.dice.terms.RollTerm);
}
export async function registerDiceSoNice(dice3d) {
  const { DiceSystem } = await import("/modules/dice-so-nice/api.js");
  dice3d.addSystem(
    new DiceSystem(
      SYSTEM_ID,
      "Star Wars FFG narrative symbols",
      "preferred",
      "Hill To Die On",
    ),
  );
  for (const [key, die] of Object.entries(DICE)) {
    const colorset = `${SYSTEM_ID}-${key}`;
    dice3d.addColorset(
      {
        name: colorset,
        description: `Star Wars FFG ${die.label}`,
        category: "Star Wars FFG",
        foreground: die.ink,
        background: die.color,
        outline: "none",
        edge: die.color,
        texture: "none",
        material: "plastic",
      },
      "default",
    );
    dice3d.addDicePreset(
      {
        type: `d${die.term}`,
        labels: die.faces.map(
          (_, i) => `${SYSTEM_PATH}/assets/dice/${key}-${i + 1}.png`,
        ),
        system: SYSTEM_ID,
        colorset,
      },
      `d${die.faces.length}`,
    );
  }
  await dice3d.preloadPresets(SYSTEM_ID);
}
export function resultFromRoll(roll) {
  return resolveFaces(
    roll.dice.flatMap((term) =>
      term.results
        .filter((r) => r.active !== false)
        .map((result) => ({
          die: term.options.starWarsDie,
          result: result.result,
        })),
    ),
  );
}
export function rollCard(
  label,
  outcome,
  roll,
  automaticResults = {},
  ruleNotes = [],
) {
  const dice = roll.dice
    .flatMap((term) =>
      term.results.map(
        (r) =>
          `<span style="background:${DICE[term.options.starWarsDie].color}" title="${DICE[term.options.starWarsDie].label}: ${faceLabel(DICE[term.options.starWarsDie].faces[r.result - 1])}">${term.getResultLabel(r)}</span>`,
      ),
    )
    .join("");
  const forceOnly =
    roll.dice.length > 0 &&
    roll.dice.every((d) => d.options.starWarsDie === "force");
  const fixed = Object.entries(automaticResults)
      .filter(([, value]) => value)
      .map(([key, value]) => `${value > 0 ? "+" : ""}${value} ${key}`),
    applied = [
      ...ruleNotes,
      ...(fixed.length ? [`Automatic results: ${fixed.join(", ")}`] : []),
    ];
  return `<article class="sf-chat"><div class="sf-eyebrow">STAR WARS FFG / NARRATIVE CHECK</div><h3>${escapeHTML(label)}</h3><div class="sf-dice-tray">${dice}</div><strong>${forceOnly ? "Force resources" : outcome.passed ? `${outcome.success} net success` : outcome.failure ? `${outcome.failure} net failure` : "No net success"}</strong><p>${[outcome.advantage && `${outcome.advantage} advantage`, outcome.threat && `${outcome.threat} threat`, outcome.triumph && `${outcome.triumph} triumph`, outcome.despair && `${outcome.despair} despair`, outcome.light && `${outcome.light} light`, outcome.dark && `${outcome.dark} dark`].filter(Boolean).join(" · ") || "No additional symbols"}</p><details><summary>Pool & applied rules</summary><p>${escapeHTML(roll.formula)}</p>${applied.length ? `<ul>${applied.map((note) => `<li>${escapeHTML(note)}</li>`).join("")}</ul>` : ""}</details></article>`;
}
export async function rollPool(
  pool,
  {
    label = "Narrative check",
    actor,
    rollMode,
    chatMessage = true,
    automaticResults = {},
    ruleNotes = [],
  } = {},
) {
  const normalized = normalizePool(pool);
  const roll = await new foundry.dice.Roll(poolFormula(normalized)).evaluate();
  const outcome = applyAutomaticResults(
    resultFromRoll(roll),
    automaticResults,
  );
  roll.options.starWars = { pool: normalized, outcome, automaticResults };
  if (chatMessage) {
    const data = {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: label,
      content: rollCard(label, outcome, roll, automaticResults, ruleNotes),
      rolls: [roll],
      flags: {
        [SYSTEM_ID]: {
          pool: normalized,
          outcome,
          automaticResults,
          ruleNotes,
          actorUuid: actor?.uuid,
        },
      },
    };
    await ChatMessage.create(
      ChatMessage.applyRollMode(
        data,
        rollMode ?? game.settings.get("core", "rollMode"),
      ),
    );
  }
  return { roll, outcome, pool: normalized };
}
