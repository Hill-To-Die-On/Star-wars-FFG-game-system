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

/** Shared by all authoritative actor-resource mutations in this client. */
export const actorMutationQueue = new ActorTransactionQueue();
