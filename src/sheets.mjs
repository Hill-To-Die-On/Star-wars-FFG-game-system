import {
  SYSTEM_ID,
  SYSTEM_PATH,
  THEMES,
  CHARACTERISTICS,
  SKILLS,
  ITEM_TYPES,
  RANGES,
  PERSONAL_RANGES,
  VEHICLE_RANGES,
} from "./config.mjs";
import { DICE, skillPool } from "./dice/core.mjs";
import { rollPool } from "./dice/foundry.mjs";
import {
  ROLL_DICE,
  DIFFICULTY_PRESETS,
  automaticCheckPool,
  adjustPool,
  setDifficulty,
  shiftUpgrade,
} from "./dice/builder.mjs";
import { availableTalents } from "./advancement.mjs";
import {
  DEFAULT_CAMPAIGN,
  validateCampaign,
  RULE_LINES,
  resolveSheetTheme,
  bookAllowed,
} from "./rules.mjs";
import { escapeHTML, minionState } from "./mechanics.mjs";
import { importWithProgress } from "./library.mjs";
import { getLibraryPack } from "./library-packs.mjs";
import { convertSwaSource } from "./swa-source.mjs";
import { openGMSourceNotes } from "./gm-notes.mjs";
import { creationPlan } from "./creation.mjs";
import {
  CUSTOM_SKILL_TYPES,
  customSkillKey,
} from "./custom-skills.mjs";
import {
  availableSignatureNodes,
  signatureLinkState,
} from "./signature-abilities.mjs";
import { buildSkillColumns, SKILL_VIEWS } from "./skill-layout.mjs";
import { measureActorTargetRange } from "./range-overlay/foundry.mjs";
const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const notifyError = (error) => ui.notifications.error(error.message);
const optionsHTML = (options, selected) =>
  Object.entries(options)
    .map(
      ([value, label]) =>
        `<option value="${escapeHTML(value)}" ${selected === value ? "selected" : ""}>${escapeHTML(label)}</option>`,
    )
    .join("");
const numericInput = (name, label, value = 0, max = 40) =>
  `<label>${label}<input type="number" name="${name}" value="${value}" min="0" max="${max}" step="1"></label>`;
const DIE_HINTS = {
  ability: "Natural aptitude",
  proficiency: "Training and expertise",
  boost: "Helpful circumstances",
  difficulty: "Task and range",
  challenge: "Upgraded opposition",
  setback: "Defense and hindrances",
};
const dieShape = (key) =>
  `<span class="sf-die-shape sf-die-${key}" aria-hidden="true"></span>`;
const poolPreviewHTML = (pool) => {
  const dice = ROLL_DICE.flatMap((key) =>
    Array.from({ length: pool[key] ?? 0 }, () =>
      `<span class="sf-pool-token" title="${DICE[key].label}">${dieShape(key)}<span class="sr-only">${DICE[key].label}</span></span>`,
    ),
  ).join("");
  return dice || '<span class="sf-empty-pool">No dice selected</span>';
};
const poolControlHTML = (key, value) =>
  `<div class="sf-die-control" data-die="${key}">
    <div class="sf-die-control-label">${dieShape(key)}<span><strong>${DICE[key].label}</strong><small>${DIE_HINTS[key]}</small></span></div>
    <div class="sf-stepper">
      <button type="button" data-pool-delta="-1" aria-label="Remove one ${DICE[key].label} die">−</button>
      <input type="number" name="${key}" value="${value}" min="0" max="40" step="1" aria-label="${DICE[key].label} dice">
      <button type="button" data-pool-delta="1" aria-label="Add one ${DICE[key].label} die">+</button>
    </div>
  </div>`;
const difficultyPresetsHTML = (difficulty, attribute) =>
  DIFFICULTY_PRESETS.map(
    ({ value, label }) =>
      `<button type="button" ${attribute}="${value}" class="${difficulty === value ? "active" : ""}"><span>${label}</span><small>${value ? `${value} difficulty` : "No check"}</small></button>`,
  ).join("");
