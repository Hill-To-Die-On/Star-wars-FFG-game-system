import test from "node:test";
import assert from "node:assert/strict";
import {
  availableSignatureNodes,
  signatureAbilityStatus,
  signatureAttachmentCandidates,
  signatureLinkState,
  validateSignatureAttachment,
} from "../src/signature-abilities.mjs";

const specialization = {
  id: "spec-1",
  name: "Career path",
  type: "specialization",
  system: {
    career: "Explorer",
    tree: {
      verified: true,
      edges: [],
      nodes: Array.from({ length: 4 }, (_, col) => ({
        id: `bottom-${col}`,
        name: `Bottom ${col}`,
        row: 4,
        col,
        cost: 25,
      })),
    },
  },
};
const ability = {
  id: "sig-1",
  name: "Example signature",
  type: "signatureAbility",
  system: {
    eligibleCareers: ["Explorer"],
    abilityCategory: "Discovery",
    linkedSpecializationId: "spec-1",
    matchingNodes: [false, true, true, false],
    source: { book: "Held book", page: "42" },
    tree: {
      verified: true,
      edges: [["base", "upgrade"]],
      nodes: [
        {
          id: "base",
          name: "Base ability",
          row: 0,
          col: 0,
          span: 4,
          cost: 30,
          entry: true,
          ranked: false,
        },
        {
          id: "upgrade",
          name: "Upgrade",
          row: 1,
          col: 0,
          cost: 10,
          ranked: false,
        },
      ],
    },
  },
};
const actor = (advancement = []) => ({
  system: { advancement },
  items: { contents: [specialization, ability] },
});

test("signature abilities attach only to a listed career specialization", () => {
  assert.deepEqual(signatureAttachmentCandidates(actor(), ability), [
    specialization,
  ]);
  assert.equal(
    validateSignatureAttachment(actor(), ability, "spec-1"),
    specialization,
  );
  assert.throws(() => validateSignatureAttachment(actor(), ability, "other"));
});

test("a matching bottom-row talent unlocks the base node and its connected path", () => {
  assert.equal(signatureLinkState(actor(), ability).unlocked, false);
  assert.deepEqual(availableSignatureNodes(actor(), ability), []);
  const linked = actor([
    { itemId: "spec-1", nodeId: "bottom-1", name: "Bottom 1" },
  ]);
  assert.equal(signatureLinkState(linked, ability).unlocked, true);
  assert.deepEqual(
    availableSignatureNodes(linked, ability).map((node) => node.id),
    ["base"],
  );
  const learned = actor([
    { itemId: "spec-1", nodeId: "bottom-1", name: "Bottom 1" },
    { itemId: "sig-1", nodeId: "base", name: "Base ability", cost: 30 },
  ]);
  assert.deepEqual(
    availableSignatureNodes(learned, ability).map((node) => node.id),
    ["upgrade"],
  );
  assert.equal(signatureAbilityStatus(learned, ability).available[0].cost, 10);
  assert.deepEqual(
    availableSignatureNodes(
      { system: learned.system, items: { contents: [ability] } },
      ability,
    ),
    [],
  );
});
