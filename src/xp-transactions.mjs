import { SYSTEM_ID } from "./config.mjs";
import {actorMutationQueue} from "./transaction-queue.mjs";
import {getDocumentTransactionBroker} from "./document-transactions.mjs";
export {ActorTransactionQueue,actorMutationQueue} from "./transaction-queue.mjs";

export const XP_TRANSACTION_CHANNEL = `system.${SYSTEM_ID}`;
export const XP_OPERATIONS = Object.freeze([
  "buyTalent",
  "buySkill",
  "buyCharacteristic",
  "acquireSpecialization",
]);
const OPERATIONS = new Set(XP_OPERATIONS);

function userList(collection) {
  return Array.from(collection ?? []);
}

export function canSpendXp(actor, user) {
  if (!actor || !user) return false;
  if (user.isGM) return true;
  if (typeof actor.canUserModify === "function")
    return actor.canUserModify(user, "update");
  if (typeof actor.testUserPermission === "function")
    return actor.testUserPermission(user, "OWNER");
  return false;
}

export function selectXpAuthority(actor, collection) {
  const eligible = userList(collection)
    .filter((user) => user.active && canSpendXp(actor, user))
    .sort(
      (a, b) =>
        Number(b.isGM) - Number(a.isGM) || String(a.id).localeCompare(String(b.id)),
    );
  return eligible[0] ?? null;
}

function validateRequest(operation,args) {
 if(!OPERATIONS.has(operation)||!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>4096)throw new Error('Invalid XP transaction.');
}
/** XP writes run only after native-document creator authentication. */
export class XpTransactionCoordinator {
 constructor({currentUser,users,getActor,execute,transport,randomId}){Object.assign(this,{currentUser,users,getActor,execute,transport,randomId});}
 start(){
  if(this.unregister)return this;this.transport??=getDocumentTransactionBroker();
  this.unregister=this.transport.register('xp',{resolve:this.getActor,lockKeys:actor=>[actor.uuid],
   validate:(actor,operation,args,user)=>{if(!canSpendXp(actor,user))throw new Error('Owner permission is required.');validateRequest(operation,args);},
   execute:(actor,operation,args,user,_id,assertAuthority)=>actorMutationQueue.run(actor.uuid,()=>{assertAuthority();if(!user.active||!canSpendXp(actor,user))throw new Error('Owner permission is required.');return this.execute(actor,operation,args);})});return this;
 }
 stop(){this.unregister?.();this.unregister=null;}
 async request(actor,operation,args){
  validateRequest(operation,args);if(!canSpendXp(actor,this.currentUser()))throw new Error('Owner permission is required.');
  this.start();return this.transport.request('xp',actor.uuid,operation,args,this.randomId?.());
 }
}
let coordinator;
export function configureXpTransactions(options){coordinator?.stop();coordinator=new XpTransactionCoordinator(options).start();return coordinator;}
export function requestXpTransaction(actor,operation,args){
 if(!coordinator)throw new Error('The authenticated XP service is not ready.');
 return coordinator.request(actor,operation,args);
}
