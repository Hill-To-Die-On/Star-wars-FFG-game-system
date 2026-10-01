import test from "node:test";
import assert from "node:assert/strict";
import {
  indexRuleInstructionCandidates,
  filterRuleInstructionCandidates,
} from "../src/rule-instruction-audit.mjs";

const database = {
  tables: {
    books: [
      { ID: 1, books: "Edge of The Empire - Core Book" },
      { ID: 2, books: "Age of Rebellion - Core Book" },
    ],
    career_rules: [
      { ID: 1, Rule: "Shared heading", Book: "Edge of The Empire - Core Book", Page: "42" },
      { ID: 2, Rule: "Shared heading", Book: "Age of Rebellion - Core Book", Page: "51" },
    ],
    talents: [
      { ID: 3, Talent: "Uncited talent", Book: "", Page: 0 },
    ],
  },
};

test("a repeated heading remains two book-specific candidates until the rules are compared", () => {
  const index = indexRuleInstructionCandidates(database, ["career_rules", "talents"]);
  assert.equal(index.records.length, 3);
  assert.deepEqual(index.overlaps, [{
    table: "career_rules",
    name: "Shared heading",
    books: ["Age of Rebellion - Core Book", "Edge of The Empire - Core Book"],
  }]);
  assert.equal(index.summary.career_rules.missingBook, 0);
  assert.equal(index.summary.talents.missingBook, 1);
  assert.equal(index.summary.talents.missingPage, 1);
  assert.equal(index.records[2].citation, "missing-book");
  assert.equal(index.records[2].source.page, "0", "keep the raw zero placeholder visible for repair");
  assert.ok(index.records.every((record) => record.review === "candidate"));
});

test("owned-book filtering keeps only the matching occurrence and treats uncited rows explicitly", () => {
  const index = indexRuleInstructionCandidates(database, ["career_rules", "talents"]);
  const campaign = {
    bookMode: "owned",
    books: ["Age of Rebellion - Core Book"],
    includeUnreferenced: false,
  };
  assert.deepEqual(
    filterRuleInstructionCandidates(index.records, campaign).map((row) => row.source.book),
    ["Age of Rebellion - Core Book"],
  );
  assert.equal(filterRuleInstructionCandidates(index.records, { ...campaign, books: [] }).length, 0);
  assert.equal(
    filterRuleInstructionCandidates(index.records, { ...campaign, includeUnreferenced: true }).length,
    2,
  );
});
