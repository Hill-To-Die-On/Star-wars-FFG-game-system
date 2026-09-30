/** Refresh only an open dashboard after relevant document events; no polling loop. */
export function watchVehicleDashboard({hooks,actorUuids,sceneId,refresh,schedule=queueMicrotask}) {
  let closed=false,pending=false;
  const enqueue=()=>{
    if(closed||pending)return;
    pending=true;schedule(()=>{pending=false;if(!closed)refresh();});
  };
  const actorChanged=actor=>{if(actorUuids().has(actor?.uuid))enqueue();};
  const embeddedChanged=document=>{
    for(let parent=document?.parent;parent;parent=parent.parent)if(actorUuids().has(parent.uuid)){enqueue();break;}
  };
  const tokenChanged=token=>{if(actorUuids().has(token?.actor?.uuid)||(sceneId()&&token?.parent?.id===sceneId()))enqueue();};
  const subscriptions=[
    ...['updateActor','deleteActor'].map(name=>[name,actorChanged]),
    ...['createItem','updateItem','deleteItem','createActiveEffect','updateActiveEffect','deleteActiveEffect'].map(name=>[name,embeddedChanged]),
    ...['createToken','updateToken','deleteToken'].map(name=>[name,tokenChanged]),
    ...['updateCombat','deleteCombat','createCombatant','updateCombatant','deleteCombatant','canvasReady','controlToken','updateUser'].map(name=>[name,enqueue])
  ].map(([name,callback])=>[name,hooks.on(name,callback)]);
  return ()=>{closed=true;for(const [name,handle]of subscriptions)hooks.off(name,handle);};
}
