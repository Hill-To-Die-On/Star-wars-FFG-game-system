import test from "node:test";
import assert from "node:assert/strict";
import { reviewStarterAdvancement, restoreStarterAdvancement } from "../src/starter-advancement.mjs";

const fixture = () => ({
  _id: "starterrecord001",
  name: "Explorer (Starter: Example Hero)", type: "specialization",
  system: {
    career: "Explorer", careerSkills: [], source: { book: "Synthetic starter", page: "12" },
    tree: { verified: false, nodes: [
      { id: "first", name: "Example first", row: 0, col: 0, cost: 5, entry: true },
      { id: "isolated", name: "Example isolated", row: 1, col: 1, cost: 10 },
    ], edges: [], source: { book: "Synthetic starter", page: "12" } },
    metadata: { starterCareerTree: { schema: 1, character: "Example Hero",
      sourceFilename: "synthetic.pdf", sourceSha256: "a".repeat(64), physicalPdfPage: 12,
      folioIdentityPage: 6, purchaseState: "No purchases asserted", heldReason: "Connector review pending" } },
  },
});
function actor() {
  return { uuid: "Actor.synthetic", name: "Example Hero (Test copy)", type: "character", isOwner: true,
    system: { career: "Explorer", xp: { available: 10, total: 50 }, advancement: [] }, items: [],
    async createEmbeddedDocuments(type, records, options) {
      assert.equal(type, "Item");
      assert.deepEqual(options, { keepId: true });
      const item = { ...structuredClone(records[0]), id: "created" };
      item.system.source = { table: "", id: "", ...item.system.source };
      this.items.push(item); return [item];
    },
  };
}
const gm = { isGM: true };
const confirmation = (review) => ({ actorUuid: review.actorUuid, character: review.character, sourceReviewed: true });

test("GM restoration keeps the exact unverified graph, XP and ledger, and rejects repeat attachment", async () => {
  const a = actor(), data = fixture(), before = structuredClone(a.system);
  const review = reviewStarterAdvancement(a, data, gm);
  assert.equal(review.readOnly, true);
  assert.equal(review.isolatedNodes, 1);
  const item = await restoreStarterAdvancement(a, review, confirmation(review), gm);
  assert.deepEqual(item.system.tree, data.system.tree);
  assert.deepEqual(a.system, before);
  assert.equal(item.system.metadata.starterRestoration.actorUuid, a.uuid);
  assert.throws(() => reviewStarterAdvancement(a, data, gm), /already|conflict/i);
});

test("restoration refuses non-GMs, other actors/careers, mismatched source and purchased records", () => {
  assert.throws(() => reviewStarterAdvancement(actor(), fixture(), { isGM: false }), /GM/);
  for (const mutate of [
    a => { a.name = "Different Hero"; }, a => { a.system.career = "Different career"; },
    a => { a.isOwner = false; }, a => { a.type = "rival"; },
    a => { a.system.source = { book: "Different source" }; },
    a => { a.system.advancement.push({ nodeId: "first", cost: 5 }); },
  ]) { const a = actor(); mutate(a); assert.throws(() => reviewStarterAdvancement(a, fixture(), gm)); }
  for (const mutate of [
    d => { d.system.metadata.starterCareerTree.sourceSha256 = "missing"; },
    d => { d.system.source.page = "13"; },
    d => { d.system.tree.nodes[0].purchased = true; },
    d => { d.system.tree.edges = [["first", "missing"]]; },
    d => { d.system.tree.nodes = []; },
    d => { d.effects = [{ name: "Unexpected active effect" }]; },
  ]) { const d = fixture(); mutate(d); assert.throws(() => reviewStarterAdvancement(actor(), d, gm)); }
});

test("confirmation binds the reviewed actor and refuses stale XP, ledger, item or source state", async () => {
  for (const mutate of [
    a => { a.system.xp.available++; }, a => { a.system.advancement.push({ name: "Purchased elsewhere" }); },
    a => { a.items.push({ id: "other", type: "gear", system: {} }); },
    a => { a.name = "Example Hero (Other copy)"; },
  ]) {
    const a = actor(), review = reviewStarterAdvancement(a, fixture(), gm); mutate(a);
    await assert.rejects(restoreStarterAdvancement(a, review, confirmation(review), gm), /changed/);
  }
  const a = actor(), review = reviewStarterAdvancement(a, fixture(), gm);
  await assert.rejects(restoreStarterAdvancement(a, review, { ...confirmation(review), actorUuid: "Actor.other" }, gm), /confirm/i);
  await assert.rejects(restoreStarterAdvancement(a, review, { ...confirmation(review), sourceReviewed: false }, gm), /confirm/i);
  assert.equal(a.items.length, 0);
});

