export const DAMAGE_IMPAIRMENTS=Object.freeze({
  none:{label:"No ability impairment",skills:[],setback:0},
  scanner:{label:"Damaged scanner",skills:["perception","vigilance"],setback:1},
  armament:{label:"Damaged armament",skills:["rangedLight","rangedHeavy","gunnery","melee"],setback:1},
  mobility:{label:"Damaged mobility",skills:["athletics","coordination","stealth","pilotingPlanetary"],setback:1},
});

export function suggestEnemyCondition(name,woundsMax) {
  const damaged=/\b(?:damaged|broken|wounded|injured|malfunctioning)\b/i.test(String(name??""));
  const maximum=Number(woundsMax);
  return {wounds:damaged&&Number.isFinite(maximum)&&maximum>1?Math.max(1,Math.floor(maximum/4)):0,
    impairment:damaged&&/\b(?:security|probe|surveillance)\b/i.test(String(name??""))?"scanner":"none"};
}

export function validateEnemyCondition(condition,woundsMax) {
  const wounds=Number(condition?.wounds),maximum=Number(woundsMax),impairment=String(condition?.impairment??"");
  if(!Number.isSafeInteger(maximum)||maximum<1||!Number.isSafeInteger(wounds)||wounds<0||wounds>=maximum)
    throw new Error("Starting wounds must leave an active enemy below its wound threshold.");
  if(!Object.hasOwn(DAMAGE_IMPAIRMENTS,impairment))throw new Error("Choose a supported enemy impairment.");
  return {wounds,impairment};
}

export function impairmentForCheck(actor,skill) {
  const key=String(actor?.system?.metadata?.damageImpairment??"none"),rule=DAMAGE_IMPAIRMENTS[key];
  if(!rule?.skills.includes(skill))return {setback:0,note:""};
  return {setback:rule.setback,note:`${rule.label}: +${rule.setback} setback to ${skill} checks.`};
}

export function damageVisualState(actor) {
  const system=actor?.system??{},resource=actor?.type==="vehicle"?system.hullTrauma:system.wounds;
  const wounds=Number(resource?.value??0),maximum=Number(resource?.max??0);
  if(!Number.isFinite(wounds)||!Number.isFinite(maximum)||wounds<=0||maximum<=0)return {kind:"none",severity:0,preset:null};
  const preference=String(system.metadata?.damageVisual??"auto");
  const kind=preference==="none"?"none":preference==="blood"||preference==="sparks"?preference:
    actor?.type==="vehicle"||/\bdroid\b/i.test(String(system.species??""))?"sparks":"blood";
  if(kind==="none")return {kind:"none",severity:0,preset:null};
  const severity=Math.max(1,Math.min(3,Math.ceil(3*wounds/maximum)));
  return {kind,severity,preset:kind==="blood"?"bleed":"sparks"};
}
