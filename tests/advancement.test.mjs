import test from "node:test";
import assert from "node:assert/strict";
import {
  characteristicPurchase,
  skillPurchase,
  talentPurchase,
  validateTree,
} from "../src/advancement.mjs";

const node = (id, changes = {}) => ({
  id,
  name: `Talent ${id}`,
  row: 0,
  col: 0,
  cost: 5,
  ranked: false,
  ...changes,
});

test("talent trees are refused when oversized, malformed or badly linked", () => {
  const many = Array.from({ length: 101 }, (_, index) => node(`n${index}`));
  assert.throws(() => validateTree({ nodes: many, edges: [] }), /exceeds size limits/);
  assert.throws(
    () =>
      validateTree({
        nodes: [node("a"), node("b")],
        edges: Array.from({ length: 301 }, () => ["a", "b"]),
      }),
    /exceeds size limits/,
  );
  for (const tree of [null, { nodes: [node("a")] }, { nodes: {}, edges: [] }])
    assert.throws(() => validateTree(tree), /needs nodes and edges/);
  for (const nodes of [
    [node("")],
    [node("a"), node("a")],
    [node("a", { name: "   " })],
    [node("a", { name: undefined })],
  ])
    assert.throws(
      () => validateTree({ nodes, edges: [] }),
      /Every talent node needs a unique id and name/,
    );
  for (const edge of [["a", "a"], ["a", "b", "a"], ["a", "missing"], "a-b"])
    assert.throws(
      () => validateTree({ nodes: [node("a"), node("b")], edges: [edge] }),
      /Talent links must join two existing nodes/,
    );
  const tree = { nodes: [node("a"), node("b")], edges: [["a", "b"]] };
  assert.equal(validateTree(tree), tree);
});

test("talent purchases say whether the path is locked or the XP is short", () => {
  const tree = {
    nodes: [node("a", { entry: true, cost: 10 }), node("b", { cost: 15 })],
    edges: [["a", "b"]],
  };
  assert.throws(
    () => talentPurchase(tree, [], "b", 100),
    /already owned or its path is not unlocked/,
  );
  assert.throws(() => talentPurchase(tree, [], "a", 9), /Not enough available XP/);
  assert.deepEqual(talentPurchase(tree, [], "a", 10), {
    xp: 0,
    purchased: ["a"],
    node: tree.nodes[0],
  });
});

test("skill purchases stop at the rank caps and when XP runs short", () => {
  assert.throws(() => skillPurchase(2, true, 100, true), /Creation ranks cannot exceed 2/);
  assert.throws(() => skillPurchase(5, true, 100), /Skill ranks cannot exceed 5/);
  assert.throws(() => skillPurchase(1, true, 9), /Not enough available XP/);
  assert.deepEqual(skillPurchase(1, true, 10), { rank: 2, xp: 0, cost: 10 });
  assert.throws(() => skillPurchase(0, false, 9), /Not enough available XP/);
  assert.deepEqual(skillPurchase(0, false, 10), { rank: 1, xp: 0, cost: 10 });
  assert.deepEqual(skillPurchase(1, false, 15, true), { rank: 2, xp: 0, cost: 15 });
});

test("creation characteristic purchases stop at 5 and when XP runs short", () => {
  assert.throws(
    () => characteristicPurchase(3, 100, "play"),
    /only available during creation/,
  );
  assert.throws(
    () => characteristicPurchase(5, 100, "creation"),
    /Creation characteristics cannot exceed 5/,
  );
  assert.throws(() => characteristicPurchase(4, 49, "creation"), /Not enough available XP/);
  assert.deepEqual(characteristicPurchase(4, 50, "creation"), {
    value: 5,
    xp: 0,
    cost: 50,
  });
});
