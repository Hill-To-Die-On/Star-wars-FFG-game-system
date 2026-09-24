import test from "node:test";
import assert from "node:assert/strict";
import {
  generateSourceKey,
  sealSource,
  openSource,
  sourceKeyId,
} from "../src/source-crypto.mjs";
test("GM source prose persists as authenticated ciphertext and survives key restore", async () => {
  const key = generateSourceKey(),
    source = {
      name: "Source",
      text: "PRIVATE_ADVENTURE_MOTIVE",
      kind: "adversary",
    };
  const sealed = await sealSource(source, key, "world", "note");
  assert.ok(!JSON.stringify(sealed).includes(source.text));
  assert.equal(sealed.keyId, await sourceKeyId(key));
  assert.deepEqual(
    await openSource(JSON.parse(JSON.stringify(sealed)), key, "world", "note"),
    source,
  );
  assert.notEqual(
    (await sealSource(source, key, "world", "note")).ciphertext,
    sealed.ciphertext,
  );
});
test("wrong keys, cross-world copies, swapped records and tampered ciphertext cannot unlock notes", async () => {
  const key = generateSourceKey(),
    sealed = await sealSource({ text: "secret" }, key, "world", "note");
  await assert.rejects(
    openSource(sealed, generateSourceKey(), "world", "note"),
  );
  await assert.rejects(openSource(sealed, key, "other-world", "note"));
  await assert.rejects(openSource(sealed, key, "world", "other-note"));
  const damaged = {
    ...sealed,
    ciphertext:
      (sealed.ciphertext[0] === "A" ? "B" : "A") + sealed.ciphertext.slice(1),
  };
  await assert.rejects(openSource(damaged, key, "world", "note"));
  await assert.rejects(sourceKeyId("AAAA"));
});
