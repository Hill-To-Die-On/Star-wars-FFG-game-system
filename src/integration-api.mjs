import { SYSTEM_ID } from "./config.mjs";
import { escapeHTML } from "./mechanics.mjs";
import {
  INTEGRATION_FORMAT,
  INTEGRATION_VERSION,
  MAX_PACKAGE_BYTES,
  createConnectorRegistry,
  decodeIntegrationPackage,
  encodeConnectionRequest,
  encodeIntegrationPackage,
  integrationCapabilities,
  integrationSummary,
  parseIntegrationHash,
  validateIntegrationPackage,
} from "./integration-protocol.mjs";

const COMMUNITY_PACK = "star-wars-community-rules";
const COMMUNITY_PACK_COLLECTION = `world.${COMMUNITY_PACK}`;
const MESSAGE_READY = "star-wars-ffg:ready";
const MESSAGE_PACKAGE = "star-wars-ffg:package";
const MESSAGE_RESULT = "star-wars-ffg:result";
const HANDOFF_TIMEOUT = 120000;
const connectorRegistry = createConnectorRegistry();

const jsonClone = (value) => JSON.parse(JSON.stringify(value));

function canCreateActor() {
  return game.user.isGM || game.user.can?.("ACTOR_CREATE") === true;
}

function assertCharacterImportPermission() {
  if (!canCreateActor())
    throw new Error("Your Foundry role cannot create actors in this world.");
}

function assertActorImportPermission(pkg) {
  if (pkg.payload.type === "character") return assertCharacterImportPermission();
  if (!game.user.isGM)
    throw new Error("Only the GM can import adversaries, vehicles and groups.");
}

function assertPackagePermissions(pkg) {
  if (pkg.kind === "character") assertCharacterImportPermission();
  if (pkg.kind === "actor") assertActorImportPermission(pkg);
  if (pkg.kind === "rulePack" && !game.user.isGM)
    throw new Error("Only the GM can import community rule packs.");
  if (pkg.kind === "actorGroup" && !game.user.isGM)
    throw new Error("Only the GM can import actor groups.");
  if (pkg.kind === "bundle")
    for (const entry of pkg.payload.packages) assertPackagePermissions(entry);
}

function provenance(pkg, extra = {}) {
  return {
    sourceId: pkg.source.id,
    sourceName: pkg.source.name,
    sourceVersion: pkg.source.version ?? "",
    sourceUrl: pkg.source.url ?? "",
    format: INTEGRATION_FORMAT,
    formatVersion: pkg.version,
    importedAt: new Date().toISOString(),
    ...extra,
  };
}

function embeddedItemSource(item) {
  const { id, ...source } = item;
  return { ...jsonClone(source), ...(id ? { _id: id } : {}) };
}

export async function importIntegrationCharacter(value, options = {}) {
  const pkg = validateIntegrationPackage(value);
  if (pkg.kind !== "character")
    throw new Error("Choose a character interchange package.");
  assertCharacterImportPermission();
  const payload = pkg.payload,
    owner = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3,
    source = {
      name: payload.name,
      type: "character",
      ...(payload.img ? { img: payload.img } : {}),
      system: jsonClone(payload.system),
      items: payload.items.map(embeddedItemSource),
      flags: { [SYSTEM_ID]: { integration: provenance(pkg) } },
      ...(!game.user.isGM ? { ownership: { [game.user.id]: owner } } : {}),
    },
    actor = await Actor.create(source, {
      renderSheet: options.renderSheet !== false,
      keepEmbeddedIds: true,
    });
  if (!actor) throw new Error("Foundry did not create the character.");
  const result = {
    kind: "character",
    actorId: actor.id,
    actorUuid: actor.uuid,
    name: actor.name,
  };
  Hooks.callAll("starWarsFFGIntegrationImported", result, pkg);
  return result;
}

export async function importIntegrationActor(value, options = {}) {
  const pkg = validateIntegrationPackage(value);
  if (pkg.kind !== "actor")
    throw new Error("Choose a version 2 actor interchange package.");
  assertActorImportPermission(pkg);
  const payload = pkg.payload,
    owner = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3,
    source = {
      name: payload.name,
      type: payload.type,
      ...(payload.img ? { img: payload.img } : {}),
      system: jsonClone(payload.system),
      items: payload.items.map(embeddedItemSource),
      flags: { [SYSTEM_ID]: { integration: provenance(pkg) } },
      ...(!game.user.isGM && payload.type === "character"
        ? { ownership: { [game.user.id]: owner } }
        : {}),
    },
    actor = await Actor.create(source, {
      renderSheet: options.renderSheet !== false,
      keepEmbeddedIds: true,
    });
  if (!actor) throw new Error("Foundry did not create the actor.");
  const result = {
    kind: "actor",
    actorType: actor.type,
    actorId: actor.id,
    actorUuid: actor.uuid,
    name: actor.name,
  };
  Hooks.callAll("starWarsFFGIntegrationImported", result, pkg);
  return result;
}

