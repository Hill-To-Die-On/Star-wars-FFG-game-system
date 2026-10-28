# Reference library and owned books

The reference library is the searchable database of species, careers, talents, equipment, vehicles, adventure seeds and other entries that ships with the system. This guide explains how GMs and players search it, how the GM limits it to the books the table owns, and how it fills in characters and vehicles. It also covers the Group record.

## What is included

The system includes the complete creator-supplied database, distributed with the creator's permission: 44 original tables and 6,662 rows, with names, mechanics, creator notes, relationships and book/page references.

- `data/reference-database.json` keeps those rows and adds evidence-backed vehicle fields and 288 weapon-mount relationships, for 45 tables and 6,950 searchable rows in total.
- The original SQL and Access files are untouched. SQL headers and server configuration are left out, and checksums of the source and overlays record where the data came from.
- `data/reference-library.json` contains 6,595 top-level Foundry documents. Dice-table rows stay as catalogue references, and checked weapon mounts become weapons embedded in their vehicle rather than duplicate standalone Items.

References to books and trademarks do not grant any rights to the underlying works.

## Search the catalogue

1. Open **Reference catalogue** from the system settings or the Actors directory.
2. Type a search. It matches every field, including descriptive notes and source references.
3. Narrow the results with the category and book filters. Results are paginated to keep the window responsive.
4. Select an entry to read all of its stored fields.

### Summaries on entries and sheets

Item, ship and playable-species entries show short original summaries built from their recorded categories, statistics and sources. The summaries leave out unreviewed item effects, ship armament and species abilities, and blank values stay unknown. Item and vehicle sheets show the same summary beside your own editable notes.

Species choices show the recorded starting characteristics, wound and strain bases and XP before you pick one, with the book and page alongside.

### Species abilities

For 95 of the 104 playable catalogue species, the catalogue and character sheet also show the checked ability page and a short summary of the mechanics. Character creation applies checked starting skill ranks and asks for a species skill choice where one is required. Eleven unconditional abilities apply automatically to rolls or to the turn budget. See [species ability coverage](../sources/species-ability-coverage.md) for the list and the nine rows still pending.

### Adventure seeds

The catalogue's 421 adventure-seed records keep their book and page and any creator-supplied hook, career, character, vehicle and place fields. Some have no hook description and remain incomplete. The GM-only Director of Realms seed lookup reads these fields through the same owned-book filter. Source-checked adventure and reward prompts are described in [book play guidance](../integrations/book-play-guidance.md).

## Limit the library to your books

The GM's **Owned books** menu lists 45 titles, with extra space for titles from private imports.

1. Choose **All books**, or choose **Only selected books** and tick the books you want.
2. Decide whether to include entries that have no source reference; this is a separate option.

With **Only selected books** and nothing ticked, no book-sourced records are shown. This is a convenience filter over a public database for the campaign. It is not a licence or an access-control mechanism.

The filter applies, for every connected user, to:

- the catalogue and its search and detail API;
- character creation choices;
- item drops;
- future imports into the public compendiums.

Changing the filter leaves existing characters and previously imported compendium documents as they are. Use Foundry's normal permissions to control who sees those compendiums.

## Populate compendiums

**Populate compendiums** imports every reference the owned-book settings allow, whatever the current search or category filter. With all books enabled, it creates 4,495 Items, 399 vehicle references and 1,701 journals.

- It merges `data/advancement-trees.json` into the matching specialization and signature items, and `data/vehicle-stats.json` into the matching vehicle actors.
- Running it again keeps existing documents and adds any missing structured data.
- A vehicle reference is upgraded only while all seven profile fields are still marked incomplete and still hold their untouched zero placeholders, so play data and your edits are never overwritten.
- A repeat run can add a checked loadout to an older matching vehicle reference that has no weapon Items. Existing component values and custom equipment are kept. This upgrades library references, not vehicles already in play.
- Source data missing from the public overlays stays marked as incomplete, and unknown loadouts keep an `installed weapons` review marker.

## Pick species, careers and vehicle models

The character **Species** and **Career** fields, and the vehicle **Model** and **Manufacturer** fields, search the bundled database directly; importing a compendium is optional.

- Search ignores punctuation and tolerates missing letters.
- By default, only selecting a listed entry changes the actor. Unmatched text is discarded when you leave the field.
- Visible world-library entries take precedence over matching bundled entries, and the GM's book filters still apply.
- Dropdown rows grow to fit wrapped descriptions.
- Character origins stay locked after creation.

