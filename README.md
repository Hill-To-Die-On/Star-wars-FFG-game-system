# Star Wars FFG

A free, independent **Foundry VTT 14** game system for campaigns using **Edge of the Empire**, **Age of Rebellion**, and **Force and Destiny**, separately or together. Published by Hill To Die On.

Original sheets and interface, with familiar narrative dice symbols from an attributed community source. The complete creator-authorized reference database is included: **6,662 rows across 44 tables**, with statistics, creator notes and book/page references. Rulebooks, adventure text and official illustrations are not distributed. The books remain necessary. Star Wars FFG is not affiliated with or endorsed by Lucasfilm, Fantasy Flight Games, Asmodee, or EDGE Studio.

## Install

Use this manifest in Foundry's **Install System → Manifest URL**:

```text
https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/releases/latest/download/system.json
```

Create a world using **Star Wars FFG**. Enable **Dice So Nice 6.3.1 or later** for animated custom dice. Its absence does not disable rolls or chat results.

The compact seven-die tray beside the chat bar supports quick ad-hoc pools and follows Foundry's public, GM, blind and self chat buttons. Each player can hide it under **Configure Settings → Star Wars FFG → Compact dice tray by chat**.

## At the table

- Character, minion, rival, nemesis, vehicle and **Group** sheets use an original print-inspired layout and paper texture. Automatic mode maps Edge characters to Frontier, Age characters to Rebellion and Force characters to Mystic; vehicles and Groups follow the campaign's first enabled ruleset. **Default sheet theme** can override automatic selection for one client, and each sheet can make its own final choice.
- **Foundry interface theme** applies the same three schemes across a losslessly bundled public-domain NASA artist's concept of Saturn beyond Enceladus's geysers, locally bundled interface typography, custom sidebar and pause icons, chat cards, combat tracker, scene tools, player list, hotbar, windows, journals and handouts. It can follow the campaign automatically, use a manually selected scheme or leave Foundry's standard interface untouched. Authored scene artwork remains unobscured.
- The paper-style Skills tab keeps all 35 standard skills, pools, characteristics, career/group marks, ranks and XP controls in one desktop view. Each user can switch between rulebook-style groups and a single A–Z list; both retain the balanced three-column layout. Its `+` control adds as many persistent custom skills as a character needs, with edit/remove controls, XP advancement and the same automatic/manual roll workflow.
- Group records include a **Base of Operations**, members, Obligation, optional Duty/Morality, motivations, resources, possessions, contacts and the world's shared Destiny pool. Link characters and use **Sync linked characters** to refresh their recorded story scores.
- All seven narrative dice, standard symbol faces, separate result axes, Triumph/Despair retention, and upgrades/downgrades.
- Skills, wounds, strain, defense, Force dice, inventory, vehicle condition and shields.
- **Configure Settings → Star Wars FFG → Campaign rules & adventure state** lets the GM enable any one, two or all three rule lines; new worlds enable all three. It also selects story mechanics and beginner teaching mode, and moves completed characters into play when the adventure starts.
- **Reference catalogue** searches the full database. **Owned books** lets the GM select sources from 45 book titles; that selection filters the catalogue for the GM and players, the reference API, starting choices and future imports. **Populate compendiums** creates native documents for the selected books.
- **Dice & Destiny** opens the pool builder and the persistent shared Destiny pool.
- The dedicated **Star Wars FFG · Range bands** scene control draws labelled colour bands from a selected token. It follows the latest selection or retains multiple origins, measures Personal, Battlefield/planetary and Ship/vehicle/space scales, uses a battlemap's configured grid scale, and stores independent click calibrations for gridless Theatre-of-the-Mind scenes. Scaled-map target checks include token elevation and Foundry sight walls; a blocked shot stops the automatic roll while the prefilled Manual pool remains available for a GM ruling. A measured target range feeds the ordinary automatic dice-pool builder and the public/DoR APIs. See [range bands](docs/range-bands.md).
- **Private library** imports local JSON into world compendiums. Importing again preserves existing entries.
- **SW Adversaries** imports [site collections or local exports](docs/sw-adversaries.md) as native adversaries and vehicles. Descriptions, ability rules, motivations and related source records are retained in a private GM compendium and supplied to the DoR adapter.
- **GM source library** searches decrypted source notes. **GM source key** backs up or restores the browser-held key needed to unlock them; source prose is encrypted before world storage.
- The Advancement tab displays every owned specialization as an interactive tree. The public catalogue supplies graph positions, links, XP costs, source references and declarative effects without copied source prose. Private node guidance can fill the boxes when the GM imports it locally. Click an eligible talent to spend XP; purchased and shared unranked talents are marked. Structured passive talent effects marked **Auto** feed both sheet and API dice pools. Each tree separately labels structural validation and its printed-chart comparison state.
- Signature abilities attach to an eligible owned career specialization. Their base node stays locked until a matching bottom-row talent is learned, after which the connected upgrades use the same click-to-buy XP ledger. The supplied private data provides 36 of 38 graphs; the coverage register names the two charts still needed.
- The Story tab supports any number of structured motivations with category, active/dormant state, player/GM guidance and book reference. The freeform legacy field remains available. Dragging a motivation reference from a privately enriched library carries its local guidance onto the character.
- Searchable Species and Career controls accept only playable, complete entries from the enabled database sources. Species fills characteristics, starting XP, soak and wound/strain thresholds; Career marks its career skills and derives the starting rules from its source within the GM's enabled campaign lines. Completing creation adds the first specialization and free ranks, applies the selected Obligation, Duty or Morality benefit, and opens an owned-book-filtered equipment picker with live cash and gear-allowance validation. Purchased equipment becomes native actor Items, unspent credits are retained, and a one-time d100 pocket-money roll is recorded in chat. Species and starting Career then lock. Exceptional species rules remain flagged for reference review.