export async function importIntegrationActorGroup(value, options = {}) {
  const pkg = validateIntegrationPackage(value);
  if (pkg.kind !== "actorGroup")
    throw new Error("Choose a version 3 actor-group interchange package.");
  if (!game.user.isGM) throw new Error("Only the GM can import actor groups.");

  const nodeByActorRef = new Map();
  for (const node of pkg.payload.nodes)
    for (const actorRef of node.actorRefs) nodeByActorRef.set(actorRef, node);

  const sources = pkg.payload.actors.map((entry) => {
    const node = nodeByActorRef.get(entry.id);
    const incidentRelationships = pkg.payload.relationships.filter(
      (relationship) => relationship.fromNodeId === node.id || relationship.toNodeId === node.id,
    );
    return {
      name: entry.actor.name,
      type: entry.actor.type,
      ...(entry.actor.img ? { img: entry.actor.img } : {}),
      system: jsonClone(entry.actor.system),
      items: entry.actor.items.map(embeddedItemSource),
      flags: {
        [SYSTEM_ID]: {
          integration: provenance(pkg, {
            actorGroup: {
              schemaVersion: 1,
              source: jsonClone(pkg.source),
              group: { id: pkg.payload.id, name: pkg.payload.name },
              actorRef: entry.id,
              node: jsonClone(node),
              relationships: jsonClone(incidentRelationships),
            },
          }),
        },
      },
    };
  });
  const actors = await Actor.createDocuments(sources, {
    renderSheet: options.renderSheet === true,
    keepEmbeddedIds: true,
  });
  if (!Array.isArray(actors) || actors.length !== sources.length)
    throw new Error("Foundry did not create every actor in the actor group.");

  const actorEntries = actors.map((actor, index) => {
    const actorRef = pkg.payload.actors[index].id;
    const node = nodeByActorRef.get(actorRef);
    return {
      actorRef,
      nodeId: node.id,
      role: node.role,
      actorType: actor.type,
      actorId: actor.id,
      actorUuid: actor.uuid,
      name: actor.name,
    };
  });
  const result = {
    kind: "actorGroup",
    groupId: pkg.payload.id,
    groupName: pkg.payload.name,
    actors: actorEntries,
    nodes: jsonClone(pkg.payload.nodes),
    relationships: jsonClone(pkg.payload.relationships),
  };
  Hooks.callAll("starWarsFFGIntegrationImported", result, pkg);
  return result;
}

async function resolveActor(actorOrUuid) {
  if (typeof actorOrUuid !== "string") return actorOrUuid;
  return game.actors.get(actorOrUuid) ?? (await fromUuid(actorOrUuid));
}

export async function exportIntegrationCharacter(actorOrUuid, options = {}) {
  const actor = await resolveActor(actorOrUuid);
  if (!actor || actor.documentName !== "Actor" || actor.type !== "character")
    throw new Error("Choose a player character to export.");
  if (!actor.testUserPermission(game.user, "OBSERVER"))
    throw new Error("Observer permission is required to export this character.");
  const source = actor.toObject(),
    system = jsonClone(source.system),
    items = Array.from(actor.items, (item) => {
      const itemSource = item.toObject();
      return {
        id: item.id,
        name: item.name,
        type: item.type,
        ...(itemSource.img ? { img: itemSource.img } : {}),
        system: jsonClone(itemSource.system),
      };
    }),
    pkg = {
      format: INTEGRATION_FORMAT,
      version: 1,
      kind: "character",
      source: {
        id: SYSTEM_ID,
        name: game.system.title,
        version: game.system.version,
        ...(game.system.url ? { url: game.system.url } : {}),
      },
      payload: {
        name: actor.name,
        type: "character",
        ...(source.img ? { img: source.img } : {}),
        system,
        items,
      },
    };
  const validated = validateIntegrationPackage(pkg);
  if (options.download) {
    const filename = `${actor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "character"}.star-wars-ffg.json`;
    saveDataToFile(
      JSON.stringify(validated, null, 2),
      "application/json",
      filename,
    );
  }
  return validated;
}

