import test from "node:test";
import assert from "node:assert/strict";
import { actorRuleCoverage, capabilityCoverage, supportSnapshot } from "../src/rules-coverage.mjs";

function actor() {
  const nodes = [
    {id:"auto",name:"Pool modifier",activation:"Passive",effects:[{type:"pool",operation:"add",target:"boost",count:1,skills:["leadership"]}]},
    {id:"active",name:"Chosen modifier",activation:"Incidental",effects:[{type:"pool",operation:"remove",target:"setback",count:1}]},
    {id:"manual",name:"Unencoded ability",summary:"Private source prose that must not be returned",effects:[]},
    {id:"bad",name:"Invalid effect",activation:"Passive",effects:[{type:"pool",operation:"add",target:"credits",count:99}]}
  ];
  return {system:{advancement:nodes.map(n=>({itemId:"tree",nodeId:n.id}))},
    items:[{id:"tree",type:"specialization",system:{source:{book:"Example Book",page:"42"},tree:{verification:{source:"full-chart"},nodes}}}]};
}

test("coverage separates passive effects, choices and manual abilities without exposing prose",()=>{
 const report=actorRuleCoverage(actor(),{bookMode:"all"});
 assert.equal(report.entries.length,4);
 assert.deepEqual(report.entries.map(e=>e.status),["automatic","choice","manual","manual"]);
 assert.match(report.entries[0].calculation,/add 1 boost/);
 assert.match(report.entries[0].condition,/leadership/);
 assert.equal(report.entries[0].source.book,"Example Book");
 assert.equal(report.entries[0].source.page,"42");
 assert.equal(report.entries[0].chartVerification,"full-chart");
 assert.equal(report.entries[0].effectVerification,"not-certified-by-chart");
 assert.match(report.entries[3].calculation,/invalid/i);
 assert.ok(!JSON.stringify(report).includes("Private source prose"));
});

test("owned-book filtering never changes learned actor effects or counts excluded entries as verified",()=>{
 const input=actor(), before=JSON.stringify(input);
 const report=actorRuleCoverage(input,{bookMode:"owned",books:["Different Book"]});
 assert.equal(report.entries.length,0);
 assert.equal(report.excluded,4);
 assert.equal(JSON.stringify(input),before);
 assert.match(report.notice,/does not disable/);
});

test("a missing tree node remains an explicit manual gap",()=>{
 const input=actor(); input.system.advancement.push({itemId:"missing",nodeId:"lost",name:"Lost rule"});
 const report=actorRuleCoverage(input,{bookMode:"all"});
 assert.equal(report.entries.at(-1).status,"manual");
 assert.equal(report.entries.at(-1).chartVerification,"pending");
 assert.equal(report.entries.at(-1).source.page,"");
});

test("coverage counts and text filters refer to displayed rows, not unrelated hidden sources",()=>{
 const report=actorRuleCoverage(actor(),{bookMode:"all"},{query:"chosen",status:"choice"});
 assert.equal(report.entries.length,1);
 assert.equal(report.entries[0].name,"Chosen modifier");
 assert.equal(report.total,4);
 assert.equal(report.counts.manual,2);
});

test("implementation inventory is fail-closed for unknown mechanics and flags unencoded effects",()=>{
 const rows=capabilityCoverage();
 for(const key of ["criticals","qualities","cross-scale","narrative-options","downtime"]){
   const row=rows.find(r=>r.id===key);assert.ok(row,key);
   assert.equal(row.automatic,false,key);assert.equal(row.requiresGmRuling,true,key);
 }
 const unknown=capabilityCoverage("invented-rule");
 assert.deepEqual(unknown,{id:"invented-rule",status:"unsupported",automatic:false,requiresGmRuling:true});
 assert.equal(capabilityCoverage("dice").status,"implemented");
});

test("diagnostic snapshot uses an allowlist and never serializes world content, users, settings or arbitrary modules",()=>{
 const privateText="secret-private-content";
 const game={version:"14.368",system:{id:"star-wars-ffg",version:"0.3.0",secret:privateText},
   actors:{size:4,contents:[{name:privateText}]},scenes:{size:2},messages:{size:50},
   world:{id:privateText,title:privateText},user:{name:privateText},settings:{get(){throw Error("must not read settings")}},
   modules:new Map([["dice-so-nice",{active:true,version:"6.3.1"}],["hill-to-die-on-director-of-realms",{active:true,version:"0.10.1219"}],["private-module",{active:true,version:privateText}]])};
 const snapshot=supportSnapshot(game);
 assert.equal(snapshot.counts.actors,4);
 assert.equal(snapshot.integrations["dice-so-nice"].active,true);
 assert.equal(snapshot.integrations["dice-so-nice"].version,"6.3.1");
 assert.equal(snapshot.integrations["hill-to-die-on-director-of-realms"].active,true);
 assert.ok(!JSON.stringify(snapshot).includes(privateText));
 assert.deepEqual(Object.keys(snapshot).sort(),["counts","format","foundry","integrations","system"]);
});

test("diagnostic version and counts reject paths, credentials and malformed data",()=>{
 const snapshot=supportSnapshot({version:"C:/private/key",system:{version:"sk-secret /private"},actors:{size:-1},scenes:{size:"secret"},
 modules:new Map([["dice-so-nice",{active:true,version:"https://private/?api_key=secret"}]])});
 assert.equal(snapshot.foundry,"unknown");assert.equal(snapshot.system.version,"unknown");
 assert.equal(snapshot.counts.actors,0);assert.equal(snapshot.counts.scenes,0);
 assert.equal(snapshot.integrations["dice-so-nice"].version,"unknown");
});
