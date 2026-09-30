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

test("printed chart corrections change XP costs, labels and missing paths", () => {
  const input = structuredClone(catalog);
  input.documents.Item[0].system.tree.nodes.push({
    ...node,
    id: "r1c0",
    name: "Misspelt Talent",
    cost: 10,
    row: 1,
    entry: false,
  });
  const checked = structuredClone(verification);
  checked.checks[0].nodeCorrections = [
    { id: "r0c0", sourceCost: 5, printedCost: 15 },
    { id: "r1c0", sourceName: "Misspelt Talent", printedName: "Correct Talent" },
  ];
  checked.checks[0].edgeAdds = [["r0c0", "r1c0"]];
  const tree = publishAdvancementTrees(input, checked).items
    .find((item) => item.name === "Verified Path").tree;
  assert.equal(tree.nodes[0].cost, 15);
  assert.equal(tree.nodes[1].name, "Correct Talent");
  assert.deepEqual(tree.edges, [["r0c0", "r1c0"]]);

  input.documents.Item[0].system.tree.nodes[0].cost = 20;
  assert.throws(() => publishAdvancementTrees(input, checked), /correction/i);
});

test("a checked standalone signature chart supplies a missing graph and attachment slots", () => {
  const input = structuredClone(catalog);
  input.documents.Item[1].system.tree = { nodes: [], edges: [], verified: false };
  const checked = structuredClone(verification);
  checked.checks.push({
    kind: "signatureAbility",
    name: "Pending Ability",
    book: "Held Expansion",
    referencePage: "77",
    evidencePage: "78",
    level: "full-chart",
    checked: ["node names", "costs", "connectors"],
    chart: {
      matchingNodes: [true, false, true, false],
      nodes: [
        { id: "r0c0", name: "Pending Ability Base Ability", cost: 30, row: 0, col: 0, span: 4, entry: true },
        ...Array.from({ length: 4 }, (_, col) => ({ id: `r1c${col}`, name: `Upgrade ${col}`, cost: 10, row: 1, col, span: 1, entry: false })),
        ...Array.from({ length: 4 }, (_, col) => ({ id: `r2c${col}`, name: `Upgrade ${col + 4}`, cost: 15, row: 2, col, span: 1, entry: false })),
      ],
      edges: [["r0c0", "r1c0"], ["r1c0", "r2c0"]],
    },
  });
  const published = publishAdvancementTrees(input, checked);
  const ability = published.items.find((item) => item.name === "Pending Ability");
  assert.equal(ability.tree.verified, true);
  assert.equal(ability.tree.verification.source, "full-chart");
  assert.equal(ability.tree.nodes.length, 9);
  assert.deepEqual(ability.matchingNodes, [true, false, true, false]);
  assert.equal(published.report.missingGraphs, 0);
  input.documents.Item[1].system.tree = { ...structuredClone(ability.tree), verified: true };
  input.documents.Item[1].system.matchingNodes = [...ability.matchingNodes];
  assert.deepEqual(publishAdvancementTrees(input, checked).items.find((item) => item.name === "Pending Ability"), ability);
});

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
      structuralGraphs: 173,
      missingGraphs: 0,
    },
  );
  assert.equal(data.report.fullChartCompared, 168);
  assert.equal(data.report.connectorCompared, 0);
  assert.equal(data.report.pendingComparison, 5);
  assert.equal(data.report.nodes, 3042);
  assert.doesNotMatch(JSON.stringify(data), /"(?:summary|description|metadata)"\s*:/i);
  assert.doesNotMatch(JSON.stringify(data), /[A-Z]:[\\/]|\.pdf\b/i);
  const merged = mergeAdvancementTrees(library, data),
    advancement = merged.documents.Item.filter((item) =>
      ["specialization", "signatureAbility"].includes(item.type),
    );
  assert.equal(advancement.length, 173);
  assert.equal(
    advancement.filter((item) => item.system.tree?.verified).length,
    173,
  );

  const specialization = (name) =>
      data.items.find(
        (item) => item.type === "specialization" && item.name === name,
      ),
    signatureAbility = (name) =>
      data.items.find(
        (item) => item.type === "signatureAbility" && item.name === name,
      ),
    hasEdge = (item, left, right) =>
      item.tree.edges.some(
        (edge) => edge.includes(left) && edge.includes(right),
      ),
    propagandist = specialization("Propagandist");
  assert.deepEqual(
    propagandist.tree.nodes
      .filter((entry) => entry.key === "INKNOW")
      .map(({ name, ranked, activation }) => ({ name, ranked, activation })),
    Array.from({ length: 3 }, () => ({
      name: "In the Know",
      ranked: true,
      activation: "Passive",
    })),
  );
  assert.equal(
    hasEdge(specialization("Fringer"), "r2c2", "r2c3"),
    false,
  );
  assert.equal(
    hasEdge(specialization("Scoundrel"), "r3c1", "r4c1"),
    true,
  );
  assert.equal(
    specialization("Padawan").tree.nodes.find((node) => node.id === "r4c2").cost,
    15,
  );
  assert.equal(
    specialization("Republic Representative").tree.nodes.find((node) => node.id === "r3c0").name,
    "Consider Our Options",
  );
  for (const [name, left, right] of [
    ["Republic Representative", "r2c0", "r3c0"],
    ["Republic Representative", "r3c0", "r4c0"],
    ["Republic Representative", "r3c3", "r4c3"],
    ["Death Watch Warrior", "r3c2", "r4c2"],
    ["Death Watch Warrior", "r3c3", "r4c3"],
  ]) assert.equal(hasEdge(specialization(name), left, right), true);
  assert.equal(
    specialization("Clone Commander").tree.nodes.find((node) => node.id === "r4c3").name,
    "Practiced Strategist",
  );
  assert.equal(
    specialization("General").tree.nodes.find((node) => node.id === "r3c3").name,
    "Improved Stand Firm!",
  );
  for (const [name, id] of [["Master", "r1c1"], ["Senator", "r3c3"]])
    assert.equal(specialization(name).tree.nodes.find((node) => node.id === id).name,
      "Improved Nobody's Fool");
  for (const [name, slots, edge] of [
    ["Unmatched Teamwork", [true, false, true, false], ["r2c1", "r2c2"]],
    ["Peerless Interception", [false, true, false, true], ["r2c1", "r2c2"]],
  ]) {
    const ability = signatureAbility(name);
    assert.equal(ability.tree.nodes.length, 9);
    assert.deepEqual(ability.matchingNodes, slots);
    assert.equal(hasEdge(ability, ...edge), true);
    assert.equal(ability.tree.nodes.find((entry) => entry.id === "r0c0").cost, 30);
    assert.equal(ability.tree.verification.source, "full-chart");
  }
  assert.equal(signatureAbility("Prophecy").tree.nodes.find((entry) => entry.id === "r1c1").name,
    "Flow of the Universe");
  assert.equal(signatureAbility("Unmatched Destiny").tree.nodes.find((entry) => entry.id === "r2c2").name,
    "Unleashed Power");
  assert.ok(signatureAbility("Unmatched Devastation"));
  assert.deepEqual(
    signatureAbility("Deadly Reputation").tree.nodes.map(
      ({ id, name }) => [id, name],
    ),
    [
      ["r0c0", "Deadly Reputation Base Ability"],
      ["r1c0", "Duration"],
      ["r1c1", "Deadly by Association"],
      ["r1c2", "Add Setback"],
      ["r1c3", "Duration"],
      ["r2c0", "Increase Effect"],
      ["r2c1", "Add Setback"],
      ["r2c2", "Destiny"],
      ["r2c3", "Increase Duration"],
    ],
  );
  assert.deepEqual(
    signatureAbility("Unmatched Ferocity").tree.nodes.map(
      ({ id, name }) => [id, name],
    ),
    [
      ["r0c0", "Unmatched Ferocity Base Ability"],
      ["r1c0", "Reduce Strain"],
      ["r1c1", "Change Skill (Brawl)"],
      ["r1c2", "Change Skill (Lightsaber)"],
      ["r1c3", "Reduce Strain"],
      ["r2c0", "Destiny"],
      ["r2c1", "Change Target"],
      ["r2c2", "Reduce Conflict"],
      ["r2c3", "Reduce Strain"],
    ],
  );
});