export async function exportIntegrationActor(actorOrUuid, options = {}) {
  const actor = await resolveActor(actorOrUuid),
    actorTypes = integrationCapabilities().actorTypes;
  if (!actor || actor.documentName !== "Actor" || !actorTypes.includes(actor.type))
    throw new Error("Choose a Star Wars FFG actor to export.");
  if (!actor.testUserPermission(game.user, "OBSERVER"))
    throw new Error("Observer permission is required to export this actor.");
  const source = actor.toObject(),
    items = Array.from(actor.items, (item) => {
      const itemSource = item.toObject();
      return {
        id: item.id,
        name: item.name,
        type: item.type,
        ...(itemSource.img ? { img: itemSource.img } : {}),
        system: jsonClone(itemSource.system),
      };
    }),
    pkg = validateIntegrationPackage({
      format: INTEGRATION_FORMAT,
      version: 2,
      kind: "actor",
      source: {
        id: SYSTEM_ID,
        name: game.system.title,
        version: game.system.version,
        ...(game.system.url ? { url: game.system.url } : {}),
      },
      payload: {
        name: actor.name,
        type: actor.type,
        ...(source.img ? { img: source.img } : {}),
        system: jsonClone(source.system),
        items,
      },
    });
  if (options.download) {
    const filename = `${actor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "actor"}.star-wars-ffg.json`;
    saveDataToFile(JSON.stringify(pkg, null, 2), "application/json", filename);
  }
  return pkg;
}

async function getCommunityPack() {
  let pack = game.packs.get(COMMUNITY_PACK_COLLECTION);
  if (!pack)
    pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
      name: COMMUNITY_PACK,
      label: "Star Wars FFG · Community rules",
      type: "Item",
      ownership: {
        GAMEMASTER: "OWNER",
        ASSISTANT: "OWNER",
        TRUSTED: "OBSERVER",
        PLAYER: "OBSERVER",
      },
    });
  if (pack.documentName !== "Item")
    throw new Error("The community rules compendium has an unexpected document type.");
  return pack;
}

function externalRuleKey(pkg, rule) {
  return `${pkg.source.id}:${pkg.payload.id}:${rule.key}`;
}

function ruleDocumentSource(pkg, rule) {
  return {
    name: rule.name,
    type: rule.type,
    ...(rule.img ? { img: rule.img } : {}),
    system: jsonClone(rule.system),
    flags: {
      [SYSTEM_ID]: {
        integration: provenance(pkg, {
          packageId: pkg.payload.id,
          packageName: pkg.payload.name,
          packageVersion: pkg.payload.version,
          ruleKey: rule.key,
          externalKey: externalRuleKey(pkg, rule),
        }),
      },
    },
  };
}

export async function importIntegrationRulePack(value, options = {}) {
  const pkg = validateIntegrationPackage(value);
  if (pkg.kind !== "rulePack")
    throw new Error("Choose a community rule-pack interchange package.");
  if (!game.user.isGM)
    throw new Error("Only the GM can import community rule packs.");
  const conflict = options.conflict ?? "preserve";
  if (!["preserve", "replace"].includes(conflict))
    throw new Error("Rule conflict mode must be preserve or replace.");
  const pack = await getCommunityPack(),
    wasLocked = pack.locked;
  await pack.configure({
    locked: false,
    ownership: {
      GAMEMASTER: "OWNER",
      ASSISTANT: "OWNER",
      TRUSTED: "OBSERVER",
      PLAYER: "OBSERVER",
    },
  });
  try {
    await pack.getIndex({ fields: [`flags.${SYSTEM_ID}.integration.externalKey`] });
    const indexed = Array.from(pack.index.values(), (entry) => [
        foundry.utils.getProperty(
          entry,
          `flags.${SYSTEM_ID}.integration.externalKey`,
        ),
        entry._id,
      ]).filter(([key]) => key),
      existing = new Map(),
      create = [],
      update = [];
    for (const [key, id] of indexed) {
      if (existing.has(key))
        throw new Error(
          `Community rules contain duplicate integration key ${key}.`,
        );
      existing.set(key, id);
    }
    let preserved = 0;
    for (const rule of pkg.payload.rules) {
      const key = externalRuleKey(pkg, rule),
        id = existing.get(key),
        source = ruleDocumentSource(pkg, rule);
      if (!id) create.push(source);
      else if (conflict === "replace") update.push({ _id: id, ...source });
      else preserved += 1;
    }
    for (let index = 0; index < create.length; index += 100)
      await pack.documentClass.createDocuments(create.slice(index, index + 100), {
        pack: pack.collection,
        render: false,
      });
    for (let index = 0; index < update.length; index += 100)
      await pack.documentClass.updateDocuments(update.slice(index, index + 100), {
        pack: pack.collection,
        render: false,
      });
    const result = {
      kind: "rulePack",
      pack: pack.collection,
      packageId: pkg.payload.id,
      created: create.length,
      updated: update.length,
      preserved,
    };
    Hooks.callAll("starWarsFFGIntegrationImported", result, pkg);
    return result;
  } finally {
    await pack.configure({ locked: wasLocked });
  }
}

