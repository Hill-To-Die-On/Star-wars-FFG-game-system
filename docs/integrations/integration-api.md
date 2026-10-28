# Public integration API

Star Wars FFG exposes a versioned public API so that web character builders, community-rule publishers, companion Foundry modules and local tools can exchange characters, adversaries, vehicles, Groups and rule packs with a Foundry world. This page is a reference for developers of those tools. Every import is shown to the Foundry user for review before it changes the world, and external JSON is always treated as data, never as executable code.

The API is available at:

```js
game.system.api.integration
```

## Discover capabilities

Read the capabilities rather than assuming a system version:

```js
const integration = game.system.api.integration;
console.table(integration.getCapabilities());
```

Capability discovery reports the supported formats, transports, document types, current entry limits and transport limits.

## Contract versions

| Version | Adds |
| --- | --- |
| 1 | Player characters, community rule packs and bundles containing both. Still supported unchanged. |
| 2 | Reviewed Actor packages for characters, minions, rivals, nemeses, vehicles and groups. Version 2 bundles can combine those Actors with version 2 rule packs. |
| 3 | GM-reviewed authored actor groups, whose stable source nodes, map roles, positions and directed relationships are kept alongside the created Actors. |

All versions support JSON files, compact URL-fragment handoffs and an origin-bound `postMessage` handoff.

### JSON Schemas

The `schema` path returned by capability discovery points to the latest bundled [version 3 JSON Schema](../schemas/integration-v3.schema.json). `schemas[1]`, `schemas[2]` and `schemas[3]` expose every contract. Sites can use them for editor hints and preflight validation. The runtime validator remains authoritative for referential integrity, size limits, actor-specific fields and detailed talent-tree rules.

### Portraits and retained fields (0.4.2 Beta)

From the 0.4.2 Beta, exports leave out the procedural SVG data of system-generated portraits; the receiving system regenerates its own default portrait. Custom raster portraits and ordinary asset paths remain supported, and imported SVG data URLs remain prohibited.

Supported actor packages keep native character metadata, vehicle registration, Group starting assets and the bounded Group resource ledger. Older packages may omit these fields.

## Package envelope

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

- `source.id` and package and rule keys are lowercase stable identifiers.
- A source URL must use HTTP or HTTPS.
- Packages are limited to 2 MiB.

## Character package (version 1)

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

An embedded Item `id` is optional. Use a unique 16-character alphanumeric ID when advancement records, signature abilities or other embedded records refer to that Item.

- Character imports always create a new Actor in version 1.
- Players may import only when their Foundry role can create Actors; the new Actor is owned by them.
- Export requires Observer access.

From another Foundry module:

```js
const integration = game.system.api.integration;
const checked = integration.validatePackage(characterPackage);
const result = await integration.importCharacter(checked);
const roundTrip = await integration.exportCharacter(result.actorUuid);
```

Pass `{ download: true }` as the second argument to `exportCharacter` to save the result as JSON.

## Actor package (version 2)

Version 2 uses `kind: "actor"` and accepts every native system Actor type: `character`, `minion`, `rival`, `nemesis`, `vehicle` and `group`. SW-RPG.info uses this contract to send generated enemies, ships, parties and home bases as well as characters.

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

- Player-character Actors keep the ordinary Actor-create permission and are owned by their non-GM importer.
- Importing an adversary, vehicle or group is GM-only.
- Every Actor import creates a new document. Version 2 never silently updates an existing Actor.

## Authored actor group (version 3)

Version 3 uses `kind: "actorGroup"` and is GM-only. Its `actors` array contains allow-listed native Actor payloads. Stable actor references connect those payloads to authored `nodes`; each node keeps its name, semantic role, canvas position and one or more Actor references. A roster can therefore create several Foundry Actors while remaining a single relationship endpoint.

### Relationships

Relationships use stable node IDs and one of 131 allow-listed directed kinds. Each relationship reads as a `fromNodeId → kind → toNodeId` sentence, and several facts may connect the same pair in either direction. The optional creator label is kept separate from the kind.

The vocabulary covers authority and service, alliance and conflict, explicit personal attitudes, family and mentorship, leverage and intelligence, organisation and assignment, ownership, custody and acquisition, vehicles and travel, and bases, territory and logistics. Distinct meanings are never conflated. For example:

- a commander `commands` a minion while that minion is `loyal-to` the commander;
- legal `owns` can coexist with `steals`, `stolen-from` and `borrowed-by`;
- a ship can be `piloted-by`, `docked-at`, `refuels-at` or `repaired-by`.

Capability discovery publishes the same vocabulary as the public version 3 JSON Schema, and an automated contract test keeps the two in step.

### Validation and import

Runtime validation rejects dangling references, reused Actor references, self-links, duplicate IDs and unknown fields before any Actor is created.

