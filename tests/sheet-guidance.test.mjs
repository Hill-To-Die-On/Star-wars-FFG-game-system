import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHARACTERISTICS, SKILLS } from "../src/config.mjs";
import {
  CHARACTERISTIC_GUIDANCE,
  SKILL_GUIDANCE,
  skillGuidance,
  sheetTitleGuidance,
  sheetFieldGuidance,
} from "../src/sheet-guidance.mjs";
import { directorAdapter } from "../src/director-adapter.mjs";

test("every native skill and characteristic has distinct, concise play guidance", () => {
  assert.deepEqual(Object.keys(SKILL_GUIDANCE).sort(), Object.keys(SKILLS).sort());
  assert.deepEqual(Object.keys(CHARACTERISTIC_GUIDANCE).sort(), Object.keys(CHARACTERISTICS).sort());
  for (const text of [...Object.values(SKILL_GUIDANCE), ...Object.values(CHARACTERISTIC_GUIDANCE)]) {
    assert.ok(text.length >= 35 && text.length <= 240, `Guidance should fit a tooltip: ${text}`);
  }
  assert.match(skillGuidance("astrogation"), /spacecraft|starship/i);
  assert.match(skillGuidance("astrogation"), /route|hyperspace/i);
  assert.doesNotMatch(skillGuidance("astrogation"), /unlock|hack/i);
  assert.match(skillGuidance("computers"), /terminal|network|computer/i);
  assert.match(skillGuidance("custom:123", "Droid etiquette"), /GM/i);
});

test("sheet titles and contextual fields explain the terms that differ by section", () => {
  for (const title of ["Overview", "Skills", "Inventory", "Advancement", "Story", "Vitals", "Readiness", "Story hooks", "Background story", "Bio Notes", "Source reference"])
    assert.ok(sheetTitleGuidance(title), title);
  assert.notEqual(sheetFieldGuidance("system.obligation.value"), sheetFieldGuidance("system.morality.value"));
  assert.ok(sheetFieldGuidance("system.characteristics.brawn"));
  assert.ok(sheetFieldGuidance("system.skills.astrogation.rank"));
});

test("character sheet wires help to skill names and characteristic labels", () => {
  const template = readFileSync(new URL("../templates/actor.hbs", import.meta.url), "utf8");
  assert.match(template, /sf-skill-roll[^>]*title="\{\{guidance\}\}"/);
  assert.match(template, /sf-characteristics[\s\S]*?<label[^>]*title="\{\{guidance\}\}"/);
  const sheet = readFileSync(new URL("../src/sheets.mjs", import.meta.url), "utf8");
  assert.match(sheet, /bindSheetGuidance\(this\.element\)/);
});

test("AI GM check API exposes the same skill and characteristic guidance", () => {
  const rules = directorAdapter.getNativeCheckRules();
  assert.equal(rules.skillGuidance.astrogation, SKILL_GUIDANCE.astrogation);
  assert.equal(rules.characteristicGuidance.intellect, CHARACTERISTIC_GUIDANCE.intellect);
});