const targetContext = (key, meleeOverride, sourceActor) => {
  const targets = Array.from(game.user?.targets ?? []),
    token = targets[0] ?? null,
    actor = token?.actor ?? null,
    melee =
      meleeOverride ?? ["brawl", "melee", "lightsaber"].includes(key),
    traits = actor?.effectiveTraits?.(),
    defense = actor
      ? Math.max(
          0,
          Number(
            traits?.defense?.[melee ? "melee" : "ranged"] ??
              actor.system.defense?.[melee ? "melee" : "ranged"],
          ) || 0,
        )
      : 0,
    adversary = actor
      ? Math.max(
          0,
          ...actor.items
            .filter(
              (candidate) =>
                candidate.type === "talent" &&
                candidate.name.trim().toLowerCase() === "adversary",
            )
            .map((candidate) => Number(candidate.system.rank) || 1),
        )
      : 0;
  const measured =
      token && sourceActor && !melee
        ? measureActorTargetRange(sourceActor, token)
        : null,
    flaggedRange = token?.document?.getFlag?.(SYSTEM_ID, "rangeBand"),
    rangeBand = measured?.available
      ? measured.band
      : RANGES.includes(flaggedRange)
        ? flaggedRange
        : "";
  return {
    name: actor?.name ?? "",
    defense,
    adversary,
    rangeBand,
    rangeSource: measured?.available
      ? "overlay"
      : RANGES.includes(flaggedRange)
        ? "token-flag"
        : "",
    rangeScale: measured?.scale ?? "",
    rangeMode: measured?.profileMode ?? "",
    sceneDistance: measured?.sceneDistance ?? null,
    sceneUnits: measured?.units ?? "",
    extraTargets: Math.max(0, targets.length - 1),
  };
};
const titleCase = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
const CHARACTERISTIC_SHORT = {
  brawn: "Br",
  agility: "Ag",
  intellect: "Int",
  cunning: "Cun",
  willpower: "Will",
  presence: "Pr",
};
async function customSkillDialog(actor, id = "") {
  const definition = id
      ? actor.skillDefinition(customSkillKey(id))
      : null,
    skill = definition?.state ?? {
      label: "",
      characteristic: "intellect",
      type: "general",
      rank: 0,
      career: false,
      group: false,
    };
  if (id && !definition) throw new Error("Custom skill was not found.");
  const result = await DialogV2.prompt({
    window: {
      title: id ? `Edit custom skill · ${skill.label}` : "Add custom skill",
    },
    classes: ["star-wars"],
    position: { width: 440 },
    content: `<div class="sf-dialog sf-custom-skill-dialog">
      <label>Skill name<input name="label" maxlength="60" value="${escapeHTML(skill.label)}" autofocus></label>
      <label>Characteristic<select name="characteristic">${optionsHTML(CHARACTERISTICS, skill.characteristic)}</select></label>
      <label>Automatic roll handling<select name="type">${optionsHTML(CUSTOM_SKILL_TYPES, skill.type)}</select></label>
      <label>Current rank<input type="number" name="rank" min="0" max="${actor.type === "character" ? 5 : 10}" value="${skill.rank}"></label>
      <label><input type="checkbox" name="career" ${skill.career ? "checked" : ""}> Career skill</label>
      ${actor.type === "minion" ? `<label><input type="checkbox" name="group" ${skill.group ? "checked" : ""}> Minion group skill</label>` : ""}
      <p class="sf-hint">General skills use a chosen task difficulty. Combat skills use the selected target, range, defense and Adversary rating.</p>
    </div>`,
    ok: {
      label: id ? "Save changes" : "Add skill",
      icon: id ? "fa-solid fa-check" : "fa-solid fa-plus",
      callback: (_event, button) => {
        const data = Object.fromEntries(new FormData(button.form));
        return {
          label: data.label,
          characteristic: data.characteristic,
          type: data.type,
          rank: Number(data.rank),
          career: !!data.career,
          group: !!data.group,
        };
      },
    },
    rejectClose: false,
  });
  if (!result) return null;
  return id
    ? actor.updateCustomSkill(id, result)
    : actor.createCustomSkill(result);
}
async function motivationDialog(actor, id = "") {
  const motivation = id
    ? actor.motivationSources().find((entry) => entry.id === id)
    : {
        name: "",
        category: "",
        description: "",
        active: true,
        source: { book: "", page: "", table: "", id: "" },
      };
  if (!motivation) throw new Error("Motivation was not found.");
  const result = await DialogV2.prompt({
    window: {
      title: id ? `Edit motivation · ${motivation.name}` : "Add motivation",
    },
    classes: ["star-wars"],
    position: { width: 520 },
    content: `<div class="sf-dialog sf-motivation-dialog">
      <label>Motivation<input name="name" maxlength="160" value="${escapeHTML(motivation.name)}" autofocus></label>
      <label>Category or type<input name="category" maxlength="100" value="${escapeHTML(motivation.category)}" placeholder="Ambition, Cause, Relationship…"></label>
      <label>Player and GM guidance<textarea name="description" maxlength="4000" rows="6">${escapeHTML(motivation.description)}</textarea></label>
      <label><input type="checkbox" name="active" ${motivation.active ? "checked" : ""}> Active motivation</label>
      <div class="sf-form-grid">
        <label>Source book<input name="book" maxlength="160" value="${escapeHTML(motivation.source.book)}"></label>
        <label>Page<input name="page" maxlength="32" value="${escapeHTML(motivation.source.page)}"></label>
      </div>
    </div>`,
    ok: {
      label: id ? "Save changes" : "Add motivation",
      icon: id ? "fa-solid fa-check" : "fa-solid fa-plus",
      callback: (_event, button) => {
        const data = Object.fromEntries(new FormData(button.form));
        return {
          name: data.name,
          category: data.category,
          description: data.description,
          active: !!data.active,
          source: {
            book: data.book,
            page: data.page,
            table: motivation.source.table,
            id: motivation.source.id,
          },
        };
      },
    },
    rejectClose: false,
  });
  if (!result) return null;
  return id
    ? actor.updateMotivation(id, result)
    : actor.createMotivation(result);
}
function poolBuilderContext(actor, key, item, skill, characteristic, rank) {
  const combat = skill.group === "Combat",
    melee = skill.melee ?? ["brawl", "melee", "lightsaber"].includes(key),
    target = targetContext(key, melee, actor),
    weaponRange = RANGES.includes(item?.system.range) ? item.system.range : "",
    vehicleScale =
      actor.type === "vehicle" || item?.system.scale === "vehicle",
    rangeOptions =
      target.rangeScale && target.rangeScale !== "personal"
        ? VEHICLE_RANGES
        : vehicleScale
          ? VEHICLE_RANGES
          : PERSONAL_RANGES,
    rangeBand = melee
      ? "engaged"
      : target.rangeBand ||
        (weaponRange === "engaged"
          ? "engaged"
          : vehicleScale
            ? "close"
            : "short"),
    context = {
      actorName: actor.name,
      skillKey: key,
      skillLabel: skill.label,
      characteristic,
      characteristicLabel: CHARACTERISTICS[characteristic],
      characteristicValue: Number(actor.system.characteristics[characteristic]),
      rank,
      combat,
      melee,
      itemName: item?.name ?? "",
      weaponRange,
      target,
      difficulty: 2,
      rangeBand,
      rangeOptions,
      talentRules: actor.talentRulesForCheck(key),
    };
  context.automatic = automaticCheckPool({
    characteristic: context.characteristicValue,
    rank,
    skill: key,
    weaponRange,
    rangeBand,
    difficulty: context.difficulty,
    defense: target.defense,
    adversary: target.adversary,
    combat,
    melee,
    talentRules: context.talentRules,
  });
  return context;
}
function automaticContextHTML(context) {
  if (!context.combat)
    return `<div class="sf-auto-context">
      <i class="fa-solid fa-gauge-high" aria-hidden="true"></i>
      <div><strong>Task difficulty</strong><span>Choose the difficulty that best matches the current action.</span></div>
    </div>`;
  const measuredRange = context.target.rangeSource === "overlay"
      ? ` · ${context.target.rangeBand === "beyond" ? "Beyond Extreme" : `${titleCase(context.target.rangeBand)} range`} (${context.target.rangeMode === "map" ? "map scale" : "ToM calibration"})`
      : "",
    target = context.target.name
    ? `<strong>${escapeHTML(context.target.name)}</strong><span>${context.target.defense} ${context.melee ? "melee" : "ranged"} defence · Adversary ${context.target.adversary}${measuredRange}${context.target.extraTargets ? ` · ${context.target.extraTargets} other target${context.target.extraTargets === 1 ? "" : "s"} ignored` : ""}</span>`
    : "<strong>No target selected</strong><span>Select a token to add its defence and Adversary upgrades automatically.</span>";
  return `<div class="sf-auto-context">
    <i class="fa-solid fa-crosshairs" aria-hidden="true"></i>
    <div>${target}</div>
  </div>`;
}
function poolBuilderHTML(context) {
  const pool = context.automatic.pool,
    automaticControl = context.combat
      ? context.melee
        ? `<div class="sf-fixed-range"><span class="sf-eyebrow">Range</span><strong>Engaged</strong><small>Melee attacks use Average difficulty.</small></div>`
        : `<div class="sf-range-presets">${context.rangeOptions.map(
            (range) =>
              `<button type="button" data-auto-range="${range}" class="${range === context.rangeBand ? "active" : ""}"><span>${titleCase(range)}</span><small>${range === "engaged" ? "Close contact" : `${{ close: 1, short: 1, medium: 2, long: 3, extreme: 4 }[range]} difficulty`}</small></button>`,
          ).join("")}</div>`
      : `<div class="sf-difficulty-presets">${difficultyPresetsHTML(context.difficulty, "data-auto-difficulty")}</div>`;
  return `<div class="sf-pool-builder">
    <section class="sf-pool-origin">
      <div><span class="sf-eyebrow">SKILL + CHARACTERISTIC</span>
      <h2>${escapeHTML(context.itemName || context.skillLabel)}</h2>
      <p><strong>${escapeHTML(context.skillLabel)}</strong> uses <strong>${escapeHTML(context.characteristicLabel)} ${context.characteristicValue}</strong> with <strong>rank ${context.rank}</strong>.</p></div>
      <div class="sf-builder-mode" role="tablist" aria-label="Dice pool mode">
        <button type="button" class="active" data-builder-mode="auto" role="tab" aria-selected="true"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i><span>Auto<small>Use sheet & target</small></span></button>
        <button type="button" data-builder-mode="manual" role="tab" aria-selected="false"><i class="fa-solid fa-sliders" aria-hidden="true"></i><span>Manual<small>Set every die</small></span></button>
      </div>
    </section>
    <section class="sf-pool-preview" aria-live="polite">
      <span>Dice to roll</span><div data-pool-preview>${poolPreviewHTML(pool)}</div>
    </section>
    <div data-mode-panel="auto">
      <section class="sf-pool-section sf-auto-section">
        <div class="sf-pool-section-title"><div><span class="sf-step-number">1</span><h3>${context.combat ? context.melee ? "Attack at engaged range" : "Choose the range band" : "Choose the task difficulty"}</h3><p>${context.combat ? "The selected target supplies opposition automatically." : "Your characteristic and training are already included."}</p></div></div>
        ${automaticControl}
        ${automaticContextHTML(context)}
      </section>
      <section class="sf-auto-breakdown">
        <div class="sf-auto-explanation"><span class="sf-eyebrow">WHY THIS POOL?</span><ul data-auto-reasons></ul></div>
        <p class="sf-pool-error" data-auto-error hidden></p>
        <div class="sf-auto-actions"><button type="button" data-modify-pool><i class="fa-solid fa-sliders" aria-hidden="true"></i><span>Modify this pool<small>Copy these dice into Manual</small></span></button></div>
      </section>
    </div>
    <div data-mode-panel="manual" hidden>
      <section class="sf-pool-section">
        <div class="sf-pool-section-title"><div><span class="sf-step-number">1</span><h3>Adjust the automatic pool</h3><p>The automatic dice are already loaded. Change only what the situation requires.</p></div><button type="button" data-pool-reset><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Reset to auto</button></div>
        <div class="sf-difficulty-presets sf-manual-presets">${difficultyPresetsHTML(pool.challenge ? -1 : pool.difficulty, "data-manual-difficulty")}</div>
      <div class="sf-pool-groups">
        <fieldset><legend>Skill</legend>${poolControlHTML("ability", pool.ability)}${poolControlHTML("proficiency", pool.proficiency)}<div class="sf-upgrade-row"><button type="button" data-pool-upgrade="positive" data-direction="1">Upgrade skill die</button><button type="button" data-pool-upgrade="positive" data-direction="-1">Downgrade</button></div></fieldset>
        <fieldset><legend>Opposition</legend>${poolControlHTML("difficulty", pool.difficulty)}${poolControlHTML("challenge", pool.challenge)}<div class="sf-upgrade-row"><button type="button" data-pool-upgrade="negative" data-direction="1">Upgrade difficulty</button><button type="button" data-pool-upgrade="negative" data-direction="-1">Downgrade</button></div></fieldset>
        <fieldset><legend>Situation</legend>${poolControlHTML("boost", pool.boost)}${poolControlHTML("setback", pool.setback)}${poolControlHTML("force", pool.force)}</fieldset>
      </div>
      </section>
    </div>
    <input type="hidden" name="poolMode" value="auto">
    <label class="sf-roll-visibility">Roll visibility<select name="rollMode">${optionsHTML({ publicroll: "Public", gmroll: "GM", blindroll: "Blind GM", selfroll: "Self" }, game.settings.get("core", "rollMode"))}</select></label>
  </div>`;
}
function attachPoolBuilder(dialog, context) {
  const root = dialog.element.querySelector(".sf-pool-builder");
  if (!root || root.dataset.ready) return;
  root.dataset.ready = "true";
  const readPool = () =>
    Object.fromEntries(
      ROLL_DICE.map((key) => [
        key,
        Math.max(0, Math.min(40, Number(root.querySelector(`[name="${key}"]`).value) || 0)),
      ]),
    );
  const writePool = (pool) => {
    for (const key of ROLL_DICE) root.querySelector(`[name="${key}"]`).value = pool[key];
    root.querySelector("[data-pool-preview]").innerHTML = poolPreviewHTML(pool);
    for (const button of root.querySelectorAll("[data-manual-difficulty]"))
      button.classList.toggle(
        "active",
        pool.challenge === 0 &&
          Number(button.dataset.manualDifficulty) === pool.difficulty,
      );
  };
  const automatic = () =>
    automaticCheckPool({
      characteristic: context.characteristicValue,
      rank: context.rank,
      skill: context.skillKey,
      weaponRange: context.weaponRange,
      rangeBand:
        root.querySelector("[data-auto-range].active")?.dataset.autoRange ??
        context.rangeBand,
      difficulty: Number(
        root.querySelector("[data-auto-difficulty].active")?.dataset
          .autoDifficulty ?? context.difficulty,
      ),
      defense: context.target.defense,
      adversary: context.target.adversary,
      combat: context.combat,
      melee: context.melee,
      talentRules: context.talentRules,
    });
  const renderAutomatic = () => {
    const result = automatic();
    writePool(result.pool);
    const reasons = [
      `${context.characteristicLabel} ${context.characteristicValue} + ${context.skillLabel} rank ${context.rank}: ${result.pool.ability} ability, ${result.pool.proficiency} proficiency`,
      ...result.reasons.slice(1),
    ];
    root.querySelector("[data-auto-reasons]").innerHTML = reasons
      .map((reason) => `<li>${escapeHTML(reason)}</li>`)
      .join("");
    const error = root.querySelector("[data-auto-error]");
    error.hidden = !result.error;
    error.textContent = result.error;
    root.dataset.autoError = result.error ? "true" : "false";
    const submit = dialog.element.querySelector('button[data-action="ok"]');
    if (submit && root.dataset.mode !== "manual") submit.disabled = !!result.error;
  };
  const setMode = (mode) => {
    root.dataset.mode = mode;
    root.querySelector('[name="poolMode"]').value = mode;
    for (const button of root.querySelectorAll("[data-builder-mode]")) {
      const active = button.dataset.builderMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    }
    for (const panel of root.querySelectorAll("[data-mode-panel]"))
      panel.hidden = panel.dataset.modePanel !== mode;
    const submit = dialog.element.querySelector('button[data-action="ok"]');
    if (mode === "auto") renderAutomatic();
    else if (submit) submit.disabled = false;
  };
  const enterManual = () => {
    writePool(automatic().pool);
    setMode("manual");
  };
  root.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    let pool = readPool();
    if (button.hasAttribute("data-builder-mode")) {
      if (
        button.dataset.builderMode === "manual" &&
        root.dataset.mode !== "manual"
      )
        enterManual();
      else setMode(button.dataset.builderMode);
      return;
    }
    if (button.hasAttribute("data-modify-pool")) {
      enterManual();
      return;
    }
    if (button.hasAttribute("data-auto-range")) {
      for (const peer of root.querySelectorAll("[data-auto-range]"))
        peer.classList.toggle("active", peer === button);
      renderAutomatic();
      return;
    }
    if (button.hasAttribute("data-auto-difficulty")) {
      for (const peer of root.querySelectorAll("[data-auto-difficulty]"))
        peer.classList.toggle("active", peer === button);
      renderAutomatic();
      return;
    }
    if (button.hasAttribute("data-pool-delta"))
      pool = adjustPool(pool, button.closest("[data-die]").dataset.die, Number(button.dataset.poolDelta));
    else if (button.hasAttribute("data-manual-difficulty"))
      pool = setDifficulty(pool, Number(button.dataset.manualDifficulty));
    else if (button.hasAttribute("data-pool-upgrade"))
      pool = shiftUpgrade(pool, button.dataset.poolUpgrade, Number(button.dataset.direction));
    else if (button.hasAttribute("data-pool-reset")) pool = automatic().pool;
    else return;
    writePool(pool);
  });
  root.addEventListener("input", (event) => {
    if (event.target.matches("[data-die] input")) writePool(readPool());
  });
  setMode("auto");
}
export async function checkDialog(actor, key, item) {
  const definition = actor.skillDefinition(key);
  if (!definition) throw new Error("Select a valid skill.");
  actor.assertOwner();
  if (actor.isVehicle || actor.type === "group")
    throw new Error("Choose a character's native skill.");
  const characteristic =
      definition.state.characteristic || definition.characteristic,
    rank = actor.skillRank(definition.key),
    context = poolBuilderContext(
      actor,
      definition.key,
      item,
      definition,
      characteristic,
      rank,
    );
  const form = await DialogV2.prompt({
    window: { title: `${item?.name ?? definition.label} · Build dice pool` },
    classes: ["star-wars", "sf-pool-builder-window"],
    position: { width: 780 },
    content: poolBuilderHTML(context),
    render: (_event, dialog) => attachPoolBuilder(dialog, context),
    ok: {
      label: "Roll these dice",
      icon: "fa-solid fa-dice",
      callback: (_event, button) => {
        const data = Object.fromEntries(new FormData(button.form));
        return {
          rollMode: data.rollMode,
          pool: Object.fromEntries(
            ROLL_DICE.map((die) => [die, Number(data[die])]),
          ),
        };
      },
    },
    rejectClose: false,
  });
  if (!form) return;
  const result = await rollPool(form.pool, {
    label: `${actor.name} · ${item?.name ?? definition.label}`,
    actor,
    rollMode: form.rollMode,
    automaticResults: context.talentRules.automaticResults,
    ruleNotes: context.talentRules.reasons,
  });
  if (item && result.outcome.passed) {
    ui.notifications.info(
      `${item.name}: ${item.damageFor(result.outcome)} damage before soak. Apply weapon qualities and target soak separately.`,
    );
  }
  return result;
}
export class StarWarsActorSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["star-wars"],
    position: { width: 1000, height: 820 },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      switchSection: this.tab,
      setSkillView: this.setSkillView,
      skill: this.skill,
      force: this.force,
      item: this.item,
      addItem: this.addItem,
      removeItem: this.removeItem,
      addCustomSkill: this.addCustomSkill,
      editCustomSkill: this.editCustomSkill,
      removeCustomSkill: this.removeCustomSkill,
      addMotivation: this.addMotivation,
      editMotivation: this.editMotivation,
      removeMotivation: this.removeMotivation,
      buySkill: this.buySkill,
      buyCharacteristic: this.buyCharacteristic,
      buyTalent: this.buyTalent,
      damage: this.damage,
      createCharacter: this.createCharacter,
      verifySource: this.verifySource,
      gmNotes: this.gmNotes,
    },
  };
  static PARTS = { sheet: { template: `${SYSTEM_PATH}/templates/actor.hbs` } };
  activeTab = "overview";
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.hasGMNotes =
      game.user.isGM && !!this.actor.getFlag(SYSTEM_ID, "swa")?.notesId;
    const actor = this.actor,
      s = actor.system;
    const campaign = game.settings.get(SYSTEM_ID, "campaign"),
      skillViewMode = game.settings.get(SYSTEM_ID, "skillView"),
      sheetTheme = game.settings.get(SYSTEM_ID, "sheetTheme"),
      themeKey = resolveSheetTheme(
        s.theme === "auto" ? sheetTheme : s.theme,
        s.line,
        campaign.lines,
      );
    const skillView = (definition, index = -1) => {
        const state = definition.state,
          characteristic = state.characteristic || definition.characteristic;
        return {
          key: definition.key,
          id: definition.id,
          label: definition.label,
          characteristic,
          characteristicShort: CHARACTERISTIC_SHORT[characteristic],
          career: state.career,
          group: state.group,
          category: definition.group,
          rank: state.rank,
          custom: definition.custom,
          path: definition.custom
            ? `system.customSkills.${index}`
            : `system.skills.${definition.key}`,
          ...(() => {
            try {
              const p = skillPool(
                s.characteristics[characteristic],
                actor.skillRank(definition.key),
                { difficulty: 0 },
              );
              return {
                pool: `${p.proficiency} proficiency · ${p.ability} ability`,
                poolDice: ["proficiency", "ability"]
                  .filter((die) => p[die])
                  .map((die) => ({
                    key: die,
                    count: p[die],
                    label: DICE[die].label,
                  })),
                characteristicLabel: CHARACTERISTICS[characteristic],
                characteristicValue: s.characteristics[characteristic],
              };
            } catch {
              return { pool: "Verify statistics", poolDice: [] };
            }
          })(),
          characteristicOptions: CHARACTERISTICS,
          characteristicShortOptions: CHARACTERISTIC_SHORT,
          cap: actor.type === "character" ? 5 : 10,
          showGroup: actor.type === "minion",
        };
      },
      skills = actor.isVehicle
        ? []
        : Object.keys(SKILLS).map((key) =>
            skillView(actor.skillDefinition(key)),
          ),
      customSkills = actor.isVehicle
        ? []
        : Array.from(s.customSkills ?? []).flatMap((skill, index) => {
            const definition = actor.skillDefinition(customSkillKey(skill.id));
            return definition ? [skillView(definition, index)] : [];
          });
    const skillColumns = actor.isVehicle
      ? []
      : buildSkillColumns(skills, customSkills, skillViewMode);
    const advancementTree = (item) => {
        const tree = item.system.tree,
          signature = item.type === "signatureAbility",
          owned = s.advancement
            .filter((e) => e.itemId === item.id)
            .map((e) => e.nodeId);
        const specializationIds = new Set(
            actor.items
              .filter((candidate) => candidate.type === "specialization")
              .map((candidate) => candidate.id),
          ),
          shared = new Set(
            s.advancement
              .filter(
                (entry) =>
                  entry.ranked === false &&
                  specializationIds.has(entry.itemId),
              )
              .map((e) => e.name.toLowerCase()),
          );
        const available = signature
            ? availableSignatureNodes(actor, item)
            : tree?.verified
              ? availableTalents(
                  tree,
                  owned,
                  s.advancement
                    .filter(
                      (entry) =>
                        entry.ranked === false &&
                        specializationIds.has(entry.itemId),
                    )
                    .map((e) => e.name),
                )
              : [],
          rows = Math.max(
            1,
            ...Array.from(tree?.nodes ?? [], (node) => Number(node.row) + 1),
          ),
          link = signature ? signatureLinkState(actor, item) : null;
        return {
          id: item.id,
          name: item.name,
          signature,
          source: item.system.source,
          verified: tree?.verified,
          treeHeight: rows * 130,
          svgHeight: rows * 130,
          linkSpecialization: link?.specialization?.name ?? "",
          linkUnlocked: link?.unlocked ?? false,
          nodes: (tree?.nodes ?? []).map((n) => ({
            ...n,
            itemId: item.id,
            automatic:
              n.activation === "Passive" && (n.effects?.length ?? 0) > 0,
            automationLabel:
              n.activation === "Passive" && (n.effects?.length ?? 0) > 0
                ? "Auto"
                : n.summary
                  ? n.activation || "Guidance"
                  : "Book reference",
            owned: owned.includes(n.id),
            knownElsewhere:
              !signature &&
              !owned.includes(n.id) &&
              n.ranked === false &&
              shared.has(n.name.toLowerCase()),
            available: available.some((a) => a.id === n.id),
            disabled:
              !this.isEditable ||
              !available.some((a) => a.id === n.id) ||
              n.cost > s.xp.available,
            x: n.col * 25 + 0.5,
            y: n.row * (100 / rows) + 1,
            width: Math.max(1, Number(n.span) || 1) * 25 - 1,
            height: 100 / rows - 3,
          })),
          edges: (tree?.edges ?? []).map(([a, b]) => {
            const n = tree.nodes.find((n) => n.id === a),
              m = tree.nodes.find((n) => n.id === b);
            return {
              x1: (n.col + (Number(n.span) || 1) / 2) * 200,
              y1: n.row * 130 + 65,
              x2: (m.col + (Number(m.span) || 1) / 2) * 200,
              y2: m.row * 130 + 65,
            };
          }),
        };
      },
      specializations = actor.items
        .filter((item) => item.type === "specialization")
        .map(advancementTree),
      signatureAbilities = actor.items
        .filter((item) => item.type === "signatureAbility")
        .map(advancementTree),
      advancementTrees = [...specializations, ...signatureAbilities];
    const stats = actor.isVehicle
      ? [
          ["hullTrauma", "Hull trauma"],
          ["systemStrain", "System strain"],
        ]
      : [
          ["wounds", "Wounds"],
          ["strain", "Strain"],
        ];
    return {
      ...context,
      actor,
      system: s,
      editable: this.isEditable,
      isVehicle: actor.isVehicle,
      isMinion: actor.type === "minion",
      skillCap: actor.type === "character" ? 5 : 10,
      minions:
        actor.type === "minion"
          ? minionState(s.groupSize, s.wounds.value, Math.max(1, s.wounds.max))
          : null,
      themeKey,
      theme: THEMES[themeKey],
      themes: {
        auto: `Automatic · ${THEMES[themeKey].name}`,
        ...Object.fromEntries(
          Object.entries(THEMES).map(([k, v]) => [k, v.name]),
        ),
      },
      campaign,
      creation: s.phase === "creation",
      tabs: ["overview", "skills", "inventory", "advancement", "story"]
        .filter(
          (k) =>
            !actor.isVehicle || ["overview", "inventory", "story"].includes(k),
        )
        .map((id) => ({
          id,
          label: id.charAt(0).toUpperCase() + id.slice(1),
          active: this.activeTab === id,
        })),
      overview: this.activeTab === "overview",
      activeTab: this.activeTab,
      showSkills: this.activeTab === "skills",
      inventory: this.activeTab === "inventory",
      advancement: this.activeTab === "advancement",
      story: this.activeTab === "story",
      characteristics: actor.isVehicle
        ? []
        : Object.entries(CHARACTERISTICS).map(([key, label]) => ({
            key,
            label,
            value: s.characteristics[key],
          })),
      skills,
      skillColumns,
      skillView: skillViewMode,
      skillViews: Object.entries(SKILL_VIEWS).map(([id, label]) => ({
        id,
        label,
        active: skillViewMode === id,
      })),
      specializations,
      signatureAbilities,
      advancementTrees,
      motivations: Array.from(s.motivations ?? []),
      resources: stats.map(([key, label]) => ({
        key,
        label,
        ...s[key],
        exceeded: s[key].value > s[key].max,
      })),
      items: actor.items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        img: item.img,
        system: item.system,
        weapon: item.type === "weapon",
      })),
      vehicleFields: ["armor", "silhouette", "handling"].map((key) => ({
        key,
        value: s[key],
        label: key.charAt(0).toUpperCase() + key.slice(1),
      })),
      shields: actor.isVehicle
        ? Object.entries(s.shields).map(([key, value]) => ({ key, value }))
        : [],
      lines: Object.fromEntries(
        Object.entries(RULE_LINES).map(([k, v]) => [k, v.label]),
      ),
    };
  }
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.theme = context.themeKey;
    if (this.activeTab === "skills") {
      requestAnimationFrame(() => {
        if (this.activeTab !== "skills" || !this.element?.isConnected) return;
        const content = this.element.querySelector(".window-content"),
          overflow = content
            ? Math.max(0, content.scrollHeight - content.clientHeight)
            : 0;
        const height = Math.min(
          window.innerHeight - 48,
          this.position.height + overflow,
        );
        if (overflow > 1 && height > this.position.height)
          this.setPosition({ height });
      });
    } else if (this.position.height !== 820)
      this.setPosition({ height: 820 });
    this.element.addEventListener("dragover", (event) =>
      event.preventDefault(),
    );
    this.element.addEventListener("drop", (event) => this.onDrop(event));
  }
  async onDrop(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    try {
      const data =
        foundry.applications.ux.TextEditor.implementation.getDragEventData(
          event,
        );
      if (data.type !== "Item" || !data.uuid) return;
      const item = await fromUuid(data.uuid);
      if (!item || item.documentName !== "Item") return;
      const campaign = game.settings.get(SYSTEM_ID, "campaign");
      if (!bookAllowed(item.system.source.book, campaign))
        throw new Error("This book is not enabled for this campaign.");
      if (item.type === "specialization" && this.actor.type === "character") {
        const cost = this.actor.specializationPrice(item);
        if (
          await DialogV2.confirm({
            window: { title: "Acquire specialization" },
            content: `<p>Add ${escapeHTML(item.name)} for ${cost} XP? Its additional skills become career skills; this does not grant another set of free ranks.</p>`,
          })
        )
          await this.actor.acquireSpecialization(item);
        return;
      }
      if (
        item.type === "signatureAbility" &&
        this.actor.type === "character"
      ) {
        const candidates = this.actor.signatureAttachmentCandidates(item);
        if (!candidates.length)
          throw new Error(
            "Add a specialization from this signature ability's career before attaching it.",
          );
        const specializationId =
          candidates.length === 1
            ? candidates[0].id
            : await DialogV2.prompt({
                window: { title: `Attach ${item.name}` },
                content: `<label>Linked specialization<select name="specialization">${optionsHTML(Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate.name])))}</select></label>`,
                ok: {
                  label: "Attach ability",
                  callback: (_event, button) =>
                    button.form.elements.specialization.value,
                },
                rejectClose: false,
              });
        if (specializationId)
          await this.actor.acquireSignatureAbility(item, specializationId);
        return;
      }
      if (
        this.actor.type === "character" &&
        ["motivation", "deteremine_motivation"].includes(
          item.system.source?.table,
        )
      ) {
        await this.actor.createMotivation({
          name: item.name,
          category: String(
            item.system.metadata?.Motivation_Type ??
              item.system.metadata?.Career ??
              "",
          ),
          description: item.system.description ?? "",
          active: true,
          source: item.system.source,
        });
        return;
      }
      const copy = item.toObject();
      delete copy._id;
      await this.actor.createEmbeddedDocuments("Item", [copy]);
    } catch (error) {
      notifyError(error);
    }
  }
  static tab(_event, target) {
    this.activeTab = target.dataset.tab;
    this.render();
  }
  static async setSkillView(_event, target) {
    const view = target.dataset.skillView;
    if (!Object.hasOwn(SKILL_VIEWS, view)) return;
    await game.settings.set(SYSTEM_ID, "skillView", view);
    this.render();
  }
  static gmNotes() {
    openGMSourceNotes(this.actor).catch((error) => notifyError(error));
  }
  static async skill(_event, target) {
    try {
      const item = target.dataset.item
        ? this.actor.items.get(target.dataset.item)
        : null;
      await checkDialog(
        this.actor,
        item?.system.skill ?? target.dataset.skill,
        item,
      );
    } catch (error) {
      notifyError(error);
    }
  }
  static async force() {
    try {
      await this.actor.rollForce();
    } catch (error) {
      notifyError(error);
    }
  }
  static item(_event, target) {
    this.actor.items.get(target.dataset.item)?.sheet.render({ force: true });
  }
  static async addItem() {
    await this.actor.createEmbeddedDocuments("Item", [
      { name: "New equipment", type: "gear" },
    ]);
  }
  static async removeItem(_event, target) {
    if (
      await DialogV2.confirm({
        window: { title: "Remove item" },
        content: "Remove this item from the actor?",
      })
    )
      await this.actor.deleteEmbeddedDocuments("Item", [target.dataset.item]);
  }
  static async addCustomSkill() {
    try {
      await customSkillDialog(this.actor);
      this.render();
    } catch (error) {
      notifyError(error);
    }
  }
  static async editCustomSkill(_event, target) {
    try {
      await customSkillDialog(this.actor, target.dataset.customId);
      this.render();
    } catch (error) {
      notifyError(error);
    }
  }
  static async removeCustomSkill(_event, target) {
    try {
      const definition = this.actor.skillDefinition(
        customSkillKey(target.dataset.customId),
      );
      if (!definition) throw new Error("Custom skill was not found.");
      if (
        await DialogV2.confirm({
          window: { title: `Remove custom skill · ${definition.label}` },
          content: `<p>Remove <strong>${escapeHTML(definition.label)}</strong> from this actor? Its past XP entries remain in the advancement record.</p>`,
        })
      ) {
        await this.actor.deleteCustomSkill(definition.id);
        this.render();
      }
    } catch (error) {
      notifyError(error);
    }
  }
  static async addMotivation() {
    try {
      await motivationDialog(this.actor);
      this.render();
    } catch (error) {
      notifyError(error);
    }
  }
  static async editMotivation(_event, target) {
    try {
      await motivationDialog(this.actor, target.dataset.motivationId);
      this.render();
    } catch (error) {
      notifyError(error);
    }
  }
  static async removeMotivation(_event, target) {
    try {
      const motivation = this.actor
        .motivationSources()
        .find((entry) => entry.id === target.dataset.motivationId);
      if (!motivation) throw new Error("Motivation was not found.");
      if (
        await DialogV2.confirm({
          window: { title: `Remove motivation · ${motivation.name}` },
          content: `<p>Remove <strong>${escapeHTML(motivation.name)}</strong> from this character?</p>`,
        })
      ) {
        await this.actor.deleteMotivation(motivation.id);
        this.render();
      }
    } catch (error) {
      notifyError(error);
    }
  }
  static async buySkill(_event, target) {
    try {
      await this.actor.buySkill(target.dataset.skill);
    } catch (error) {
      notifyError(error);
    }
  }
  static async buyCharacteristic(_event, target) {
    try {
      await this.actor.buyCharacteristic(target.dataset.characteristic);
    } catch (error) {
      notifyError(error);
    }
  }
  static async buyTalent(_event, target) {
    try {
      target.disabled = true;
      const node = this.actor.items
        .get(target.dataset.item)
        ?.system.tree.nodes.find((n) => n.id === target.dataset.node);
      let characteristic;
      if (node?.name.toLowerCase() === "dedication") {
        characteristic = await DialogV2.prompt({
          window: { title: "Dedication · Choose a characteristic" },
          content: `<select name="characteristic">${optionsHTML(Object.fromEntries(Object.entries(CHARACTERISTICS).filter(([key]) => this.actor.system.characteristics[key] < 6)))}</select>`,
          ok: {
            label: "Learn talent",
            callback: (_e, b) => b.form.elements.characteristic.value,
          },
          rejectClose: false,
        });
        if (!characteristic) return;
      }
      await this.actor.buyTalent(target.dataset.item, target.dataset.node, {
        characteristic,
      });
    } catch (error) {
      notifyError(error);
    } finally {
      this.render();
    }
  }
  static async verifySource() {
    if (
      await DialogV2.confirm({
        window: { title: "Confirm source review" },
        content:
          "Have the missing statistics or species exceptions been checked against the source and applied to this sheet?",
      })
    )
      await this.actor.update({ "system.incomplete": [] });
  }
  static async damage() {
    try {
      const result = await DialogV2.prompt({
        window: { title: "Apply damage" },
        content: `<div class="sf-dialog">${numericInput("amount", "Incoming damage", 1, 100000)}${numericInput("pierce", "Pierce", 0)}<label><input type="checkbox" name="strain"> Strain damage</label><label><input type="checkbox" name="ignoreSoak"> Ignore soak / armor</label></div>`,
        ok: {
          label: "Apply",
          callback: (_event, button) =>
            Object.fromEntries(new FormData(button.form)),
        },
        rejectClose: false,
      });
      if (result)
        await this.actor.applyDamage(Number(result.amount), {
          pierce: Number(result.pierce),
          strain: !!result.strain,
          ignoreSoak: !!result.ignoreSoak,
        });
    } catch (error) {
      notifyError(error);
    }
  }
  static async createCharacter() {
    try {
      await createCharacterDialog(this.actor);
    } catch (error) {
      notifyError(error);
    }
  }
}
export class StarWarsItemSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["star-wars"],
    position: { width: 650, height: 750 },
    form: { submitOnChange: true, closeOnSubmit: false },
  };
  static PARTS = { sheet: { template: `${SYSTEM_PATH}/templates/item.hbs` } };
  async _prepareContext(options) {
    return {
      ...(await super._prepareContext(options)),
      item: this.item,
      system: this.item.system,
      editable: this.isEditable,
      weapon: this.item.type === "weapon",
      armor: this.item.type === "armor",
      signatureAbility: this.item.type === "signatureAbility",
      skills: Object.fromEntries(
        [
          ...Object.entries(SKILLS).map(([k, v]) => [k, v.label]),
          ...Array.from(this.item.actor?.system.customSkills ?? [], (skill) => [
            customSkillKey(skill.id),
            skill.label,
          ]),
        ],
      ),
      ranges: Object.fromEntries(RANGES.map((r) => [r, r])),
      metadata: Object.entries(this.item.system.metadata ?? {}).map(
        ([key, value]) => ({ key: key.replaceAll("_", " "), value }),
      ),
      hasTree: this.item.system.tree?.nodes?.length,
      fields: ["quantity", "price", "rarity", "encumbrance", "hardpoints"].map(
        (key) => ({ key, value: this.item.system[key] }),
      ),
    };
  }
}
export async function importDialog() {
  try {
    const file = await DialogV2.prompt({
      window: { title: "Import private reference library" },
      content:
        '<p>Select the JSON produced by the local SQL importer. Existing entries are preserved. This creates compendiums in this world only.</p><input type="file" name="library" accept=".json">',
      ok: {
        label: "Import library",
        callback: (_event, button) => button.form.elements.library.files[0],
      },
      rejectClose: false,
    });
    if (!file) return;
    const report = await importWithProgress(JSON.parse(await file.text()));
    ui.notifications.info(
      `Library ready: ${Object.entries(report)
        .map(([key, v]) => `${key} ${v.created} new, ${v.preserved} preserved`)
        .join("; ")}`,
    );
  } catch (error) {
    notifyError(error);
  }
}
export async function importSwaDialog() {
  try {
    if (!game.user.isGM) throw new Error("Only the GM can import adversaries.");
    const selected = await DialogV2.prompt({
      window: { title: "Import SW Adversaries" },
      content:
        '<p>Select an SW Adversaries export or the full source bundle prepared by scripts/fetch-swa.mjs. Existing actors are preserved.</p><label><input type="checkbox" name="privateNotes" checked>Keep descriptions, behaviour and rule explanations in GM-only source notes for Director of Realms</label><input type="file" name="adversaries" accept=".json">',
      ok: {
        label: "Review import",
        callback: (_event, button) => ({
          file: button.form.elements.adversaries.files[0],
          privateNotes: button.form.elements.privateNotes.checked,
        }),
      },
      rejectClose: false,
    });
    const file = selected?.file;
    if (!file) return;
    if (file.size > 10 * 1024 * 1024)
      throw new Error("Choose a JSON file smaller than 10 MB.");
    const bundle = await convertSwaSource(JSON.parse(await file.text()), {
      includePrivateNotes: selected.privateNotes,
    });
    const report = bundle.report;
    const proceed = await DialogV2.confirm({
      window: { title: "Review adversary import" },
      content: `<p>${report.records} source adversaries · ${bundle.documents.Actor.length} native actors including ${report.vehicles} vehicles · ${report.gmNotes} private GM notes.</p><p>${report.resolvedWeapons} weapon references resolved; ${report.weaponReferences} still require statistics. ${report.rejected.length} records need review before they can become native actors; their source notes are retained when enabled.</p><p>Talent and ability descriptions inform the GM; their mechanical effects still require adjudication.</p><ul>${[
        ...report.review,
        ...report.rejected.map((row) => ({
          name: row.name,
          missing: [row.reason],
          weaponReferences: 0,
        })),
      ]
        .slice(0, 20)
        .map(
          (row) =>
            `<li>${escapeHTML(row.name)}: ${escapeHTML([...row.missing, ...(row.weaponReferences ? [`${row.weaponReferences} weapon references`] : [])].join("; "))}</li>`,
        )
        .join("")}</ul>`,
      yes: { label: "Import into this world" },
      no: { label: "Cancel" },
      rejectClose: false,
    });
    if (!proceed) return;
    const result = await importWithProgress(bundle);
    ui.notifications.info(
      `Adversaries ready: ${result.Actor?.created ?? 0} new, ${result.Actor?.preserved ?? 0} preserved; ${result.GMNotes?.created ?? 0} new private notes.`,
    );
  } catch (error) {
    notifyError(error);
  }
}
export async function campaignDialog() {
  const c = game.settings.get(SYSTEM_ID, "campaign");
  const data = await DialogV2.prompt({
    window: { title: "Campaign rulebooks" },
    content: `<div class="sf-dialog"><p>Rules can be combined. Appearance is chosen independently on each sheet.</p>${Object.entries(
      RULE_LINES,
    )
      .map(
        ([key, line]) =>
          `<label><input type="checkbox" name="${key}" ${c.lines.includes(key) ? "checked" : ""}>${line.label}</label>`,
      )
      .join(
        "",
      )}<hr>${["obligation", "duty", "morality", "beginnerMode"].map((key) => `<label><input type="checkbox" name="${key}" ${c[key] ? "checked" : ""}>${key === "beginnerMode" ? "Use beginner adventure teaching rules" : key.charAt(0).toUpperCase() + key.slice(1)}</label>`).join("")}<p>Use the Owned books menu to manage the shared reference filter.</p></div>`,
    ok: {
      label: "Save campaign",
      callback: (_event, button) =>
        Object.fromEntries(new FormData(button.form)),
    },
    rejectClose: false,
  });
  if (data)
    await game.settings.set(
      SYSTEM_ID,
      "campaign",
      validateCampaign({
        ...c,
        lines: Object.keys(RULE_LINES).filter((key) => data[key]),
        obligation: !!data.obligation,
        duty: !!data.duty,
        morality: !!data.morality,
        beginnerMode: !!data.beginnerMode,
      }),
    );
}
async function createCharacterDialog(actor) {
  if (actor.system.creation?.applied)
    throw new Error(
      "Starting choices have already been applied. Continue with XP advancement.",
    );
  const pack = getLibraryPack("Item");
  if (!pack) throw new Error("Import the local reference library first.");
  const campaign = game.settings.get(SYSTEM_ID, "campaign");
  await pack.getIndex({ fields: ["type", "system.source.book"] });
  const choose = (type) =>
    optionsHTML(
      Object.fromEntries(
        pack.index
          .filter(
            (i) =>
              i.type === type && bookAllowed(i.system?.source?.book, campaign),
          )
          .map((i) => [i._id, i.name])
          .sort((a, b) => a[1].localeCompare(b[1])),
      ),
    );
  const data = await DialogV2.prompt({
    window: { title: "Character creation · Source choices" },
    content: `<div class="sf-dialog"><label>Creation rules<select name="line">${optionsHTML(Object.fromEntries(campaign.lines.map((key) => [key, RULE_LINES[key].label])), actor.system.line)}</select></label>${["species", "career", "specialization"].map((type) => `<label>${type}<select name="${type}">${choose(type)}</select></label>`).join("")}<p>Species-specific exceptions must be checked against the book after these base statistics are applied.</p></div>`,
    ok: {
      label: "Choose free skills",
      callback: (_e, b) => Object.fromEntries(new FormData(b.form)),
    },
    rejectClose: false,
  });
  if (!data) return;
  const [species, career, specialization] = await Promise.all(
    [data.species, data.career, data.specialization].map((id) =>
      pack.getDocument(id),
    ),
  );
  const rule = RULE_LINES[data.line];
  if (specialization.system.career !== career.name)
    throw new Error("Select a specialization belonging to the career.");
  const rankForm = await DialogV2.prompt({
    window: { title: "Character creation · Free skill ranks" },
    content: `<div class="sf-dialog">${[
      ["career", career, rule.freeCareerRanks],
      ["specialization", specialization, rule.freeSpecializationRanks],
    ]
      .map(
        ([key, item, n]) =>
          `<fieldset><legend>${escapeHTML(item.name)}: choose ${Math.min(n, item.system.careerSkills.length)}</legend>${item.system.careerSkills.map((skill) => `<label><input type="checkbox" name="${key}:${skill}">${escapeHTML(SKILLS[skill]?.label ?? skill)}</label>`).join("")}</fieldset>`,
      )
      .join("")}</div>`,
    ok: {
      label: "Apply starting choices",
      callback: (_e, b) => Object.fromEntries(new FormData(b.form)),
    },
    rejectClose: false,
  });
  if (!rankForm) return;
  const system = creationPlan({
    species,
    career,
    specialization,
    line: data.line,
    careerRanks: Object.keys(rankForm)
      .filter((k) => k.startsWith("career:"))
      .map((k) => k.slice(7)),
    specializationRanks: Object.keys(rankForm)
      .filter((k) => k.startsWith("specialization:"))
      .map((k) => k.slice(15)),
  });
  const items = [species, career, specialization].map((item) => {
    const data = item.toObject();
    data._id = foundry.utils.randomID();
    return data;
  });
  await actor.update({
    system,
    items: [...actor.items.map((i) => i.toObject()), ...items],
  });
}
