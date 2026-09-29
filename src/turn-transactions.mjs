import { SYSTEM_ID } from "./config.mjs";
import { actorMutationQueue, canSpendXp, selectXpAuthority } from "./xp-transactions.mjs";

const CHANNEL = `system.${SYSTEM_ID}`, REQUEST = "turn-request", RESULT = "turn-result";
const commands = new Set(["action","maneuver","buyManeuver","tradeManeuver","grant","activate","undo","reset"]);
const validate = (command, options) => {
  if (!commands.has(command)) throw new Error("Unknown turn command.");
  if (!options || typeof options !== "object" || Array.isArray(options) || JSON.stringify(options).length > 2048)
    throw new Error("Invalid turn request.");
};

/** Single active owner/GM commits spending; UUIDs preserve unlinked-token identity. */
export class TurnTransactionCoordinator {
  #queue = actorMutationQueue;
  #pending = new Map();
  #completed = new Map();
  #listener;
  constructor({ socket, currentUser, users, getActor, execute, randomId = () => crypto.randomUUID() }) {
    Object.assign(this,{socket,currentUser,users,getActor,execute,randomId});
    this.#listener = message => { void this.#receive(message).catch(error => console.error("Star Wars FFG | Turn tracker",error)); };
  }
  start() { this.socket.on(CHANNEL,this.#listener); return this; }
  stop() {
    this.socket.off?.(CHANNEL,this.#listener);
    for (const p of this.#pending.values()) { clearTimeout(p.timer); p.reject(new Error("Turn tracker stopped.")); }
    this.#pending.clear();
  }
  async request(actor, command, options = {}) {
    validate(command,options);
    const user = this.currentUser();
    if (!canSpendXp(actor,user)) throw new Error("Owner permission is required.");
    const authority = selectXpAuthority(actor,this.users());
    if (!authority) throw new Error("No active owner or GM can update the turn.");
    const args = { ...options, operationId:options.operationId || this.randomId() };
    if (authority.id === user.id) return this.#queue.run(actor.uuid,() => this.execute(actor,command,args,user));
    const requestId = this.randomId();
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => { this.#pending.delete(requestId); reject(new Error("Turn update was not confirmed. Check the lights before retrying.")); },15000);
      this.#pending.set(requestId,{resolve,reject,timer,authorityId:authority.id});
      this.socket.emit(CHANNEL,{type:REQUEST,requestId,actorUuid:actor.uuid,userId:user.id,command,options:args});
    });
  }
  async #receive(message) {
    if (message?.type === RESULT) {
      const p = this.#pending.get(message.requestId);
      if (!p || message.userId !== this.currentUser().id || p.authorityId !== message.authorityId) return;
      clearTimeout(p.timer); this.#pending.delete(message.requestId);
      if (message.ok) p.resolve(message.result); else p.reject(new Error(message.error));
      return;
    }
    if (message?.type !== REQUEST) return;
    if (typeof message.actorUuid !== "string" || message.actorUuid.length > 512) return;
    const actor = await this.getActor(message.actorUuid), users = this.users();
    if (!actor || selectXpAuthority(actor,users)?.id !== this.currentUser()?.id) return;
    const user = users.get?.(message.userId) ?? Array.from(users).find(u => u.id === message.userId);
    const cacheKey = `${message.userId}:${message.requestId}`;
    if (!this.#completed.has(cacheKey)) {
      const job = this.#queue.run(actor.uuid,async () => {
        try {
          if (!user?.active || !canSpendXp(actor,user)) throw new Error("Owner permission is required.");
          validate(message.command,message.options);
          return {ok:true,result:await this.execute(actor,message.command,message.options,user)};
        } catch(error) { return {ok:false,error:error.message}; }
      });
      this.#completed.set(cacheKey,job);
      if (this.#completed.size > 500) this.#completed.delete(this.#completed.keys().next().value);
    }
    this.socket.emit(CHANNEL,{type:RESULT,requestId:message.requestId,userId:message.userId,
      authorityId:this.currentUser().id,...await this.#completed.get(cacheKey)});
  }
}
