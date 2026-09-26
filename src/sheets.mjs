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
  CREATION_RESOURCE_CHOICES,
  buildStartingLoadout,
  creationResourcePlan,
  finalizePocketMoney,
  startingEquipmentOptions,
} from "./creation-resources.mjs";
import {
  availableOriginOptions,
  fuzzyOriginOptions,
  ORIGIN_INDEX_FIELDS,
  originChoiceLocked,
  originEntryAllowed,
  originSelectionUpdate,
  referenceRuleLine,
} from "./character-origins.mjs";
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
    elevationDifference: measured?.elevationDifference ?? null,
    elevationApplied: measured?.elevationApplied === true,
    lineOfSight: measured?.lineOfSight ?? "unavailable",
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
    elevation = context.target.elevationApplied
      ? ` · ${context.target.elevationDifference} ${escapeHTML(context.target.sceneUnits)} vertical separation included`
      : "",
    sight =
      context.target.lineOfSight === "blocked"
        ? " · line of sight blocked"
        : context.target.lineOfSight === "clear"
          ? " · line of sight clear"
          : "",
    target = context.target.name
    ? `<strong>${escapeHTML(context.target.name)}</strong><span>${context.target.defense} ${context.melee ? "melee" : "ranged"} defence · Adversary ${context.target.adversary}${measuredRange}${elevation}${sight}${context.target.extraTargets ? ` · ${context.target.extraTargets} other target${context.target.extraTargets === 1 ? "" : "s"} ignored` : ""}</span>`
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
  const automatic = () => {
    const result = automaticCheckPool({
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
    if (
      context.combat &&
      !context.melee &&
      context.target.lineOfSight === "blocked"
    )
      return {
        ...result,
        error:
          result.error ||
          "The selected target is behind a sight-blocking wall. Switch to Manual only after a GM ruling.",
      };
    return result;
  };
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
    window: { resizable: true },
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
      selectOrigin: this.selectOrigin,
      createCharacter: this.createCharacter,
      finishStartingFunds: this.finishStartingFunds,
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
    let originLibraryReady = false,
      originOptions = { species: [], career: [] };
    if (actor.type === "character") {
      const pack = getLibraryPack("Item");
      if (pack) {
        await pack.getIndex({ fields: ORIGIN_INDEX_FIELDS });
        originOptions = availableOriginOptions(pack.index, campaign);
        originLibraryReady = true;
      }
    }
    const originsLocked = originChoiceLocked(s),
      originEditable =
        actor.type === "character" && this.isEditable && !originsLocked;
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
          careerLocked: actor.type === "character" && originsLocked,
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
        const sourceVerification = tree?.verification?.source ?? "pending",
          sourceVerificationLabel =
            sourceVerification === "full-chart"
              ? "Printed chart fully checked"
              : sourceVerification === "connectors-only"
                ? "Printed connectors checked; node comparison pending"
                : "Printed chart comparison pending";
        return {
          id: item.id,
          name: item.name,
          signature,
          source: item.system.source,
          verified: tree?.verified,
          sourceVerification,
          sourceVerificationLabel,
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
      isCharacter: actor.type === "character",
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
      originsLocked,
      characteristicsLocked:
        actor.type === "character" && s.phase !== "creation",
      originEditable,
      originLibraryReady,
      originHelp: originsLocked
        ? "Locked after starting choices are finalised or campaign play begins."
        : !this.isEditable
          ? "You have read-only access to this character."
          : originLibraryReady
            ? "Type to search, then choose a database entry."
            : "Ask the GM to populate the reference compendium.",
      originSelectionReady:
        !!s.creation?.speciesId && !!s.creation?.careerId,
      pocketMoneyPending:
        actor.type === "character" && s.creation?.pocketMoneyPending === true,
      speciesOptions: originOptions.species.map((entry) => ({
        ...entry,
        selected: entry.id === s.creation?.speciesId,
      })),
      careerOptions: originOptions.career.map((entry) => ({
        ...entry,
        selected: entry.id === s.creation?.careerId,
      })),
      campaignRulesLabel: campaign.lines
        .map((key) => RULE_LINES[key]?.label)
        .filter(Boolean)
        .join(" · "),
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
    for (const picker of this.element.querySelectorAll(
      "[data-origin-picker]",
    )) {
      const kind = picker.dataset.originPicker,
        input = picker.querySelector("[data-origin-search]"),
        toggle = picker.querySelector("[data-origin-toggle]"),
        menu = picker.querySelector("[data-origin-menu]"),
        empty = picker.querySelector("[data-origin-empty]"),
        originOptions = context[`${kind}Options`] ?? [];
      if (!input || !menu) continue;
      const buttons = new Map(
          Array.from(menu.querySelectorAll("[data-document-id]"), (button) => [
            button.dataset.documentId,
            button,
          ]),
        ),
        setOpen = (open) => {
          menu.hidden = !open;
          input.setAttribute("aria-expanded", String(open));
          toggle?.setAttribute("aria-expanded", String(open));
        },
        refresh = () => {
          const query =
              input.value === picker.dataset.current ? "" : input.value,
            matches = fuzzyOriginOptions(originOptions, query, 32),
            visible = new Set(matches.map((entry) => entry.id));
          for (const [id, button] of buttons) button.hidden = !visible.has(id);
          for (const entry of matches) {
            const button = buttons.get(entry.id);
            if (button) menu.insertBefore(button, empty);
          }
          if (empty) empty.hidden = matches.length > 0;
        };
      input.addEventListener("focus", () => {
        input.select();
        refresh();
        setOpen(true);
      });
      input.addEventListener("input", () => {
        refresh();
        setOpen(true);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          input.value = picker.dataset.current;
          setOpen(false);
          input.blur();
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          menu.querySelector("[data-document-id]:not([hidden])")?.focus();
        } else if (event.key === "Enter") {
          const match = menu.querySelector(
            "[data-document-id]:not([hidden])",
          );
          if (match) {
            event.preventDefault();
            match.click();
          }
        }
      });
      toggle?.addEventListener("click", () => {
        refresh();
        setOpen(menu.hidden);
        if (!menu.hidden) input.focus();
      });
      for (const button of buttons.values())
        button.addEventListener("mousedown", (event) =>
          event.preventDefault(),
        );
      picker.addEventListener("focusout", (event) => {
        if (picker.contains(event.relatedTarget)) return;
        input.value = picker.dataset.current;
        setOpen(false);
      });
    }
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
    }
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
  static async selectOrigin(_event, target) {
    try {
      const kind = target.dataset.kind;
      if (this.actor.type !== "character")
        throw new Error("Origin choices are available on player characters.");
      if (originChoiceLocked(this.actor.system))
        throw new Error(
          "Species and starting career are locked after character creation or campaign play begins.",
        );
      if (!["species", "career"].includes(kind))
        throw new Error("Unknown character origin choice.");
      const pack = getLibraryPack("Item");
      if (!pack) throw new Error("Ask the GM to populate the reference compendium first.");
      const entry = await pack.getDocument(target.dataset.documentId),
        campaign = game.settings.get(SYSTEM_ID, "campaign"),
        update = originSelectionUpdate(
          kind,
          entry,
          this.actor.system,
          campaign,
        );
      await this.actor.update({ system: update });
      ui.notifications.info(`${entry.name} selected as ${kind}.`);
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
  static async finishStartingFunds(_event, target) {
    target.disabled = true;
    try {
      const roll = await new Roll("1d100").evaluate(),
        update = finalizePocketMoney(this.actor.system, Number(roll.total));
      await this.actor.update({
        "system.credits": update.credits,
        "system.creation": update.creation,
      });
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `${this.actor.name} · Starting pocket money`,
      });
      ui.notifications.info(
        `${roll.total} credits added after starting equipment purchases.`,
      );
    } catch (error) {
      notifyError(error);
    } finally {
      this.render();
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
  if (!game.user.isGM)
    throw new Error("Only the GM can change campaign rules or adventure state.");
  const c = game.settings.get(SYSTEM_ID, "campaign");
  const data = await DialogV2.prompt({
    window: { title: "Campaign rulebooks" },
    content: `<div class="sf-dialog"><p>Select every ruleset this adventure uses. All three are enabled in a new world and can be combined.</p><fieldset><legend>Enabled rulesets</legend>${Object.entries(
      RULE_LINES,
    )
      .map(
        ([key, line]) =>
          `<label><input type="checkbox" name="${key}" ${c.lines.includes(key) ? "checked" : ""}>${line.label}</label>`,
      )
      .join(
        "",
      )}</fieldset><fieldset><legend>Campaign mechanics</legend>${["obligation", "duty", "morality", "beginnerMode"].map((key) => `<label><input type="checkbox" name="${key}" ${c[key] ? "checked" : ""}>${key === "beginnerMode" ? "Use beginner adventure teaching rules" : key.charAt(0).toUpperCase() + key.slice(1)}</label>`).join("")}</fieldset><fieldset><legend>Starting group</legend><label>Starting Player Characters<input type="number" name="partySize" min="2" max="100" step="1" value="${Number(c.partySize ?? 4)}"></label><label>Age of Rebellion group resource<select name="ageStartingResource">${optionsHTML({ lambda: "Commandered Lambda-class shuttle", "y-wings": "Y-wing squadron", base: "Base of operations" }, c.ageStartingResource ?? "lambda")}</select></label><p class="sf-hint">Party size sets starting Obligation or Duty. A base provides a gear-only allowance during character creation.</p></fieldset><fieldset><legend>Adventure state</legend><label><input type="checkbox" name="adventureStarted" ${c.adventureStarted ? "checked" : ""}> Adventure has started</label><p class="sf-hint">Starting the adventure moves completed characters into campaign play and locks their species, original career and creation-only purchases. New characters can still complete creation before joining.</p></fieldset><p>Use the Owned books menu to manage the shared reference filter. Appearance is chosen independently.</p></div>`,
    ok: {
      label: "Save campaign",
      callback: (_event, button) =>
        Object.fromEntries(new FormData(button.form)),
    },
    rejectClose: false,
  });
  if (data) {
    const next = validateCampaign({
      ...c,
      lines: Object.keys(RULE_LINES).filter((key) => data[key]),
      obligation: !!data.obligation,
      duty: !!data.duty,
      morality: !!data.morality,
      beginnerMode: !!data.beginnerMode,
      adventureStarted: !!data.adventureStarted,
      partySize: Number(data.partySize),
      ageStartingResource: data.ageStartingResource,
    });
    if (!c.adventureStarted && next.adventureStarted) {
      const completed = game.actors.filter(
        (actor) =>
          actor.type === "character" && actor.system.creation?.applied,
      );
      await Promise.all(
        completed.map((actor) => actor.update({ "system.phase": "play" })),
      );
      if (completed.length)
        ui.notifications.info(
          `${completed.length} completed character${completed.length === 1 ? " is" : "s are"} now locked for campaign play.`,
        );
    }
    await game.settings.set(
      SYSTEM_ID,
      "campaign",
      next,
    );
  }
}

const STARTING_EQUIPMENT_INDEX_FIELDS = [
  ...ORIGIN_INDEX_FIELDS,
  "system.price",
  "system.restricted",
  "system.incomplete",
  "system.scale",
];

function resourceChoiceHTML(line) {
  const choices = CREATION_RESOURCE_CHOICES[line] ?? [];
  return choices
    .map((choice, index) => {
      const force = line === "force",
        type = force ? "radio" : "checkbox",
        checked = force && (choice.id === "standard" || index === 0) ? "checked" : "";
      return `<label class="sf-starting-choice"><input type="${type}" name="resourceChoice" value="${escapeHTML(choice.id)}" ${checked}><span><strong>${escapeHTML(choice.label)}</strong><small>${escapeHTML(choice.cost)}</small></span></label>`;
    })
    .join("");
}

function startingLoadoutHTML({ line, allowRestricted }) {
  return `<div class="sf-dialog sf-starting-loadout" data-starting-loadout data-line="${escapeHTML(line)}">
    <fieldset><legend>Story resource and starting benefit</legend><div class="sf-starting-choices">${resourceChoiceHTML(line)}</div></fieldset>
    <section class="sf-starting-budget" aria-live="polite"><strong data-resource-summary></strong><span data-budget-summary></span><small data-grant-summary></small></section>
    <div class="sf-starting-equipment-grid">
      <section><h3>Available equipment</h3><label>Find by name, type or book<input type="search" data-equipment-search autocomplete="off"></label><select data-equipment-results size="12" aria-label="Matching starting equipment"></select><button type="button" data-add-starting-item><i class="fa-solid fa-plus" aria-hidden="true"></i> Add selected item</button><p class="sf-hint">Only enabled books and entries with a recorded price appear. ${allowRestricted ? "As GM, you may approve Restricted entries here." : "Restricted entries require the GM to add or approve them."}</p></section>
      <section><h3>Starting loadout</h3><div class="sf-starting-basket" data-starting-basket></div><input type="hidden" name="loadout" value="[]"></section>
    </div>
    <p class="sf-form-error" data-loadout-error hidden></p>
  </div>`;
}

function attachStartingLoadout(dialog, context) {
  const root = dialog.element.querySelector("[data-starting-loadout]");
  if (!root) return;
  const search = root.querySelector("[data-equipment-search]"),
    results = root.querySelector("[data-equipment-results]"),
    basketNode = root.querySelector("[data-starting-basket]"),
    hidden = root.querySelector('[name="loadout"]'),
    error = root.querySelector("[data-loadout-error]"),
    submit = dialog.element.querySelector('button[data-action="ok"]'),
    byId = new Map(context.equipment.map((entry) => [entry.id, entry])),
    basket = new Map();
  const choices = () =>
    Array.from(
      root.querySelectorAll('[name="resourceChoice"]:checked'),
      (input) => input.value,
    ).filter((choice) => choice !== "standard");
  const selections = () =>
    Array.from(basket, ([id, quantity]) => ({ id, quantity }));
  const resources = () =>
    creationResourcePlan({
      line: context.line,
      partySize: context.partySize,
      choices: choices(),
      ageStartingResource: context.ageStartingResource,
    });
  const loadout = (plan) =>
    buildStartingLoadout({
      options: context.equipment,
      selections: selections(),
      cashBudget: plan.cashBudget,
      gearGrant: plan.gearGrant,
      allowRestricted: context.allowRestricted,
    });
  const renderResults = () => {
    const terms = String(search.value ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
      matches = context.equipment
        .filter((entry) =>
          terms.every((term) =>
            `${entry.name} ${entry.type} ${entry.source.book}`
              .toLowerCase()
              .includes(term),
          ),
        )
        .slice(0, 150);
    results.replaceChildren(
      ...matches.map((entry) => {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = `${entry.name} · ${entry.price.toLocaleString()} cr · ${entry.type}${entry.restricted ? " · Restricted" : ""}`;
        option.disabled = entry.restricted && !context.allowRestricted;
        return option;
      }),
    );
  };
  const refresh = () => {
    hidden.value = JSON.stringify(selections());
    try {
      const plan = resources(),
        purchase = loadout(plan),
        mechanic =
          plan.story.mechanic.charAt(0).toUpperCase() +
          plan.story.mechanic.slice(1);
      root.querySelector("[data-resource-summary]").textContent =
        `${mechanic} ${plan.story.value} · +${plan.xpBonus} XP`;
      root.querySelector("[data-budget-summary]").textContent =
        `${purchase.cost.toLocaleString()} spent · ${purchase.credits.toLocaleString()} credits retained`;
      root.querySelector("[data-grant-summary]").textContent = plan.gearGrant
        ? `${plan.gearGrant.toLocaleString()}-credit base allowance: ${purchase.gearGrantUsed.toLocaleString()} used, ${purchase.gearGrantUnused.toLocaleString()} unused and not converted to cash.`
        : `${plan.cashBudget.toLocaleString()} credits available for gear or later play.`;
      error.hidden = true;
      error.textContent = "";
      if (submit) submit.disabled = false;
    } catch (reason) {
      error.hidden = false;
      error.textContent = reason.message;
      if (submit) submit.disabled = true;
    }
  };
  const renderBasket = () => {
    basketNode.replaceChildren();
    if (!basket.size) {
      const empty = document.createElement("p");
      empty.className = "sf-hint";
      empty.textContent = "No equipment selected; the full cash budget is retained.";
      basketNode.append(empty);
    }
    for (const [id, quantity] of basket) {
      const entry = byId.get(id),
        row = document.createElement("div"),
        description = document.createElement("span"),
        input = document.createElement("input"),
        remove = document.createElement("button");
      row.className = "sf-starting-basket-row";
      row.dataset.basketId = id;
      description.textContent = `${entry.name} · ${entry.price.toLocaleString()} cr${entry.restricted ? " · Restricted" : ""}`;
      input.type = "number";
      input.min = "1";
      input.max = "99";
      input.step = "1";
      input.value = String(quantity);
      input.dataset.basketQuantity = id;
      input.setAttribute("aria-label", `${entry.name} quantity`);
      remove.type = "button";
      remove.dataset.removeStartingItem = id;
      remove.setAttribute("aria-label", `Remove ${entry.name}`);
      remove.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
      row.append(description, input, remove);
      basketNode.append(row);
    }
    refresh();
  };
  search.addEventListener("input", renderResults);
  results.addEventListener("dblclick", () =>
    root.querySelector("[data-add-starting-item]")?.click(),
  );
  root.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-starting-item]"),
      remove = event.target.closest("[data-remove-starting-item]");
    if (add) {
      const entry = byId.get(results.value);
      if (!entry || (entry.restricted && !context.allowRestricted)) return;
      basket.set(entry.id, Math.min(99, (basket.get(entry.id) ?? 0) + 1));
      renderBasket();
    } else if (remove) {
      basket.delete(remove.dataset.removeStartingItem);
      renderBasket();
    }
  });
  root.addEventListener("input", (event) => {
    if (event.target.hasAttribute("data-basket-quantity")) {
      basket.set(
        event.target.dataset.basketQuantity,
        Number(event.target.value),
      );
      refresh();
    }
  });
  root.addEventListener("change", (event) => {
    if (event.target.name === "resourceChoice") refresh();
  });
  renderResults();
  renderBasket();
}

