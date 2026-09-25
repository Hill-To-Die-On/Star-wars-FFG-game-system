# ADR 0001: Client-mediated public integration API

- Status: Accepted
- Date: 2026-09-25

## Context

External character builders and community-rule sites need a stable way to exchange data with the Star Wars FFG system. Foundry worlds are authenticated applications, often self-hosted behind routers or reverse proxies. A game system running in the browser cannot safely create a general unauthenticated server route, and a permanent cross-origin browser listener would let unrelated sites repeatedly offer writes to a world.

The system must also distinguish community data from executable Foundry extensions. A rules publisher needs declarative Items and talent effects; it does not need authority to set ownership, install macros, run JavaScript or write arbitrary document fields.

## Decision

The system provides a versioned `star-wars-ffg-interchange` envelope through `game.system.api.integration`.

- Version 1 supports player-character packages, community Item rule packs and non-recursive mixed bundles.
- Character imports create new Actors. Foundry's role permission controls who may create them, and non-GM creators own their imported Actor.
- Rule packs are GM-only and use a dedicated player-readable world compendium. Stable external keys support preserve-by-default and explicit replacement.
- Imported sources are rebuilt from public allow-lists. Ownership, folders, sort order, arbitrary flags, Active Effects, unknown fields, functions and unsafe object keys are excluded.
- Mechanical rules use the system's validated declarative talent-effect schema. Imported packages cannot execute code.
- External sites may deliver a JSON file, a size-limited fragment or one package through an exact-origin, exact-opener, nonce-bound, two-minute `postMessage` session.
- Every browser handoff reaches a Foundry review before import. No permanent cross-origin listener or unauthenticated HTTP/socket write endpoint is created.
- Installed companion modules may register connector metadata. Registration cannot inject runtime callbacks through JSON.

## Consequences

Character builders can create a one-click handoff while retaining a JSON fallback. Rule authors receive a searchable, draggable native Foundry library. The interchange contract can add a new version without silently changing version 1 semantics.

The user must have an authenticated Foundry session and approve the connection and import. Sites cannot silently synchronize in the background. Very large packages use the message or file transport rather than a URL. Version 1 creates characters rather than updating existing Actors, avoiding accidental replacement of campaign state; a future update protocol would need an explicit merge contract and conflict review.
