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

const withSystem = (item, system) => ({
  ...item,
  system: { ...item.system, ...system },
});

test("signature links work from plain item arrays and from actors with no items", () => {
  const plain = { items: [specialization, ability] };
  assert.deepEqual(signatureAttachmentCandidates(plain, ability), [
    specialization,
  ]);
  assert.deepEqual(signatureLinkState(plain, ability), {
    linked: true,
    unlocked: false,
    specialization,
    matchingNodeIds: ["bottom-1", "bottom-2"],
    purchasedMatchingNodeIds: [],
  });
  assert.deepEqual(signatureAttachmentCandidates({}, ability), []);
  assert.equal(signatureLinkState({}, ability).linked, false);
});

test("only a signature ability listing the specialization's career can attach to it", () => {
  const talent = { id: "talent-1", name: "Grit", type: "talent", system: {} };
  assert.throws(
    () => validateSignatureAttachment(actor(), talent, "spec-1"),
    /Choose a signature ability/,
  );
  const unlisted = withSystem(ability, { eligibleCareers: undefined });
  assert.deepEqual(signatureAttachmentCandidates(actor(), unlisted), []);
  assert.throws(
    () => validateSignatureAttachment(actor(), unlisted, "spec-1"),
    /must attach to a specialization from its listed career/,
  );
  const universal = {
    id: "spec-2",
    name: "Universal path",
    type: "specialization",
    system: { universal: true },
  };
  const owner = { items: [universal, specialization, ability] };
  const blankCareer = withSystem(ability, { eligibleCareers: ["Explorer", ""] });
  assert.deepEqual(signatureAttachmentCandidates(owner, blankCareer), [
    specialization,
  ]);
  assert.throws(
    () => validateSignatureAttachment(owner, blankCareer, "spec-2"),
    /must attach to a specialization from its listed career/,
  );
});

test("a link stays locked without a specialization tree or matching columns", () => {
  const learned = [{ itemId: "spec-1", nodeId: "bottom-1", name: "Bottom 1" }];
  const treeless = withSystem(specialization, { tree: undefined });
  assert.deepEqual(
    signatureLinkState(
      { system: { advancement: learned }, items: [treeless, ability] },
      ability,
    ),
    {
      linked: true,
      unlocked: false,
      specialization: treeless,
      matchingNodeIds: [],
      purchasedMatchingNodeIds: [],
    },
  );
  const unmatched = withSystem(ability, { matchingNodes: undefined });
  assert.deepEqual(signatureLinkState(actor(learned), unmatched), {
    linked: true,
    unlocked: false,
    specialization,
    matchingNodeIds: [],
    purchasedMatchingNodeIds: [],
  });
  assert.deepEqual(availableSignatureNodes(actor(learned), unmatched), []);
});

test("an unverified signature tree offers no upgrades even after its link unlocks", () => {
  const pending = withSystem(ability, {
    tree: { ...ability.system.tree, verified: false },
  });
  const linked = actor([
    { itemId: "spec-1", nodeId: "bottom-1", name: "Bottom 1" },
  ]);
  assert.equal(signatureLinkState(linked, pending).unlocked, true);
  assert.deepEqual(availableSignatureNodes(linked, pending), []);
  const status = signatureAbilityStatus(linked, pending);
  assert.equal(status.verified, false);
  assert.deepEqual(status.verification, {
    structure: "missing",
    source: "pending",
    checked: [],
  });
  assert.equal(status.linkUnlocked, true);
  assert.deepEqual(status.available, []);
});

test("a signature ability with no details yet reports empty status defaults", () => {
  const blank = {
    id: "sig-2",
    name: "Unfinished signature",
    type: "signatureAbility",
    system: {},
  };
  assert.deepEqual(signatureAbilityStatus(actor(), blank), {
    name: "Unfinished signature",
    source: {},
    eligibleCareers: [],
    category: "",
    verified: false,
    verification: { structure: "missing", source: "pending", checked: [] },
    linkedSpecializationId: "",
    linkedSpecialization: "",
    matchingNodeIds: [],
    linkUnlocked: false,
    purchased: [],
    available: [],
  });
});

test("a signature ability linked to a removed specialization keeps its stored link", () => {
  const removed = {
    system: {
      advancement: [
        { itemId: "sig-1", nodeId: "base", name: "Base ability", cost: 30 },
      ],
    },
    items: { contents: [ability] },
  };
  const status = signatureAbilityStatus(removed, ability);
  assert.equal(status.linkedSpecializationId, "spec-1");
  assert.equal(status.linkedSpecialization, "");
  assert.equal(status.linkUnlocked, false);
  assert.deepEqual(status.purchased, [
    { nodeId: "base", name: "Base ability", cost: 30 },
  ]);
  assert.deepEqual(status.available, []);
});