test("conflicting or partly attached starter records are never merged or overwritten", () => {
  const a = actor(); a.items.push({ id: "partial", name: fixture().name, type: "specialization", system: { career: "Explorer", tree: { nodes: [] } } });
  assert.throws(() => reviewStarterAdvancement(a, fixture(), gm), /conflict/i);
  assert.equal(a.items[0].system.tree.nodes.length, 0);
  a.items[0].name = "Explorer (Other source label)";
  assert.throws(() => reviewStarterAdvancement(a, fixture(), gm), /conflict/i);
});

test("exact local owned-copy labels preserve folio offsets and meaningful book edition tokens", async () => {
  for (const [identityPage, chartPage] of [[106, 112], [114, 120]]) {
    const a = actor(), data = fixture();
    data.system.source.page = String(chartPage);
    data.system.tree.source.page = String(chartPage);
    Object.assign(data.system.metadata.starterCareerTree, { folioIdentityPage: identityPage, physicalPdfPage: chartPage });
    a.system.source = { book: "Synthetic starter - owned playtest copy", page: `PDF ${identityPage + 1}-${identityPage + 2}` };
    const before = structuredClone(a.system.source);
    const review = reviewStarterAdvancement(a, data, gm);
    assert.equal(review.identityPage, identityPage); assert.equal(review.page, chartPage);
    await restoreStarterAdvancement(a, review, confirmation(review), gm);
    assert.deepEqual(a.system.source, before);
  }
  for (const book of ["Different starter - owned playtest copy", "Synthetic starter Revised - owned playtest copy", "Synthetic starter anthology", "Synthetic starter - owned playtest copy Revised", "Synthetic starter - other copy"]) {
    const a = actor(); a.system.source = { book, page: "PDF 107-108" };
    assert.throws(() => reviewStarterAdvancement(a, fixture(), gm), /conflicting source books/);
  }
});

test("creation errors or partial results are reported without a retry or XP writes", async () => {
  for (const create of [async () => { throw new Error("write failed"); }, async () => []]) {
    const a = actor(), before = structuredClone(a.system); let calls = 0;
    a.createEmbeddedDocuments = async () => { calls++; return create(); };
    const review = reviewStarterAdvancement(a, fixture(), gm);
    await assert.rejects(restoreStarterAdvancement(a, review, confirmation(review), gm), /restoration|incomplete/i);
    assert.equal(calls, 1); assert.deepEqual(a.system, before);
  }
});

test("native sheet file and source review attach once, cancellation and player access never attach", async () => {
  const prompts = [];
  const dialogs = { async prompt(options) { return prompts.shift()(options); } };
  globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: base => base, DialogV2: dialogs }, sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} } } };
  const { StarWarsActorSheet } = await import("../src/sheets.mjs");
  const errors = [], messages = [];
  globalThis.ui = { notifications: { error: message => errors.push(message), info: message => messages.push(message) } };
  globalThis.game = { user: gm };
  const a = actor(), sheet = { actor: a, isEditable: true, render() {} };
  const file = { size: 100, text: async () => JSON.stringify(fixture()) };
  prompts.push(
    options => options.ok.callback(null, { form: { elements: { starter: { files: [file] } } } }),
    options => {
      assert.match(options.content, /purchases remain disabled/);
      assert.match(options.content, /Example isolated/);
      assert.match(options.content, /identity page 6/);
      assert.equal(a.items.length, 0, "review happens before mutation");
      return options.ok.callback(null, { form: { elements: { character: { value: "Example Hero" }, sourceReviewed: { checked: true } } } });
    },
  );
  await StarWarsActorSheet.DEFAULT_OPTIONS.actions.restoreStarterAdvancement.call(sheet);
  assert.equal(a.items.length, 1); assert.deepEqual(errors, []); assert.equal(messages.length, 1);
  const canceled = actor(); sheet.actor = canceled;
  prompts.push(() => file, () => null);
  await StarWarsActorSheet.restoreStarterAdvancement.call(sheet);
  assert.equal(canceled.items.length, 0);
  globalThis.game.user = { isGM: false };
  await StarWarsActorSheet.restoreStarterAdvancement.call(sheet);
  assert.match(errors.at(-1), /Only the GM/); assert.equal(canceled.items.length, 0);
});

test("overlapping restoration calls cannot create duplicate items", async () => {
  const a = actor(), first = reviewStarterAdvancement(a, fixture(), gm), second = reviewStarterAdvancement(a, fixture(), gm);
  let finish;
  const create = a.createEmbeddedDocuments.bind(a);
  a.createEmbeddedDocuments = async (...args) => { await new Promise(resolve => { finish = resolve; }); return create(...args); };
  const pending = restoreStarterAdvancement(a, first, confirmation(first), gm);
  await assert.rejects(restoreStarterAdvancement(a, second, confirmation(second), gm), /already in progress/);
  finish(); await pending; assert.equal(a.items.length, 1);
});