export async function importIntegrationPackage(value, options = {}) {
  const pkg = validateIntegrationPackage(value);
  assertPackagePermissions(pkg);
  if (pkg.kind === "character")
    return importIntegrationCharacter(pkg, options);
  if (pkg.kind === "actor") return importIntegrationActor(pkg, options);
  if (pkg.kind === "actorGroup") return importIntegrationActorGroup(pkg, options);
  if (pkg.kind === "rulePack")
    return importIntegrationRulePack(pkg, options);
  const results = [];
  for (const entry of pkg.payload.packages)
    results.push(await importIntegrationPackage(entry, options));
  const result = { kind: "bundle", results };
  Hooks.callAll("starWarsFFGIntegrationImported", result, pkg);
  return result;
}

function reviewDescription(pkg, { origin } = {}) {
  const summary = integrationSummary(pkg),
    originText = origin
      ? `<p>Connection: <strong>${escapeHTML(origin)}</strong></p>`
      : "",
    details =
      summary.kind === "character" || summary.kind === "actor"
        ? `${summary.items} embedded item${summary.items === 1 ? "" : "s"}`
        : summary.kind === "actorGroup"
          ? `${summary.actors} actors, ${summary.relationships} authored relationships and ${summary.items} total items`
        : summary.kind === "rulePack"
          ? `${summary.items} community rule${summary.items === 1 ? "" : "s"}`
          : `${summary.packages.length} packages and ${summary.items} total items`;
  return `<div class="sf-dialog"><p><strong>${escapeHTML(summary.label)}</strong></p><p>${escapeHTML(details)} from ${escapeHTML(summary.source)}.</p>${originText}<p>Foundry will validate the data and ignore Actor IDs, ownership, folders, scripts and third-party flags. Rule packs are stored in the Community rules compendium.</p></div>`;
}

export async function reviewIntegrationPackage(value, context = {}) {
  const pkg = validateIntegrationPackage(value);
  assertPackagePermissions(pkg);
  const proceed = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Review external Star Wars FFG import" },
    content: reviewDescription(pkg, context),
    yes: { label: "Import into this world" },
    no: { label: "Cancel" },
    rejectClose: false,
  });
  if (!proceed) return null;
  const result = await importIntegrationPackage(pkg, context.options);
  const summary = integrationSummary(pkg);
  ui.notifications.info(`${summary.label} imported from ${summary.source}.`);
  return result;
}

export async function openIntegrationImport() {
  try {
    const selection = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Import external Star Wars FFG data" },
      position: { width: 620 },
      content:
        '<div class="sf-dialog"><p>Select a <code>.json</code> interchange file from a character or campaign builder, community-rules site or companion tool, or paste its JSON below.</p><label>Interchange file<input type="file" name="integrationFile" accept=".json,application/json"></label><label>Paste JSON<textarea name="integrationJson" rows="12" spellcheck="false"></textarea></label></div>',
      ok: {
        label: "Review import",
        callback: (_event, button) => ({
          file: button.form.elements.integrationFile.files[0],
          text: button.form.elements.integrationJson.value,
        }),
      },
      rejectClose: false,
    });
    if (!selection) return null;
    if (selection.file?.size > MAX_PACKAGE_BYTES)
      throw new Error(`Choose a JSON file no larger than ${MAX_PACKAGE_BYTES} bytes.`);
    const text = selection.file ? await selection.file.text() : selection.text.trim();
    if (!text) throw new Error("Choose a JSON file or paste an interchange package.");
    return reviewIntegrationPackage(JSON.parse(text));
  } catch (error) {
    ui.notifications.error(`External import: ${error.message}`);
    return null;
  }
}

function clearIntegrationHash() {
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}

