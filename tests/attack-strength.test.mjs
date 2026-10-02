import test from "node:test";
import assert from "node:assert/strict";
import { expectedAttackImpact, compareAttackOptions } from "../src/range-overlay/strength.mjs";

test("attack strength includes hit probability and extra successes without assuming optional spends",()=>{
 const result=expectedAttackImpact({damage:"5",scale:"personal",pool:{ability:1}});
 assert.equal(result.hitChance,0.5);assert.equal(result.expectedImpact,3.125);
 assert.equal(expectedAttackImpact({damage:"5",scale:"vehicle",pool:{ability:1}}).expectedImpact,31.25);
 assert.equal(expectedAttackImpact({damage:"?",pool:{ability:3}}),null);
 assert.equal(expectedAttackImpact({damage:"+2",pool:{ability:3}}),null);
});
test("gunner training, opposition and automatic successes affect estimated strength",()=>{
 const rate=pool=>expectedAttackImpact({damage:6,pool});
 assert.ok(rate({proficiency:3}).expectedImpact>rate({ability:3}).expectedImpact);
 assert.ok(rate({ability:3}).expectedImpact>rate({ability:3,difficulty:2}).expectedImpact);
 assert.ok(expectedAttackImpact({damage:6,pool:{},automaticResults:{success:1}}).expectedImpact===7);
});
test("ranking prefers a legal stronger attack, then the shorter shot on equal impact",()=>{
 const entry=(name,power,distance,error="")=>({attack:{itemName:name},range:{distancePx:distance,lineOfSight:"clear"},pool:{},error,strength:{expectedImpact:power,hitChance:.5}});
 const rows=[entry("Blocked",30,100,"Outside arc"),entry("Weak",2,100),entry("Strong far",8,700),entry("Strong near",8,500)];
 rows.sort(compareAttackOptions);
 assert.deepEqual(rows.map(r=>r.attack.itemName),["Strong near","Strong far","Weak","Blocked"]);
});
