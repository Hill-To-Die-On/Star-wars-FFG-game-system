# Public integration API

Star Wars FFG exposes a versioned public API at:

```js
game.system.api.integration
```

It is intended for web character builders, community-rule publishers, companion Foundry modules and local tools. Every import remains visible to the Foundry user before it changes the world. External JSON is data, never executable code.

## Capability discovery

Read capabilities rather than assuming a system version:

```js
const integration = game.system.api.integration;
console.table(integration.getCapabilities());
```

Version 1 remains supported unchanged for player characters, community rule packs and bundles containing both. Version 2 adds reviewed Actor packages for characters, minions, rivals, nemeses, vehicles and groups; its bundles can combine those Actors with version-two rule packs. Version 3 adds GM-reviewed authored actor groups whose stable source nodes, map roles, positions and directed relationships survive alongside the created Actors. All versions support JSON files, compact URL-fragment handoffs and an origin-bound `postMessage` handoff.

The returned `schema` path points to the latest bundled [version 3 JSON Schema](schemas/integration-v3.schema.json), while `schemas[1]`, `schemas[2]` and `schemas[3]` expose every contract. Sites can use them for editor hints and preflight validation. The runtime validator remains authoritative for referential integrity, size limits, actor-specific fields and detailed talent-tree rules.

## Version 2 Actor package

Version 2 uses `kind: "actor"` and accepts every native system Actor type: `character`, `minion`, `rival`, `nemesis`, `vehicle` and `group`. This is the contract used by SW-RPG.info to send generated enemies, ships, parties and home bases as well as characters.

```json
{
  "format": "star-wars-ffg-interchange",
  "version": 2,
  "kind": "actor",
  "source": {
    "id": "sw-rpg.info",
    "name": "SW-RPG.info",
    "version": "0.2.0",
    "url": "https://sw-rpg.info/"
  },
  "payload": {
    "name": "Rook Cell",
    "type": "group",
    "system": {
      "base": {
        "name": "Rook Waystation",
        "location": "Outer Rim",
        "description": ""
      },
      "members": {},
      "credits": 2500,
      "resources": "",
      "possessions": "",
      "contacts": "",
      "notes": ""
    },
    "items": []
  }
}
```

Player-character Actors retain the ordinary Actor-create permission and are owned by their non-GM importer. Importing an adversary, vehicle or group is GM-only. Every Actor import creates a new document; version 2 does not silently update an existing Actor.

## Version 3 authored actor group

Version 3 uses `kind: "actorGroup"` and is GM-only. Its `actors` array contains allow-listed native Actor payloads. Stable actor references connect those payloads to authored `nodes`; each node retains its name, semantic role, canvas position and one or more Actor references. A roster can therefore create several Foundry Actors while remaining one exact relationship endpoint.

Relationships use stable node IDs and one of 55 allow-listed directed kinds. Each relationship reads as a `fromNodeId → kind → toNodeId` sentence, and several facts may connect the same pair in either direction. The vocabulary covers authority/service, alliance/conflict, explicit personal attitudes, family/mentorship, leverage/intelligence and organisation/place/operations. A commander can therefore `commands` a minion while that minion is `loyal-to` the commander; a character may also be `paid-by`, `blackmailed-by`, `student-of`, `assigned-to` or `aboard` another node without those meanings being conflated. The optional creator label remains separate from the kind. Runtime validation rejects dangling references, reused Actor references, self-links, duplicate IDs and unknown fields before any Actor is created.

The importer creates the Actors as one batch and stores system-owned provenance sufficient to reconstruct each node's incident relationships. It then emits one `starWarsFFGIntegrationImported` result with the stable-reference-to-Foundry-Actor mapping. Director of Realms consumes this result as explicit authored context; it does not convert structural links into invented trust, fear or hostility scores. See [ADR 0002](adr/0002-authored-actor-group-interchange.md).

## Interchange envelope

Every package uses the same envelope:

```json
{
  "format": "star-wars-ffg-interchange",
  "version": 1,
  "kind": "character",
  "source": {
    "id": "example.builder",
    "name": "Example Builder",
    "version": "1.4.0",
    "url": "https://builder.example/"
  },
  "payload": {}
}
```

