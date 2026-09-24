import { SYSTEM_ID, SYSTEM_PATH, THEMES } from "./config.mjs";
import { groupSummary, memberFromCharacter } from "./group.mjs";
import { resolveSheetTheme } from "./rules.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;
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
}
export function refreshGroupSheets() {
  for (const actor of game.actors ?? [])
    if (actor.type === "group")
      for (const app of Object.values(actor.apps))
        if (app.rendered) app.render();
}
