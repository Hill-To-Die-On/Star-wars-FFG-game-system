import test from "node:test";
import assert from "node:assert/strict";
import { gmSightRuling } from "../src/line-of-sight-ruling.mjs";

test("only an explicit GM ruling with a reason permits a blocked sight line", () => {
  const blocked = { needsRuling: true, manual: true, approved: true, reason: "Sense through the sealed bulkhead" };
  assert.equal(gmSightRuling({ ...blocked, isGM: false }).allowed, false);
  assert.equal(gmSightRuling({ ...blocked, isGM: true, manual: false }).allowed, false);
  assert.equal(gmSightRuling({ ...blocked, isGM: true, approved: false }).allowed, false);
  assert.equal(gmSightRuling({ ...blocked, isGM: true, reason: "   " }).allowed, false);
  const ruling = gmSightRuling({ ...blocked, isGM: true });
  assert.equal(ruling.allowed, true);
  assert.match(ruling.note, /GM line of sight override: Sense through the sealed bulkhead/);
  assert.equal(gmSightRuling({ ...blocked, needsRuling: false, isGM: false }).allowed, true);
});
