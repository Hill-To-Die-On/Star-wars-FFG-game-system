import test from "node:test";
import assert from "node:assert/strict";
import { groupSummary, memberFromCharacter } from "../src/group.mjs";
import { directorAdapter, actorContext } from "../src/director-adapter.mjs";
import { DEFAULT_CAMPAIGN } from "../src/rules.mjs";
test("group summaries combine ledgers and use the world's Destiny pool without mutating it", () => {
  const destiny = { light: 2, dark: 3 };
  const summary = groupSummary(
    {
      base: { name: "Test base" },
      members: {
        a: { obligation: 15, duty: 5 },
        b: { obligation: 10, duty: 20 },
      },
    },
    destiny,
  );
  assert.equal(summary.obligationTotal, 25);
  assert.equal(summary.dutyTotal, 25);
  assert.deepEqual(summary.destiny, destiny);
  summary.destiny.light = 99;
  assert.equal(destiny.light, 2);
});
test("explicit member sync preserves group-authored details and never modifies a character", () => {
  const pc = {
    id: "pc",
    type: "character",
    name: "Linked character",
    system: {
      obligation: { value: 15, label: "Debt" },
      duty: { value: 3, label: "Support" },
      morality: { value: 52 },
      motivation: "Test motive",
      motivations: [
        {
          id: "m1",
          name: "Protect the crew",
          category: "Relationship",
          active: true,
        },
      ],
    },
  };
  const before = structuredClone(pc);
  const result = memberFromCharacter(pc, {
    playerName: "Player",
    description: "Group-specific history",
  });
  assert.equal(result.obligation, 15);
  assert.equal(result.characterName, pc.name);
  assert.equal(result.description, "Group-specific history");
  assert.equal(result.playerName, "Player");
  assert.equal(result.motivation, "Relationship: Protect the crew");
  assert.deepEqual(pc, before);
  assert.throws(() => memberFromCharacter({ ...pc, type: "vehicle" }));
});
test("DoR receives group base, contacts and shared state without treating it as a combatant", () => {
  const prior = globalThis.game;
  try {
    globalThis.game = {
      user: { isGM: false },
      settings: {
        get: (_id, key) =>
          key === "destiny" ? { light: 1, dark: 4 } : DEFAULT_CAMPAIGN,
      },
    };
    const group = {
      type: "group",
      name: "Crew",
      items: { contents: [] },
      system: {
        base: { name: "Refuge" },
        contacts: "Ally",
        members: {},
        credits: 25,
      },
    };
    assert.equal(actorContext(group).group.base.name, "Refuge");
    const stats = directorAdapter.getNarrativeSheetStats(group);
    assert.equal(
      stats.find((stat) => stat.label === "Shared Destiny").value,
      "1 light, 4 dark",
    );
    assert.equal(
      stats.find((stat) => stat.label === "Group contacts").value,
      "Ally",
    );
    assert.throws(() => directorAdapter.getActorHP(group), /no combat health/);
  } finally {
    globalThis.game = prior;
  }
});
