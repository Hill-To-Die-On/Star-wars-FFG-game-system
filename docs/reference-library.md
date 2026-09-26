# Reference library and owned books

The public system includes the complete creator-supplied database with permission: 44 tables and 6,662 rows, including names, mechanics, creator notes, relationships and book/page references. `data/reference-database.json` preserves all row fields and null values. SQL headers and server configuration are excluded. A source checksum records provenance. `data/reference-library.json` is the corresponding Foundry import bundle; its 6,595 documents exclude 67 dice-table rows that remain searchable in the catalogue.

Open **Reference catalogue** from system settings or the Actors directory. Search matches all fields, including descriptive notes and source references. Select an entry to read every stored field. Category and book filters narrow results; pagination keeps the interface responsive.

The GM's **Owned books** menu offers 45 titles. Choose **All books**, or **Only selected books** and check the desired books. Selecting no books in the latter mode shows no book-sourced records. A separate option includes entries without a source reference. Additional titles accommodate private imports. This is a campaign convenience filter over a public database, not a licence or access-control mechanism.

The filter applies to the catalogue and its search/detail API for every connected user, character creation choices, item drops and future public compendium imports. Existing characters and previously imported compendium documents are preserved when the filter changes. The GM can use ordinary Foundry permissions to control those compendiums.

**Populate compendiums** imports all references allowed by the owned-book settings, regardless of the current search/category filter. It also merges `data/advancement-trees.json` into matching specialization and signature items. Repeated imports preserve existing documents and add missing structured enrichment without replacing user-authored guidance. With all books enabled, this creates 4,495 Items, 399 vehicle references and 1,701 journals. Source data absent from both public datasets remains marked as incomplete.

The public advancement file contains 135 specialization graphs and 36 of 38 signature graphs: 3,024 nodes with positions, links, XP costs, activation labels, source references and allowlisted declarative effects. It contains no summaries, descriptions, artwork or local paths. Structural validation means the graph is internally usable; `data/source-verification.json` separately records 143 full printed-chart comparisons and the 30 remaining pending comparisons.

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
