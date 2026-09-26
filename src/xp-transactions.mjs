import { SYSTEM_ID } from "./config.mjs";

export const XP_TRANSACTION_CHANNEL = `system.${SYSTEM_ID}`;
export const XP_OPERATIONS = Object.freeze([
  "buyTalent",
  "buySkill",
  "buyCharacteristic",
  "acquireSpecialization",
]);
const OPERATIONS = new Set(XP_OPERATIONS),
  REQUEST = "xp-transaction-request",
  RESULT = "xp-transaction-result";

function userList(collection) {
  return Array.from(collection ?? []);
}

function userById(collection, id) {
  return collection?.get?.(id) ?? userList(collection).find((user) => user.id === id);
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

export class ActorTransactionQueue {
  #queues = new Map();

  run(actorId, work) {
    const key = String(actorId ?? "");
    if (!key) return Promise.reject(new Error("An actor is required."));
    const previous = this.#queues.get(key) ?? Promise.resolve(),
      current = previous.catch(() => undefined).then(work),
      cleanup = () => {
        if (this.#queues.get(key) === current) this.#queues.delete(key);
      };
    this.#queues.set(key, current);
    current.then(cleanup, cleanup);
    return current;
  }
}

function defaultRandomId() {
  if (globalThis.foundry?.utils?.randomID)
    return globalThis.foundry.utils.randomID(24);
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function transactionError(value) {
  const error = new Error(value?.message || "The XP transaction failed.");
  if (value?.name) error.name = value.name;
  return error;
}

function validateRequest(operation, args) {
  if (!OPERATIONS.has(operation)) throw new Error("Unsupported XP transaction.");
  if (!args || typeof args !== "object" || Array.isArray(args))
    throw new Error("XP transaction arguments must be an object.");
  if (JSON.stringify(args).length > 4096)
    throw new Error("XP transaction arguments are too large.");
}

export class XpTransactionCoordinator {
  #listener;
  #pending = new Map();
  #queue = new ActorTransactionQueue();
  #started = false;

  constructor({
    socket,
    currentUser,
    users,
    getActor,
    execute,
    randomId = defaultRandomId,
    timeoutMs = 30_000,
  }) {
    this.socket = socket;
    this.currentUser = currentUser;
    this.users = users;
    this.getActor = getActor;
    this.execute = execute;
    this.randomId = randomId;
    this.timeoutMs = timeoutMs;
    this.#listener = (message) => {
      this.#receive(message).catch((error) =>
        console.error("Star Wars FFG | XP transaction", error),
      );
    };
  }

  start() {
    if (this.#started) return this;
    this.socket.on(XP_TRANSACTION_CHANNEL, this.#listener);
    this.#started = true;
    return this;
  }

  stop() {
    if (!this.#started) return;
    this.socket.off?.(XP_TRANSACTION_CHANNEL, this.#listener);
    this.#started = false;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("XP transaction coordinator stopped."));
    }
    this.#pending.clear();
  }

  async request(actor, operation, args, localExecute) {
    validateRequest(operation, args);
    const user = this.currentUser();
    if (!canSpendXp(actor, user)) throw new Error("Owner permission is required.");
    const authority = selectXpAuthority(actor, this.users());
    if (!authority)
      throw new Error("No active GM or actor owner can process this XP purchase.");
    if (authority.id === user.id)
      return this.#queue.run(actor.uuid ?? actor.id, () =>
        localExecute ? localExecute() : this.execute(actor, operation, args),
      );
    const requestId = this.randomId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(requestId);
        reject(
          new Error(
            "The XP purchase was not confirmed. Check the character before retrying.",
          ),
        );
      }, this.timeoutMs);
      this.#pending.set(requestId, { resolve, reject, timer });
      this.socket.emit(XP_TRANSACTION_CHANNEL, {
        type: REQUEST,
        requestId,
        actorId: actor.id,
        operation,
        args,
        userId: user.id,
      });
    });
  }

  async #receive(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === RESULT) {
      if (message.userId !== this.currentUser()?.id) return;
      const pending = this.#pending.get(message.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.#pending.delete(message.requestId);
      if (message.ok) pending.resolve(message.result);
      else pending.reject(transactionError(message.error));
      return;
    }
    if (message.type !== REQUEST) return;
    const actor = this.getActor(message.actorId),
      collection = this.users(),
      authority = selectXpAuthority(actor, collection);
    if (!actor || authority?.id !== this.currentUser()?.id) return;
    const requester = userById(collection, message.userId);
    let response;
    try {
      if (!requester || !canSpendXp(actor, requester))
        throw new Error("Owner permission is required.");
      validateRequest(message.operation, message.args);
      const result = await this.#queue.run(actor.uuid ?? actor.id, () =>
        this.execute(actor, message.operation, message.args),
      );
      response = { ok: true, result };
    } catch (error) {
      response = {
        ok: false,
        error: {
          name: error?.name || "Error",
          message: error?.message || String(error),
        },
      };
    }
    this.socket.emit(XP_TRANSACTION_CHANNEL, {
      type: RESULT,
      requestId: message.requestId,
      userId: message.userId,
      ...response,
    });
  }
}

const localQueue = new ActorTransactionQueue();
let coordinator;

export function configureXpTransactions(options) {
  coordinator?.stop();
  coordinator = new XpTransactionCoordinator(options).start();
  return coordinator;
}

export function requestXpTransaction(actor, operation, args, execute) {
  if (coordinator) return coordinator.request(actor, operation, args, execute);
  return localQueue.run(actor.uuid ?? actor.id, execute);
}
