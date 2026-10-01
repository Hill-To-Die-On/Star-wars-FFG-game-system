import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile("styles/star-wars.css", "utf8");

test("story mechanic legends break the fieldset border around their text", () => {
  assert.match(
    css,
    /\.sf-form-grid fieldset\s*\{\s*box-shadow:\s*none;\s*\}/,
  );
});