This is an initial development release. The public advancement catalogue supplies 135 specialization graphs and 36 of 38 signature-ability graphs, totalling 3,024 copyright-bounded nodes. Privately held pages support 143 full node/cost/connector comparisons; the other 30 charts remain explicitly pending. The private dataset can add local guidance for all 2,700 specialization nodes, most supplied signature nodes, 298 motivation references and structured pool automation for 28 unique passive talents. Other active or situational effects, weapon qualities, critical-injury consequences, cover and terrain, starship maneuvers and expansion subsystems still require an explicit player/GM decision or source adjudication. Automated checks do not constitute an end-to-end adventure playtest. See [validation](docs/validation.md) and [coverage](docs/source-coverage.md) for the exact evidence and remaining gaps.

## Reference library and private chart import

The bundled database needs no import to search. Use **Reference catalogue → Populate compendiums** to create 4,495 Items, 399 vehicle references and 1,701 journals when all books are enabled. The import merges the separate public advancement catalogue into matching specialization and signature items. All 6,662 original rows, including the dice tables, remain available in the catalogue. This database remains an index to the books and does not contain every vehicle statistic or the source wording of talent effects. See [the reference-library guide](docs/reference-library.md).

The optional private workflow adds structured charts and vehicle statistics from locally held sources:

Node 24 or later:

```powershell
npm ci
npm run import:database -- "path/to/database-backup.sql"
python scripts/enrich-library.py "path/to/DataSet_Full DataSet" "path/to/PDF library" --include-private-talent-text
```

The output is `.local/catalog.json`, deliberately excluded from Git and public releases. Select that file using the **Private library** menu. SQL is parsed without executing it. Public database descriptions remain excluded. The optional flag copies locally held specialization, signature-ability and motivation guidance into this private file; it also imports machine-readable passive dice modifiers. Re-importing fills missing tree guidance and effects without replacing user-authored node text. Illustrations and source files are never imported.

The supplied structured sources produced the copyright-bounded public graphs, while private imports can add locally held descriptive guidance. Two signature graphs are absent: Peerless Interception and Unmatched Teamwork. Of 399 vehicles, 312 now have complete public numeric profiles backed by matching structured records, reviewed aliases or held printed pages; the other 87 remain explicitly incomplete rather than receiving guessed values. Full printed-chart verification now covers 111 specialization charts and 32 signature abilities. The photo register identifies the remaining 24 specialization charts and six signature charts; four of those six signatures already have structured graphs that still need comparison.