`source.id` and package/rule keys are lowercase stable identifiers. A source URL must use HTTP or HTTPS. Packages are limited to 2 MiB. Capability discovery reports the current entry and transport limits.

### Character package

The character payload follows the system's public Actor and embedded Item data. It deliberately omits Foundry ownership, folders, sort order, Active Effects and third-party flags.

```json
{
  "format": "star-wars-ffg-interchange",
  "version": 1,
  "kind": "character",
  "source": {
    "id": "example.builder",
    "name": "Example Builder",
    "version": "1.4.0"
  },
  "payload": {
    "name": "Ria Vale",
    "type": "character",
    "system": {
      "line": "edge",
      "phase": "play",
      "species": "Human",
      "career": "Explorer",
      "characteristics": {
        "brawn": 2,
        "agility": 3,
        "intellect": 2,
        "cunning": 2,
        "willpower": 2,
        "presence": 2
      },
      "skills": {
        "pilotingSpace": {
          "rank": 2,
          "career": true,
          "group": false,
          "characteristic": "agility"
        }
      },
      "wounds": { "value": 0, "max": 12 },
      "strain": { "value": 0, "max": 13 },
      "xp": { "available": 0, "total": 110 }
    },
    "items": [
      {
        "id": "AbCdEfGhIjKlMnOp",
        "name": "Creator's toolkit",
        "type": "gear",
        "system": {
          "description": "Creator-written guidance.",
          "quantity": 1
        }
      }
    ]
  }
}
```

An embedded Item `id` is optional. Use a unique 16-character alphanumeric ID when advancement records, signature abilities or other embedded records refer to that Item. Character imports always create a new Actor in version 1. Players may import only when their Foundry role can create Actors; their new Actor is owned by them. Export requires Observer access.

From another Foundry module:

```js
const integration = game.system.api.integration;
const checked = integration.validatePackage(characterPackage);
const result = await integration.importCharacter(checked);
const roundTrip = await integration.exportCharacter(result.actorUuid);
```

Pass `{ download: true }` as the second argument to `exportCharacter` to save the result as JSON.

### Community rule pack

A rule pack contains existing Star Wars FFG Item types. This lets a publisher provide equipment, careers, species, talents, specializations, signature abilities, Force powers, attachments and reference records without shipping code.

```json
{
  "format": "star-wars-ffg-interchange",
  "version": 1,
  "kind": "rulePack",
  "source": {
    "id": "example.rules",
    "name": "Example Community Rules",
    "version": "2.0.0"
  },
  "payload": {
    "id": "frontier-options",
    "name": "Frontier options",
    "version": "2.0.0",
    "rules": [
      {
        "key": "gear.creators-toolkit",
        "name": "Creator's toolkit",
        "type": "gear",
        "system": {
          "description": "Original creator-written guidance.",
          "quantity": 1,
          "price": 250,
          "rarity": 3
        }
      }
    ]
  }
}
```

Only a GM can import rule packs. They are stored as Items in **Star Wars FFG · Community rules**, where players can browse and drag them onto owned characters. The stable identity is `source.id + payload.id + rule.key`. Re-imports preserve existing records by default:

```js
await game.system.api.integration.importRulePack(rulePack);
await game.system.api.integration.importRulePack(rulePack, {
  conflict: "replace"
});
```

Use `replace` only after an explicit user choice. Talent-tree automation is limited to the declarative effect types already supported by the system. Macro bodies, callbacks, arbitrary Active Effects and unknown fields are rejected. A publisher must have permission to distribute every description and asset in its package.

### Bundle

A bundle contains 1–20 complete character or rule-pack envelopes in `payload.packages`. Bundles cannot contain other bundles. Permission checks run for the full bundle before its first document is written.

## Browser transports

### JSON file

This is the universal fallback. A site downloads its envelope as `.json`; the Foundry user chooses **Configure Settings → Star Wars FFG → External tools & community rules** and reviews the import.

### Direct link

Packages below 192 KiB can be UTF-8 encoded as unpadded base64url and attached to the authenticated world's URL:

