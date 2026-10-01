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

test("a motivation entered with only a name gets blank details and source", () => {
  assert.deepEqual(
    appendMotivation(undefined, { name: "  Protect the crew  " }, { id: "m1" }),
    [
      {
        id: "m1",
        name: "Protect the crew",
        category: "",
        description: "",
        active: true,
        source: { book: "", page: "", table: "", id: "" },
      },
    ],
  );
});

test("motivation text beyond its limit is refused and names the field", () => {
  const add = (overrides, id = "m1") =>
    appendMotivation([], { ...motivation("m1", "Protect the crew"), ...overrides }, { id });
  assert.equal(add({ name: "x".repeat(160) })[0].name.length, 160);
  assert.throws(
    () => add({ name: "x".repeat(161) }),
    /Motivation name cannot exceed 160 characters/,
  );
  assert.throws(
    () => add({ category: "x".repeat(101) }),
    /Motivation category cannot exceed 100 characters/,
  );
  assert.throws(
    () => add({ description: "x".repeat(4001) }),
    /Motivation guidance cannot exceed 4000 characters/,
  );
  assert.throws(
    () => add({ source: { book: "Held book", page: "x".repeat(33) } }),
    /Source page cannot exceed 32 characters/,
  );
  assert.throws(
    () => add({}, "x".repeat(65)),
    /Motivation id cannot exceed 64 characters/,
  );
});

test("a new motivation needs a stable id that no other motivation uses", () => {
  assert.throws(
    () => appendMotivation([], { name: "Protect the crew" }),
    /A motivation needs a stable id/,
  );
  const values = appendMotivation([], motivation("m1", "Protect the crew"), {
    id: "m1",
  });
  assert.throws(
    () => appendMotivation(values, motivation("m1", "Clear a debt")),
    /Motivation ids must be unique/,
  );
});

test("editing or removing a motivation that is not recorded is refused", () => {
  const values = appendMotivation([], motivation("m1", "Protect the crew"), {
    id: "m1",
  });
  for (const current of [values, undefined]) {
    assert.throws(
      () => replaceMotivation(current, "m2", motivation("m2", "Clear a debt")),
      /Motivation was not found/,
    );
    assert.throws(
      () => discardMotivation(current, "m2"),
      /Motivation was not found/,
    );
  }
});

test("the motivation summary shows uncategorised names, skips unnamed ones and may be empty", () => {
  const system = {
    motivation: "Legacy freeform motive",
    motivations: [
      { id: "m1", name: "Protect the crew" },
      { id: "m2", name: " Clear a debt ", category: " Cause " },
      { id: "m3", category: "Relationship" },
      { id: "m4", name: "   ", category: "Faith" },
    ],
  };
  assert.equal(motivationSummary(system), "Protect the crew; Cause: Clear a debt");
  assert.equal(
    motivationSummary({ ...system, motivations: system.motivations.slice(2) }),
    "Legacy freeform motive",
  );
  assert.equal(motivationSummary({}), "");
});
