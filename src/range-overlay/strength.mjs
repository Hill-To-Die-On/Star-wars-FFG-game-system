import { DICE } from "../dice/core.mjs";

/** Expected raw impact, before armour and optional qualities or symbol spending. */
export function expectedAttackImpact({damage,scale="personal",pool,automaticResults={}}) {
  if (!/^\d+(?:\.\d+)?$/.test(String(damage ?? "").trim()) || !pool) return null;
  const base=Number(damage), multiplier=scale==="vehicle"?10:1;
  let distribution=new Map([[Number(automaticResults.success||0)-Number(automaticResults.failure||0),1]]);
  for (const key of ["ability","proficiency","boost","difficulty","challenge","setback"]) {
    const count=Number(pool[key] ?? 0);
    if (!Number.isInteger(count) || count<0 || count>40) return null;
    const faces=DICE[key].faces, probabilities=new Map();
    for(const face of faces) {
      const result=face.success-face.failure;
      probabilities.set(result,(probabilities.get(result)||0)+1/faces.length);
    }
    for(let die=0;die<count;die++) {
      const next=new Map();
      for(const [total,chance] of distribution) for(const [result,frequency] of probabilities)
        next.set(total+result,(next.get(total+result)||0)+chance*frequency);
      distribution=next;
    }
  }
  let hitChance=0,expectedImpact=0;
  for(const [success,chance] of distribution) if(success>0){hitChance+=chance;expectedImpact+=(base+success)*chance*multiplier;}
  return {hitChance,expectedImpact,basis:"Expected raw impact in personal-scale units, before armour, qualities and optional symbol spends"};
}

export function compareAttackOptions(a,b) {
  const usable=p=>!!p.pool && !p.error && p.range?.lineOfSight==="clear";
  const legal=p=>p.range?.lineOfSight==="clear" && !p.range?.arcError;
  return Number(usable(b))-Number(usable(a)) ||
    Number(legal(b))-Number(legal(a)) ||
    (b.strength?.expectedImpact ?? -1)-(a.strength?.expectedImpact ?? -1) ||
    (b.strength?.hitChance ?? -1)-(a.strength?.hitChance ?? -1) ||
    (a.range?.distancePx ?? Infinity)-(b.range?.distancePx ?? Infinity);
}
