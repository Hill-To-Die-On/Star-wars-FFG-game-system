# Starfall: Narrative Toolkit

A free, independent **Foundry VTT 14** game system for campaigns using **Edge of the Empire**, **Age of Rebellion**, and **Force and Destiny**, separately or together. Published by Hill To Die On.

Original sheets and interface, with familiar narrative dice symbols from an attributed community source. This project does not distribute the rulebooks, adventure text, official illustrations, or a public copy of a private database. The books remain necessary. Starfall is not affiliated with or endorsed by Lucasfilm, Fantasy Flight Games, Asmodee, or EDGE Studio.

## Install

Use this manifest in Foundry's **Install System → Manifest URL**:

```text
https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/releases/latest/download/system.json
```

Create a world using **Starfall: Narrative Toolkit**. Enable **Dice So Nice 6.3.1 or later** for animated custom dice. Its absence does not disable rolls or chat results.

## At the table

- Character, minion, rival, nemesis and vehicle sheets. Frontier, Rebellion and Mystic themes can coexist in a world.
- All seven narrative dice, standard symbol faces, separate result axes, Triumph/Despair retention, and upgrades/downgrades.
- Skills, wounds, strain, defense, Force dice, inventory, vehicle condition and shields.
- **Configure Settings → Starfall → Campaign rulebooks** selects rule lines, story mechanics, beginner teaching mode and allowed sources.
- **Dice & Destiny** opens the pool builder and the persistent shared Destiny pool.
- **Private library** imports local JSON into world compendiums. Importing again preserves existing entries.
- The Advancement tab displays every owned specialization as an interactive tree. Click an eligible talent to spend XP; purchased and shared unranked talents are marked. Drag additional specializations from the compendium to acquire them at their career/universal XP price.
- Starting character choices apply the selected species and career, free skill ranks, the first specialization, and starting XP. Exceptional species rules require reference review. Purchases are recorded in the actor.

This is an initial development release. Weapon qualities, most talent effects, critical-injury consequences, range adjudication, starship maneuvers and expansion subsystems still require the GM and source books. Automated checks do not constitute an end-to-end adventure playtest. See [validation](docs/validation.md) and [coverage](docs/source-coverage.md) for the exact evidence and remaining gaps.

## Private database and chart import

Node 24 or later:

```powershell
npm ci
npm run import:database -- "path/to/database-backup.sql"
python scripts/enrich-library.py "path/to/DataSet_Full DataSet" "path/to/PDF library"
```

The output is `.local/catalog.json`, deliberately excluded from Git and public releases. Select that file using the **Private library** menu. SQL is parsed without executing it. Descriptions are excluded; names, mechanical values and source references are retained. The optional structured-data pass imports talent nodes and links, and fills matching vehicle statistics. It does not import illustrations or descriptive text.

The supplied sources produced 135 structurally validated specialization references and 6,595 private library entries. Of 399 vehicles, 162 have matched structured statistics; the other 237 remain explicitly incomplete pending source checks. Missing chart coverage identifies 24 chart pages across four books, plus three standalone charts from a fifth book whose full PDF is absent.

[Source coverage and photo requests](docs/source-coverage.md) distinguish missing PDFs, structurally validated trees and pending comparison with the books. Unknown vehicle statistics remain marked, and unverified graphs cannot spend XP.

## Director of Realms

The system exposes `game.system.api.directorOfRealms` with native actor facts, check guidance, narrative checks, damage handling, campaign configuration and accessible advancement choices. `game.system.api.actorContext(actor)` returns structured context for a character, including legal next talent purchases and source references.

Director of Realms needs to discover this adapter through its registry. The integration status and installation steps are recorded in [the integration guide](docs/director-of-realms.md). PDF intake remains private through Campaign Studio; it is not part of the public game-system download. A configured AI provider and separate adventure playtests are required before claiming autonomous GM acceptance.

## Development

```sh
npm ci
npm test
npm run check
npm run build
```

The release ZIP is `dist/starfall.zip`. Its positive allow-list contains only runtime files, original and attributed assets, their notices, and public documentation. No database or PDF can be included by copying the workspace wholesale. `python scripts/generate-dice.py` regenerates the 256px face textures from the attributed community font using Pillow.

API references: [Foundry system development](https://foundryvtt.com/article/system-development/), [Foundry v14](https://foundryvtt.com/api/), [Dice So Nice custom terms](https://riccisi.gitlab.io/foundryvtt-dice-so-nice/api/terms/).

MIT license for original project code and artwork only; third-party content is excluded from that grant.

Dice symbol provenance and the retained MIT notice are recorded in [third-party notices](THIRD_PARTY_NOTICES.md).
