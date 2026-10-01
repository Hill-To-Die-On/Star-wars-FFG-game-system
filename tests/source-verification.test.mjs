import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public source verification records checks without private prose or paths", async () => {
  const data = JSON.parse(
    await readFile("data/source-verification.json", "utf8"),
  );
  assert.equal(data.format, "star-wars-ffg-source-verification");
  assert.equal(data.version, 1);
  assert.equal(data.checks.length, 168);
  const identities = new Set();
  for (const entry of data.checks) {
    assert.ok(["specialization", "signatureAbility"].includes(entry.kind));
    assert.ok(["full-chart", "connectors"].includes(entry.level));
    assert.deepEqual(entry.checked,
      entry.level === "full-chart"
        ? ["node names", "costs", "connectors",
           ...(entry.kind === "signatureAbility" &&
               ["Prophecy", "Unmatched Destiny", "Unmatched Teamwork", "Peerless Interception"].includes(entry.name)
             ? ["attachment slots"] : [])]
        : ["connectors"]);
    assert.match(entry.referencePage, /^\d+$/);
    assert.match(entry.evidencePage, /^\d+$/);
    assert.ok(!("path" in entry));
    assert.ok(!("text" in entry));
    assert.ok(!("description" in entry));
    identities.add(`${entry.kind}:${entry.name.toLowerCase()}`);
  }
  assert.equal(identities.size, data.checks.length);
  for (const identity of [
    "specialization:assassin",
    "specialization:courier",
    "specialization:interrogator",
    "specialization:sleeper agent",
    "signatureAbility:counterespionage",
    "signatureAbility:unmatched tradecraft",
    "signatureAbility:insightful revelation",
    "signatureAbility:unmatched devastation",
    "signatureAbility:deadly reputation",
    "signatureAbility:unmatched ferocity",
    "signatureAbility:unexpected demise",
    "specialization:ambassador",
    "specialization:scoundrel",
    "specialization:protector",
    "specialization:sharpshooter",
    "specialization:propagandist",
    "specialization:force sensitive emergent",
    "specialization:heavy (soldier)",
    "specialization:imperial academy cadet",
    "specialization:martial artist",
    "specialization:modder",
    "specialization:teacher",
    "specialization:sentry",
    "specialization:steel hand adept",
    "specialization:navigator",
    "specialization:alchemist",
    "specialization:magus",
    "specialization:prophet",
    "specialization:clone officer",
    "specialization:clone pilot",
    "specialization:clone trooper",
    "specialization:knight",
    "specialization:padawan",
    "specialization:force sensitive outcast",
    "specialization:republic navy officer",
    "specialization:republic representative",
    "specialization:scavenger",
    "specialization:arc trooper",
    "specialization:clone commander",
    "specialization:clone veteran",
    "specialization:general",
    "specialization:master",
    "specialization:death watch warrior",
    "specialization:nightsister",
    "specialization:senator",
    "specialization:separatist commander",
    "signatureAbility:prophecy",
    "signatureAbility:unmatched destiny",
    "signatureAbility:unmatched teamwork",
    "signatureAbility:peerless interception",
  ])
    assert.ok(identities.has(identity));
  assert.equal(
    data.checks.filter((entry) => entry.level === "full-chart").length,
    168,
  );
  assert.equal(
    data.checks.filter((entry) => entry.level === "connectors").length,
    0,
  );
});

test("source coverage requests every unverified signature chart", async () => {
  const coverage = await readFile("docs/source-coverage.md", "utf8"),
    section = coverage.split("## Signature chart photo requests")[1].split(
      "## Coverage limits",
    )[0];
  for (const name of [
    "The Harder They Fall",
    "Unmatched Ingenuity",
  ])
    assert.match(section, new RegExp(name));
  assert.doesNotMatch(section, /Deadly Reputation|Unmatched Ferocity|Peerless Interception|Unmatched Teamwork|Prophecy|Unmatched Destiny/);
});
