import { SYSTEM_ID, SYSTEM_PATH, THEMES } from "./config.mjs";
import { groupSummary, memberFromCharacter } from "./group.mjs";
import { resolveSheetTheme } from "./rules.mjs";
import { STARTING_GROUP_ASSETS, startingAssetOptions, planStartingAsset, planResourceEntry } from "./group-resources.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
export class GroupSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["star-wars", "sf-group"],
    position: { width: 1020, height: 840 },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addMember: this.addMember,
      removeMember: this.removeMember,
      syncMembers: this.syncMembers,
      openMember: this.openMember,
      destiny: this.destiny,
      chooseAsset: this.chooseAsset,
      openAsset: this.openAsset,
      recordResource: this.recordResource,
    },
  };
  static PARTS = { sheet: { template: `${SYSTEM_PATH}/templates/group.hbs` } };
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const campaign = game.settings.get(SYSTEM_ID, "campaign");
    const sheetTheme = game.settings.get(SYSTEM_ID, "sheetTheme");
    const themeKey = resolveSheetTheme(
      this.actor.system.theme === "auto"
        ? sheetTheme
        : this.actor.system.theme,
      undefined,
      campaign.lines,
    );
    const summary = groupSummary(
      this.actor.system,
      game.settings.get(SYSTEM_ID, "destiny"),
    );
    const linkedAsset = game.actors.get(summary.startingAsset.actorId);
    return {
      ...context,
      actor: this.actor,
      system: this.actor.system,
      ...summary,
      editable: this.isEditable,
      campaign,
      themeKey,
      theme: THEMES[themeKey],
      themes: {
        auto: `Automatic · ${THEMES[themeKey].name}`,
        ...Object.fromEntries(
          Object.entries(THEMES).map(([key, theme]) => [key, theme.name]),
        ),
      },
      members: summary.members.map((member) => ({
        ...member,
        characters: game.actors
          .filter(
            (actor) =>
              actor.type === "character" &&
              actor.testUserPermission(game.user, "OBSERVER"),
          )
          .map((actor) => ({
            id: actor.id,
            name: actor.name,
            selected: actor.id === member.actorId,
          }))
          .concat(
            member.actorId &&
              !game.actors
                .get(member.actorId)
                ?.testUserPermission(game.user, "OBSERVER")
              ? [
                  {
                    id: member.actorId,
                    name: "Unavailable linked character",
                    selected: true,
                  },
                ]
              : [],
          ),
        linked: !!game.actors
          .get(member.actorId)
          ?.testUserPermission(game.user, "OBSERVER"),
      })),
      startingAssetLabel: STARTING_GROUP_ASSETS.find(option => option.id === summary.startingAsset.choice)?.label ?? "",
      linkedAsset: linkedAsset?.type === "vehicle" && linkedAsset.testUserPermission(game.user, "OBSERVER") ? linkedAsset.name : "",
      resourceLedger: summary.resourceLedger.map(entry => ({ ...entry, deltaLabel: entry.change > 0 ? `+${entry.change}` : entry.change < 0 ? String(entry.change) : "" })),
    };
  }
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.theme = context.themeKey;
  }
  static async addMember() {
    if (!this.isEditable) return;
    await this.submit();
    await this.actor.update({
      [`system.members.${foundry.utils.randomID()}`]: {
        characterName: "New member",
      },
    });
  }
  static async removeMember(_event, target) {
    if (!this.isEditable || !this.actor.system.members[target.dataset.member])
      return;
    await this.actor.update({
      [`system.members.-=${target.dataset.member}`]: null,
    });
  }
  static async syncMembers() {
    if (!this.isEditable) return;
    await this.submit();
    const changes = {};
    for (const [id, member] of Object.entries(this.actor.system.members)) {
      const actor = game.actors.get(member.actorId);
      if (
        actor?.type === "character" &&
        actor.testUserPermission(game.user, "OBSERVER")
      )
        changes[`system.members.${id}`] = memberFromCharacter(actor, member);
    }
    if (Object.keys(changes).length) await this.actor.update(changes);
    else
      ui.notifications.info(
        "Choose a linked character for at least one member first.",
      );
  }
  static openMember(_event, target) {
    const actor = game.actors.get(
      this.actor.system.members[target.dataset.member]?.actorId,
    );
    if (actor?.testUserPermission(game.user, "OBSERVER"))
      actor.sheet.render({ force: true });
  }
  static destiny() {
    return game.system.api.openConsole();
  }
  static openAsset() {
    const actor = game.actors.get(this.actor.system.startingAsset?.actorId);
    if (actor?.type === "vehicle" && actor.testUserPermission(game.user, "OBSERVER")) actor.sheet.render({ force: true });
  }
  static async chooseAsset() {
    if (!this.isEditable) return;
    const campaign = game.settings.get(SYSTEM_ID, "campaign");
    const choices = startingAssetOptions(campaign);
    if (!choices.length) return ui.notifications.warn("Enable a campaign rule line before choosing a starting group asset.");
    const vehicles = game.actors.filter(actor => actor.type === "vehicle" && actor.testUserPermission(game.user, "OBSERVER"));
    const current = this.actor.system.startingAsset ?? {};
    await foundry.applications.api.DialogV2.wait({
      classes: ["star-wars"], window: { title: "Starting group asset" }, position: { width: 540 }, rejectClose: false,
      content: `<div class="sf-dialog"><p>Choose the party's starting shared asset. A vehicle can link to its playable actor; later changes belong in the resource ledger.</p>
        <label>Resource type<select name="choice" required><option value="">Choose a resource</option>${choices.map(option => `<option value="${option.id}" ${option.id === current.choice ? "selected" : ""}>${escape(option.label)}</option>`).join("")}</select></label>
        <label>Asset name<input name="name" required maxlength="120" value="${escape(current.name)}"></label>
        <label>Linked vehicle<select name="actorId"><option value="">No linked vehicle yet</option>${vehicles.map(actor => `<option value="${escape(actor.id)}" ${actor.id === current.actorId ? "selected" : ""}>${escape(actor.name)}</option>`).join("")}</select></label>
        <label>Status<input name="status" maxlength="80" value="${escape(current.status || "Available")}"></label>
        <label>Description<textarea name="description" rows="3">${escape(current.description)}</textarea></label></div>`,
      buttons: [{ action: "save", label: "Record asset", callback: async (_event, button) => {
        try {
          const input = Object.fromEntries(new FormData(button.form));
          const changes = planStartingAsset(this.actor.system, input, { campaign, vehicles, id: foundry.utils.randomID(), at: new Date().toISOString() });
          await this.actor.update(changes);
        } catch (error) { ui.notifications.error(error.message); }
      } }],
    });
  }
  static async recordResource() {
    if (!this.isEditable) return;
    await foundry.applications.api.DialogV2.wait({
      classes: ["star-wars"], window: { title: "Group resource ledger" }, position: { width: 500 }, rejectClose: false,
      content: `<div class="sf-dialog"><p>Record a shared credit or gear change, or add a note about an asset, contact, or supply. Use a minus sign when the group spends or gives something away.</p>
        <label>Resource<select name="kind"><option value="credits">Shared credits</option><option value="gear">Shared gear</option><option value="note">Other resource note</option></select></label>
        <label>Name<input name="name" required maxlength="120" placeholder="What changed?"></label>
        <label>Change<input name="change" type="number" step="1" value="0"></label>
        <label>What happened?<textarea name="note" rows="3"></textarea></label></div>`,
      buttons: [{ action: "record", label: "Record change", callback: async (_event, button) => {
        try {
          const input = Object.fromEntries(new FormData(button.form));
          const changes = planResourceEntry(this.actor.system, input, { id: foundry.utils.randomID(), at: new Date().toISOString(), scene: globalThis.canvas?.scene?.name });
          await this.actor.update(changes);
        } catch (error) { ui.notifications.error(error.message); }
      } }],
    });
  }
}
export function refreshGroupSheets() {
  for (const actor of game.actors ?? [])
    if (actor.type === "group")
      for (const app of Object.values(actor.apps))
        if (app.rendered) app.render();
}
