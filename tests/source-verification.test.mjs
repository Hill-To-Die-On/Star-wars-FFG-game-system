import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public source verification records checks without private prose or paths", async () => {
  const data = JSON.parse(
    await readFile("data/source-verification.json", "utf8"),
  );
  assert.equal(data.format, "star-wars-ffg-source-verification");
  assert.equal(data.version, 1);
  assert.ok(data.checks.length >= 9);
  const identities = new Set();
  for (const entry of data.checks) {
    assert.ok(["specialization", "signatureAbility"].includes(entry.kind));
    assert.ok(["full-chart", "connectors"].includes(entry.level));
    assert.deepEqual(
      entry.checked,
      entry.level === "full-chart"
        ? ["node names", "costs", "connectors"]
        : ["connectors"],
    );
    assert.match(entry.referencePage, /^\d+$/);
    assert.match(entry.evidencePage, /^\d+$/);
    assert.ok(!("path" in entry));
    assert.ok(!("text" in entry));
    assert.ok(!("description" in entry));
    identities.add(`${entry.kind}:${entry.name.toLowerCase()}`);
  }
  assert.equal(identities.size, data.checks.length);
  for (const identity of [
    "specialization:courier",
    "specialization:interrogator",
    "specialization:sleeper agent",
    "signatureAbility:counterespionage",
    "signatureAbility:unmatched tradecraft",
    "specialization:ambassador",
    "specialization:scoundrel",
    "specialization:protector",
    "specialization:sharpshooter",
  ])
    assert.ok(identities.has(identity));
});