const publicItems = () => {
  const data = publishAdvancementTrees(catalog, verification);
  return {
    data,
    path: data.items.find((item) => item.type === "specialization"),
    ability: data.items.find((item) => item.type === "signatureAbility"),
  };
};
const assertEachRefused = (cases) => {
  for (const [change, message] of cases) {
    const edited = publicItems();
    change(edited);
    assert.throws(() => validateAdvancementData(edited.data), message);
  }
};

test("advancement data outside the public format or copyright boundary is refused", () => {
  assert.throws(
    () => validateAdvancementData(null),
    /Unsupported public advancement data format/,
  );
  assertEachRefused([
    [
      ({ data }) => (data.format = "star-wars-library"),
      /Unsupported public advancement data format/,
    ],
    [
      ({ data }) => (data.version = 2),
      /Unsupported public advancement data format/,
    ],
    [
      ({ data }) => (data.items = {}),
      /Unsupported public advancement data format/,
    ],
    [
      ({ data }) => delete data.boundary,
      /Advancement data needs the public copyright boundary/,
    ],
    [
      ({ data }) => (data.catalogPath = ".local/catalog.json"),
      /Advancement data contains unsupported catalogPath/,
    ],
    [
      ({ path }) => (path.metadata = { Description: "Private prose" }),
      /Advancement item contains unsupported metadata/,
    ],
    [
      ({ ability }) =>
        (ability.source = { ...ability.source, privatePath: "C:/book.pdf" }),
      /Pending Ability source contains unsupported privatePath/,
    ],
    [
      ({ path }) => (path.tree.provenance = "Private dataset"),
      /Verified Path tree contains unsupported provenance/,
    ],
    [
      ({ path }) => (path.tree.verification.notes = "Checked against the PDF"),
      /Verified Path verification contains unsupported notes/,
    ],
    [
      ({ path }) => (path.tree.nodes[0].summary = "Private source wording"),
      /Verified Path node contains unsupported summary/,
    ],
  ]);
});

