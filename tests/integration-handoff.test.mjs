import test from "node:test";
import assert from "node:assert/strict";
import {
  createConnectorLaunch,
  createIntegrationHandoffUrl,
  importIntegrationPackage,
  integrationApi,
  openIntegrationConnector,
  openIntegrationImport,
  processIntegrationHandoff,
  registerIntegrationConnector,
  reviewIntegrationPackage,
  unregisterIntegrationConnector,
} from "../src/integration-api.mjs";
import {
  MAX_PACKAGE_BYTES,
  encodeConnectionRequest,
  parseIntegrationHash,
  validateIntegrationPackage,
} from "../src/integration-protocol.mjs";
import { characterPackage, rulePack } from "./fixtures/integration-packages.mjs";

const ORIGIN = "https://builder.example",
  NONCE = "nonce-0123456789abcdef",
  CONNECT = `#star-wars-ffg-connect=${encodeConnectionRequest({ origin: ORIGIN, nonce: NONCE })}`,
  PACKAGE = "star-wars-ffg:package",
  RESULT = "star-wars-ffg:result";

// Foundry and browser globals for one test. Dialogs answer from `answers` in
// order; a function answer receives the dialog config.
function installBrowser({ isGM = true, opener, answers = [] } = {}) {
  const calls = { created: [], hooks: [], info: [], errors: [], dialogs: [], replaced: [], opened: [] },
    listeners = new Set(),
    answer = async (config) => {
      calls.dialogs.push(config);
      const next = answers.shift();
      return typeof next === "function" ? next(config) : next;
    };
  globalThis.game = {
    user: { id: "user1", isGM, can: () => false },
    actors: new Map(),
    packs: new Map(),
  };
  globalThis.Actor = {
    async create(source) {
      calls.created.push(source);
      return {
        id: "NewActor00000001",
        uuid: "Actor.NewActor00000001",
        name: source.name,
        type: source.type,
      };
    },
  };
  globalThis.Hooks = { callAll: (...args) => calls.hooks.push(args) };
  globalThis.ui = {
    notifications: {
      info: (message) => calls.info.push(message),
      error: (message) => calls.errors.push(message),
    },
  };
  globalThis.foundry = {
    applications: { api: { DialogV2: { confirm: answer, prompt: answer } } },
  };
  globalThis.location = {
    href: "https://foundry.example/game?world=x",
    pathname: "/game",
    search: "?world=x",
    hash: "",
  };
  globalThis.history = { replaceState: (...args) => calls.replaced.push(args) };
  globalThis.window = {
    opener,
    addEventListener(type, listener) {
      assert.equal(type, "message");
      listeners.add(listener);
    },
    removeEventListener: (type, listener) => listeners.delete(listener),
    open: (...args) => calls.opened.push(args),
  };
  return {
    calls,
    listeners,
    dispatch: (event) => [...listeners].forEach((listener) => listener(event)),
  };
}

const openerWindow = () => {
  const posted = [];
  return { posted, postMessage: (message, origin) => posted.push({ message, origin }) };
};

async function until(condition) {
  for (let turn = 0; turn < 200 && !condition(); turn += 1)
    await new Promise((resolve) => setImmediate(resolve));
  assert.ok(condition(), "condition not reached");
}

const pasted = (text) => (config) =>
  config.ok.callback(null, {
    form: {
      elements: { integrationFile: { files: [] }, integrationJson: { value: text } },
    },
  });

test("review checks permissions first, escapes the origin, and a cancel imports nothing", async () => {
  const player = installBrowser({ isGM: false });
  await assert.rejects(
    reviewIntegrationPackage(rulePack()),
    /Only the GM can import community rule packs/,
  );
  assert.equal(player.calls.dialogs.length, 0);

  const { calls } = installBrowser({ answers: [null] });
  assert.equal(
    await reviewIntegrationPackage(characterPackage(), {
      origin: "https://x.example/<img src=x>",
    }),
    null,
  );
  const [dialog] = calls.dialogs;
  assert.match(dialog.content, /1 embedded item from QA Builder/);
  assert.match(dialog.content, /&lt;img src=x&gt;/);
  assert.ok(!dialog.content.includes("<img"));
  assert.ok(!dialog.content.includes("integrationConflict"));
  assert.equal(calls.created.length, 0);

  const rules = installBrowser({ answers: [null] });
  await reviewIntegrationPackage(rulePack(), { options: { conflict: "replace" } });
  assert.match(rules.calls.dialogs[0].content, /<option value="replace" selected>/);
});

