import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBookshelf, bookshelfFromCampaign, applyBookshelf, needsOnboarding, readRememberedBooks, rememberBooks } from "../src/onboarding.mjs";
import { DEFAULT_CAMPAIGN } from "../src/rules.mjs";

test("bookshelf profiles retain only bounded book metadata and normalize duplicates", () => {
  assert.deepEqual(normalizeBookshelf({books:[" Core ","Core","","Force"],bookMode:"owned",includeUnreferenced:true,secret:"private"}),{version:1,books:["Core","Force"],bookMode:"owned",includeUnreferenced:true});
  assert.equal(normalizeBookshelf(null),null);
  assert.equal(normalizeBookshelf({books:"Core"}),null);
  assert.equal(normalizeBookshelf({books:[{}]}),null);
});
test("saving books preserves unrelated campaign state and rejects stale book edits", () => {
  const original={...DEFAULT_CAMPAIGN,books:["Core"],bookMode:"owned"};
  const expected=bookshelfFromCampaign(original);
  const current={...original,adventureStarted:true,partySize:6};
  const saved=applyBookshelf(current,{books:["Force"],bookMode:"owned"},expected);
  assert.equal(saved.adventureStarted,true);assert.equal(saved.partySize,6);assert.deepEqual(saved.lines,DEFAULT_CAMPAIGN.lines);assert.deepEqual(saved.books,["Force"]);
  assert.throws(()=>applyBookshelf({...current,books:["Another GM's book"]},{books:["Force"]},expected),/changed/i);
  assert.deepEqual(applyBookshelf(original,{books:[],bookMode:"owned"},expected).books,[]);
});
test("first launch is per user and skipping the tour counts as seen", () => {
  assert.equal(needsOnboarding(undefined),true);
  assert.equal(needsOnboarding({version:1,tour:"skipped"}),false);
  assert.equal(needsOnboarding({version:1,tour:"completed"}),false);
});
test("remembered books survive future worlds without requiring browser storage", () => {
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  assert.equal(readRememberedBooks(storage),null);
  assert.equal(rememberBooks(storage,{books:["Core"],bookMode:"owned"}),true);
  assert.deepEqual(readRememberedBooks(storage).books,["Core"]);
  rememberBooks(storage,null);assert.equal(readRememberedBooks(storage),null);
  const denied={getItem(){throw Error("Denied");},setItem(){throw Error("Denied");}};
  assert.equal(readRememberedBooks(denied),null);assert.equal(rememberBooks(denied,{books:[]}),false);
});
