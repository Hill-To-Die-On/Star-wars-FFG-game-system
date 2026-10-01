import test from "node:test";
import assert from "node:assert/strict";
import { resolveFaces, applyAutomaticResults } from "../src/dice/core.mjs";
import {
  applyTalentPool,
  actorTalentRules,
  effectiveTalentTraits,
  learnedTalentRules,
  talentPurchaseUpdates,
  talentRulesForCheck,
  validateTalentNodeRules,
} from "../src/talent-rules.mjs";

const effect = (target, operation = "add") => ({
  type: target === "advantage" ? "result" : "pool",
  operation,
  target,
  count: 1,
  skills: ["leadership"],
});

const actor = {
  system: {
    advancement: [
      { itemId: "spec", nodeId: "command-1", name: "Command" },
      { itemId: "spec", nodeId: "command-2", name: "Command" },
      { itemId: "spec", nodeId: "active", name: "Active example" },
      { itemId: "spec", nodeId: "reputation", name: "Reputation" },
    ],
  },
  items: {
    contents: [
      {
        id: "spec",
        type: "specialization",
        system: {
          source: { book: "Test", page: "1" },
          tree: {
            nodes: [
              {
                id: "command-1",
                key: "COM",
                name: "Command",
                ranked: true,
                activation: "Passive",
                summary: "Adds a boost to Leadership checks.",
                effects: [effect("boost")],
              },
              {
                id: "command-2",
                key: "COM",
                name: "Command",
                ranked: true,
                activation: "Passive",
                effects: [effect("boost")],
              },
              {
                id: "active",
                key: "ACTIVE",
                name: "Active example",
                activation: "Incidental",
                effects: [effect("force")],
              },
              {
                id: "reputation",
                key: "REP",
                name: "Reputation",
                activation: "Passive",
                effects: [effect("advantage")],
              },
            ],
          },
        },
      },
    ],
  },
};

test("learned talent rules retain player guidance and automation status", () => {
  const learned = learnedTalentRules(actor);
  assert.equal(learned.length, 4);
  assert.equal(learned[0].summary, "Adds a boost to Leadership checks.");
  assert.equal(learned[0].automation, "automatic");
  assert.equal(learned[2].automation, "decision");
});

test("passive talent ranks update the pool and fixed results automatically", () => {
  const rules = talentRulesForCheck(actor, {
    key: "leadership",
    label: "Leadership",
    group: "General",
  });
  assert.equal(rules.pool.add.boost, 2);
  assert.equal(rules.pool.add.force, 0);
  assert.equal(rules.automaticResults.advantage, 1);
  assert.equal(rules.decisions.length, 1);
  assert.equal(applyTalentPool({ ability: 2, setback: 1 }, rules).boost, 2);

  const selected = talentRulesForCheck(
    actor,
    { key: "leadership", label: "Leadership", group: "General" },
    { selectedTalents: ["ACTIVE"] },
  );
  assert.equal(selected.pool.add.force, 1);
  assert.equal(selected.decisions.length, 0);
});

test("automatic result symbols participate in cancellation", () => {
  const rolled = resolveFaces([{ die: "difficulty", result: 4 }]);
  assert.equal(rolled.threat, 1);
  const adjusted = applyAutomaticResults(rolled, { advantage: 2 });
  assert.equal(adjusted.advantage, 1);
  assert.equal(adjusted.threat, 0);
});

test("talent rule validation rejects unknown or oversized effects", () => {
  assert.equal(
    validateTalentNodeRules({
      summary: "Short guidance",
      activation: "Passive",
      effects: [effect("boost")],
    }).summary,
    "Short guidance",
  );
  assert.throws(() =>
    validateTalentNodeRules({
      activation: "Passive",
      effects: [{ ...effect("boost"), target: "luck" }],
    }),
  );
});

test("structured attribute effects update purchases and conditional armor traits", () => {
  const base = {
      system: {
        strain: { max: 10 },
        wounds: { max: 12 },
        soak: 4,
        defense: { melee: 0, ranged: 0 },
        forceRating: 1,
        advancement: [{ itemId: "armor-spec", nodeId: "armor" }],
      },
      items: {
        contents: [
          {
            id: "armor-spec",
            type: "specialization",
            system: {
              tree: {
                nodes: [
                  {
                    id: "armor",
                    name: "Armor training",
                    activation: "Passive",
                    effects: [
                      {
                        type: "attribute",
                        operation: "add",
                        target: "soak",
                        count: 1,
                        requirements: { equippedArmor: true },
                      },
                    ],
                  },
                ],
              },
            },
          },
          { type: "armor", system: { equipped: true } },
        ],
      },
    },
    purchase = talentPurchaseUpdates(base, {
      effects: [
        {
          type: "attribute",
          operation: "add",
          target: "strainThreshold",
          count: 1,
        },
        {
          type: "attribute",
          operation: "add",
          target: "rangedDefense",
          count: 1,
        },
      ],
    });
  assert.deepEqual(purchase, {
    "system.strain.max": 11,
    "system.defense.ranged": 1,
  });
  assert.equal(effectiveTalentTraits(base).soak, 5);
  base.items.contents[1].system.equipped = false;
  assert.equal(effectiveTalentTraits(base).soak, 4);
});

