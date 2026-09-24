import {
  SYSTEM_ID,
  SYSTEM_PATH,
  THEMES,
  CHARACTERISTICS,
  SKILLS,
  ITEM_TYPES,
  RANGES,
} from "./config.mjs";
import { DICE, skillPool } from "./dice/core.mjs";
import { availableTalents } from "./advancement.mjs";
import {
  DEFAULT_CAMPAIGN,
  validateCampaign,
  RULE_LINES,
  bookAllowed,
} from "./rules.mjs";
import { escapeHTML, minionState } from "./mechanics.mjs";
import { importLibrary } from "./library.mjs";
import { convertSwa } from "./swa-import.mjs";
import { creationPlan } from "./creation.mjs";
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
export async function checkDialog(actor, key, item) {
  const skill = SKILLS[key];
  if (!skill) throw new Error("Select a valid skill.");
  const form = await DialogV2.prompt({
    window: { title: `${item?.name ?? skill.label} · Build dice pool` },
    content: `<div class="sf-dialog"><p>${escapeHTML(actor.name)} · ${escapeHTML(skill.label)}</p><div class="sf-form-grid">${numericInput("difficulty", "Difficulty", 2, 10)}${numericInput("boost", "Boost")}${numericInput("setback", "Setback / defense")}${numericInput("upgradeDifficulty", "Upgrade difficulty / Adversary")}${numericInput("upgradeAbility", "Upgrade ability")}</div><p>Set range difficulty and situational modifiers from the encounter. Effects of Destiny flips and talents must be included in the pool.</p><label>Visibility<select name="rollMode">${optionsHTML({ publicroll: "Public", gmroll: "GM", blindroll: "Blind GM", selfroll: "Self" }, game.settings.get("core", "rollMode"))}</select></label></div>`,
    ok: {
      label: "Roll pool",
      callback: (_event, button) =>
        Object.fromEntries(new FormData(button.form)),
    },
    rejectClose: false,
  });
  if (!form) return;
  const { rollMode, ...numbers } = form;
  const result = await actor.rollSkill(key, {
    ...Object.fromEntries(
      Object.entries(numbers).map(([k, v]) => [k, Number(v)]),
    ),
    rollMode,
  });
  if (item && result.outcome.passed) {
    ui.notifications.info(
      `${item.name}: ${item.damageFor(result.outcome)} damage before soak. Apply weapon qualities and target soak separately.`,
    );
  }
  return result;
}
export class StarfallActorSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["starfall"],
    position: { width: 1000, height: 820 },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      switchSection: this.tab,
      skill: this.skill,
      force: this.force,
      item: this.item,
      addItem: this.addItem,
      removeItem: this.removeItem,
      buySkill: this.buySkill,
      buyCharacteristic: this.buyCharacteristic,
      buyTalent: this.buyTalent,
      damage: this.damage,
      createCharacter: this.createCharacter,
      verifySource: this.verifySource,
    },
  };
  static PARTS = { sheet: { template: `${SYSTEM_PATH}/templates/actor.hbs` } };
  activeTab = "overview";
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor,
      s = actor.system;
    const campaign = game.settings.get(SYSTEM_ID, "campaign");
    const skills = actor.isVehicle
      ? []
      : Object.entries(SKILLS).map(([key, skill]) => ({
          key,
          ...skill,
          ...s.skills[key],
          rank: s.skills[key].rank,
          pool: (() => {
            try {
              const p = skillPool(
                s.characteristics[s.skills[key].characteristic],
                actor.skillRank(key),
                { difficulty: 0 },
              );
              return `${p.proficiency} proficiency · ${p.ability} ability`;
            } catch {
              return "Verify statistics";
            }
          })(),
          characteristicOptions: CHARACTERISTICS,
        }));
    const specializations = actor.items
      .filter((i) => i.type === "specialization")
      .map((item) => {
        const tree = item.system.tree,
          owned = s.advancement
            .filter((e) => e.itemId === item.id)
            .map((e) => e.nodeId);
        const shared = new Set(
          s.advancement
            .filter((e) => e.ranked === false)
            .map((e) => e.name.toLowerCase()),
        );
        const available = tree?.verified
          ? availableTalents(
              tree,
              owned,
              s.advancement
                .filter((e) => e.ranked === false)
                .map((e) => e.name),
            )
          : [];
        return {
          id: item.id,
          name: item.name,
          source: item.system.source,
          verified: tree?.verified,
          nodes: (tree?.nodes ?? []).map((n) => ({
            ...n,
            itemId: item.id,
            owned: owned.includes(n.id),
            knownElsewhere:
              !owned.includes(n.id) &&
              n.ranked === false &&
              shared.has(n.name.toLowerCase()),
            available: available.some((a) => a.id === n.id),
            disabled:
              !this.isEditable ||
              !available.some((a) => a.id === n.id) ||
              n.cost > s.xp.available,
            x: n.col * 25 + 0.5,
            y: n.row * 20 + 1,
          })),
          edges: (tree?.edges ?? []).map(([a, b]) => {
            const n = tree.nodes.find((n) => n.id === a),
              m = tree.nodes.find((n) => n.id === b);
            return {
              x1: n.col * 200 + 100,
              y1: n.row * 130 + 65,
              x2: m.col * 200 + 100,
              y2: m.row * 130 + 65,
            };
          }),
        };
      });
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
      minions:
        actor.type === "minion"
          ? minionState(s.groupSize, s.wounds.value, Math.max(1, s.wounds.max))
          : null,
      theme: THEMES[s.theme],
      themes: Object.fromEntries(
        Object.entries(THEMES).map(([k, v]) => [k, v.name]),
      ),
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
      specializations,
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
    this.element.dataset.theme = this.actor.system.theme;
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
export class StarfallItemSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["starfall"],
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
      skills: Object.fromEntries(
        Object.entries(SKILLS).map(([k, v]) => [k, v.label]),
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
    const report = await importLibrary(
      JSON.parse(await file.text()),
      (type, done, total) => ui.notifications.info(`${type}: ${done}/${total}`),
    );
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
    const file = await DialogV2.prompt({
      window: { title: "Import SW Adversaries" },
      content:
        '<p>Select an SW Adversaries JSON file. Statistics and name references become native actors in this world. Descriptions and images are omitted. Existing actors are preserved.</p><p>On swa.stoogoff.com, copy chosen adversaries to Mine, then export the custom collection.</p><input type="file" name="adversaries" accept=".json">',
      ok: {
        label: "Review import",
        callback: (_event, button) => button.form.elements.adversaries.files[0],
      },
      rejectClose: false,
    });
    if (!file) return;
    if (file.size > 10 * 1024 * 1024)
      throw new Error("Choose a JSON file smaller than 10 MB.");
    const bundle = await convertSwa(JSON.parse(await file.text()));
    const report = bundle.report;
    const proceed = await DialogV2.confirm({
      window: { title: "Review adversary import" },
      content: `<p>${report.records} adversaries · ${report.incompleteActors} with missing statistics · ${report.weaponReferences} unresolved weapon references.</p><p>Named weapons without statistics remain reference items. Replace them from the private equipment library. Talent and ability effects still require the source books.</p><ul>${report.review
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
    const result = await importLibrary(bundle);
    ui.notifications.info(
      `Adversaries ready: ${result.Actor.created} new, ${result.Actor.preserved} preserved.`,
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
      )}<hr>${["obligation", "duty", "morality", "beginnerMode"].map((key) => `<label><input type="checkbox" name="${key}" ${c[key] ? "checked" : ""}>${key === "beginnerMode" ? "Use beginner adventure teaching rules" : key.charAt(0).toUpperCase() + key.slice(1)}</label>`).join("")}<label>Allowed source book titles (one per line; blank allows all)<textarea name="books">${escapeHTML(c.books.join("\n"))}</textarea></label></div>`,
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
        lines: Object.keys(RULE_LINES).filter((key) => data[key]),
        obligation: !!data.obligation,
        duty: !!data.duty,
        morality: !!data.morality,
        beginnerMode: !!data.beginnerMode,
        books: data.books
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
      }),
    );
}
async function createCharacterDialog(actor) {
  if (actor.system.creation?.applied)
    throw new Error(
      "Starting choices have already been applied. Continue with XP advancement.",
    );
  const pack = game.packs.get("world.starfall-item");
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
