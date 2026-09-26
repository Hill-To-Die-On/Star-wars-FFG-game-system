import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { publishAdvancementTrees } from "../scripts/publish-advancement-trees.mjs";
import {
  mergeAdvancementTrees,
  validateAdvancementData,
} from "../src/advancement-data.mjs";

const node = {
  id: "r0c0",
  name: "Known Talent",
  key: "KNOWN",
  ranked: false,
  cost: 5,
  row: 0,
  col: 0,
  entry: true,
  activation: "Passive",
  effects: [
    { type: "attribute", operation: "add", target: "soak", count: 1 },
  ],
  summary: "Private source wording must not enter the public tree.",
  reference: { book: "Other private source", page: "10" },
};

const catalog = {
  format: "star-wars-library",
  version: 1,
  documents: {
    Item: [
      {
        _id: "abcdefghijklmnop",
        name: "Verified Path",
        type: "specialization",
        system: {
          source: { book: "Held Book", page: "42", privatePath: "C:/book.pdf" },
          metadata: { Description: "Private prose" },
          career: "Explorer",
          careerSkills: ["survival"],
          universal: false,
          grantedForceRating: 0,
          tree: {
            nodes: [node],
            edges: [],
            verified: true,
            provenance: "Private dataset",
          },
        },
      },
      {
        _id: "ponmlkjihgfedcba",
        name: "Pending Ability",
        type: "signatureAbility",
        system: {
          source: { book: "Held Expansion", page: "77" },
          eligibleCareers: ["Explorer"],
          abilityCategory: "Discovery",
          matchingNodes: [true, false, false, false],
          tree: {
            nodes: [{ ...node, name: "Base Ability", span: 4, cost: 30 }],
            edges: [],
            verified: true,
          },
        },
      },
    ],
  },
};

const verification = {
  format: "star-wars-ffg-source-verification",
  version: 1,
  checks: [
    {
      kind: "specialization",
      name: "Verified Path",
      book: "Held Book",
      referencePage: "42",
      evidencePage: "43",
      level: "full-chart",
      checked: ["node names", "costs", "connectors"],
    },
  ],
};

test("public advancement publisher keeps mechanics and removes private prose", () => {
  const published = publishAdvancementTrees(catalog, verification);
  assert.equal(validateAdvancementData(published), published);
  assert.equal(published.items.length, 2);
  assert.deepEqual(published.report, {
    specializations: 1,
    signatureAbilities: 1,
    structuralGraphs: 2,
    fullChartCompared: 1,
    connectorCompared: 0,
    pendingComparison: 1,
    missingGraphs: 0,
    nodes: 2,
  });
  const path = published.items.find((item) => item.type === "specialization"),
    ability = published.items.find(
      (item) => item.type === "signatureAbility",
    );
  assert.deepEqual(path.source, { book: "Held Book", page: "42" });
  assert.equal(path.tree.verified, true);
  assert.equal(path.tree.verification.source, "full-chart");
  assert.equal(ability.tree.verification.source, "pending");
  assert.deepEqual(path.tree.nodes[0].effects, node.effects);
  assert.equal(path.tree.nodes[0].summary, undefined);
  assert.equal(path.tree.nodes[0].reference, undefined);
  assert.doesNotMatch(
    JSON.stringify(published),
    /Private source wording|Private prose|C:\/book\.pdf|provenance/i,
  );
});

test("public advancement data enriches only the matching native item", () => {
  const published = publishAdvancementTrees(catalog, verification),
    bundle = {
      format: "star-wars-library",
      version: 1,
      documents: {
        Item: [
          {
            _id: "abcdefghijklmnop",
            name: "Verified Path",
            type: "specialization",
            system: {
              source: { book: "Held Book", page: "42" },
              tree: { nodes: [], edges: [], verified: false },
              incomplete: ["tree"],
            },
          },
        ],
      },
    },
    merged = mergeAdvancementTrees(bundle, published),
    item = merged.documents.Item[0];
  assert.equal(item.system.tree.nodes[0].name, "Known Talent");
  assert.equal(item.system.tree.verification.source, "full-chart");
  assert.deepEqual(item.system.incomplete, []);
  assert.equal(bundle.documents.Item[0].system.tree.nodes.length, 0);

  const mismatched = structuredClone(bundle);
  mismatched.documents.Item[0].name = "Wrong Identity";
  assert.throws(
    () => mergeAdvancementTrees(mismatched, published),
    /identity does not match/,
  );
});

test("committed advancement catalogue is complete and copyright bounded", async () => {
  const [data, library] = await Promise.all([
    readFile("data/advancement-trees.json", "utf8").then(JSON.parse),
    readFile("data/reference-library.json", "utf8").then(JSON.parse),
  ]);
  validateAdvancementData(data);
  assert.deepEqual(
    {
      specializations: data.report.specializations,
      signatureAbilities: data.report.signatureAbilities,
      structuralGraphs: data.report.structuralGraphs,
      missingGraphs: data.report.missingGraphs,
    },
    {
      specializations: 135,
      signatureAbilities: 38,
      structuralGraphs: 171,
      missingGraphs: 2,
    },
  );
  assert.equal(data.report.fullChartCompared, 5);
  assert.equal(data.report.connectorCompared, 4);
  assert.equal(data.report.nodes, 3024);
  assert.doesNotMatch(JSON.stringify(data), /"(?:summary|description|metadata)"\s*:/i);
  assert.doesNotMatch(JSON.stringify(data), /[A-Z]:[\\/]|\.pdf\b/i);
  const merged = mergeAdvancementTrees(library, data),
    advancement = merged.documents.Item.filter((item) =>
      ["specialization", "signatureAbility"].includes(item.type),
    );
  assert.equal(advancement.length, 173);
  assert.equal(
    advancement.filter((item) => item.system.tree?.verified).length,
    171,
  );
});
