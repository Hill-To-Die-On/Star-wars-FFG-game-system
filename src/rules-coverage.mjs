import { bookAllowed } from "./rules.mjs";
import { learnedTalentRules, validateTalentNodeRules } from "./talent-rules.mjs";

const CAPABILITIES = [
  ["dice", "Narrative dice", "implemented", "Native symbol cancellation and independent result axes. Review the pool before rolling."],
  ["creation", "Character creation", "assisted", "Campaign-filtered origins, starting choices and XP validation. Exceptional abilities need their recorded source."],
  ["talents", "Learned talents", "assisted", "Only structured effects participate in automation. An active effect needs its supported choice; prose is never executed."],
  ["damage", "Damage and recovery", "assisted", "Reviewed same-scale damage, soak/armour, Pierce/Breach and recovery previews with history and conflict-safe undo."],
  ["criticals", "Criticals and conditions", "manual", "Records do not apply unencoded modifiers. Consult the source and adjust the pool or actor explicitly."],
  ["qualities", "Weapon-quality activations", "manual", "Do not assume every quality activates or spends symbols automatically. Review timing, cost and effect."],
  ["cross-scale", "Cross-scale damage", "manual", "Mixed personal and vehicle damage needs a GM ruling before applying an amount."],
  ["narrative-options", "Narrative-symbol choices", "assisted", "Budgets, proposals and approval are implemented. The option catalogue begins empty; effects are applied separately."],
  ["downtime", "Session and downtime", "assisted", "Reviewed XP, credits and enabled story-resource adjustments are supported. Crafting, equipment rewards and story triggers remain manual."],
  ["vertical", "Vertical targeting", "assisted", "Verified native-level geometry supports targeting. Ambiguous surfaces, overlapping levels and unsupported geometry require a GM ruling."]
].map(([id,label,status,detail]) => Object.freeze({
  id,label,status,detail,automatic:id === "dice",
  requiresGmRuling:["criticals","qualities","cross-scale","narrative-options","downtime","vertical"].includes(id)
}));

export function capabilityCoverage(id) {
  if (id !== undefined) return {...(CAPABILITIES.find(row=>row.id === id) ?? {id,status:"unsupported",automatic:false,requiresGmRuling:true})};
  return CAPABILITIES.map(row=>({...row}));
}

function effectCalculation(effect) {
  return `${effect.operation} ${effect.count} ${effect.target} (${effect.type})`;
}
function effectConditions(effect) {
  const parts=[];
  if(effect.skills?.length)parts.push("Skills: "+effect.skills.join(", "));
  if(effect.groups?.length)parts.push("Groups: "+effect.groups.join(", "));
  if(effect.requirements)for(const [key,value] of Object.entries(effect.requirements))parts.push(key+": "+value);
  return parts.join("; ") || "No additional selector recorded";
}

/** Inventory only: never changes the actor or grants a source permission to execute. */
export function actorRuleCoverage(actor, campaign = {}, {query="",status=""} = {}) {
  const items=new Map(Array.from(actor?.items?.contents ?? actor?.items ?? [],item=>[item.id,item]));
  const learned=learnedTalentRules(actor ?? {system:{}}), allowed=[];
  let excluded=0;
  for(const rule of learned){
    if(!bookAllowed(rule.source?.book,campaign)){excluded++;continue;}
    let invalid=false;
    try {validateTalentNodeRules(rule);} catch {invalid=true;}
    const item=items.get(rule.id.split(":")[0]);
    const supported=rule.effects.length>0 && !invalid;
    allowed.push({
      id:rule.id,name:rule.name,
      status:supported ? (rule.activation==="Passive" ? "automatic" : "choice") : "manual",
      activation:rule.activation || "Not recorded",
      source:{book:String(rule.source?.book ?? ""),page:String(rule.source?.page ?? "")},
      chartVerification:["full-chart","connectors-only"].includes(item?.system?.tree?.verification?.source) ? item.system.tree.verification.source : "pending",
      effectVerification:"not-certified-by-chart",
      calculation:invalid ? "Invalid structured effect; GM review required." : supported ? rule.effects.map(effectCalculation).join("; ") : "No structured effect; apply a reviewed GM ruling manually.",
      condition:supported ? rule.effects.map(effectConditions).join("; ") : "Read the cited entry before changing play state."
    });
  }
  const counts=Object.fromEntries(["automatic","choice","manual"].map(key=>[key,allowed.filter(row=>row.status===key).length]));
  const search=String(query).trim().toLocaleLowerCase();
  return {entries:allowed.filter(row=>(!status || row.status===status) && (!search || [row.name,row.source.book,row.source.page,row.calculation].join(" ").toLocaleLowerCase().includes(search))),
    total:allowed.length,counts,excluded,
    notice:"This inventory does not disable learned effects when the book filter changes. Printed chart checks cover the graph, not certification of every effect or prerequisite."};
}

const version=value=>typeof value==="string" && /^\d{1,5}(?:\.\d{1,5}){0,3}$/.test(value) ? value : "unknown";
const count=collection=>Number.isSafeInteger(collection?.size) && collection.size>=0 ? collection.size : 0;

/** Explicit allowlist. Never include world names, document content, settings, keys, URLs or logs. */
export function supportSnapshot(game = {}) {
  return {
    format:"star-wars-ffg-diagnostics-v1",
    foundry:version(game.version),
    system:{id:"star-wars-ffg",version:version(game.system?.version)},
    integrations:Object.fromEntries(["dice-so-nice","hill-to-die-on-director-of-realms"].map(id=>{
      const module=game.modules?.get?.(id);
      return [id,{active:module?.active===true,version:version(module?.version)}];
    })),
    counts:{actors:count(game.actors),scenes:count(game.scenes),messages:count(game.messages)}
  };
}