async function startingLoadoutDialog({
  line,
  campaign,
  equipment,
  allowRestricted,
}) {
  const context = {
    line,
    partySize: campaign.partySize ?? 4,
    ageStartingResource: campaign.ageStartingResource ?? "lambda",
    equipment,
    allowRestricted,
  };
  return DialogV2.prompt({
    window: { title: "Character creation · Resources and equipment", resizable: true },
    classes: ["star-wars", "sf-starting-loadout-window"],
    position: { width: 820, height: 760 },
    content: startingLoadoutHTML(context),
    render: (_event, dialog) => attachStartingLoadout(dialog, context),
    ok: {
      label: "Apply starting choices",
      callback: (_event, button) => {
        const selectedChoices = Array.from(
            button.form.querySelectorAll('[name="resourceChoice"]:checked'),
            (input) => input.value,
          ).filter((choice) => choice !== "standard"),
          selectedEquipment = JSON.parse(button.form.elements.loadout.value),
          resources = creationResourcePlan({
            line,
            partySize: context.partySize,
            choices: selectedChoices,
            ageStartingResource: context.ageStartingResource,
          }),
          loadout = buildStartingLoadout({
            options: equipment,
            selections: selectedEquipment,
            cashBudget: resources.cashBudget,
            gearGrant: resources.gearGrant,
            allowRestricted,
          });
        return {
          choices: selectedChoices,
          selections: selectedEquipment,
          resources,
          loadout,
        };
      },
    },
    rejectClose: false,
  });
}

