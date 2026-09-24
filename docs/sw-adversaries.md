# SW Adversaries connection

Star Wars FFG imports source material from [SW Adversaries](https://swa.stoogoff.com/) into a private Foundry world. The importer creates native NPC and vehicle statistics, resolves weapons from the separate catalogue, and retains the full source records and related explanations for the GM. It is a one-way import, not account synchronisation.

## Import the site collections

With Node 24 or later, run from this checkout:

```sh
npm run import:swa
```

This reads the site's current published version and its adversaries, weapons, talents, qualities, skills and vehicles collections. It writes `.local/swa-source.json`, which is excluded from Git and releases. The site does not supply the cross-origin response header needed for a direct browser fetch, so this preparation step runs locally.

In Foundry, choose **Configure Settings → Star Wars FFG → SW Adversaries → Import adversaries**. Select the prepared file, keep **private GM source notes** enabled, review the counts and import. Drag native actors from the world compendium into the Actors directory or onto a scene. Set group size for minions.

For a smaller selection, the site's **Copy → Mine → Export** workflow produces `swa-data.json`. Single adversary objects and upstream adversary arrays are also accepted. Without the separate collections, named weapons and rules may remain unresolved. Files are limited to 10 MB and 2,000 adversaries.

## GM knowledge and player visibility

All supplied descriptions, notes, gear text, ability explanations, talent rules, weapon-quality rules and other source fields are retained in a **Private GM source notes** journal compendium when enabled. Related records are attached to each adversary's notes. Their HTML is escaped, and source material is treated as reference data rather than instructions. The GM can open an actor's **Equipment & abilities → GM source notes** button.

Native actors contain statistics, names and references. Source prose is encrypted with AES-GCM before entering the separate compendium; the key stays in a client-scoped setting in the GM's browser. Foundry compendium permissions hide the interface but do not prevent direct document retrieval, so the stored pages contain only a placeholder and authenticated ciphertext. Public source names remain reference labels. Player and trusted-player compendium permissions are also set to None. The DoR adapter exposes decrypted prose only for GM users, including vehicle notes. Its narrative-stat prompt includes up to 16,000 characters per actor; the complete retained record is available through actor context and `game.system.api.searchGMSourceNotes(query)`. Images and remote assets are not downloaded; any URLs in the source remain references.

Use **GM source library** in system settings to search all unlocked notes, including standalone weapon, talent, quality and skill records. **GM source key → Download key backup** saves the key privately. Restore that backup on another GM browser or after clearing browser data. Without the original key, the library stays locked; no replacement key is generated over existing encrypted notes. Keep the backup outside public repositories and share it only with trusted GMs. HTTPS or localhost is required for browser encryption. A world backup contains encrypted notes but not the browser key.

Re-importing preserves existing compendium entries and links actors to their private source notes. It does not overwrite manual changes or silently refresh old rules. Private notes can be omitted using the import checkbox.

## Statistics and review

The converter retains characteristics, wounds, strain, soak, defense, Force rating, skill ranks, minion group skills, complete weapons, talent names/ranks, ability names, vehicle profiles and source tags. Alternative Lightsaber characteristics are retained. Explicit NPC ranks above the player purchase cap are preserved; player advancement still stops at rank 5. Missing book pages stay empty and unknown book codes remain visible.

Missing or unsupported weapon fields produce reference items instead of usable zero-damage weapons. Unknown skills and missing actor statistics are flagged. Unsupported actor types retain private notes but are not assigned an invented native type. Talent and ability descriptions inform the GM; their mechanical effects still require adjudication. Named attached vehicles are retained as references; the vehicle collection creates separate sheets without guessing occupants or scene placement.

The published site version **2.2.10** supplied 1,346 adversaries, 74 weapons, 755 talents/abilities, 40 qualities, 43 skills and 51 vehicles: **2,309 private source records**. Conversion produced **1,345 NPCs and 51 vehicles**, resolved 907 named weapon references and retained 312 incomplete weapon references. Twelve NPCs have missing or unrecognised statistics; one record lacks an adversary type. These are import coverage counts, not evidence of complete encounter automation or an autonomous campaign.

## Provenance

The [upstream repository](https://github.com/stoogoff/sw-adversaries) contains a React application, static JSON data and browser export support. No documented service API or dataset redistribution licence was found in the repository inspected at commit `9f057a470744d5de01addbbafa7699273a96dcad`. This project publishes its independently written importer. The site's implementation and dataset are not bundled in the public system; fetched material stays in the private world.
