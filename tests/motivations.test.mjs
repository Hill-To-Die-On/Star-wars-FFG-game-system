import test from "node:test";
import assert from "node:assert/strict";
import {
  appendMotivation,
  discardMotivation,
  motivationSummary,
  replaceMotivation,
} from "../src/motivations.mjs";

const motivation = (id, name, category = "") => ({
  id,
  name,
  category,
  description: `${name} guidance`,
  active: true,
  source: { book: "Held book", page: "10", table: "motivation", id },
});

test("structured motivations can be added, edited, deactivated and removed", () => {
  let values = appendMotivation([], motivation("m1", "Protect the crew"), {
    id: "m1",
  });
  values = appendMotivation(values, motivation("m2", "Clear a debt", "Cause"), {
    id: "m2",
  });
  values = replaceMotivation(values, "m1", {
    ...motivation("ignored", "Protect the found family", "Relationship"),
    active: false,
  });
  assert.equal(values.length, 2);
  assert.equal(values[0].id, "m1");
  assert.equal(values[0].active, false);
  assert.equal(motivationSummary({ motivations: values }), "Cause: Clear a debt");
  assert.equal(
    motivationSummary({ motivations: values }, { includeInactive: true }),
    "Relationship: Protect the found family; Cause: Clear a debt",
  );
  values = discardMotivation(values, "m1");
  assert.deepEqual(values.map((entry) => entry.id), ["m2"]);
});

test("legacy motivation remains available during migration", () => {
  assert.equal(
    motivationSummary({ motivation: "Legacy freeform motive", motivations: [] }),
    "Legacy freeform motive",
  );
  assert.throws(() =>
    appendMotivation([], { ...motivation("m1", ""), name: "" }, { id: "m1" }),
  );
});
