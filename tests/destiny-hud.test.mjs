import test from "node:test";
import assert from "node:assert/strict";
import { registerDestinyHud, refreshDestinyHud } from "../src/destiny-hud.mjs";

test("shared Destiny HUD appears once, updates for every client, and opens the console", () => {
  const old = Object.fromEntries(["document", "game", "Hooks"].map(key => [key, globalThis[key]]));
  const listeners = new Map();
  const elements = new Map();
  let opened = 0;
  const body = { append(element) { elements.set(element.id, element); } };
  globalThis.document = {
    body,
    getElementById: id => elements.get(id) ?? null,
    createElement: tag => ({
      tag,
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return this.attributes[name]; },
      addEventListener(event, callback) { this[event] = callback; },
    }),
  };
  globalThis.game = { settings: { get: () => ({ light: 2, dark: 3 }) } };
  globalThis.Hooks = { once: (event, fn) => listeners.set(event, fn) };
  try {
    registerDestinyHud(() => opened++);
    listeners.get("ready")();
    const tracker = elements.get("sf-destiny-hud");
    assert.equal(tracker.tag, "button");
    assert.match(tracker.innerHTML, /Light[^<]*<strong>2<\/strong>/);
    assert.match(tracker.innerHTML, /Dark[^<]*<strong>3<\/strong>/);
    assert.match(tracker.getAttribute("aria-label"), /2 light.*3 dark/i);
    tracker.click();
    assert.equal(opened, 1);
    refreshDestinyHud({ light: 1, dark: 4 });
    assert.match(tracker.innerHTML, /Light[^<]*<strong>1<\/strong>/);
    assert.match(tracker.innerHTML, /Dark[^<]*<strong>4<\/strong>/);
    listeners.get("ready")();
    assert.equal(elements.size, 1);
  } finally {
    for (const [key, value] of Object.entries(old)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});