test("advancement items need unique identities and safe book and page references", () => {
  assertEachRefused([
    [
      ({ path }) => delete path._id,
      /Advancement items need unique native identities/,
    ],
    [
      ({ path, ability }) => (path._id = ability._id),
      /Advancement items need unique native identities/,
    ],
    [
      ({ path }) => (path.name = " "),
      /Advancement items need unique native identities/,
    ],
    [
      ({ ability }) => (ability.type = "talent"),
      /Advancement items need unique native identities/,
    ],
    [
      ({ path }) => delete path.source,
      /Verified Path source needs a safe book and page reference/,
    ],
    [
      ({ path }) =>
        (path.source = { book: "C:/books/Held Book.pdf", page: "42" }),
      /Verified Path source needs a safe book and page reference/,
    ],
    [
      ({ path }) => (path.tree.source = { book: "Held Book", page: 42 }),
      /Verified Path tree source needs a safe book and page reference/,
    ],
  ]);
});

test("advancement trees must agree with their declared structure and verification", () => {
  assertEachRefused([
    [
      ({ path }) => (path.tree.verified = "yes"),
      /Verified Path needs a structured tree/,
    ],
    [
      ({ path }) => delete path.tree.edges,
      /Verified Path needs a structured tree/,
    ],
    [
      ({ path }) => delete path.tree.verification,
      /Verified Path has invalid verification metadata/,
    ],
    [
      ({ path }) => (path.tree.verification.source = "memory"),
      /Verified Path has invalid verification metadata/,
    ],
    [
      ({ path }) => path.tree.verification.checked.push("prose"),
      /Verified Path has invalid verification metadata/,
    ],
    [
      ({ path }) => (path.tree.verification.evidencePage = 43),
      /Verified Path has invalid verification metadata/,
    ],
    [
      ({ path }) => (path.tree.verification.structure = "missing"),
      /Verified Path structure status contradicts its tree/,
    ],
    [
      ({ path }) => (path.tree.nodes = []),
      /Verified Path structure status contradicts its tree/,
    ],
    [
      ({ ability }) => {
        ability.tree.verified = false;
        ability.tree.verification.structure = "missing";
      },
      /Pending Ability structure status contradicts its tree/,
    ],
  ]);
});

