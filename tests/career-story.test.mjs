import test from "node:test";
import assert from "node:assert/strict";
import { defaultOriginBiography, appendCareerStoryPrompts, careerBackgroundDefault, speciesBackgroundDefault } from "../src/career-story.mjs";

test("new Human Smuggler has editable original background defaults", () => {
  const biography = defaultOriginBiography("Human", "Smuggler");
  assert.match(biography, /Species origin · Human/);
  assert.match(biography, /Career origin · Smuggler/);
  assert.match(biography, /routes, people and risk/);
  assert.ok(speciesBackgroundDefault("Human"));
  assert.ok(careerBackgroundDefault("Smuggler"));
  assert.equal(appendCareerStoryPrompts(biography, "Smuggler"), appendCareerStoryPrompts(appendCareerStoryPrompts(biography, "Smuggler"), "Smuggler"));
});
