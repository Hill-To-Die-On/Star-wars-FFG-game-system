# ADR 0002: Preserve authored actor-group relationships across imports

- Status: Accepted
- Date: 2026-09-26

## Context

SW-RPG.info can organise characters, adversaries, ships, organisations and locations into nested adventure groups and draw directional relationships between them. Each arrow is a sentence from its source through its kind to its target. Its allow-listed vocabulary spans authority, allegiance, conflict, attitude, family, leverage, intelligence, ownership and operations, and several independently authored facts may connect the same pair in either direction. Importing only the individual Actors destroys that authored structure. Expanding a roster node directly into pairwise Actor relationships is also incorrect: a gang represented by several Foundry Actors is still one authored relationship endpoint, and its minions must not silently inherit a boss's role.

Director of Realms already distinguishes explicit authored facts from inferred or observed relationships. The interchange must preserve that distinction and must not invent numeric trust, fear, loyalty or hostility values from a structural label.

## Decision

Interchange version 3 adds a GM-only `actorGroup` package.

- The package carries stable external Actor references, stable authored node IDs, each node's display name, map role and position, and exact directed relationship records.
- A node may map to several imported Actors. This supports enemy rosters without changing the meaning or cardinality of the authored graph.
- Every Actor is created in one reviewed Foundry batch. Its system-owned provenance flag contains enough incident graph data for a later Director of Realms installation to reconstruct the relationship map.
- The completed import emits one `starWarsFFGIntegrationImported` hook with the external-to-Foundry Actor mapping and the normalized graph.
- Relationship kinds and fields are allow-listed. Unknown fields, dangling references, actor reuse across nodes, self-links and non-GM imports fail closed.
- Vehicle and home-base links remain explicit rather than being flattened into generic location text: ownership, pilot, crew, aboard, docking and base relationships retain their authored direction.
- Director of Realms stores the authored nodes and edges separately from its quantitative `regards` readings. Its prompt context identifies these as explicit instructions and preserves direction and creator-written labels.

## Consequences

The website, Star Wars FFG game system and Director of Realms share one versioned boundary. A saved adventure group can be imported without flattening its hierarchy or turning structural facts into guessed sentiment. Existing version 1 and version 2 packages retain their current semantics.

The package creates new Actors rather than updating existing documents. A future synchronization protocol will need explicit identity, conflict and deletion rules rather than silently replacing campaign state.
