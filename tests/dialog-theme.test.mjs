import test from "node:test";
import assert from "node:assert/strict";
import { starWarsDialogOptions, themedDialogApi } from "../src/dialog-theme.mjs";

test("system dialogs gain the common theme without losing specialized classes or mutating callers", () => {
  const original = { window:{title:"Crew"}, classes:["sf-crew-dialog","star-wars"] };
  const themed = starWarsDialogOptions(original);
  assert.deepEqual(themed.classes, ["star-wars","sf-crew-dialog"]);
  assert.deepEqual(original.classes, ["sf-crew-dialog","star-wars"]);
  assert.deepEqual(starWarsDialogOptions({window:{title:"Damage"}}).classes, ["star-wars"]);
});

test("dialog prompt, confirm, and wait all receive the themed options", async () => {
  const seen = [], api = Object.fromEntries(["prompt","confirm","wait"].map((method) => [
    method, (options) => { seen.push([method, options.classes]); return method; },
  ]));
  const themed = themedDialogApi(api);
  for (const method of ["prompt","confirm","wait"])
    assert.equal(themed[method]({classes:["sf-special"]}), method);
  assert.deepEqual(seen, ["prompt","confirm","wait"].map((method) => [method,["star-wars","sf-special"]]));
});
