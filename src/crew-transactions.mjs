import { SYSTEM_ID } from "./config.mjs";
import { ActorTransactionQueue, canSpendXp, selectXpAuthority } from "./xp-transactions.mjs";
const CHANNEL=`system.${SYSTEM_ID}`;
const commands=new Set(["board","leave","role","split","generate","deploy"]);
const actorOf=target=>target.actor??target;
const queueKey=target=>target.parent?.tokens?target.parent.id:target.uuid;
function validate(command,args) {
  if(!commands.has(command) || !args || typeof args!=="object" || Array.isArray(args) || JSON.stringify(args).length>2048)
    throw new Error("Invalid crew request.");
}
/** All seat changes in a scene are serialized, including competing requests for the last seat. */
export class CrewTransactionCoordinator {
  queue=new ActorTransactionQueue();
  pending=new Map();
  completed=new Map();
  constructor({socket,currentUser,users,getToken,execute,randomId=()=>crypto.randomUUID()}) {
    Object.assign(this,{socket,currentUser,users,getToken,execute,randomId});
    this.listener=m=>{void this.receive(m).catch(e=>console.error("Star Wars FFG | Crew",e));};
  }
  start(){this.socket.on(CHANNEL,this.listener);return this;}
  stop(){this.socket.off?.(CHANNEL,this.listener);for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error("Crew service stopped."));}this.pending.clear();}
  async request(token,command,args={}) {
    validate(command,args);
    const user=this.currentUser(),authority=selectXpAuthority(actorOf(token),this.users());
    if(!canSpendXp(actorOf(token),user)) throw new Error("Owner permission is required.");
    if(!authority) throw new Error("No active owner or GM is available.");
    if(authority.id===user.id) return this.queue.run(queueKey(token),()=>this.execute(token,command,args,user));
    const requestId=this.randomId();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error("Crew change was not confirmed. Check the roster before retrying."));},15000);
      this.pending.set(requestId,{resolve,reject,timer,authorityId:authority.id});
      this.socket.emit(CHANNEL,{type:"crew-request",requestId,tokenUuid:token.uuid,userId:user.id,command,args});
    });
  }
  async receive(message) {
    if(message?.type==="crew-result") {
      const p=this.pending.get(message.requestId);
      if(!p || message.userId!==this.currentUser().id || p.authorityId!==message.authorityId) return;
      clearTimeout(p.timer);this.pending.delete(message.requestId);
      if(message.ok)p.resolve(message.result);else p.reject(new Error(message.error));return;
    }
    if(message?.type!=="crew-request" || typeof message.tokenUuid!=="string" || message.tokenUuid.length>512) return;
    const token=await this.getToken(message.tokenUuid),users=this.users();
    if(!token || selectXpAuthority(actorOf(token),users)?.id!==this.currentUser()?.id)return;
    const user=users.get?.(message.userId) ?? Array.from(users).find(u=>u.id===message.userId);
    const key=`${message.userId}:${message.requestId}`;
    if(!this.completed.has(key)) {
      this.completed.set(key,this.queue.run(queueKey(token),async()=>{
        try {
          if(!user?.active || !canSpendXp(actorOf(token),user))throw new Error("Owner permission is required.");
          validate(message.command,message.args);
          return {ok:true,result:await this.execute(token,message.command,message.args,user)};
        }catch(error){return {ok:false,error:error.message};}
      }));
      if(this.completed.size>500)this.completed.delete(this.completed.keys().next().value);
    }
    this.socket.emit(CHANNEL,{type:"crew-result",requestId:message.requestId,userId:message.userId,authorityId:this.currentUser().id,...await this.completed.get(key)});
  }
}