test("the import dialog reports oversized, empty and malformed input", async () => {
  const { calls } = installBrowser({
    answers: [
      null,
      { file: { size: MAX_PACKAGE_BYTES + 1, text: async () => "{}" } },
      pasted("   "),
      pasted("{not json"),
    ],
  });
  for (let attempt = 0; attempt < 4; attempt += 1)
    assert.equal(await openIntegrationImport(), null);
  assert.equal(calls.errors.length, 3);
  assert.equal(
    calls.errors[0],
    `External import: Choose a JSON file no larger than ${MAX_PACKAGE_BYTES} bytes.`,
  );
  assert.equal(
    calls.errors[1],
    "External import: Choose a JSON file or paste an interchange package.",
  );
  assert.match(calls.errors[2], /^External import: .*JSON/);
  assert.equal(calls.created.length, 0);
});

test("a pasted or chosen package goes through review before it imports", async () => {
  const text = JSON.stringify(characterPackage()),
    { calls } = installBrowser({
      answers: [pasted(text), {}, { file: { size: text.length, text: async () => text } }, {}],
    });
  assert.equal((await openIntegrationImport()).kind, "character");
  assert.equal((await openIntegrationImport()).kind, "character");
  assert.match(calls.dialogs[1].window.title, /Review external Star Wars FFG import/);
  assert.equal(calls.created.length, 2);
  assert.equal(calls.info.length, 2);
  assert.match(calls.info[0], /imported from QA Builder\.$/);
});

test("a URL fragment handoff clears the fragment and imports after review", async () => {
  const { calls } = installBrowser({ answers: [{}] }),
    url = createIntegrationHandoffUrl(
      characterPackage(),
      "https://foundry.example/game?world=x",
    );
  assert.ok(url.startsWith("https://foundry.example/game?world=x#star-wars-ffg-import="));
  const { hash } = new URL(url);
  assert.deepEqual(
    parseIntegrationHash(hash).package,
    validateIntegrationPackage(characterPackage()),
  );
  assert.equal((await processIntegrationHandoff(hash)).kind, "character");
  assert.deepEqual(calls.replaced, [[null, "", "/game?world=x"]]);
});

test("unrelated fragments are ignored and malformed handoffs are reported", async () => {
  const { calls } = installBrowser();
  assert.equal(await processIntegrationHandoff("#combat-tracker"), null);
  assert.equal(await processIntegrationHandoff(), null);
  assert.equal(await processIntegrationHandoff("#star-wars-ffg-import=@@@"), null);
  assert.deepEqual(calls.replaced, []);
  assert.equal(calls.errors.length, 1);
  assert.match(calls.errors[0], /^External handoff: /);
});

test("a connection needs its opener, and a declined request is reported back to it", async () => {
  const orphan = installBrowser({ opener: null });
  assert.equal(await processIntegrationHandoff(CONNECT), null);
  assert.match(orphan.calls.errors[0], /no longer connected/);

  const opener = openerWindow(),
    { calls } = installBrowser({ opener, answers: [false] });
  assert.equal(await processIntegrationHandoff(CONNECT), null);
  assert.deepEqual(calls.replaced, [[null, "", "/game?world=x"]]);
  assert.match(
    calls.dialogs[0].content,
    /<strong>https:\/\/builder\.example<\/strong> wants to send/,
  );
  assert.deepEqual(opener.posted, [
    { message: { type: RESULT, nonce: NONCE, status: "cancelled" }, origin: ORIGIN },
  ]);
});

test("a connection accepts one package only from the approved window, origin and nonce", async () => {
  const opener = openerWindow(),
    stranger = openerWindow(),
    browser = installBrowser({ opener, answers: [true, {}] }),
    handoff = processIntegrationHandoff(CONNECT);
  await until(() => opener.posted.length === 1);
  const [ready] = opener.posted;
  assert.equal(ready.origin, ORIGIN);
  assert.equal(ready.message.type, "star-wars-ffg:ready");
  assert.equal(ready.message.nonce, NONCE);
  assert.ok(ready.message.capabilities.imports.includes("character"));

  const data = { type: PACKAGE, nonce: NONCE, package: characterPackage() };
  browser.dispatch({ origin: "https://evil.example", source: opener, data });
  browser.dispatch({ origin: ORIGIN, source: stranger, data });
  browser.dispatch({ origin: ORIGIN, source: opener, data: { ...data, nonce: "other-0123456789abcdef" } });
  browser.dispatch({ origin: ORIGIN, source: opener, data: { ...data, type: "star-wars-ffg:ready" } });
  browser.dispatch({ origin: ORIGIN, source: opener, data: null });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(browser.calls.dialogs.length, 1);
  assert.equal(browser.listeners.size, 1);

  browser.dispatch({ origin: ORIGIN, source: opener, data });
  const result = await handoff;
  assert.equal(result.kind, "character");
  assert.equal(browser.listeners.size, 0);
  assert.match(
    browser.calls.dialogs[1].content,
    /Connection: <strong>https:\/\/builder\.example<\/strong>/,
  );
  assert.deepEqual(opener.posted.at(-1), {
    message: { type: RESULT, nonce: NONCE, status: "imported", result },
    origin: ORIGIN,
  });
});