[Source coverage and photo requests](docs/source-coverage.md) distinguish missing PDFs, partial scans, structurally validated trees and pending comparison with the books. The separate [vehicle source register](docs/vehicle-source-coverage.md) lists every one of the 87 unresolved profiles by book and printed page. The release also includes the machine-readable `data/source-requests.json`, which records exact missing printed-page ranges without source text, artwork or private paths. Unknown vehicle statistics remain marked. Structurally valid graphs support XP paths while their separate printed-comparison label prevents them from being mistaken for fully checked source transcriptions.

## Director of Realms

The system exposes `game.system.api.directorOfRealms` with native actor facts, check guidance, narrative checks, damage handling, campaign configuration, token-to-token range measurement and accessible advancement choices. `readNativeCheckRoll(message)` preserves exact actor/skill context and every narrative result axis without trusting freeform chat notes. `game.system.api.actorContext(actor)` returns structured motivations, learned talent and signature guidance, signature link/unlock state, legal next purchases, verification state and source references. `getCombatRange(sourceToken, targetToken)` reads the same scene scale and calibration as the visible overlay and reports scaled-map elevation plus Foundry sight-wall state. `getCheckTalentRules(actor, skill)` reports automatic modifiers and unresolved decisions before DoR calls `executeCheck`; the same passive modifiers are applied by ordinary character-sheet rolls. `getRulesKnowledgePolicy()` and `getRuleEvidence(query)` require unsupported mechanics to stop for a source review or explicit GM ruling instead of being inferred from general model knowledge.

Director of Realms needs to discover this adapter through its registry. The integration status and installation steps are recorded in [the integration guide](docs/director-of-realms.md). PDF intake remains private through Campaign Studio; it is not part of the public game-system download. A configured AI provider and separate adventure playtests are required before claiming autonomous GM acceptance.

## Public integration API

`game.system.api.integration` lets external character and campaign builders, community-rule sites and companion Foundry modules discover capabilities, validate versioned packages, import or export characters, adversaries, vehicles and Groups, publish declarative Item rule packs and register site connectors. Version-one character and rule packages remain supported; version two adds the wider Actor contract. Small packages can use a direct URL; larger sites can send one package through an exact-origin, nonce-bound browser handoff. Every external handoff is reviewed in the authenticated Foundry client before it changes the world, and imported data cannot install scripts, macros, arbitrary Active Effects or document permissions.

The full interchange schema, website example and API reference are in the [public integration guide](docs/integration-api.md). Community rules appear in a player-readable world compendium; the GM controls imports and whether an existing external rule is preserved or explicitly replaced.

## Development

Start contribution branches from `dev`; maintainer promotion runs through protected `staging` and `main`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, content boundaries, and review evidence, and [the GitHub artifact inventory](.github/REPOSITORY_ARTIFACTS.md) for repository governance, dependency automation, and release assets.

```sh
npm ci
npm test
npm run check
npm run build
```

The release ZIP is `dist/star-wars-ffg.zip`. Its positive allow-list includes runtime files, original and attributed assets, notices, documentation, the two authorized database JSON files, the public advancement catalogue and its verification register. PDFs, SQL backups, private chart prose, adventure passages and SW Adversaries source data remain excluded. `python scripts/generate-dice.py` regenerates the 256px face textures from the attributed community font using Pillow.

API references: [Foundry system development](https://foundryvtt.com/article/system-development/), [Foundry v14](https://foundryvtt.com/api/), [Dice So Nice custom terms](https://riccisi.gitlab.io/foundryvtt-dice-so-nice/api/terms/).

MIT license for original project code and artwork only; third-party content is excluded from that grant.

The interface uses locally bundled Roboto, Signika and Rajdhani fonts. Font licences, dice symbol provenance and retained notices are recorded in [third-party notices](THIRD_PARTY_NOTICES.md).

## Interface artwork credit

The optional interface backdrop is NASA's public-domain *Saturn Through the Veil of Enceladus – Artist's Concept*. Credit: **NASA's Goddard Space Flight Center; art by Dan Gallagher (eMITS)**. A GM client creates the player-visible **Star Wars FFG · Artwork credits** Journal once per world, with the image, credit and a link to the [NASA SVS source and catalogue record](https://svs.gsfc.nasa.gov/14162). Existing Journal content is preserved. Full provenance, source hashes and NASA usage information are retained in [third-party notices](THIRD_PARTY_NOTICES.md).
