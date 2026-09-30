# Reference library and owned books

The public system includes the complete creator-supplied database with permission: 44 original tables and 6,662 rows, including names, mechanics, creator notes, relationships and book/page references. `data/reference-database.json` preserves those rows and adds evidence-backed vehicle fields and 288 weapon-mount relationships: 45 tables and 6,950 searchable rows in total. The original SQL and Access files remain untouched. SQL headers and server configuration are excluded; source and overlay checksums record provenance. `data/reference-library.json` still contains 6,595 top-level Foundry documents. Dice-table rows remain catalogue references, and checked mount rows become embedded vehicle weapons rather than duplicate standalone Items.

Open **Reference catalogue** from system settings or the Actors directory. Search matches all fields, including descriptive notes and source references. Select an entry to read every stored field. Category and book filters narrow results; pagination keeps the interface responsive.

The catalogue's 421 adventure-seed records retain their book/page and any creator-supplied hook, career, character, vehicle and place fields. Some entries have no hook description and remain incomplete. The GM-only Director of Realms seed lookup exposes these fields through the same owned-book filter. Source-checked adventure and reward prompts are described in [book play guidance](book-play-guidance.md).

Item, ship and playable-species entries also show short original summaries built from recorded categories, statistics and source fields. The summaries omit unreviewed item effects, ship armament and species abilities; blank values stay unknown. Item and vehicle sheets display the same summaries beside editable personal notes. Species choices show recorded starting characteristics, wound/strain bases and XP before selection, with the book/page alongside them.

For 38 book-checked playable species, the catalogue and character sheet also display the source ability page and short mechanics summaries. Character creation applies checked starting skill ranks and prompts for a species skill choice where required. Umbaran, Balosar and Arcona have unconditional check bonuses applied to native rolls; Harch, Quermian and Xexto receive their additional free maneuver in the turn budget. The remaining checked abilities are labelled for situational application; the other 66 playable species retain a source-review warning. [Species ability coverage](species-ability-coverage.md) records the checked books, pages and limits.

The GM's **Owned books** menu offers 45 titles. Choose **All books**, or **Only selected books** and check the desired books. Selecting no books in the latter mode shows no book-sourced records. A separate option includes entries without a source reference. Additional titles accommodate private imports. This is a campaign convenience filter over a public database, not a licence or access-control mechanism.

The filter applies to the catalogue and its search/detail API for every connected user, character creation choices, item drops and future public compendium imports. Existing characters and previously imported compendium documents are preserved when the filter changes. The GM can use ordinary Foundry permissions to control those compendiums.

**Populate compendiums** imports all references allowed by the owned-book settings, regardless of the current search/category filter. It merges `data/advancement-trees.json` into matching specialization and signature items and `data/vehicle-stats.json` into matching vehicle Actors. Repeated imports preserve existing documents and add missing structured enrichment. A vehicle is upgraded only while all seven profile fields are still marked incomplete and retain their untouched zero placeholders, so play data and user edits are not overwritten. With all books enabled, this creates 4,495 Items, 399 vehicle references and 1,701 journals. Source data absent from the public overlays remains marked as incomplete.

Character Species and Career fields, and vehicle Model and Manufacturer fields, search the bundled database immediately; a separate compendium import is optional. Search ignores punctuation and supports missing letters. By default, only selecting a listed entry changes the actor; unmatched text is discarded on leaving the field. Visible world-library entries override matching bundled identities, and the GM's rulebook filters still apply. Character origins remain locked after creation. Dropdown rows grow with their wrapped descriptions so separators stay below all of the text.

The character Story tab offers original, optional background questions for the selected species and career. **Add to biography** appends a question scaffold once and preserves existing writing. These prompts do not add mechanics or claim to paraphrase the sourcebook descriptions.

Choosing a vehicle manufacturer filters the model choices without changing the current ship. Choosing a model then fills its manufacturer, available profile statistics and source reference, and updates its default portrait and token. Missing profile data remains explicitly incomplete. Current damage, strain, notes, custom art and physical dimensions are preserved. Every selected model receives a persistent random registration if none exists. An unnamed vehicle uses `Model · Registration` as its default name; the Name field remains editable, and later model changes preserve a custom name.

