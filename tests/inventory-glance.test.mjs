import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inventoryGlance, inventoryGroups } from "../src/inventory-glance.mjs";

const item = (type, system = {}, name = type) => ({
  id: `${type}-1`, name, type, img: "item.webp", system: { quantity: 1, source: {}, ...system },
});

test("inventory separates every supported item type without losing entries", () => {
  const types = ["weapon", "armor", "gear", "attachment", "species", "career", "specialization", "talent", "forcePower", "signatureAbility", "reference"];
  const grouped = inventoryGroups(types.map((type) => item(type)));
  assert.deepEqual(grouped.equipmentItems.map(({type}) => type), types.slice(0, 4));
  assert.deepEqual(grouped.abilityItems.map(({type}) => type), types.slice(4));
  assert.equal(grouped.equipmentItems.length + grouped.abilityItems.length, types.length);
});

test("equipment cards expose recorded combat and carrying stats before opening an item", () => {
  const pistol = inventoryGlance(item("weapon", {damage:"6", critical:3, range:"medium", skill:"rangedLight", encumbrance:1, qualities:"Stun setting", quantity:2}, "Blaster Pistol"));
  assert.deepEqual(pistol.chips.map(({label,value}) => `${label} ${value}`),
    ["Damage 6", "Critical 3", "Range medium", "Skill Ranged (Light)", "Encumbrance 1"]);
  assert.equal(pistol.detail, "Stun setting");
  assert.equal(pistol.quantity, 2);
  const armor = inventoryGlance(item("armor", {soak:2, defense:1, encumbrance:3, equipped:true}));
  assert.deepEqual(armor.chips.map(({label,value}) => `${label} ${value}`),
    ["Soak 2", "Defense 1", "Encumbrance 3"]);
  assert.equal(armor.equipped, true);
  const gear = inventoryGlance(item("gear", {encumbrance:0, price:25, rarity:1, description:"A compact tool."}));
  assert.match(gear.chips.map(({label,value}) => `${label} ${value}`).join(" · "), /Encumbrance 0.*Price 25 cr.*Rarity 1/);
  assert.equal(gear.detail, "A compact tool.");
});

test("ability cards show activation and short rules; missing fields are visibly unverified", () => {
  const talent = inventoryGlance(item("talent", {description:"[B]Take an action[/B] to do a daring thing.", source:{book:"Owned book",page:33}}, "Full Throttle"));
  assert.ok(talent.chips.some(({label,value}) => label === "Activation" && value === "Action"));
  assert.equal(talent.detail, "Take an action to do a daring thing.");
  assert.equal(talent.source, "Owned book · p. 33");
  const career = inventoryGlance(item("career", {careerSkills:["astrogation","computers"]}));
  assert.ok(career.chips.some(({label,value}) => label === "Career skills" && value === "2"));
  const unknown = inventoryGlance(item("weapon", {incomplete:["Damage needs source check"]}));
  assert.equal(unknown.needsReview, true);
  assert.ok(unknown.chips.every(({label}) => label !== "Damage" && label !== "Range"), "schema defaults must not masquerade as verified stats");
});

test("abilities include purchased talent nodes but exclude unpurchased tree nodes", () => {
  const pilot = item("specialization", {
    tree: { nodes: [
      { id:"r0c0", name:"Full Throttle", activation:"Action", summary:"[B]Increase[/B] vehicle speed after a [DI] Piloting check.", reference:{book:"Edge of the Empire",page:87} },
      { id:"r0c1", name:"Skilled Jockey", activation:"Passive", summary:"Handle a piloting setback." },
    ] },
  }, "Pilot");
  const actor = { type:"character", items:[pilot], system:{advancement:[{itemId:pilot.id,nodeId:"r0c0",name:"Full Throttle",cost:5}]} };
  const grouped = inventoryGroups(actor);
  assert.deepEqual(grouped.ownedAbilityItems.map(({name}) => name), ["Full Throttle"]);
  assert.equal(grouped.ownedAbilityItems[0].chips.find(({label}) => label === "Activation")?.value, "Action");
  assert.match(grouped.ownedAbilityItems[0].detail, /Increase vehicle speed/);
  assert.match(grouped.ownedAbilityItems[0].detailHtml, /<strong>Increase<\/strong>.*sf-die-difficulty/);
  assert.equal(grouped.ownedAbilityItems[0].source, "Edge of the Empire · p. 87");
  assert.equal(grouped.abilityItems[0].name, "Pilot", "the source tree remains visible separately");
});