async function createCharacterDialog(actor) {
  if (originChoiceLocked(actor.system))
    throw new Error(
      "Starting choices have already been applied. Continue with XP advancement.",
    );
  const pack = getLibraryPack("Item");
  if (!pack) throw new Error("Import the local reference library first.");
  const campaign = game.settings.get(SYSTEM_ID, "campaign");
  await pack.getIndex({ fields: STARTING_EQUIPMENT_INDEX_FIELDS });
  const speciesId = actor.system.creation?.speciesId,
    careerId = actor.system.creation?.careerId;
  if (!speciesId || !careerId)
    throw new Error(
      "Choose a valid species and career from the searchable fields in the sheet header first.",
    );
  const [species, career] = await Promise.all([
    pack.getDocument(speciesId),
    pack.getDocument(careerId),
  ]);
  if (
    !originEntryAllowed(species, "species", campaign) ||
    !originEntryAllowed(career, "career", campaign)
  )
    throw new Error(
      "The selected species or career is no longer available under the GM's campaign and owned-book settings.",
    );
  const inferredLine = referenceRuleLine(career),
    line =
      (inferredLine && campaign.lines.includes(inferredLine)
        ? inferredLine
        : null) ??
      (campaign.lines.includes(actor.system.line) ? actor.system.line : null) ??
      campaign.lines[0],
    specializationOptions = pack.index
      .filter((entry) => {
        const entryLine = referenceRuleLine(entry);
        return (
          entry.type === "specialization" &&
          entry.system?.career === career.name &&
          Array.isArray(entry.system?.careerSkills) &&
          entry.system.careerSkills.length > 0 &&
          bookAllowed(entry.system?.source?.book, campaign) &&
          (!entryLine || campaign.lines.includes(entryLine))
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  if (!specializationOptions.length)
    throw new Error(
      `No starting specialization for ${career.name} is available under the campaign and owned-book settings.`,
    );
  const data = await DialogV2.prompt({
    window: { title: "Character creation · Starting specialization" },
    content: `<div class="sf-dialog"><dl class="sf-creation-summary"><dt>Species</dt><dd>${escapeHTML(species.name)}</dd><dt>Career</dt><dd>${escapeHTML(career.name)}</dd><dt>Creation rules</dt><dd>${escapeHTML(RULE_LINES[line].label)} <small>set from the GM's campaign and career source</small></dd></dl><label>Starting specialization<select name="specialization">${optionsHTML(Object.fromEntries(specializationOptions.map((entry) => [entry._id, entry.name])))}</select></label><p>Species-specific abilities and exceptions remain flagged for verification against the cited book.</p></div>`,
    ok: {
      label: "Choose free skills",
      callback: (_e, b) => Object.fromEntries(new FormData(b.form)),
    },
    rejectClose: false,
  });
  if (!data) return;
  const specialization = await pack.getDocument(data.specialization),
    rule = RULE_LINES[line];
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
      label: "Choose resources & equipment",
      callback: (_e, b) => Object.fromEntries(new FormData(b.form)),
    },
    rejectClose: false,
  });
  if (!rankForm) return;
  const equipment = startingEquipmentOptions(pack.index, campaign),
    allowRestricted = game.user.isGM,
    starting = await startingLoadoutDialog({
      line,
      campaign,
      equipment,
      allowRestricted,
    });
  if (!starting) return;
  const equipmentDocuments = await Promise.all(
      starting.selections.map((selection) => pack.getDocument(selection.id)),
    ),
    verifiedEquipment = startingEquipmentOptions(equipmentDocuments, campaign);
  if (verifiedEquipment.length !== starting.selections.length)
    throw new Error(
      "A selected equipment entry is no longer available under the campaign or owned-book settings.",
    );
  const verifiedById = new Map(
      verifiedEquipment.map((entry) => [entry.id, entry]),
    ),
    startingEquipment = starting.selections.map((selection) => ({
      ...verifiedById.get(selection.id),
      quantity: selection.quantity,
    }));
  buildStartingLoadout({
    options: verifiedEquipment,
    selections: starting.selections,
    cashBudget: starting.resources.cashBudget,
    gearGrant: starting.resources.gearGrant,
    allowRestricted,
  });
  const system = creationPlan({
    species,
    career,
    specialization,
    line,
    careerRanks: Object.keys(rankForm)
      .filter((k) => k.startsWith("career:"))
      .map((k) => k.slice(7)),
    specializationRanks: Object.keys(rankForm)
      .filter((k) => k.startsWith("specialization:"))
      .map((k) => k.slice(15)),
    partySize: campaign.partySize ?? 4,
    resourceChoices: starting.choices,
    ageStartingResource: campaign.ageStartingResource ?? "lambda",
    startingEquipment,
    allowRestricted,
  });
  system.phase = campaign.adventureStarted ? "play" : "creation";
  system.creation.startingResources.items = startingEquipment.map((entry) => ({
    id: entry.id,
    name: entry.name,
    type: entry.type,
    quantity: entry.quantity,
    price: entry.price,
    cost: entry.price * entry.quantity,
    restricted: entry.restricted,
    source: entry.source,
  }));
  const items = [species, career, specialization, ...equipmentDocuments].map(
    (item, index) => {
      const data = item.toObject();
      data._id = foundry.utils.randomID();
      if (index >= 3)
        data.system.quantity = starting.selections[index - 3].quantity;
      return data;
    },
  );
  await actor.update({
    system,
    items: [
      ...actor.items
        .filter(
          (item) =>
            !["species", "career", "specialization"].includes(item.type),
        )
        .map((item) => item.toObject()),
      ...items,
    ],
  });
  ui.notifications.info(
    "Starting choices applied. Use Finish starting funds after reviewing the loadout to add the d100 pocket-money roll.",
  );
}
