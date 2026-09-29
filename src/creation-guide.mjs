import { CHARACTERISTICS, SKILLS, SYSTEM_ID } from "./config.mjs";
import { originEntryAllowed, originSelectionUpdate, referenceRuleLine } from "./character-origins.mjs";
import { bookAllowed } from "./rules.mjs";
import { characteristicPurchase, skillPurchase } from "./advancement.mjs";

export const CREATION_ROLES = Object.freeze({
  combat:{label:"Front-line fighter",skills:["rangedLight","rangedHeavy","brawl","melee","gunnery"]},
  pilot:{label:"Pilot",skills:["pilotingSpace","pilotingPlanetary","astrogation"]},
  mechanic:{label:"Mechanic / slicer",skills:["mechanics","computers"]},
  social:{label:"Negotiator",skills:["charm","negotiation","deception"]},
  explorer:{label:"Explorer",skills:["survival","perception","athletics"]},
  leader:{label:"Leader",skills:["leadership","discipline"]},
  medic:{label:"Medic",skills:["medicine"]},
  rogue:{label:"Infiltrator",skills:["stealth","skulduggery","streetwise"]},
  scholar:{label:"Scholar",skills:Object.keys(SKILLS).filter(k=>SKILLS[k].group==="Knowledge")},
});
export const GUIDE_COMBAT = Object.freeze({any:"Any approach",avoid:"Avoid fighting",brawl:"Unarmed",melee:"Melee",rangedLight:"Pistols",rangedHeavy:"Rifles",gunnery:"Vehicle / heavy weapons",lightsaber:"Lightsaber"});
export const GUIDE_FORCE = Object.freeze({any:"Open to any path",mundane:"No starting Force career",force:"Start with a Force career"});
const validChoice=(value,choices,name)=>{if(value && !Object.hasOwn(choices,value))throw new Error(`Unknown ${name} choice.`);};
const isForce=entry=>referenceRuleLine(entry)==="force" || /^(true|yes|1)$/i.test(String(entry.system?.metadata?.Force_Sensitive??"")) || Number(entry.system?.metadata?.Gain_Force_Rating)>0;
export function creationCandidates(entries,campaign,answers={}) {
  validChoice(answers.role,CREATION_ROLES,"role");validChoice(answers.combat,GUIDE_COMBAT,"combat");
  validChoice(answers.aptitude,{any:"Any",...CHARACTERISTICS},"aptitude");validChoice(answers.force,GUIDE_FORCE,"Force");
  const roleSkills=CREATION_ROLES[answers.role]?.skills??[],wantedCombat=![undefined,"any","avoid"].includes(answers.combat)?answers.combat:null;
  const specializations=Array.from(entries).filter(e=>{
    const line=referenceRuleLine(e),skills=e.system?.careerSkills;
    return e.type==="specialization" && (e.id??e._id) && Array.isArray(skills) && skills.length>0 && skills.every(k=>SKILLS[k]) &&
      bookAllowed(e.system?.source?.book,campaign) && (!line||campaign.lines.includes(line)) &&
      (!roleSkills.length||skills.some(k=>roleSkills.includes(k))) && (!wantedCombat||skills.includes(wantedCombat)) &&
      (!answers.force||answers.force==="any"||(answers.force==="force"?isForce(e):!isForce(e)));
  });
  const careers=Array.from(entries).filter(e=>originEntryAllowed(e,"career",campaign) && specializations.some(s=>s.system.career===e.name));
  const species=Array.from(entries).filter(e=>originEntryAllowed(e,"species",campaign) &&
    (!answers.aptitude||answers.aptitude==="any"||Number(e.system.metadata[CHARACTERISTICS[answers.aptitude]])===Math.max(...Object.values(CHARACTERISTICS).map(k=>Number(e.system.metadata[k])))));
  const sorted=rows=>rows.sort((a,b)=>a.name.localeCompare(b.name)||String(a.id??a._id).localeCompare(String(b.id??b._id)));
  return {species:sorted(species),careers:sorted(careers),specializations:sorted(specializations.filter(s=>careers.some(c=>c.name===s.system.career)))};
}
export function validateFreeRanks(form,choices,counts) {
  for(const key of Object.keys(form)) {
    const [kind,skill]=key.split(":");
    if(!choices[kind]?.includes(skill))throw new Error("Unknown starting skill choice.");
  }
  for(const [kind,skills] of Object.entries(choices)) {
    const required=Math.min(counts[kind],skills.length),selected=Object.keys(form).filter(key=>key.startsWith(`${kind}:`)).length;
    if(selected!==required)throw new Error(`Choose exactly ${required} ${kind} skills (${selected} selected).`);
  }
  return form;
}
/** Rebuild an isolated XP draft from its starting state on every edit; never charge the actor until confirmed. */
export function spendCreationXp(base,{characteristics={},skills={}}={}) {
  if(base.phase!=="creation")throw new Error("Starting XP can only be allocated during character creation.");
  const result=structuredClone(base);result.advancement??=[];
  for(const [kind,choices] of Object.entries({characteristics,skills})) {
    for(const [key,count] of Object.entries(choices)) {
      if(!Object.hasOwn(kind==="characteristics"?CHARACTERISTICS:SKILLS,key)||!Object.hasOwn(result[kind],key))throw new Error(`Unknown ${kind} entry.`);
      if(!Number.isInteger(count)||count<0||count>5)throw new Error("Choose a whole number of increases from 0 to 5.");
      for(let n=0;n<count;n++) {
        const characteristic=kind==="characteristics",current=result[kind][key],
          purchase=characteristic?characteristicPurchase(current,result.xp.available,"creation"):skillPurchase(current.rank,current.career,result.xp.available,true);
        result.xp.available=purchase.xp;
        if(characteristic) {
          result.characteristics[key]=purchase.value;
          if(key==="brawn"){result.soak++;result.wounds.max++;}
          if(key==="willpower")result.strain.max++;
        } else result.skills[key].rank=purchase.rank;
        result.advancement.push({name:`${characteristic?CHARACTERISTICS[key]:SKILLS[key].label} ${purchase.value??purchase.rank}`,cost:purchase.cost,creation:true});
      }
    }
  }
  return result;
}
export function creationReadiness(system) {
  const issues=[];
  if(!system.creation?.applied)issues.push("Complete species, career, specialization and free skills.");
  if(system.creation?.speciesAbilitiesPending || system.incomplete?.length)issues.push("Review and apply species abilities and outstanding source checks.");
  if(system.creation?.pocketMoneyPending)issues.push("Finish starting funds.");
  if(!Number.isInteger(system.xp?.available)||system.xp.available<0||system.xp.available>system.xp.total)issues.push("Reconcile available and total XP.");
  if(Object.values(system.skills??{}).some(s=>s.rank>2))issues.push("Starting skill ranks cannot exceed 2 without a documented species exception.");
  if(Object.values(system.characteristics??{}).some(v=>v>5))issues.push("Starting characteristics cannot exceed 5 without a documented exception.");
  return issues;
}
export function planEnemy(recipe,species,campaign) {
  if(!["minion","rival","nemesis"].includes(recipe.type))throw new Error("Choose minion, rival or nemesis.");
  validChoice(recipe.role,CREATION_ROLES,"role");validChoice(recipe.combat,GUIDE_COMBAT,"combat");
  if(!CREATION_ROLES[recipe.role])throw new Error("Choose the enemy's role.");
  const rank=Number(recipe.rank),count=Number(recipe.count);
  if(!Number.isInteger(rank)||rank<0||rank>5)throw new Error("Choose training from 0 to 5.");
  if(!Number.isInteger(count)||count<1||count>100)throw new Error("Choose 1 to 100 minions.");
  const base=originSelectionUpdate("species",species,{},campaign),keys=new Set(CREATION_ROLES[recipe.role].skills);
  if(SKILLS[recipe.combat])keys.add(recipe.combat);
  return {name:String(recipe.name??"").trim()||`${species.name} ${CREATION_ROLES[recipe.role].label}`,type:recipe.type,
    system:{...base,phase:"play",groupSize:recipe.type==="minion"?count:1,xp:{available:0,total:0},
      skills:Object.fromEntries([...keys].map(key=>[key,{rank:recipe.type==="minion"?0:rank,career:false,group:recipe.type==="minion",characteristic:SKILLS[key].characteristic}]))},
    flags:{[SYSTEM_ID]:{generatedEnemy:{kind:"original-npc-preset",role:recipe.role,training:rank,note:"GM-designed NPC; not a published adversary or a PC XP build. Review species abilities, equipment and talents."}}}};
}
