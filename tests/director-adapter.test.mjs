import test from "node:test";
import assert from "node:assert/strict";
import { actorContext, directorAdapter } from "../src/director-adapter.mjs";

test("Director of Realms receives every custom skill with its effective rank", () => {
  const customSkills = Array.from({ length: 8 }, (_, index) => ({
      id: `skill-${index}`,
      label: `Custom ${index + 1}`,
      characteristic: index % 2 ? "presence" : "intellect",
      type: index % 3 === 0 ? "ranged" : "general",
      rank: index % 5,
      career: index % 2 === 0,
      group: false,
    })),
    actor = {
      uuid: "Actor.test",
      name: "Test character",
      type: "character",
      items: { contents: [] },
      system: {
        customSkills,
        skills: {},
        source: {},
        incomplete: [],
        advancement: [],
        motivation: "Legacy motive",
        motivations: [
          {
            id: "m1",
            name: "Protect the crew",
            category: "Relationship",
            description: "Use this to frame difficult loyalties.",
            active: true,
            source: { book: "Held book", page: "12" },
          },
        ],
      },
      skillRank(key) {
        return Number(key.split("-").at(-1)) + 1;
      },
    };

  const context = actorContext(actor);
  assert.equal(context.customSkills.length, 8);
  assert.deepEqual(context.customSkills[6], {
    key: "custom:skill-6",
    name: "Custom 7",
    characteristic: "intellect",
    type: "ranged",
    rank: 7,
    career: true,
    group: false,
  });
  assert.equal(directorAdapter.extractSkills(actor)["Custom 8"], 8);
  assert.equal(context.motivation, "Relationship: Protect the crew");
  assert.equal(context.motivations[0].description.includes("loyalties"), true);
});
