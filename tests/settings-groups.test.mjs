import test from "node:test";
import assert from "node:assert/strict";
import { groupSystemSettings } from "../src/settings-groups.mjs";

test("Star Wars settings return to named bordered panels without losing unknown settings", () => {
  const previous = globalThis.document;
  const panels = [];
  const parent = { append: element => panels.push(element) };
  const row = key => ({ parentElement: parent, querySelector: () => ({ name: `star-wars-ffg.${key}` }) });
  const rows = [row("campaignMenu"), row("interfaceTheme"), row("consoleMenu"), row("aboutMenu"), row("futureSetting")];
  const root = { classList: { add: () => {} }, querySelector: () => panels.find(panel => panel.className === "sf-settings-group") ?? null, querySelectorAll: () => rows };
  globalThis.document = { createElement: tag => ({ tag, children: [], append(child) { this.children.push(child); } }) };
  try {
    groupSystemSettings(root);
    assert.deepEqual(panels.map(panel => panel.children[0].textContent), ["Campaign setup", "Appearance", "Play tools", "Help & diagnostics", "Other Star Wars settings"]);
    assert.equal(panels[0].children[1], rows[0]);
    assert.equal(panels.at(-1).children[1], rows[4]);
    groupSystemSettings(root);
    assert.equal(panels.length, 5, "re-render does not duplicate sections");
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});
