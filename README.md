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
- **Foundry interface theme** applies the same three schemes across an original cinematic space backdrop, locally bundled interface typography, custom sidebar and pause icons, chat cards, combat tracker, scene tools, player list, hotbar, windows, journals and handouts. It can follow the campaign automatically, use a manually selected scheme or leave Foundry's standard interface untouched. Authored scene artwork remains unobscured.
- The paper-style Skills tab keeps all 35 standard skills, pools, characteristics, career/group marks, ranks and XP controls in one desktop view. Each user can switch between rulebook-style groups and a single A–Z list; both retain the balanced three-column layout. Its `+` control adds as many persistent custom skills as a character needs, with edit/remove controls, XP advancement and the same automatic/manual roll workflow.
- Group records include a **Base of Operations**, members, Obligation, optional Duty/Morality, motivations, resources, possessions, contacts and the world's shared Destiny pool. Link characters and use **Sync linked characters** to refresh their recorded story scores.
- All seven narrative dice, standard symbol faces, separate result axes, Triumph/Despair retention, and upgrades/downgrades.
- Skills, wounds, strain, defense, Force dice, inventory, vehicle condition and shields.
- **Configure Settings → Star Wars FFG → Campaign rulebooks** selects rule lines, story mechanics and beginner teaching mode.
- **Reference catalogue** searches the full database. **Owned books** lets the GM select sources from 45 book titles; that selection filters the catalogue for the GM and players, the reference API, starting choices and future imports. **Populate compendiums** creates native documents for the selected books.
- **Dice & Destiny** opens the pool builder and the persistent shared Destiny pool.
- **Private library** imports local JSON into world compendiums. Importing again preserves existing entries.
- **SW Adversaries** imports [site collections or local exports](docs/sw-adversaries.md) as native adversaries and vehicles. Descriptions, ability rules, motivations and related source records are retained in a private GM compendium and supplied to the DoR adapter.
- **GM source library** searches decrypted source notes. **GM source key** backs up or restores the browser-held key needed to unlock them; source prose is encrypted before world storage.
- The Advancement tab displays every owned specialization as an interactive tree. Privately imported node guidance appears inside each box. Click an eligible talent to spend XP; purchased and shared unranked talents are marked. Structured passive talent effects marked **Auto** feed both sheet and API dice pools.
- Signature abilities attach to an eligible owned career specialization. Their base node stays locked until a matching bottom-row talent is learned, after which the connected upgrades use the same click-to-buy XP ledger. The supplied private data provides 36 of 38 graphs; the coverage register names the two charts still needed.
- The Story tab supports any number of structured motivations with category, active/dormant state, player/GM guidance and book reference. The freeform legacy field remains available. Dragging a motivation reference from a privately enriched library carries its local guidance onto the character.
- Starting character choices apply the selected species and career, free skill ranks, the first specialization, and starting XP. Exceptional species rules require reference review. Purchases are recorded in the actor.

This is an initial development release. The private dataset supplies guidance for all 2,700 imported specialization nodes, most supplied signature-ability nodes, 298 motivation references and structured pool automation for 28 unique passive talents. Six signature graphs have incomplete node guidance, and two signature charts are absent. Other active or situational effects, weapon qualities, critical-injury consequences, range adjudication, starship maneuvers and expansion subsystems still require an explicit player/GM decision or source adjudication. Automated checks do not constitute an end-to-end adventure playtest. See [validation](docs/validation.md) and [coverage](docs/source-coverage.md) for the exact evidence and remaining gaps.

## Reference library and private chart import

The bundled database needs no import to search. Use **Reference catalogue → Populate compendiums** to create 4,495 Items, 399 vehicle references and 1,701 journals when all books are enabled. All 6,662 original rows, including the dice tables, remain available in the catalogue. This database is an index to the books: it does not contain every vehicle statistic or connected talent chart. See [the reference-library guide](docs/reference-library.md).

The optional private workflow adds structured charts and vehicle statistics from locally held sources:

Node 24 or later:

```powershell
npm ci
npm run import:database -- "path/to/database-backup.sql"
python scripts/enrich-library.py "path/to/DataSet_Full DataSet" "path/to/PDF library" --include-private-talent-text
```

The output is `.local/catalog.json`, deliberately excluded from Git and public releases. Select that file using the **Private library** menu. SQL is parsed without executing it. Public database descriptions remain excluded. The optional flag copies locally held specialization, signature-ability and motivation guidance into this private file; it also imports machine-readable passive dice modifiers. Re-importing fills missing tree guidance and effects without replacing user-authored node text. Illustrations and source files are never imported.

The supplied private sources produced 135 structurally validated specialization references and 36 structurally validated signature-ability graphs. Two signature charts are absent: Peerless Interception and Unmatched Teamwork. Of 399 vehicles, 162 have matched structured statistics; the other 237 remain explicitly incomplete pending source checks. These enrichments are separate from the public database. Missing specialization coverage identifies 24 chart pages across four books, plus three standalone charts from a fifth book whose full PDF is absent.

[Source coverage and photo requests](docs/source-coverage.md) distinguish missing PDFs, structurally validated trees and pending comparison with the books. Unknown vehicle statistics remain marked, and unverified graphs cannot spend XP.

## Director of Realms

The system exposes `game.system.api.directorOfRealms` with native actor facts, check guidance, narrative checks, damage handling, campaign configuration and accessible advancement choices. `game.system.api.actorContext(actor)` returns structured motivations, learned talent and signature guidance, signature link/unlock state, legal next purchases and source references. `getCheckTalentRules(actor, skill)` reports automatic modifiers and unresolved decisions before DoR calls `executeCheck`; the same passive modifiers are applied by ordinary character-sheet rolls.

Director of Realms needs to discover this adapter through its registry. The integration status and installation steps are recorded in [the integration guide](docs/director-of-realms.md). PDF intake remains private through Campaign Studio; it is not part of the public game-system download. A configured AI provider and separate adventure playtests are required before claiming autonomous GM acceptance.

## Public integration API

`game.system.api.integration` lets external character builders, community-rule sites and companion Foundry modules discover capabilities, validate versioned packages, import or export player characters, publish declarative Item rule packs and register site connectors. Small packages can use a direct URL; larger sites can send one package through an exact-origin, nonce-bound browser handoff. Every external handoff is reviewed in the authenticated Foundry client before it changes the world, and imported data cannot install scripts, macros, arbitrary Active Effects or document permissions.

The full interchange schema, website example and API reference are in the [public integration guide](docs/integration-api.md). Community rules appear in a player-readable world compendium; the GM controls imports and whether an existing external rule is preserved or explicitly replaced.

## Development

```sh
npm ci
npm test
npm run check
npm run build
```

The release ZIP is `dist/star-wars-ffg.zip`. Its positive allow-list includes runtime files, original and attributed assets, notices, documentation and exactly two authorized database JSON files. PDFs, SQL backups, private charts, adventure passages and SW Adversaries source data remain excluded. `python scripts/generate-dice.py` regenerates the 256px face textures from the attributed community font using Pillow.

API references: [Foundry system development](https://foundryvtt.com/article/system-development/), [Foundry v14](https://foundryvtt.com/api/), [Dice So Nice custom terms](https://riccisi.gitlab.io/foundryvtt-dice-so-nice/api/terms/).

MIT license for original project code and artwork only; third-party content is excluded from that grant.

The interface uses locally bundled Roboto, Signika and Rajdhani fonts. Font licences, dice symbol provenance and retained notices are recorded in [third-party notices](THIRD_PARTY_NOTICES.md).