The keyboard controls for these fields are described in [Accessibility and performance](accessibility-performance.md).

### Background questions

The character **Story** tab offers original, optional background questions for the chosen species and career. **Add to biography** adds the question outline once and keeps anything already written. The questions add no mechanics and do not paraphrase the sourcebooks.

### Choose a vehicle model

Choosing a manufacturer filters the model list without changing the current ship. Choosing a model then:

- fills in its manufacturer, the available profile statistics and the source reference;
- updates its default portrait and token;
- gives it a permanent random registration, if it has none;
- names an unnamed vehicle `Model · Registration`. The name stays editable, and later model changes keep a custom name.

Missing profile data stays marked as incomplete. Current damage, strain, notes, custom art and physical dimensions are kept.

For a source-checked model, selection also fills in the recorded sensors, navigation, backup hyperdrive and consumables, and adds its standard weapons as equipped Items. Each mount keeps its quantity, firing arcs, scale, qualities and exact source page.

- A later model change replaces only unchanged system-provided weapons; weapons you added or modified stay.
- Re-selecting the same model does not duplicate mounts.
- A confirmed unarmed profile is shown differently from an unknown loadout.
- Structured candidates that are still pending review can be found by search with a **Candidate** label, but are never equipped automatically.

Current coverage is listed in [database enrichment](../sources/database-enrichment.md).

## Use homebrew identities

For homebrew adventures, the GM can enable Configure Settings → Star Wars FFG → **Allow homebrew identities**. This world-wide setting is off by default. It adds a **Use "…" as homebrew** choice to all four searchable fields. Actor ownership and character-creation locks still apply, and published choices still follow the campaign's book filters.

A homebrew selection keeps the existing numeric profile for you to edit, clears the replaced database identity and marks the actor for GM review. It does not invent abilities, skills or statistics.

1. Enter the intended values and add any Items.
2. Choose **Finish homebrew setup** to confirm the setup. For a character, this also completes creation and locks Species and Career, without granting XP, free ranks, equipment or talents.

Other missing-source warnings remain. Returning to a published entry clears the homebrew marker. Switching the setting off stops new homebrew selections but keeps existing ones. The system's Director of Realms context identifies homebrew entries and their review state; only recorded structured effects affect automatic dice pools.

## Talent trees and vehicle profiles

The public advancement file contains 135 specialization graphs and all 38 signature graphs: 3,042 nodes with positions, links, XP costs, activation labels, source references and a restricted set of declarative effects. It contains no summaries, descriptions, artwork or local paths. A structurally valid graph is internally usable; `data/source-verification.json` separately records 168 full comparisons with the printed charts and the 5 still pending.

The public vehicle overlay supplies complete numeric profiles for 341 of the 399 vehicle references. Each keeps its exact actor identity and book/page reference, with evidence from an exact structured match, a reviewed alias or a held printed page. Descriptions, artwork, PDF and XML names and local paths are rejected. The remaining 58 records, and the source pages needed to complete them, are listed in [vehicle source coverage](../sources/vehicle-source-coverage.md). The Foot Speeder stays incomplete because its held page gives only a partial profile.

Maintainers rebuild these overlays from local datasets; the commands and the optional private talent-guidance enrichment are described in [database enrichment](../sources/database-enrichment.md#reproduction-and-review).

## Reference API

The API is available to GM tools and player interfaces. Search and detail calls both apply the current campaign filter.

```js
await game.system.api.searchReferences({
  query: "blaster",
  category: "weapons",
  page: 0,
});
await game.system.api.getReference("weapons:123:42"); // Use a key returned by search.
game.system.api.openReferenceBrowser();
```

## Group record

Create an actor of type **Group** to record the party. Its **Base of Operations** holds a name, location and description; further sections record members and their story scores, resources, credits, possessions, contacts and notes.

- Obligation totals are calculated from the member rows.
- Duty and Morality controls follow the campaign settings, so mixed parties work.
- Destiny comes from the existing world setting and updates for all connected users.

You can enter a member by hand or link a visible player character. **Sync linked characters** copies current names, scores and motivations into the group record, keeping player names and descriptions written on the group. Editing the group does not change the character. To let party members edit the record, give them ownership of the Group actor through Foundry's normal permissions.

The fields follow the group sheet in the *Edge of the Empire* core rulebook; the layout and artwork are original. Group context is available through `game.system.api.actorContext(group)` and the Director of Realms adapter's narrative-stat methods. Groups are not combatants.
