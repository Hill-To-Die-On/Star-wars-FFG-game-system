import test from "node:test";
import assert from "node:assert/strict";
import { specializationAllowed, specializationChoices } from "../src/specialization-choices.mjs";

const campaign = { bookMode: "owned", books: ["Synthetic guide", "Force and Destiny"], lines: ["edge"] };
const item = (id, book = "Synthetic guide") => ({
  id, _id: id, uuid: `Compendium.world.star-wars-item.Item.${id}`, documentName: "Item",
  name: `Example ${id}`, type: "specialization", system: { career: "Explorer", source: { book, page: "12" } },
});

test("choices use exact native prices, exclude owned and disallowed entries, and show insufficient XP", () => {
  const priced = [], actor = { system: { xp: { available: 25 } }, specializationPrice(value) {
    priced.push(value.id); if (value.id === "owned") throw new Error("Already attached");
    return value.id === "costly" ? 30 : 20;
  } };
  const choices = specializationChoices(actor, [item("owned"), item("cheap"), item("costly"), item("book", "Other"), item("line", "Force and Destiny")], campaign);
  assert.deepEqual(priced, ["owned", "cheap", "costly"]);
  assert.deepEqual(choices.map(({ id, cost, affordable }) => ({ id, cost, affordable })), [
    { id: "cheap", cost: 20, affordable: true }, { id: "costly", cost: 30, affordable: false },
  ]);
  assert.equal(specializationAllowed({ ...item("gear"), type: "gear" }, campaign), false);
});

test("button and drop share the native purchase review; cancel, changed prices and disabled books never acquire", async () => {
  let prompts = [], confirmations = [], acquired = [], errors = [];
  const dialogs = {
    prompt: async options => prompts.shift()(options),
    confirm: async options => confirmations.shift()(options),
  };
  globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: base => base, DialogV2: dialogs }, sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} }, ux: { TextEditor: { implementation: { getDragEventData: () => ({ type: "Item", uuid: "source" }) } } } } };
  const { StarWarsActorSheet } = await import("../src/sheets.mjs");
  const candidate = item("new"), pack = { visible: true, index: [candidate], getIndex: async () => {}, getDocument: async () => candidate };
  globalThis.game = { settings: { get: () => campaign }, packs: new Map([["world.star-wars-item", pack]]) };
  globalThis.fromUuid = async () => candidate;
  globalThis.ui = { notifications: { error: message => errors.push(message) } };
  let price = 20;
  const actor = { type: "character", isOwner: true, system: { xp: { available: 50 } }, items: [{ type: "specialization" }],
    specializationPrice: () => price, acquireSpecialization: async value => acquired.push(value) };
  const sheet = new StarWarsActorSheet(); Object.assign(sheet, { actor, isEditable: true, render() {} });
  prompts.push(options => { assert.match(options.content, /20 XP/); return "new"; });
  confirmations.push(options => { assert.match(options.content, /20 XP/); assert.match(options.content, /original career/); return true; });
  await StarWarsActorSheet.DEFAULT_OPTIONS.actions.addSpecialization.call(sheet);
  confirmations.push(() => true);
  await sheet.onDrop({ preventDefault() {} });
  assert.deepEqual(acquired, [candidate, candidate]); assert.deepEqual(errors, []);
  confirmations.push(() => false);
  await sheet.confirmSpecialization(candidate); assert.equal(acquired.length, 2);
  confirmations.push(() => { price = 30; return true; });
  await assert.rejects(sheet.confirmSpecialization(candidate), /changed during review/);
  await assert.rejects(sheet.confirmSpecialization(item("blocked", "Other")), /allowed by this campaign/);
  actor.isOwner = false;
  await StarWarsActorSheet.addSpecialization.call(sheet);
  assert.match(errors.at(-1), /you own/); assert.equal(acquired.length, 2);
});