test("a connected package that is cancelled or fails is reported back to the opener", async () => {
  const send = async (browser, opener, pkg) => {
    const handoff = processIntegrationHandoff(CONNECT);
    await until(() => opener.posted.length === 1);
    browser.dispatch({
      origin: ORIGIN,
      source: opener,
      data: { type: PACKAGE, nonce: NONCE, package: pkg },
    });
    return handoff;
  };

  const declining = openerWindow(),
    reviewer = installBrowser({ opener: declining, answers: [true, null] });
  assert.equal(await send(reviewer, declining, characterPackage()), null);
  assert.deepEqual(declining.posted.at(-1).message, {
    type: RESULT,
    nonce: NONCE,
    status: "cancelled",
    result: null,
  });

  const failing = openerWindow(),
    player = installBrowser({ isGM: false, opener: failing, answers: [true] });
  assert.equal(await send(player, failing, rulePack()), null);
  assert.deepEqual(failing.posted.at(-1), {
    message: {
      type: RESULT,
      nonce: NONCE,
      status: "error",
      error: "Only the GM can import community rule packs.",
    },
    origin: ORIGIN,
  });
  assert.deepEqual(player.calls.errors, [
    "External handoff: Only the GM can import community rule packs.",
  ]);
});

test("a connection gives up after two minutes without a package", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const opener = openerWindow(),
    browser = installBrowser({ opener, answers: [true] }),
    handoff = processIntegrationHandoff(CONNECT);
  await until(() => opener.posted.length === 1);
  t.mock.timers.tick(119_999);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(browser.listeners.size, 1);

  t.mock.timers.tick(1);
  assert.equal(await handoff, null);
  assert.equal(browser.listeners.size, 0);
  assert.deepEqual(browser.calls.errors, [
    "External handoff: The external site did not send a package within two minutes.",
  ]);
});

test("connector launches carry a fresh nonce and an exact-origin return URL", () => {
  const { calls } = installBrowser(),
    manifest = {
      id: "qa-connector",
      name: "QA Builder",
      version: "1.0.0",
      url: "https://builder.example/start?lang=en",
      capabilities: ["character.export"],
    },
    connector = registerIntegrationConnector(manifest);
  assert.deepEqual(calls.hooks, [["starWarsFFGConnectorRegistered", connector]]);
  assert.throws(() => registerIntegrationConnector(manifest), /already registered/);
  assert.deepEqual(
    integrationApi.listConnectors().map((entry) => entry.id),
    ["qa-connector"],
  );

  const launch = createConnectorLaunch("qa-connector", "https://foundry.example/game?world=x"),
    site = new URL(launch.url);
  assert.equal(site.origin, ORIGIN);
  assert.equal(site.searchParams.get("lang"), "en");
  assert.equal(site.searchParams.get("swffgNonce"), launch.nonce);
  assert.equal(site.searchParams.get("swffgVersion"), "2");
  assert.equal(site.searchParams.get("swffgReturn"), launch.returnUrl);
  assert.ok(
    launch.returnUrl.startsWith("https://foundry.example/game?world=x#star-wars-ffg-connect="),
  );
  assert.deepEqual(parseIntegrationHash(new URL(launch.returnUrl).hash), {
    type: "connection",
    request: { origin: ORIGIN, nonce: launch.nonce },
  });
  assert.notEqual(
    createConnectorLaunch("qa-connector", "https://foundry.example/game").nonce,
    launch.nonce,
  );

  const opened = openIntegrationConnector("qa-connector", {
    foundryUrl: "https://foundry.example/game",
  });
  assert.deepEqual(calls.opened, [[opened.url, "_blank", "noopener,noreferrer"]]);
  assert.throws(() => createConnectorLaunch("missing"), /Unknown connector: missing/);
  assert.equal(unregisterIntegrationConnector("qa-connector"), true);
  assert.throws(() => createConnectorLaunch("qa-connector"), /Unknown connector/);
});

test("the public integration API is a frozen, versioned surface", () => {
  assert.ok(Object.isFrozen(integrationApi));
  assert.equal(integrationApi.format, "star-wars-ffg-interchange");
  assert.equal(integrationApi.version, 2);
  assert.equal(integrationApi.importPackage, importIntegrationPackage);
  assert.throws(() => {
    integrationApi.importPackage = null;
  }, TypeError);
  assert.deepEqual(
    integrationApi.decodeHandoff(integrationApi.encodeHandoff(characterPackage())),
    validateIntegrationPackage(characterPackage()),
  );
});
