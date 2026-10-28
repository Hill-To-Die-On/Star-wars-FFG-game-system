# SW Adversaries import

The SW Adversaries importer brings material from [SW Adversaries](https://swa.stoogoff.com/) into a private Foundry world. It is for GMs who want ready-made NPC and vehicle statistics: the importer creates native actors, resolves weapons from the site's separate catalogue and keeps the full source records as private GM notes. It is a one-way import, not account synchronisation.

## Import the full site collections

1. With Node 24 or later, run this from a checkout of the system repository:

   ```sh
   npm run import:swa
   ```

   This reads the site's current published version and its adversaries, weapons, talents, qualities, skills and vehicles collections. It writes `.local/swa-source.json`, which is excluded from Git and from releases. The site does not send the cross-origin header a browser needs to fetch it directly, so this preparation step runs locally.

2. In Foundry, open **Configure Settings → Star Wars FFG → SW Adversaries → Import adversaries**.
3. Select the prepared file, keep **Private GM source notes** enabled, review the counts and import.
4. Drag the new actors from the world compendium into the Actors directory or onto a scene. Set the group size for minions.

## Import a smaller selection

The site's **Copy → Mine → Export** workflow produces a `swa-data.json` file containing your chosen entries. The importer also accepts a single adversary object or an upstream adversary array.

Without the separate collections, some named weapons and rules may stay unresolved. Files are limited to 10 MB and 2,000 adversaries.

## What is converted

The importer keeps characteristics, wounds, strain, soak, defence, Force rating, skill ranks, minion group skills, complete weapons, talent names and ranks, ability names, vehicle profiles and source tags. Alternative Lightsaber characteristics are kept.

- NPC skill ranks above the player purchase cap are preserved. Player advancement still stops at rank 5.
- Missing book pages stay empty, and unknown book codes remain visible.
- A weapon with missing or unsupported fields becomes a reference item rather than a usable zero-damage weapon.
- Unknown skills and missing actor statistics are flagged.
- Unsupported actor types keep their private notes but are not given an invented native type.
- Named attached vehicles are kept as references. The vehicle collection creates separate vehicle sheets; it does not guess occupants or scene placement.

Talent and ability descriptions inform the GM; their mechanical effects still need adjudication.

### What a full import contains

Site version **2.2.10** supplied 1,346 adversaries, 74 weapons, 755 talents and abilities, 40 qualities, 43 skills and 51 vehicles: **2,309 private source records** in total. Conversion produced **1,345 NPCs and 51 vehicles**, resolved 907 named weapon references and kept 312 incomplete weapon references as reference items. Twelve NPCs have missing or unrecognised statistics, and one record has no adversary type. These are import coverage figures, not evidence of complete encounter automation.

## Keep source text private to the GM

When **Private GM source notes** is enabled, every supplied description, note, gear text, ability explanation, talent rule, weapon-quality rule and other source field is kept in a **Private GM source notes** journal compendium. Related records are attached to each adversary's notes. Their HTML is escaped, and the material is treated as reference data, never as instructions. Open an actor's notes from **Equipment & abilities → GM source notes**.

Native actors contain only statistics, names and references. Source prose is protected as follows:

- It is encrypted with AES-GCM before it enters the separate compendium. The key stays in a client-scoped setting in the GM's browser.
- Foundry compendium permissions hide the interface but do not prevent direct document retrieval, so the stored pages contain only a placeholder and authenticated ciphertext. Public source names remain as reference labels.
- Player and trusted-player permissions on the compendium are set to None.
- Browser encryption requires HTTPS or localhost.
- Images and remote assets are not downloaded. Any URLs in the source remain references.

You can leave private notes out by clearing the import checkbox.

### Search the notes

Use **GM source library** in the system settings to search all unlocked notes, including standalone weapon, talent, quality and skill records.

### Back up the key

Choose **GM source key → Download key backup** to save the key. Restore the backup on another GM browser, or after clearing browser data. Keep it out of public repositories and share it only with trusted GMs.

A world backup contains the encrypted notes but not the browser key. Without the original key the library stays locked; the system never generates a replacement key over existing encrypted notes.

## Re-import

Re-importing preserves existing compendium entries and links actors to their private source notes. It does not overwrite manual changes or silently refresh older rules.

## Use with Director of Realms

The [Director of Realms adapter](director-of-realms.md) exposes decrypted source prose, including vehicle notes, only to GM users. Its narrative-statistics prompt includes up to 16,000 characters per actor. The complete record is available through the actor context and `game.system.api.searchGMSourceNotes(query)`.

## Provenance

The [upstream repository](https://github.com/stoogoff/sw-adversaries) contains a React application, static JSON data and browser export support. No documented service API or dataset redistribution licence was found when the repository was reviewed. This project publishes only its independently written importer. The site's implementation and dataset are not bundled with the system; fetched material stays in your private world.

## Limitations

- Talent and ability effects are descriptive and still need GM adjudication.
- Incomplete weapon references, unknown skills and unrecognised statistics need manual review before play.
- The importer does not place vehicles on scenes or assign their occupants.
- Losing the GM source key without a backup leaves the private notes permanently locked.
