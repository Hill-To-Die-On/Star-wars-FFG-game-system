import {ActorTransactionQueue,actorMutationQueue,canSpendXp} from './xp-transactions.mjs';
import {getDocumentTransactionBroker} from './document-transactions.mjs';
const commands=new Set(['board','leave','role','split','generate','deploy','travel']);
const actorOf=target=>target.actor??target;
const queueKey=target=>target.parent?.tokens?target.parent.id:target.uuid;
function validate(command,args){if(!commands.has(command)||!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>2048||command==='travel'&&(typeof args.destinationSceneId!=='string'||!args.destinationSceneId||args.destinationSceneId.length>128))throw new Error('Invalid crew request.');}
/** Scene seat changes and actor resources retain their shared critical sections. */
export class CrewTransactionCoordinator {
 queue=new ActorTransactionQueue();
 constructor({currentUser,users,getToken,execute,transport,randomId}){Object.assign(this,{currentUser,users,getToken,execute,transport,randomId});}
 start(){
  if(this.unregister)return this;this.transport??=getDocumentTransactionBroker();
  this.unregister=this.transport.register('crew',{resolve:this.getToken,lockKeys:target=>[actorOf(target).uuid,'scene:'+queueKey(target)],
   validate:(target,command,args,user)=>{if(!canSpendXp(actorOf(target),user))throw new Error('Owner permission is required.');validate(command,args);},
   execute:(target,command,args,user,_id,assertAuthority)=>this.queue.run(queueKey(target),()=>actorMutationQueue.run(actorOf(target).uuid,()=>{assertAuthority();return this.execute(target,command,args,user);} ))});return this;
 }
 stop(){this.unregister?.();this.unregister=null;}
 async request(target,command,args={}){
  validate(command,args);if(!canSpendXp(actorOf(target),this.currentUser()))throw new Error('Owner permission is required.');
  this.start();return this.transport.request('crew',target.uuid,command,args,this.randomId?.());
 }
}
