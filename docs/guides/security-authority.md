# Transaction authority and recovery

XP purchases, action and manoeuvre spending, crew changes and tabletop approvals are all processed by one GM browser that the GM selects explicitly, called the transaction authority. This guide explains how GMs select it, what happens when a request is interrupted, and what the safeguards do and do not cover.

The authority checks each player's ownership against the full identifier of the document being changed, including the temporary actor behind an unlinked token.

## Select the transaction authority

1. Join as the active GM and open the Settings sidebar.
2. Choose **Transaction authority**.
3. Confirm that any earlier transaction tabs have stopped, then select **Other tabs stopped - use this tab**.

Repeat these steps after reloading the selected GM tab, or when another GM takes over the game. Other GM tabs can view the world but do not process transactions.

The selection is a world setting protected by the server. It is deliberate and does not expire automatically. It is a handover controlled by the GM, not a distributed database lock:

- Do not select authority in two GM tabs at the same time.
- Do not take over while the old tab is still processing work.

## If a request times out

A timeout does not prove that a change failed. Select the intended GM tab, then inspect the request and the affected actor before retrying.

An unhandled request reports a timeout and points to the recovery option in the Settings sidebar.

## How requests are checked

- Requests travel as Foundry chat messages. The user who created a message, as reported by Foundry, must match its author; user identifiers supplied inside a request grant no authority. The older socket listeners no longer run commands.
- Each request leaves a receipt recording the requester, a fingerprint of the request, the target, its state and a reference to the result.
- The selected browser writes receipts one at a time, then uses the existing per-actor and per-scene queues. Ownership and authority are checked again after waiting in an actor's queue. Tabletop records and document writes use the same check.
- Sending the same request identity again with identical content returns the recorded outcome; different content is rejected. Completed request identities survive browser reloads.
- Queued requests can resume once the authority has been selected. Editing a queued request invalidates its fingerprint.
- Before a response is published, the expected receipt is checked once more, so a stale completion cannot overwrite a newer state.
- Routine request and success messages are hidden from the chat log but remain saved. Error and review messages stay visible.

## Review an interrupted transaction

Before a change runs, the system records that it has started. If the change is interrupted, or fails without proving that it changed nothing, the affected actor or scene is held for review. A client that reconnects later cannot replace that review state with a late completion.

1. Choose **Review interrupted transaction**.
2. Check the affected actor or scene.
3. Record a note, then release the hold.

Releasing the hold neither repeats nor reverses the operation. The original request identity stays used; make a fresh request only after you have reconciled the state.

## Players on plain HTTP connections

The transaction system works on ordinary HTTP LAN connections as well as HTTPS:

- Transaction IDs use 128 random bits from `crypto.getRandomValues`, which is available over HTTP on a LAN.
- Where the browser's own Web Crypto hashing is unavailable, fingerprints use the same SHA-256 algorithm through a bundled, pinned copy of the MIT-licensed noble-hashes library. Receipts remain compatible between HTTP and HTTPS clients.

The optional encrypted private-source feature still requires HTTPS or localhost. See `THIRD_PARTY_NOTICES.md` for the pinned library and its upstream monitoring requirement.

## Limitations

- **Storage grows with play.** Receipt records and their chat messages are kept without automatic pruning, and the world setting currently rewrites the whole receipt map on each change. A compacted or external ledger, and measurements over long campaigns, are future work. Deleting the receipt settings removes replay history, and deleting the chat messages can prevent a response from being recovered, so include both in backups.
- **Not atomic.** A change and its receipt are separate writes. An interrupted or uncertain operation needs GM reconciliation, not an automatic retry. The cautious review path can also hold an ordinary rejection, such as a balance changing just before a purchase runs.
- **Liveness is not proven.** A selection left over from a disconnected browser cannot show that the browser is still running, so select the GM browser again after a reload. Two trusted GMs selecting authority deliberately at the same time, or a forced takeover in the middle of a write, remain operational risks.
- **Foundry permissions still apply.** These controls govern changes made through the system's resource workflows. They do not stop users from making edits Foundry already allows on documents they own, stop a GM from changing system data, or add server-side atomicity to Foundry. A GM remains trusted to edit world state and settings, and Foundry offers no transaction-wide compare-and-swap for these client workflows.
- **Crash recovery is untested.** An interruption during a server write, and recovery from a full server crash, have not been simulated. Automated tests cover queued recovery and the blocking of late completions.
