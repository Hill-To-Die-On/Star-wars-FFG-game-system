# Backup, upgrade and recovery

This guide is for GMs and server administrators who need to back up a world, upgrade the system or Foundry core, undo a reviewed change, or restore a world. Make a backup before replacing the system or opening an older world in a newer Foundry core.

A document's **Undo** button is a narrow, conflict-checked reversal of one change. It is not a world backup.

## Back up before an upgrade

1. Ask players to finish any pending requests and disconnect. Save any unsaved sheet edits.
2. Write down the Foundry core version, the system version, the installed package archive and its hash, and the active modules.
3. Return the world to Setup and stop the Foundry server.
4. Copy the entire world directory, its compendium packs and every user asset it references. This includes world data such as actors, scenes, chat, journals, settings and workflow ledgers. A copy taken while the LevelDB database is open is not a verified backup.
5. Keep a copy of the matching system package and module versions.
6. Store the server's configuration and licence, and any browser-held encryption keys, separately and privately. Director of Realms private source keys need DoR's own export and recovery procedure; copying the world alone does not prove those notes can be decrypted elsewhere.
7. Keep the original backup untouched. Test a copy in a separate data directory on a separate port, first with third-party modules disabled. Before inviting players, check character identity, inventory, advancement, owned-book settings, linked and unlinked tokens, vehicle crew, compendiums and permissions.

### Back up the GM source key

The system's encrypted source notes need their key. Use Configure Settings → Star Wars FFG → **GM source key** → **Download key backup**, and store that JSON file privately, never alongside a public bug report. When you change browser or machine, restore the original key through the same dialog.

This key is separate from Director of Realms' own keys. The system's automated upgrade and recovery checks do not cover restoring it, so test that yourself before relying on a recovered source library.

### What changes when you upgrade

The system has no single versioned migration runner. Foundry fills in data-model defaults, and the system's start-up hooks can refresh managed procedural artwork and encrypt older private source notes. Custom artwork and token placement must survive these targeted changes.

If you test an unreleased build, keep its archive hash as well as its version number: the version alone does not identify the build.

Vehicle tokens placed in older releases, without the automatic-footprint flag, keep their existing dimensions. Only managed tokens resize when the silhouette or scene scale changes, so older battle maps are not silently altered at start-up. New vehicle tokens opt in automatically. After reviewing an existing token's placement, the GM can opt it in with `game.system.api.actorIcons.resetVehicleTokenFootprint(token)`.

## Undo a reviewed change

Open **Tabletop history** on an actor to undo a committed damage or recovery, a critical or condition record, a vehicle state change or a session award.

Undo compares the current values with the values recorded after the change. If a later edit has altered them, undo refuses to overwrite it. Undo the later change first, or resolve the conflict explicitly.

- Review dialogs compare both the original fields and the derived results. Changing soak, armour or a damage threshold while a confirmation is open cancels its approval, even if wounds are unchanged. Reload all clients after upgrading.
- Each actor change and its history entry are written in a single document update.
- If an acknowledgement is lost and the same operation is sent again, the saved result is returned instead of spending a second time. An undone operation stays undone if it is replayed.
- A timeout with no receipt does not mean the change failed, and is not a reason to repeat it as a new operation. Check the chat and the actor's history first.
- Refunds of narrative symbols and mechanical changes to actors are recorded separately and undone separately.

### For integrations

Older API callers that supply only a before-value snapshot keep that narrower comparison. Integrations should use the versioned full review snapshot from `reviewSnapshot(plan)` in `src/tabletop-workflows.mjs`.

## Restore a world

1. Stop the affected server and keep its current data as evidence.
2. Restore the whole known-good world, its referenced assets and the matching package and core versions into a new data directory.
3. Open and check the restored copy before replacing any working installation.

Do not downgrade a migrated database in place, and do not combine database files from different backups. Recovering from a core upgrade needs the matching core backup as well as the system package.

## Limitations

- The system's automated upgrade and recovery checks use synthetic test worlds. They do not certify every existing campaign, third-party module, Director of Realms encryption key, operating-system backup tool or Foundry core upgrade. Rehearse the backup and restore procedure on a copy of your real campaign before relying on it.
- The checks do not cover restoring the encrypted GM source key.

## Reporting a problem

Never attach private notes, keys, licensed PDFs, logs or world databases to a public issue or release. Report the core and system versions, a sanitised error message and the steps that led to it instead.
