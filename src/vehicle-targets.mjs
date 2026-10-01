/** Tokens that may be offered in the vehicle dashboard's target picker. */
export function listVehicleAttackTargets(vehicle,user) {
  return Array.from(vehicle?.parent?.tokens??[]).filter(token=>
    token.id!==vehicle?.id && token.actor?.type==='vehicle' && token.object &&
    (user?.isGM || (!token.hidden && token.object.visible!==false)));
}

export function targetVehicleForAttack(target,user) {
  if(!target?.object?.setTarget)throw new Error('The selected ship is no longer on the active canvas.');
  target.object.setTarget(true,{user,releaseOthers:true});
  return target.object;
}
