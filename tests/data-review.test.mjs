import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (Base) => class extends Base {},
    },
  },
};
const {
  reviewItemGaps,
  reviewItemRecords,
  validateReviewData,
} = await import("../src/data-review.mjs");

test("data review lists unverified gear and preserves reviewed records", () => {
  const gear = { id: "gear", type: "gear", name: "Field kit", system: {} };
  assert.deepEqual(reviewItemGaps(gear), [
    "Source book and page",
    "GM paraphrase / description",
    "Structured rule or ability review",
  ]);
  const records = reviewItemRecords([{ item: gear, owner: null, id: "world:gear" }]);
  assert.equal(records[0].status, "Needs review");
  gear.system = {
    source: { book: "Home campaign", page: "1" },
    description: "A creator-written field kit summary.",
    abilities: [{ name: "Field repair", summary: "Restore a damaged system.", activation: "Action" }],
  };
  assert.deepEqual(reviewItemGaps(gear), []);
  gear.system.incomplete = ["verify repair rating"];
  assert.match(reviewItemGaps(gear).join(" "), /Existing source review flags/);
});

test("data review validates declarative effects, abilities and whole talent trees", () => {
  const data = validateReviewData({
    sourceBook: "Home campaign",
    sourcePage: "2",
    activation: "Passive",
    description: "A concise creator-written summary.",
    effectsJSON: JSON.stringify([{ type: "pool", operation: "add", target: "boost", count: 1, skills: ["mechanics"] }]),
    abilitiesJSON: JSON.stringify([{ name: "Field calibration", activation: "Passive", summary: "Adds one boost.", effects: [] }]),
    incompleteJSON: "[]",
    treeJSON: JSON.stringify({ verified: true, nodes: [{ id: "entry", name: "Entry", row: 0, col: 0, cost: 5, activation: "Passive", summary: "A starting node.", effects: [] }], edges: [] }),
  }, { treeEnabled: true });
  assert.equal(data.source.book, "Home campaign");
  assert.equal(data.effects[0].target, "boost");
  assert.equal(data.tree.nodes[0].name, "Entry");
  assert.throws(() => validateReviewData({
    sourceBook: "Home campaign", sourcePage: "2", activation: "Passive", description: "Summary",
    effectsJSON: JSON.stringify([{ type: "pool", operation: "execute", target: "boost", count: 1 }]),
    abilitiesJSON: "[]",
    incompleteJSON: "[]",
  }), /Talent effects must add or remove/);
});