test("talent check contributions retain citations and distinguish selected effects from passive effects",()=>{
 const check={key:"leadership",label:"Leadership",group:"General"};
 const rules=talentRulesForCheck(actor,check);
 assert.equal(rules.contributions.length,3);
 assert.deepEqual(rules.contributions[0].source,{book:"Test",page:"1"});
 assert.equal(rules.contributions[0].status,"automatic");
 assert.equal(rules.contributions[0].verification,"structured-effect");
 assert.match(rules.reasons[0],/Test.*1/);
 assert.deepEqual(rules.decisions[0].source,{book:"Test",page:"1"});
 const chosen=talentRulesForCheck(actor,check,{selectedTalents:["ACTIVE"]});
 assert.equal(chosen.contributions.find(c=>c.ruleId==="spec:active").status,"selected");
 chosen.contributions[0].source.page="changed";
 assert.equal(actor.items.contents[0].system.source.page,"1");
});

test("equipped armour and owned item abilities feed traits and checks, while stowed gear does not", () => {
  const check = { key: "leadership", label: "Leadership", group: "General" };
  const a = {
    type: "character",
    system: {
      soak: 3,
      defense: { melee: 0, ranged: 0 },
      forceRating: 1,
      advancement: [{ itemId: "spec", nodeId: "armoured" }],
    },
    items: [
      {
        id: "spec", type: "specialization", name: "Armour specialist", system: { tree: { nodes: [
          { id: "armoured", name: "Armoured command", activation: "Passive", effects: [
            { type: "pool", operation: "add", target: "boost", count: 1, skills: ["leadership"], requirements: { minimumSoak: 2 } },
          ] },
        ] } },
      },
      { id: "armour", type: "armor", name: "Blast vest", system: { equipped: true, quantity: 1, soak: 2, defense: 1 } },
      { id: "kit", type: "gear", name: "Command kit", system: { equipped: true, quantity: 1, abilities: [
        { name: "Signal boost", activation: "Passive", effects: [{ type: "pool", operation: "add", target: "boost", count: 1, skills: ["leadership"] }] },
      ] } },
      { id: "talent", type: "talent", name: "Steady voice", system: { activation: "Passive", effects: [
        { type: "result", operation: "add", target: "advantage", count: 1, skills: ["leadership"] },
      ] } },
    ],
  };
  assert.equal(effectiveTalentTraits(a).soak, 5);
  assert.equal(effectiveTalentTraits(a).defense.melee, 1);
  assert.equal(effectiveTalentTraits(a).defense.ranged, 1);
  const rules = talentRulesForCheck(a, check);
  assert.equal(rules.pool.add.boost, 2);
  assert.equal(rules.automaticResults.advantage, 1);
  assert.equal(actorTalentRules(a).some((rule) => rule.name === "Signal boost"), true);
  a.items[1].system.equipped = false;
  a.items[2].system.equipped = false;
  const stowed = talentRulesForCheck(a, check);
  assert.equal(effectiveTalentTraits(a).soak, 3);
  assert.equal(stowed.pool.add.boost, 0);
  assert.equal(stowed.automaticResults.advantage, 1);
});

test("active equipment rules are offered as decisions and apply only when selected", () => {
  const a = {
    type: "character",
    system: { advancement: [] },
    items: [{ id: "tool", type: "gear", name: "Tactical uplink", system: { equipped: true, quantity: 1, abilities: [
      { name: "Coordinated burst", activation: "Action", effects: [{ type: "pool", operation: "add", target: "boost", count: 2, skills: ["leadership"] }] },
    ] } }],
  };
  const check = { key: "leadership", label: "Leadership", group: "General" };
  const pending = talentRulesForCheck(a, check);
  assert.equal(pending.pool.add.boost, 0);
  assert.equal(pending.decisions[0].name, "Coordinated burst");
  const selected = talentRulesForCheck(a, check, { selectedTalents: [pending.decisions[0].id] });
  assert.equal(selected.pool.add.boost, 2);
});
