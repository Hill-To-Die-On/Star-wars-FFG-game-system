import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rollCard } from "../src/dice/foundry.mjs";

const css = await readFile("styles/star-wars.css", "utf8");

function variablesAfter(marker) {
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, `Missing CSS block ${marker}`);
  const block = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries(
    Array.from(block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{3,8})/gi), ([, key, value]) => [
      key.replace(/^sf-/, ""),
      value,
    ]),
  );
}

function rgb(hex) {
  let value = hex.slice(1);
  if (value.length === 3 || value.length === 4)
    value = value
      .slice(0, 3)
      .split("")
      .map((entry) => entry.repeat(2))
      .join("");
  value = value.slice(0, 6);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function luminance(hex) {
  return rgb(hex)
    .map((value) => value / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function mix(a, b, weight) {
  const first = rgb(a),
    second = rgb(b);
  return `#${first
    .map((value, index) =>
      Math.round(value * weight + second[index] * (1 - weight))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

test("sheet and Foundry interface text tokens meet WCAG AA contrast", () => {
  const sheetBase = variablesAfter(".star-wars {"),
    sheetThemes = [
      sheetBase,
      { ...sheetBase, ...variablesAfter('.star-wars[data-theme="rebellion"],') },
      { ...sheetBase, ...variablesAfter('.star-wars[data-theme="mystic"],') },
    ],
    uiThemes = [
      variablesAfter('body[data-star-wars-theme="frontier"] {'),
      variablesAfter('body[data-star-wars-theme="rebellion"] {'),
      variablesAfter('body[data-star-wars-theme="mystic"] {'),
    ];
  for (const theme of sheetThemes) {
    assert.ok(contrast(theme["accent-text"], theme.paper) >= 4.5);
    assert.ok(contrast(theme.muted, theme.wash) >= 4.5);
    assert.ok(contrast(theme["on-accent"], theme.accent) >= 4.5);
  }
  for (const theme of uiThemes) {
    assert.ok(contrast(theme["ui-accent-text"], theme["ui-paper"]) >= 4.5);
    assert.ok(contrast(theme["ui-on-accent"], theme["ui-accent"]) >= 4.5);
    assert.ok(contrast("#fff", mix(theme["ui-accent"], "#071014", 0.58)) >= 4.5);
    assert.ok(contrast("#fff", mix(theme["ui-accent"], "#071014", 0.66)) >= 4.5);
  }
  assert.ok(
    (
      css.match(
        /color-mix\(\s*in srgb,\s*var\(--sf-ui-accent\) 58%,\s*#071014\s*\)/g,
      ) ?? []
    ).length >= 2,
  );
});

test("chat roll results expose all seven semantic dice and their distinct silhouettes", () => {
  const keys = [
      "boost",
      "ability",
      "proficiency",
      "setback",
      "difficulty",
      "challenge",
      "force",
    ],
    roll = {
      formula: keys.map((key) => `1d${key}`).join(" + "),
      dice: keys.map((key) => ({
        options: { starWarsDie: key },
        results: [{ result: 1 }],
        getResultLabel: () => `<img alt="${key}">`,
      })),
    },
    html = rollCard(
      "Mixed pool",
      {
        passed: true,
        success: 1,
        failure: 0,
        advantage: 0,
        threat: 0,
        triumph: 0,
        despair: 0,
        light: 0,
        dark: 0,
      },
      roll,
    );
  for (const key of keys) {
    assert.match(html, new RegExp(`sf-die-result sf-die-${key}`));
    assert.match(html, new RegExp(`data-die="${key}"`));
  }
  assert.match(css, /\.sf-die-ability[^{]*\{[^}]*clip-path:/s);
  assert.match(css, /\.sf-die-boost[^{]*\{[^}]*border-radius:/s);
  assert.match(
    css,
    /\.sf-die-proficiency,\s*\.sf-die-challenge,\s*\.sf-die-force\s*\{[^}]*clip-path:\s*polygon\([^}]+\)[^}]*border-radius:\s*0/s,
  );
  assert.doesNotMatch(css, /\.sf-die-force\s*\{[^}]*border-radius:\s*50%/s);
  assert.match(
    css,
    /span\[style\*="#edc94e"\],\s*\.sf-dice-tray > span\[style\*="#b93d4e"\],\s*\.sf-dice-tray > span\[style\*="#edece6"\]\s*\{[^}]*clip-path:\s*polygon\([^}]+\)[^}]*border-radius:\s*0/s,
  );
  assert.match(
    css,
    /\.sf-dice-tray \.sf-die-result,[^{]*\{[^}]*background:\s*var\(--sf-die-color,\s*#77848a\)/s,
  );
  for (const color of [
    "#79cce7",
    "#47ad68",
    "#edc94e",
    "#242a32",
    "#7953ad",
    "#b93d4e",
    "#edece6",
  ])
    assert.match(css, new RegExp(`--sf-die-color:\\s*${color}`));
});
