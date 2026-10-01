const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export async function openGroupRecord() {
  const visible = [...game.actors].filter(actor => actor.type === "group" && actor.testUserPermission(game.user, "OBSERVER"));
  let group;
  if (visible.length === 1) group = visible[0];
  else if (visible.length > 1) {
    const id = await foundry.applications.api.DialogV2.wait({
      classes: ["star-wars"], window: { title: "Open Group Record" }, position: { width: 400 }, rejectClose: false,
      content: `<div class="sf-dialog"><label>Group<select name="group">${visible.map(actor => `<option value="${escape(actor.id)}">${escape(actor.name)}</option>`).join("")}</select></label></div>`,
      buttons: [{ action: "open", label: "Open", callback: (_event, button) => new FormData(button.form).get("group") }],
    });
    group = visible.find(actor => actor.id === id);
  } else if (game.user.isGM) {
    group = await Actor.create({ name: "Party Group Record", type: "group", ownership: { default: 2 } });
  } else {
    ui.notifications.warn("Ask the GM to create a group record for the party.");
    return null;
  }
  if (!group) return null;
  group.sheet.render({ force: true });
  return group;
}
