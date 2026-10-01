import { SYSTEM_ID } from "./config.mjs";
import { damageVisualState } from "./enemy-condition.mjs";
import { getDocumentTransactionBroker } from "./document-transactions.mjs";

const DOR_ID="hill-to-die-on-director-of-realms";
const queue=new Map();

export async function syncDorDamageEffect(token,{
  api=globalThis.game?.modules?.get(DOR_ID)?.active?globalThis.game.modules.get(DOR_ID).api:null,
  scene=globalThis.canvas?.scene,
  isAuthority=!!globalThis.game?.user?.isGM&&getDocumentTransactionBroker().isAuthority(),
}={}) {
  const doc=token?.document;
  if(!isAuthority||!api?.visualEffect||!scene?.id||!doc?.id||!doc.getFlag||!doc.setFlag)return false;
  const prior=doc.getFlag(SYSTEM_ID,"damageVfx")??null;
  const state=doc.hidden?{kind:"none",severity:0,preset:null}:damageVisualState(token.actor);
  const resource=token.actor?.type==="vehicle"?token.actor.system?.hullTrauma:token.actor?.system?.wounds;
  const wounds=Number(resource?.value??0);
  const sceneEffects=scene.getFlag?.(DOR_ID,"vfxState")?.effects;
  const oldIsLive=Array.isArray(sceneEffects)&&sceneEffects.some(entry=>entry.id===prior?.id);
  if(state.kind!=="none"&&prior?.kind===state.kind&&prior.severity===state.severity&&oldIsLive) {
    if(state.kind==="blood"&&wounds>Number(prior.wounds??wounds))
      await api.visualEffect({action:"play",preset:"blood_splatter",tokenId:doc.id,duration:1500,strength:state.severity*2});
    if(prior.wounds!==wounds)await doc.setFlag(SYSTEM_ID,"damageVfx",{...prior,wounds});
    return true;
  }
  if(prior?.id)await api.visualEffect({action:"stop",id:prior.id});
  if(state.kind==="none") {
    if(prior)await doc.unsetFlag?.(SYSTEM_ID,"damageVfx");
    return true;
  }
  const id=await api.visualEffect({action:"play",preset:state.preset,tokenId:doc.id,loop:true,duration:60000,strength:state.severity*2});
  if(typeof id!=="string"||!id)return false;
  await doc.setFlag(SYSTEM_ID,"damageVfx",{id,kind:state.kind,severity:state.severity,wounds});
  if(state.kind==="blood"&&prior&&wounds>Number(prior.wounds??wounds))
    await api.visualEffect({action:"play",preset:"blood_splatter",tokenId:doc.id,duration:1500,strength:state.severity*2});
  return true;
}

function schedule(token) {
  const sceneId=globalThis.canvas?.scene?.id,tokenId=token?.document?.id;
  if(!sceneId||!tokenId)return;
  const key=`${sceneId}:${tokenId}`,previous=queue.get(key)??Promise.resolve();
  const current=previous.catch(()=>{}).then(()=>syncDorDamageEffect(token));
  queue.set(key,current);
  void current.catch(error=>console.warn("Star Wars damage effect request failed",error)).finally(()=>{if(queue.get(key)===current)queue.delete(key);});
}

export function registerDorDamageEffects() {
  const all=()=>{for(const token of globalThis.canvas?.tokens?.placeables??[])schedule(token);};
  Hooks.on("canvasReady",all);
  Hooks.on("drawToken",schedule);
  Hooks.on("updateActor",actor=>{for(const token of globalThis.canvas?.tokens?.placeables??[])if(token.actor?.id===actor.id)schedule(token);});
  Hooks.on("updateToken",document=>{const token=globalThis.canvas?.tokens?.get?.(document.id);if(token)schedule(token);});
  Hooks.on("deleteToken",document=>{
    const id=document.getFlag?.(SYSTEM_ID,"damageVfx")?.id;
    const module=globalThis.game?.modules?.get(DOR_ID),api=module?.active?module.api:null;
    if(id&&api?.visualEffect&&getDocumentTransactionBroker().isAuthority())
      void api.visualEffect({action:"stop",id}).catch(error=>console.warn("Star Wars damage effect cleanup failed",error));
  });
  Hooks.on("starWarsAuthoritySelected",all);
  Hooks.on("updateSetting",setting=>{if(setting?.key===`${SYSTEM_ID}.authoritySession`)all();});
}
