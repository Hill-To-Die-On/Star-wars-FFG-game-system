import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("src/sheets.mjs", "utf8"),
  actorSheet = source.slice(
    source.indexOf("export class StarWarsActorSheet"),
    source.indexOf("export class StarWarsItemSheet"),
  );

test("character and vehicle actor sheets expose Foundry's resize handle", () => {
  assert.match(
    actorSheet,
    /static DEFAULT_OPTIONS = \{[\s\S]*?window:\s*\{\s*resizable:\s*true\s*\}/,
  );
});

test("changing sheet tabs preserves a user-selected height", () => {
  assert.doesNotMatch(
    actorSheet,
    /else if \(this\.position\.height !== 820\)[\s\S]*?setPosition\(\{ height: 820 \}\)/,
  );
});
