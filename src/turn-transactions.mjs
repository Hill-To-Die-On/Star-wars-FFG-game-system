import {actorMutationQueue,canSpendXp} from './xp-transactions.mjs';
import {getDocumentTransactionBroker} from './document-transactions.mjs';
const commands=new Set(['action','maneuver','buyManeuver','tradeManeuver','grant','activate','undo','reset']);
function validate(command,args){if(!commands.has(command)||!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>2048)throw new Error('Invalid turn request.');}
export class TurnTransactionCoordinator {
 constructor({currentUser,users,getActor,execute,transport,randomId}){Object.assign(this,{currentUser,users,getActor,execute,transport,randomId});}
 start(){
  if(this.unregister)return this;this.transport??=getDocumentTransactionBroker();
  this.unregister=this.transport.register('turn',{resolve:this.getActor,lockKeys:actor=>[actor.uuid],
   validate:(actor,command,args,user)=>{if(!canSpendXp(actor,user))throw new Error('Owner permission is required.');validate(command,args);},
   execute:(actor,command,args,user,id,assertAuthority)=>actorMutationQueue.run(actor.uuid,()=>{assertAuthority();if(!user.active||!canSpendXp(actor,user))throw new Error('Owner permission is required.');return this.execute(actor,command,{...args,operationId:id},user);})});return this;
 }
 stop(){this.unregister?.();this.unregister=null;}
 async request(actor,command,args={}){
  validate(command,args);if(!canSpendXp(actor,this.currentUser()))throw new Error('Owner permission is required.');
  this.start();return this.transport.request('turn',actor.uuid,command,args,args.operationId??this.randomId?.());
 }
}
