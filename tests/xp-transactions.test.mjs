import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ActorTransactionQueue,
  XpTransactionCoordinator,
  selectXpAuthority,
} from "../src/xp-transactions.mjs";

function actor(id = "actor-1") {
  return {
    id,
    uuid: `Actor.${id}`,
    canUserModify: (user, action) => action === "update" && user.owner,
  };
}

function users(...entries) {
  const values = entries;
  values.get = (id) => values.find((entry) => entry.id === id);
  return values;
}

class SocketBus {
  #listeners = new Map();
  endpoint() {
    return {
      on: (channel, listener) => {
        const listeners = this.#listeners.get(channel) ?? [];
        listeners.push(listener);
        this.#listeners.set(channel, listeners);
      },
      off: (channel, listener) => {
        const listeners = this.#listeners.get(channel) ?? [];
        this.#listeners.set(
          channel,
          listeners.filter((candidate) => candidate !== listener),
        );
      },
      emit: (channel, message) => {
        const copy = structuredClone(message);
        queueMicrotask(() => {
          for (const listener of this.#listeners.get(channel) ?? [])
            listener(copy);
        });
      },
    };
  }
}

test("the Foundry system manifest enables its transaction socket", async () => {
  const manifest = JSON.parse(await readFile("system.json", "utf8"));
  assert.equal(manifest.socket, true);
});

test("XP authority prefers one active GM, then one active owner", () => {
  const target = actor(),
    playerB = { id: "player-b", active: true, owner: true, isGM: false },
    playerA = { id: "player-a", active: true, owner: true, isGM: false },
    gmB = { id: "gm-b", active: true, owner: false, isGM: true },
    gmA = { id: "gm-a", active: true, owner: false, isGM: true };
  assert.equal(
    selectXpAuthority(target, users(playerB, gmB, playerA, gmA)).id,
    "gm-a",
  );
  gmA.active = false;
  gmB.active = false;
  assert.equal(
    selectXpAuthority(target, users(playerB, gmB, playerA, gmA)).id,
    "player-a",
  );
  playerA.active = false;
  playerB.active = false;
  assert.equal(
    selectXpAuthority(target, users(playerB, gmB, playerA, gmA)),
    null,
  );
});

test("per-actor queue serializes failures without blocking another actor", async () => {
  const queue = new ActorTransactionQueue(),
    events = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const first = queue.run("actor-a", async () => {
    events.push("a1:start");
    await gate;
    events.push("a1:end");
    throw new Error("expected failure");
  });
  const second = queue.run("actor-a", async () => {
    events.push("a2");
    return 2;
  });
  const other = queue.run("actor-b", async () => {
    events.push("b1");
    return 3;
  });
  await other;
  assert.deepEqual(events, ["a1:start", "b1"]);
  release();
  await assert.rejects(first, /expected failure/);
  assert.equal(await second, 2);
  assert.deepEqual(events, ["a1:start", "b1", "a1:end", "a2"]);
});

test("two clients cannot both spend the same XP", async () => {
  const gm = { id: "gm", active: true, owner: false, isGM: true },
    player = { id: "player", active: true, owner: true, isGM: false },
    connectedUsers = users(player, gm),
    authoritativeActor = actor(),
    playerActor = actor(),
    bus = new SocketBus();
  authoritativeActor.xp = 10;
  const gmCoordinator = new XpTransactionCoordinator({
      socket: bus.endpoint(),
      currentUser: () => gm,
      users: () => connectedUsers,
      getActor: (id) => (id === authoritativeActor.id ? authoritativeActor : null),
      execute: async (target, operation, args) => {
        assert.equal(operation, "buySkill");
        if (target.xp < args.cost) throw new Error("Not enough available XP.");
        target.xp -= args.cost;
        return { xp: target.xp };
      },
      randomId: (() => {
        let id = 0;
        return () => `gm-${++id}`;
      })(),
    }),
    playerCoordinator = new XpTransactionCoordinator({
      socket: bus.endpoint(),
      currentUser: () => player,
      users: () => connectedUsers,
      getActor: () => playerActor,
      execute: async () => {
        throw new Error("The player must not execute an authoritative purchase.");
      },
      randomId: (() => {
        let id = 0;
        return () => `player-${++id}`;
      })(),
    });
  gmCoordinator.start();
  playerCoordinator.start();
  try {
    const attempts = await Promise.allSettled([
      playerCoordinator.request(playerActor, "buySkill", { cost: 10 }),
      playerCoordinator.request(playerActor, "buySkill", { cost: 10 }),
    ]);
    assert.deepEqual(
      attempts.map((attempt) => attempt.status),
      ["fulfilled", "rejected"],
    );
    assert.equal(attempts[0].value.xp, 0);
    assert.match(attempts[1].reason.message, /not enough available XP/i);
    assert.equal(authoritativeActor.xp, 0);
  } finally {
    playerCoordinator.stop();
    gmCoordinator.stop();
  }
});

test("coordinator rejects an XP request from a user without actor ownership", async () => {
  const gm = { id: "gm", active: true, owner: false, isGM: true },
    stranger = {
      id: "stranger",
      active: true,
      owner: false,
      isGM: false,
    },
    connectedUsers = users(stranger, gm),
    target = actor(),
    bus = new SocketBus(),
    gmCoordinator = new XpTransactionCoordinator({
      socket: bus.endpoint(),
      currentUser: () => gm,
      users: () => connectedUsers,
      getActor: () => target,
      execute: async () => ({ xp: 0 }),
      randomId: () => "gm-request",
    }),
    strangerCoordinator = new XpTransactionCoordinator({
      socket: bus.endpoint(),
      currentUser: () => stranger,
      users: () => connectedUsers,
      getActor: () => target,
      execute: async () => ({ xp: 0 }),
      randomId: () => "stranger-request",
    });
  gmCoordinator.start();
  strangerCoordinator.start();
  try {
    await assert.rejects(
      strangerCoordinator.request(target, "buySkill", { cost: 5 }),
      /owner permission is required/i,
    );
  } finally {
    strangerCoordinator.stop();
    gmCoordinator.stop();
  }
});
