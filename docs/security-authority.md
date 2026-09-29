# Transaction authority and recovery

XP purchases, action/manoeuvre spending, crew changes and tabletop workflow approval use one explicitly selected GM browser. Player ownership is checked by that authority against the requested document's full UUID, including an unlinked token's synthetic actor.

## Starting or resuming a game

1. Join as the elected active GM and open the Settings sidebar.
2. Choose **Transaction authority**. Confirm that previous transaction tabs have stopped, then select **Other tabs stopped - use this tab**.
3. Repeat after reloading the selected GM tab or handing the game to another GM. Additional GM tabs can view the world; they do not execute transactions.
4. If a request times out, select the intended GM tab and inspect the request and actor before retrying. A timeout does not prove that a mutation failed.

The selected session is a server-protected world setting. Selection is deliberate; it has no automatic lease expiry. This is an operator-controlled handover, not a distributed database lock. Do not select authority simultaneously in two GM tabs or take over while the old tab is still processing work. Foundry does not provide a transaction-wide compare-and-swap operation for these client workflows. A GM remains trusted to edit world state and settings.

## Authenticated requests and persisted receipts

The resource coordinators consume native ChatMessage creation events. The authenticated creator supplied by Foundry must match the document author. Packet-supplied user identifiers do not grant authority, and the former resource socket listeners no longer execute commands.

Receipts retain the requester, immutable request fingerprint, target identity hash, state and authenticated result reference. The selected browser serializes receipt writes, then uses the existing actor and scene resource queues. Ownership and selected-session authority are checked again after waiting for an actor queue. Tabletop provenance and document writes use the same selected-session guard.

Reusing a request identity with identical content returns its recorded outcome; different content is rejected. Completed request identities survive browser reloads. Queued authenticated requests can resume after explicit selection. Editing a queued request invalidates its fingerprint. Routine request and success cards are hidden from rendered play chat but remain persisted documents. Error and review cards remain visible.

A running marker is written before a resource callback executes. If execution is interrupted, or a callback fails without proving that it made no changes, the affected actor or scene is held for review. Returning clients cannot replace that review state with a late completion. Response publication compares the expected receipt again inside the metadata queue after the asynchronous document creation. The GM uses **Review interrupted transaction**, checks the affected state, and records a note before releasing the hold. Acknowledgement neither repeats nor reverses the operation. The original identity remains consumed; make a fresh request only after reconciliation.

## Verification

- 442 system unit tests passed on this branch. Security contracts cover authenticated owner requests, rejected non-owner requests, complete synthetic UUIDs, altered payloads, repeated requests, concurrent owners, GM-session selection, stale completion and permission revocation while queued. Positive controls prevent vacuous rejection tests.
- Five temporary mutations of requester authentication, replay checks, session selection completion fencing and response-publication fencing each caused the corresponding regression to fail; original source was restored. Tests were added red-first for the original transport boundary and three subsequent concurrency findings.
- The browser fixture passed damage preview/apply/undo, narrative spending, initiative claims, session awards and dashboard updates with explicit GM selection.
- Isolated Foundry 14.368, with no modules, passed native GM/two-player acceptance: synthetic actor XP isolated from its source and sibling, owned turn/crew changes, denied non-owner requests, protected receipt storage, native author handling, replay after GM reload, concurrent purchase, quiet chat and the review action. No page errors.
- A separate native two-GM-tab/player run selected one executor, preserved distinct purchases, spent two manoeuvres and two strain over two real drag commits, and applied one tabletop award. The first movement confirmation took 62 ms in that local run. No page errors. This is a bounded acceptance observation, not a performance guarantee.
- Every XP purchase entry point, turn coordinator and crew coordinator caller was checked. XP resolution now uses the complete UUID instead of looking up a world actor by ID.

## Limits and operations

- Receipt metadata and backing ChatMessages are retained without automatic pruning. Storage grows with play, and the world setting currently rewrites the receipt map per state change. A safely compacted or external ledger and long-campaign load measurements remain future work. Deleting receipt settings removes replay history; deleting backing messages can prevent response recovery. Include both in backups.
- The effect and its receipt are separate native writes. An interrupted or uncertain operation requires GM reconciliation rather than an automatic retry. The conservative review path can also hold an ordinary callback rejection, such as a balance changing before a purchase executes.
- A surviving selection from a disconnected browser cannot prove liveness. Select the GM browser again after reload; an unhandled request reports a timeout with the Settings recovery path. Simultaneous deliberate selections by trusted GMs and mid-write forced takeover remain an operational limitation.
- These controls do not prevent a user from making edits that Foundry itself already permits on owned documents, or a GM from changing system data. They govern system-mediated resource workflows. They do not add server-side atomicity to Foundry.
- Native interruption during an in-flight server write and full-server crash recovery were not simulated in this security pass. Deterministic tests cover queued recovery and late completion fencing; restore and release testing is a separate verification lane.
