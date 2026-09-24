# SW Adversaries connection

Starfall imports local JSON from [SW Adversaries](https://swa.stoogoff.com/).
This is a one-way file import, not a live API or synchronised account connection.
It produces native minion, rival and nemesis actors for the world compendium.

## At the table

1. On SW Adversaries, open an adversary and use **Copy** to save a custom version
   in **Mine**. Repeat for the desired encounter. Its export contains the custom
   collection, not every adversary on the website.
2. Export that collection to `swa-data.json`.
3. In Foundry, choose **Configure Settings → Starfall → SW Adversaries → Import
   adversaries**, select the JSON file, review the counts and import it.
4. Drag the resulting actor from the world actor compendium into the Actors
   directory or onto a scene. For a minion group, set its group size on the sheet.

Existing compendium entries are preserved by stable source ID. Re-importing does
not overwrite changes. This importer also accepts the array files in the
upstream repository's `src/media/data/adversaries/` directory, or a single
adversary object. A file is limited to 10 MB and 2,000 adversaries.

## What crosses the connection

Characteristics, wound and strain thresholds, soak, defense, skill ranks or
minion group skills, complete weapon statistics, talent names/ranks, ability
names, and available book tags are retained. Minion wounds are stored per member;
the sheet calculates group state. Unknown book codes remain visible as codes.
Missing page numbers are left empty.

Descriptions, notes, gear prose, ability explanations and images are omitted.
Weapon names without their separately stored statistics become reference items;
replace those references with the matching weapon from the private equipment
compendium after checking the book. Vehicles attached by name require a separate
vehicle import. Missing actor statistics remain flagged. Talent and ability
effects still need source review and manual application.

Director of Realms receives the native actor statistics plus these equipment and
ability references through Starfall's adapter. This does not complete DoR's
range-band attack workflow or prove an autonomous adventure play-through.

## Provenance and validation

The published [source repository](https://github.com/stoogoff/sw-adversaries)
contains a React application, static JSON data and a browser export function.
No documented service API or dataset redistribution licence was found in the
repository inspected at commit `9f057a470744d5de01addbbafa7699273a96dcad`.
Starfall ships an independently written format converter; it does not ship the
website's implementation or dataset. Imports stay in the local Foundry world.

The format was exercised against 12 records in `escapemosshuuta.json`, five in
`whisper-base.json`, and 17 in `mountaintoprescue.json`. These files can include
follow-on adventure adversaries. All 34 had the required actor statistics;
31 weapon entries were unresolved name references. These counts are format
validation, not a claim of complete encounter or rules coverage.