The importer creates the Actors as one batch and stores system-owned provenance sufficient to reconstruct each node's incident relationships. It then emits one `starWarsFFGIntegrationImported` result containing the mapping from stable references to Foundry Actors. Connected tools such as Director of Realms can use this result as explicit authored context. Consumers must not convert structural links into invented trust, fear or hostility scores. See [ADR 0002](../adr/0002-authored-actor-group-interchange.md) for the design decision.

## Community rule pack

A rule pack contains existing Star Wars FFG Item types. A publisher can provide equipment, careers, species, talents, specializations, signature abilities, Force powers, attachments and reference records without shipping code.

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

Only a GM can import rule packs. They are stored as Items in **Star Wars FFG · Community rules**, where players can browse them and drag them onto owned characters.

### Re-importing and conflicts

The stable identity of a rule is `source.id + payload.id + rule.key`. Re-imports preserve existing records by default:

```js
await game.system.api.integration.importRulePack(rulePack);
await game.system.api.integration.importRulePack(rulePack, {
  conflict: "replace"
});
```

Use `replace` only after an explicit user choice. The Foundry review dialog applies the same policy to file, direct-link and connected-site imports: a rule pack or bundle defaults to **Keep current community rules** and offers **Replace matching community rules** as an explicit choice. Matching uses the publisher, rule-pack and rule keys, updates the existing Item in place and leaves unrelated world content untouched.

### What a rule pack may contain

Talent-tree automation is limited to the declarative effect types the system already supports. Macro bodies, callbacks, arbitrary Active Effects and unknown fields are rejected. A publisher must have permission to distribute every description and asset in its package.

## Bundle

A bundle contains 1–20 complete character or rule-pack envelopes in `payload.packages`. Bundles cannot contain other bundles. Permission checks run for the whole bundle before its first document is written.

## Send a package to Foundry

### JSON file

This is the universal fallback. The site downloads its envelope as a `.json` file. The Foundry user opens **Configure Settings → Star Wars FFG → External tools & community rules** and reviews the import.

### Direct link

Packages below 192 KiB can be UTF-8 encoded as unpadded base64url and attached to the authenticated world's URL:

```text
https://foundry.example/game#star-wars-ffg-import=BASE64URL_PACKAGE
```

The system clears the fragment before showing its review, and the fragment is never sent to the Foundry server. Inside Foundry, `integration.createHandoffUrl(package, foundryUrl)` creates the same URL. Larger characters should use the direct site connection or a JSON file.

### Direct site connection

The message transport carries packages up to 2 MiB and never installs a permanent cross-origin listener. It works like this:

1. The originating site opens the authenticated Foundry world with its exact origin and a one-time nonce in the URL fragment.
2. Foundry asks the user whether to allow that origin.
3. Foundry listens to the exact opener window for two minutes and receives one package.
4. Foundry closes the listener and shows the normal import review.

A minimal connector-side implementation:

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

If browser isolation or an authentication redirect removes `window.opener`, offer the JSON-file fallback instead.

## Register a site connector

Companion Foundry modules can advertise trusted site connectors once the system is ready:

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

`createConnectorLaunch(id)` returns the registered connector URL together with a nonce and a Foundry return URL. `openConnector(id)` opens it with `noopener`. The site reads `swffgReturn`, opens that URL when it is ready to send, and then follows the direct site connection protocol above. Registration stores metadata only and cannot inject callbacks.

## API reference

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

### Hooks

- Successful imports call `Hooks.callAll("starWarsFFGIntegrationImported", result, package)`.
- Connector registration calls `starWarsFFGConnectorRegistered`.
- The existing `starWarsFFGReady` hook receives the complete system API.

## Read-only support and rules inventory

```js
game.system.api.support.capabilities();
game.system.api.support.capabilities("cross-scale");
game.system.api.support.actorCoverage(actor, { query: "", status: "" });
game.system.api.support.diagnostics();
```

- Unknown capability IDs return unsupported, with a GM ruling required.
- Actor coverage requires Observer access and applies the campaign book filter without changing learned mechanics.
- The diagnostic v1 format returns only versions, two known integration states and document counts. It is not an upload API.

The Director of Realms `getCheckTalentRules` result includes cloned structured contributions (rule ID, activation status, source and effect). Check-pool results keep `basePool` separately from the adjusted pool. This structured-effect metadata identifies what code applies; it does not certify the interpretation of a book or turn prose into executable rules.

## Security model

The protocol is client-mediated by design. It does not expose a public unauthenticated HTTP or socket write endpoint, does not store website credentials and does not let imported data execute JavaScript. See [ADR 0001](../adr/0001-public-integration-api.md) for the decision record.

## Limitations

- The JSON Schemas are a guide for editors and preflight checks; packages that pass a schema can still be rejected by the runtime validator.
- Talent-tree automation in rule packs covers only the declarative effect types the system already supports.
- Actor imports always create new documents; they never update an existing Actor.
- Director of Realms use of version 3 relationship data has not yet been verified in a live game.
- The direct-link transport is limited to packages below 192 KiB, and the direct site connection depends on the browser keeping `window.opener`.
