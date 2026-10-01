import test from "node:test";
import assert from "node:assert/strict";
import { renderAboutContent } from "../src/about.mjs";

test("About shows the version loaded by Foundry at runtime", () => {
  const html = renderAboutContent({
    systemTitle: "Star Wars FFG",
    systemId: "star-wars-ffg",
    systemVersion: "0.4.0",
    foundryVersion: "14.368",
  });
  assert.match(html, /System version<\/dt><dd>0\.4\.0<\/dd>/);
  assert.match(html, /Foundry version<\/dt><dd>14\.368<\/dd>/);
  assert.match(html, /star-wars-ffg/);
  assert.doesNotMatch(html, /0\.3\.0/);
});

test("About escapes runtime metadata before putting it in HTML", () => {
  const html = renderAboutContent({
    systemTitle: '<img src=x onerror="alert(1)">',
    systemId: "star-wars-ffg",
    systemVersion: "0.4.0<script>",
    foundryVersion: "14.368",
  });
  assert.doesNotMatch(html, /<img|<script>/);
  assert.match(html, /&lt;img/);
  assert.match(html, /0\.4\.0&lt;script&gt;/);
});
