import test from "node:test";
import assert from "node:assert/strict";
import { renderTalentMarkup, talentMarkupText } from "../src/talent-markup.mjs";

test("talent boxes render emphasis and repeated narrative dice as accessible symbols", () => {
  const source = "Take a [B]Hard ([DI][DI][DI]) Piloting check[b] and add [BO][AD].";
  const html = renderTalentMarkup(source);
  assert.match(html, /<strong>Hard \(/);
  assert.equal((html.match(/aria-label="Difficulty die"/g) ?? []).length, 3);
  assert.match(html, /aria-label="Boost die"/);
  assert.match(html, /aria-label="Advantage"/);
  assert.doesNotMatch(html, /\[(?:B|DI|BO|AD|b)\]/);
  assert.match(talentMarkupText(source), /Hard \(Difficulty die Difficulty die Difficulty die\) Piloting check/);
});

test("talent markup keeps paragraph breaks, unknown tags, and hostile text safe", () => {
  const html = renderTalentMarkup("First.[P]Second [UNKNOWN] <img src=x onerror=alert(1)> [B]bold[b]");
  assert.match(html, /First\.<br>Second/);
  assert.match(html, /\[UNKNOWN\]/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /<strong>bold<\/strong>/);
});