async function receiveConnectionPackage(request) {
  if (!window.opener)
    throw new Error(
      "The originating site is no longer connected. Use its JSON download instead.",
    );
  const allowed = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Connect an external character or rules site" },
    content: `<div class="sf-dialog"><p><strong>${escapeHTML(request.origin)}</strong> wants to send Star Wars FFG data to this world.</p><p>The connection lasts for two minutes, accepts one package from this exact browser window and origin, and still shows a final import review.</p></div>`,
    yes: { label: "Allow one package" },
    no: { label: "Cancel" },
    rejectClose: false,
  });
  if (!allowed) {
    window.opener.postMessage(
      { type: MESSAGE_RESULT, nonce: request.nonce, status: "cancelled" },
      request.origin,
    );
    return null;
  }
  const opener = window.opener,
    data = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("The external site did not send a package within two minutes."));
      }, HANDOFF_TIMEOUT);
      function onMessage(event) {
        if (
          event.origin !== request.origin ||
          event.source !== opener ||
          event.data?.type !== MESSAGE_PACKAGE ||
          event.data?.nonce !== request.nonce
        )
          return;
        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        resolve(event.data.package);
      }
      window.addEventListener("message", onMessage);
      opener.postMessage(
        {
          type: MESSAGE_READY,
          nonce: request.nonce,
          capabilities: integrationCapabilities(),
        },
        request.origin,
      );
    });
  try {
    const result = await reviewIntegrationPackage(data, { origin: request.origin });
    opener.postMessage(
      {
        type: MESSAGE_RESULT,
        nonce: request.nonce,
        status: result ? "imported" : "cancelled",
        result,
      },
      request.origin,
    );
    return result;
  } catch (error) {
    opener.postMessage(
      {
        type: MESSAGE_RESULT,
        nonce: request.nonce,
        status: "error",
        error: error.message,
      },
      request.origin,
    );
    throw error;
  }
}

export async function processIntegrationHandoff(hash = location.hash) {
  let handoff;
  try {
    handoff = parseIntegrationHash(hash);
    if (!handoff) return null;
    clearIntegrationHash();
    if (handoff.type === "package")
      return await reviewIntegrationPackage(handoff.package);
    return await receiveConnectionPackage(handoff.request);
  } catch (error) {
    ui.notifications.error(`External handoff: ${error.message}`);
    return null;
  }
}

export function createIntegrationHandoffUrl(value, foundryUrl = location.href) {
  const url = new URL(foundryUrl);
  url.hash = `star-wars-ffg-import=${encodeIntegrationPackage(value)}`;
  return url.href;
}

function connectionUrl(foundryUrl, origin, nonce) {
  const url = new URL(foundryUrl);
  url.hash = `star-wars-ffg-connect=${encodeConnectionRequest({ origin, nonce })}`;
  return url.href;
}

function randomNonce() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }
  return `${foundry.utils.randomID(32)}${foundry.utils.randomID(32)}`;
}

export function createConnectorLaunch(id, foundryUrl = location.href) {
  const connector = connectorRegistry.get(id);
  if (!connector) throw new Error(`Unknown connector: ${id}`);
  const site = new URL(connector.url),
    nonce = randomNonce(),
    returnUrl = connectionUrl(foundryUrl, site.origin, nonce);
  site.searchParams.set("swffgReturn", returnUrl);
  site.searchParams.set("swffgNonce", nonce);
  site.searchParams.set("swffgVersion", String(INTEGRATION_VERSION));
  return { connector, url: site.href, returnUrl, nonce };
}

export function openIntegrationConnector(id, options = {}) {
  const launch = createConnectorLaunch(id, options.foundryUrl);
  window.open(launch.url, "_blank", "noopener,noreferrer");
  return launch;
}

export function registerIntegrationConnector(manifest) {
  const connector = connectorRegistry.register(manifest);
  Hooks.callAll("starWarsFFGConnectorRegistered", connector);
  return connector;
}

export function unregisterIntegrationConnector(id) {
  return connectorRegistry.unregister(id);
}

export const integrationApi = Object.freeze({
  format: INTEGRATION_FORMAT,
  version: INTEGRATION_VERSION,
  getCapabilities: integrationCapabilities,
  validatePackage: validateIntegrationPackage,
  summarizePackage: integrationSummary,
  importPackage: importIntegrationPackage,
  importCharacter: importIntegrationCharacter,
  importActor: importIntegrationActor,
  importActorGroup: importIntegrationActorGroup,
  importRulePack: importIntegrationRulePack,
  exportCharacter: exportIntegrationCharacter,
  exportActor: exportIntegrationActor,
  openImportDialog: openIntegrationImport,
  createHandoffUrl: createIntegrationHandoffUrl,
  encodeHandoff: encodeIntegrationPackage,
  decodeHandoff: decodeIntegrationPackage,
  registerConnector: registerIntegrationConnector,
  unregisterConnector: unregisterIntegrationConnector,
  listConnectors: connectorRegistry.list,
  createConnectorLaunch,
  openConnector: openIntegrationConnector,
});
