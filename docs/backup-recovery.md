# Backup, upgrade and recovery

Back up before replacing the system or opening an older world in a newer Foundry core. A document's Undo button is a narrow, conflict-checked reversal; it is not a world backup.

## Before an upgrade

1. Ask players to finish pending requests and disconnect. Save any unsent sheet edits. Record the Foundry core version, system version, installed package archive/hash and active modules.
2. Return the world to Setup and stop its Foundry server. Copy the entire world directory, its compendium packs and all referenced user assets. Include world data such as actors, scenes, chat, journals, settings and workflow ledgers. A copy of an open LevelDB database is not a verified backup.
3. Keep a copy of the matching system package and module versions. Store the server's configuration/license and any browser-local encryption keys separately and privately. DoR private source keys require DoR's own export/recovery procedure; copying the world alone does not prove those notes can be decrypted elsewhere.
4. Preserve the original backup. Test a copy in a separate data directory and port, first with third-party modules disabled. Confirm character identity, inventory, advancement, owned-book settings, linked/unlinked tokens, vehicle crew, compendiums and permissions before inviting players.

For the Star Wars system's encrypted source notes, use **Configure Settings → Star Wars FFG → GM source key → Download key backup**. Store that JSON privately, separately from a public bug report. Restore the original key through the same dialog when changing browsers or machines. This system key is distinct from DoR's own keys. The native recovery harness below does not verify encrypted-source key restoration; test that separately before relying on a recovered source library.

The current system has no single versioned migration runner. Foundry hydrates data-model defaults; ready hooks can refresh managed procedural artwork and encrypt legacy private source notes. Custom artwork and token placement must survive these targeted changes. A system version number alone is insufficient provenance when testing an unreleased candidate: retain the archive hash.

Placed vehicles from older releases with no automatic-footprint flag retain their existing dimensions. Only explicitly managed tokens resize when silhouette or scene scale changes. New vehicle tokens opt in automatically; the explicit `game.system.api.actorIcons.resetVehicleTokenFootprint(token)` API can opt an existing token in after the GM reviews its placement. This avoids silently changing older battlemap geometry during startup.

## Reversing a reviewed change

The GM can open **Tabletop history** on an actor to undo a committed damage/recovery, critical/condition record, vehicle state or session award. Undo compares the affected current values with the recorded after-values. If a later edit changed them, it refuses to overwrite that edit. Undo the later change first or resolve the conflict explicitly.

New review dialogs compare both original fields and derived results. Changing soak/armour or a damage threshold while a confirmation is open invalidates its approval even when wounds have not changed. Reload clients after upgrading. Legacy API callers that supply only a before-value snapshot retain that narrower comparison; integrations should use the versioned full review snapshot from `reviewSnapshot(plan)` in `src/tabletop-workflows.mjs`.

Each actor change and its history entry are written in one document update. Reusing the same operation identity after a lost acknowledgement returns the persisted result instead of spending again. An undone operation stays undone when replayed. A timeout with no receipt is not permission to invent a successful result or repeat a new operation: inspect chat and actor history first. Narrative-symbol refunds and mechanical actor effects have separate ledgers and separate undo operations.

## Restoring a world

Stop the affected server and preserve its current data as evidence. Restore the whole known-good world, referenced assets and matching package/core versions into a new data directory. Open and verify that restored copy before replacing any working installation. Do not downgrade a migrated database in place or selectively combine unrelated database files. Recovery from a core-version upgrade requires the matching core backup as well as the system package.

Private notes, keys, licensed PDFs, logs and world databases must never be attached to a public issue or release. Report the core/system versions, sanitized error and test step instead.

## Repeatable checks

`npm run test:browser` first builds the current package, then runs the repository's `tests/*-ui.mjs` fixtures sequentially with a two-minute bound per fixture. A timeout stops that fixture's owned process tree, including its browser descendants; it never kills processes by name. It writes JSON, logs and screenshots under `test-results/browser`, including any timeout or cleanup failure. CI installs Chromium and uploads these artifacts on success or failure. These are real-browser fixtures, not native Foundry acceptance.

The opt-in native harness requires a locally licensed Foundry installation, its private license file and package ZIPs. Build/audit the candidate first, then run:

```text
npm run build
npm run audit:release
npm run test:recovery -- --foundry-app=<absolute-main.js> --license=<private-license.json> --port=30026 --baseline=<0.2.1-package.zip> --baseline=<0.3.0-package.zip>
```

Use `CHROMIUM_PATH` only when Chromium is installed outside Playwright's cache. Optional arguments are `--archive=<candidate.zip>`, `--output=<private-output-directory>` and `--core-version=<installed-version>` (default 14.368). The harness rejects an occupied port and the shared development port. It creates unique disposable data directories; it never accepts or modifies a live-world path and never overwrites an existing package installation.

For each baseline it creates synthetic actors of all six types, embedded equipment, linked and unlinked tokens, a private journal, a chat entry and a world compendium using that baseline package. It shuts down the world, copies it to a candidate installation, compares preserved values, tests a real effect/undo and reload, then opens a separate restoration using the untouched backup and baseline package. Fresh installation is a separate scenario. It preserves private logs, screenshots, archive hashes and `results.json`, and stops its own server/client processes.

This is a repeatable synthetic-world upgrade and recovery test. It does not certify every existing campaign, third-party module, DoR encryption key, operating-system backup tool or Foundry core upgrade. Run the clone procedure against the actual campaign before production use. No publishing, promotion, runner registration or AtlasMind dispatcher policy is performed by these commands.

## Recorded native acceptance — 29 September 2026

Foundry 14.368 with no active modules passed the following local scenarios:

| Scenario | Verified result |
| --- | --- |
| Fresh candidate package | All six actor types, embedded equipment, scene and compendium created; damage 2 → 5 → undo 2 persisted after reload. |
| Released 0.2.1 world → candidate | Actor/token identities, custom portraits, bearings, dimensions, linked/unlinked tokens, private journal, chat and compendium values preserved; effect/undo and reload passed. |
| Released 0.3.0 world → candidate | The same preservation and effect/undo checks passed. |
| Separate backup restoration for each baseline | Each stopped-world backup reopened with its original release and preserved the captured values. |

All scenarios reported zero browser page errors. The 0.2.1 baseline archive SHA-256 was `f9b5b32d4ac1439a1c6d941d89466bb706d0af7d9c87a7b63f5e921310ff42dc`; 0.3.0 was `d73ea7f9441772af159ec5857d0b5e91009ca2cbdae1b8bf65668ca8f2b234ae`. Private evidence is retained by the tester under `run-pOXC7s/results.json`, including the exact tested candidate archive hash. This records the recovery lane's candidate; an integrated release must rerun the harness against its own built archive.