test("specializations and signature abilities need well-typed metadata", () => {
  assertEachRefused([
    [
      ({ path }) => delete path.career,
      /Verified Path has invalid specialization metadata/,
    ],
    [
      ({ path }) => path.careerSkills.push(7),
      /Verified Path has invalid specialization metadata/,
    ],
    [
      ({ path }) => (path.universal = "false"),
      /Verified Path has invalid specialization metadata/,
    ],
    [
      ({ path }) => (path.grantedForceRating = 1.5),
      /Verified Path has invalid specialization metadata/,
    ],
    [
      ({ ability }) => (ability.eligibleCareers = "Explorer"),
      /Pending Ability has invalid signature metadata/,
    ],
    [
      ({ ability }) => delete ability.abilityCategory,
      /Pending Ability has invalid signature metadata/,
    ],
    [
      ({ ability }) => (ability.matchingNodes = [1, 0, 0, 0]),
      /Pending Ability has invalid signature metadata/,
    ],
  ]);
});

test("the advancement report must be recounted when a graph is withdrawn", () => {
  const { data, ability } = publicItems();
  Object.assign(ability.tree, { nodes: [], edges: [], verified: false });
  ability.tree.verification.structure = "missing";
  assert.throws(
    () => validateAdvancementData(data),
    /Advancement data report does not match its items/,
  );
  Object.assign(data.report, { structuralGraphs: 1, missingGraphs: 1, nodes: 1 });
  assert.equal(validateAdvancementData(data), data);
});

const nativeBundle = (...items) => ({
  format: "star-wars-library",
  version: 1,
  documents: { Item: items },
});
const nativePath = (system) => ({
  _id: "abcdefghijklmnop",
  name: "Verified Path",
  type: "specialization",
  system,
});

test("advancement trees skip item-less bundles and refuse items without their source", () => {
  const published = publishAdvancementTrees(catalog, verification),
    actorsOnly = {
      format: "star-wars-library",
      version: 1,
      documents: { Actor: [] },
    };
  assert.deepEqual(mergeAdvancementTrees(actorsOnly, published), actorsOnly);
  for (const source of [undefined, { book: "Held Book" }])
    assert.throws(
      () =>
        mergeAdvancementTrees(nativeBundle(nativePath({ source })), published),
      /Verified Path advancement identity does not match/,
    );
});

test("merged advancement items without a review list flag only missing trees", () => {
  const withdrawn = structuredClone(catalog);
  withdrawn.documents.Item.find(
    (item) => item.name === "Pending Ability",
  ).system.tree.verified = false;
  const [path, ability] = mergeAdvancementTrees(
    nativeBundle(nativePath({ source: { book: "Held Book", page: "42" } }), {
      _id: "ponmlkjihgfedcba",
      name: "Pending Ability",
      type: "signatureAbility",
      system: { source: { book: "Held Expansion", page: "77" } },
    }),
    publishAdvancementTrees(withdrawn, verification),
  ).documents.Item;
  assert.deepEqual(path.system.incomplete, []);
  assert.equal(path.system.career, "Explorer");
  assert.deepEqual(ability.system.incomplete, ["tree"]);
  assert.equal(ability.system.tree.verification.structure, "missing");
  assert.equal(ability.system.abilityCategory, "Discovery");
});

test("private file paths are refused in page references, item names and talent names", () => {
  assertEachRefused([
    [({ path }) => (path.source.page = "C:/books/core.pdf"), / source needs a safe book and page reference/],
    [
      ({ path }) => (path.tree.source = { ...path.tree.source, page: "../private" }),
      /tree source needs a safe book and page reference/,
    ],
    [({ path }) => (path.source.page = "p. 12"), /needs a safe book and page reference/],
    [({ path }) => (path.name = "C:\\books\\core.pdf"), /Advancement item name is not a safe public value/],
    [
      ({ path }) => (path.tree.nodes[0].name = "../notes/private.xml"),
      /node name is not a safe public value/,
    ],
    [({ path }) => delete path.tree.nodes[0].name, /Every talent node needs a unique id and name/],
  ]);
  const { data, path } = publicItems();
  path.source = { ...path.source, page: "40-41" };
  path.tree.source = { ...path.tree.source, page: "" };
  assert.equal(validateAdvancementData(data), data);
});