```text
https://foundry.example/game#star-wars-ffg-import=BASE64URL_PACKAGE
```

The system clears the fragment before showing its review. The fragment is not sent to the Foundry server. Inside Foundry, `integration.createHandoffUrl(package, foundryUrl)` creates the same URL. Larger characters should use the message or file transport.

### Direct site connection

The message transport carries packages up to 2 MiB and never installs a permanent cross-origin listener. The originating site opens the authenticated Foundry world with an exact origin and one-time nonce in the fragment. Foundry asks whether to allow that origin, listens to the exact opener window for two minutes, receives one package, closes the listener and shows the normal import review.

A minimal connector-side implementation is:

```js
function base64url(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function sendToFoundry(foundryWorldUrl, packageData) {
  const nonce = crypto.randomUUID();
  const foundry = new URL(foundryWorldUrl);
  const foundryOrigin = foundry.origin;
  foundry.hash = `star-wars-ffg-connect=${base64url({
    origin: location.origin,
    nonce
  })}`;

  const bridge = window.open(foundry.href, "_blank");
  function receive(event) {
    if (
      event.origin !== foundryOrigin ||
      event.source !== bridge ||
      event.data?.nonce !== nonce
    ) return;

    if (event.data.type === "star-wars-ffg:ready") {
      bridge.postMessage({
        type: "star-wars-ffg:package",
        nonce,
        package: packageData
      }, foundryOrigin);
    }

    if (event.data.type === "star-wars-ffg:result") {
      window.removeEventListener("message", receive);
      console.log(event.data.status, event.data.result ?? event.data.error);
    }
  }
  window.addEventListener("message", receive);
}
```

If browser isolation or an authentication redirect removes `window.opener`, offer the JSON-file fallback.

## Connector registry

Companion Foundry modules can advertise trusted site connectors after the system is ready:

```js
Hooks.once("starWarsFFGReady", (api) => {
  api.integration.registerConnector({
    id: "example-builder",
    name: "Example Builder",
    version: "1.0.0",
    url: "https://builder.example/connect",
    capabilities: ["character.import", "character.export"]
  });
});
```

`createConnectorLaunch(id)` returns the registered connector URL plus a nonce and Foundry return URL. `openConnector(id)` opens it with `noopener`; the site reads `swffgReturn`, opens that URL when it is ready to send, and follows the message protocol above. Registration stores metadata only and cannot inject callbacks.

## API surface

| Method | Purpose |
| --- | --- |
| `getCapabilities()` | Discover formats, transports, document types and limits |
| `validatePackage(data)` | Validate and return a normalized defensive copy |
| `summarizePackage(data)` | Produce safe review metadata |
| `importPackage(data, options)` | Import any supported package kind |
| `importCharacter(data, options)` | Create one player character |
| `importActor(data, options)` | Create one version 2 character, adversary, vehicle or group |
| `importActorGroup(data, options)` | GM-only batch import of a version 3 authored Actor group |
| `exportCharacter(actorOrUuid, options)` | Export an observable player character |
| `exportActor(actorOrUuid, options)` | Export any observable native Actor as version 2 |
| `importRulePack(data, options)` | GM-only community Item import |
| `openImportDialog()` | Open the file/paste review flow |
| `createHandoffUrl(data, foundryUrl)` | Create a compact direct-import URL |
| `encodeHandoff(data)` / `decodeHandoff(token)` | Encode or validate a compact handoff token |
| `registerConnector(manifest)` | Register site metadata from a companion module |
| `unregisterConnector(id)` / `listConnectors()` | Maintain the runtime connector registry |
| `createConnectorLaunch(id, foundryUrl)` | Create a registered site's return handshake |
| `openConnector(id, options)` | Open a registered connector without opener access |

Successful imports call `Hooks.callAll("starWarsFFGIntegrationImported", result, package)`. Connector registration calls `starWarsFFGConnectorRegistered`. The existing `starWarsFFGReady` hook receives the complete system API.

The protocol is client-mediated by design. It does not expose a public unauthenticated HTTP or socket write endpoint, store website credentials or let imported data execute JavaScript. See [ADR 0001](adr/0001-public-integration-api.md) for the decision record.