test("species abilities and applied starting skill grants join the owned ability collection", () => {
  const actor = { type:"character", items:[item("species", {}, "Human")], system:{
    species:"Human", advancement:[],
    creation:{applied:true,species:{book:"Force & Destiny - Core Book",page:"55"},nonCareerSkillChoices:["computers","mechanics"]},
  } };
  const grouped = inventoryGroups(actor);
  const skills = grouped.ownedAbilityItems.find(({name}) => name === "Human starting skill ranks");
  assert.match(skills.detail, /Computers.*Mechanics/);
  assert.match(skills.source, /Force & Destiny/);
  assert.ok(!skills.needsReview);
  actor.system.creation.nonCareerSkillChoices = [];
  assert.ok(!inventoryGroups(actor).ownedAbilityItems.some(({name}) => name === "Human starting skill ranks"),
    "unapplied choices cannot appear as owned grants");
});

test("registered species traits and explicit item abilities are collected with their source", () => {
  const gear = item("gear", {equipped:true,abilities:[{name:"Sensor Sweep",summary:"Scan the nearby area.",activation:"Action"}],source:{book:"Field notes",page:4}}, "Scanner");
  const actor = {type:"character", items:[gear], system:{
    species:"Balosar", advancement:[], creation:{species:{book:"Age of Rebellion - Cyphers & Masks",page:"18"},speciesAbilitiesPending:true},
  }};
  const grouped = inventoryGroups(actor);
  assert.ok(grouped.ownedAbilityItems.some(({name}) => name === "Sensor Sweep"));
  assert.equal(grouped.ownedAbilityItems.find(({name}) => name === "Sensor Sweep")?.source, "Field notes · p. 4");
  assert.ok(grouped.ownedAbilityItems.some(({typeLabel}) => typeLabel === "Species trait"),
    "source-checked species traits must not vanish because they lack Item documents");
  assert.ok(grouped.equipmentItems.some(({name}) => name === "Scanner"), "equipment stays in Equipment");
});

test("Inventory tab contains separate Equipment and Abilities panels with visible glance values", () => {
  const template = readFileSync(new URL("../templates/actor.hbs", import.meta.url), "utf8");
  const inventory = template.match(/\{\{#if inventory\}\}([\s\S]*?)\{\{\/if\}\}\s*\{\{#if advancement\}\}/)?.[1] ?? "";
  assert.match(inventory, /<h2>Equipment<\/h2>/);
  assert.match(inventory, /<h2>Abilities<\/h2>/);
  assert.match(inventory, /\{\{#each equipmentItems\}\}/);
  assert.match(inventory, /\{\{#each abilityItems\}\}/);
  assert.match(inventory, /\{\{#each ownedAbilityItems\}\}/);
  assert.match(inventory, /\{\{#each chips\}\}/);
  assert.match(inventory, /\{\{detail\}\}/);
  assert.match(inventory, /data-action="item"/);
});

test("theme control keeps its name accessible while revealing the visible label on focus or hover", () => {
  const template = readFileSync(new URL("../templates/actor.hbs", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles/star-wars.css", import.meta.url), "utf8");
  assert.match(template, /class="sf-theme-select"[^>]*><span>Sheet theme<\/span><select[^>]*aria-label="Sheet theme"/);
  assert.match(css, /\.sf-theme-select:hover\s+span/);
  assert.match(css, /\.sf-theme-select:focus-within\s+span/);
});

test("token editor is a small portrait corner control with a keyboard accessible name", () => {
  const template = readFileSync(new URL("../templates/actor.hbs", import.meta.url), "utf8");
  const frame = template.match(/<div class="sf-portrait-frame[\s\S]*?<\/div>/)?.[0] ?? "";
  assert.match(frame, /sf-token-editor-button[^>]*data-action="editTokenFacing"[^>]*aria-label="Edit token image and facing"/);
  assert.doesNotMatch(template, /sf-token-facing-open/);
});