For a source-checked model, selection also fills recorded sensors, navigation, backup hyperdrive and consumables, and adds the standard weapons as equipped Items. Each mount retains its quantity, firing arcs, scale, qualities and exact source page. Only unchanged system-provided weapons are replaced on a later model change; hand-added or modified weapons remain. Re-selecting a model does not duplicate mounts. A confirmed unarmed profile is distinguished from an unknown loadout. Pending structured candidates are searchable with a **Candidate** label but never automatically equipped. See [database enrichment](database-enrichment.md) for current coverage and reproduction commands.

Repeating **Populate compendiums** can enrich an older matching vehicle reference with a checked loadout while it contains no weapon Items. Existing component values and custom equipment are preserved; this upgrades library references, not vehicles already in play. Unknown loadouts retain an `installed weapons` review marker.

For homebrew adventures, the GM can enable **Game Settings → Star Wars FFG → Allow homebrew identities**. This world-wide override is off by default and adds an explicit **Use “…” as homebrew** choice to all four searchable fields. Actor ownership and character-creation locks still apply. Existing custom entries survive switching the setting off; doing so stops new custom selections. Published choices continue to use the campaign's book filters.

A custom selection retains the existing numeric profile for manual editing, clears the replaced database identity and marks the actor for GM review. It does not invent abilities, skills or statistics. After entering the intended values and any Items, the GM uses **Finish homebrew setup** to acknowledge that setup; for characters this also completes creation and locks Species and Career without granting XP, free ranks, equipment or talents. Other missing-source warnings remain. Returning to a published entry clears the corresponding homebrew marker. The system's Director of Realms context identifies custom entries and their review state; only recorded structured effects affect automatic pools.

The public advancement file contains 135 specialization graphs and 38 of 38 signature graphs: 3,042 nodes with positions, links, XP costs, activation labels, source references and allowlisted declarative effects. It contains no summaries, descriptions, artwork or local paths. Structural validation means the graph is internally usable; `data/source-verification.json` separately records 168 full printed-chart comparisons and the 5 remaining pending comparisons.

The public vehicle overlay supplies complete numeric profiles for 312 of the 399 native vehicle references. Every profile keeps its exact Actor identity and book/page reference, with evidence for an exact structured match, reviewed alias or held printed-page transcription. Descriptions, artwork, PDF/XML names and local paths are rejected. The remaining 87 records and the exact source pages needed to resolve them are listed in [vehicle source coverage](vehicle-source-coverage.md); the Foot Speeder remains incomplete because its held page contains only a partial profile.

Maintainers can reproduce the overlay from compatible local XML datasets. An optional ignored `.local/vehicle-source-overrides.json` may hold numeric values transcribed from owned printed pages; the publisher refuses overrides outside `.local` and emits only the bounded public mechanics.

```powershell
npm run publish:vehicles -- "path/to/first/dataset" "path/to/second/dataset"
```

The optional local enrichment command adds player guidance, motivation guidance and further structured passive modifiers only to `.local/catalog.json`. Use `--include-private-talent-text` when the locally held dataset may be used for the current table. The public repository and release archive never contain that source wording. Importing the private file fills missing node guidance and effects while preserving user-authored specialization text and graph edits.

The API is available to GM tools and player interfaces:

```js
await game.system.api.searchReferences({
  query: "blaster",
  category: "weapons",
  page: 0,
});
await game.system.api.getReference("weapons:123:42"); // Use a key returned by search.
game.system.api.openReferenceBrowser();
```

Both search and detail calls apply the current campaign filter. The public database is distributed with its creator's permission; references to books and marks do not grant rights to those underlying works.

## Group record

Create an Actor of type **Group**. Its Base of Operations records name, location and description; the remaining sections record members and story scores, resources, credits, possessions, contacts and notes. Obligation totals are calculated from member rows. Duty and Morality controls follow the campaign settings, allowing mixed parties. Destiny comes from the existing world setting and updates on connected clients.

A member can be entered manually or linked to a visible player character. **Sync linked characters** copies current names, scores and motivations into the group record, preserving player names and group-authored descriptions. Editing the group does not modify the character. Give party members ownership of this Actor through Foundry's normal permissions to share editing.

Field coverage was checked against the unpaginated group sheet at PDF page 456 of the supplied Edge of the Empire core PDF. The layout and artwork are original. Group context is exposed by `game.system.api.actorContext(group)` and the DoR adapter's narrative-stat methods; group records are not combatants.
