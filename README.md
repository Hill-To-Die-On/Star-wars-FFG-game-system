<p align="center">
  <img src="https://sw-rpg.info/brand/sw-ruleset-mark.svg" alt="Star Wars FFG emblem: Ability, Proficiency and Boost dice projected above a holo-emitter" width="200">
</p>

<h1 align="center">Star Wars FFG for Foundry VTT</h1>

<p align="center">
  <strong>Edge of the Empire · Age of Rebellion · Force and Destiny</strong><br>
  One free game system for all three lines, played separately or together in a single campaign.
</p>

<p align="center">
  <a href="https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/releases/latest"><img alt="Latest stable release" src="https://img.shields.io/github/v/release/Hill-To-Die-On/Star-wars-FFG-game-system?label=stable"></a>
  <a href="https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/releases"><img alt="Latest Beta release" src="https://img.shields.io/github/v/release/Hill-To-Die-On/Star-wars-FFG-game-system?include_prereleases&amp;label=beta"></a>
  <img alt="Foundry VTT 14" src="https://img.shields.io/badge/Foundry%20VTT-14-ff6400">
  <a href="LICENSE"><img alt="MIT licence for original code" src="https://img.shields.io/badge/licence-MIT-blue"></a>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#features">Features</a> ·
  <a href="https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/wiki">Wiki</a> ·
  <a href="#companion-site-sw-rpginfo">SW-RPG.info</a>
</p>

---

Bring the narrative dice, the paper-sheet feel and the whole reference index of the FFG Star Wars roleplaying game to your Foundry table. Run a smuggler crew, a Rebel cell and a band of Force adepts side by side. Build pools in a click, spend Advantage and Triumph with GM review, measure range bands across the map, put crews aboard their ships, and look up any talent, weapon or starship by book and page.

It is free, original and independent. Your rulebooks stay essential: Star Wars FFG points you to them rather than replacing them.

## Install

Paste the **latest release manifest** into Foundry's **Install System → Manifest URL**:

```text
https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/releases/latest/download/system.json
```

This is the best way to install and stay current. Foundry checks the same address for updates, so each new stable release appears in Foundry's normal **Update** flow. Then create a world using **Star Wars FFG**.

> **Why isn't it in Foundry's package browser?** Foundry has not permitted this system to be listed in its official package directory because of the extent of the data sources it can import from external documents, such as homebrew PDF rules and adventures. The manifest link above is the supported way to install it and receive updates.

**Want the newest features?** The **0.5.0 Beta release** is an English-only GitHub prerelease with everything marked **Beta** below. Install it from its version-specific manifest, back up your worlds first and try it in a disposable world:

```text
https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/releases/download/v0.5.0/system.json
```

The latest stable release is **0.3.0**. Requires **Foundry VTT 14**. **Dice So Nice 6.3.1 or later** is recommended for animated physical dice; rolls and chat results work without it.

## Features

Features marked **Beta** are in the 0.5.0 Beta release and not yet in the 0.3.0 stable release.

### Narrative dice that feel right

- All seven narrative dice with their real silhouettes and symbol faces in chat, separate success, advantage, Triumph and Despair results, and upgrades and downgrades.
- A pool builder that reads skills, characteristics and talent modifiers from the sheet, and a compact seven-die tray beside the chat bar for quick ad-hoc rolls.
- A persistent, shared Destiny pool.
- Full Dice So Nice support, with custom textures for all seven dice.

### Sheets built for every table role

- Character, minion, rival, nemesis, vehicle and **Group** sheets with an original print-inspired paper layout.
- Three colour schemes (**Frontier**, **Rebellion** and **Mystic**) chosen automatically from each character's rule line, with per-client and per-sheet overrides.
- A Skills tab with all 35 standard skills, rulebook grouping or A–Z order, and unlimited custom skills with full XP advancement.
- Interactive specialization trees and signature abilities: click an eligible talent to spend XP.
- Structured motivations, and Group records for the Base of Operations, Obligation, Duty, Morality, contacts and shared resources.
- **Beta:** sheets adapt as you resize them, down to a readable single column.

### Character creation without the spreadsheet

- Searchable species and career pickers fill characteristics, thresholds, starting XP and career skills from your enabled books.
- Starting Obligation, Duty or Morality benefits, an owned-book equipment shop with live budget checks, and the d100 pocket-money roll.
- **Beta:** manual or guided creation. Four questions narrow the choices, and validation covers free ranks, gear and starting XP.
- **Beta:** a GM guide that creates clearly labelled, original NPC presets.

### A reference library in every session

- A searchable catalogue of **6,662 database rows across 44 tables** covering talents, weapons, gear, species, careers and starships, each with book and page references.
- An **Owned books** filter of 45 titles that limits the catalogue, starting choices and imports to the books your table actually has.
- One click populates native compendiums with thousands of Items, vehicles and journals.
- **Beta:** 288 vehicle weapon-mount relationships (6,950 rows across 45 tables). Checked loadouts equip standard weapons automatically, and checked roll tables are ready from the reference browser.

### Combat and vehicles on the map

- Range bands for Personal, Ship and Battlefield scales, drawn from any token, with map-scale and Theatre-of-the-Mind calibration.
- Measured range and Foundry's line of sight feed the automatic dice pool. A blocked shot stops for a GM ruling.
- **Beta:** animated attack lines that show exactly where a shot is blocked, then send the computed pool to the dice tray for adjustment.
- **Beta:** action and manoeuvre indicators on sheets and tokens that spend themselves as you roll and move.
- **Beta:** linked minion groups with shared wounds, casualties and a shared combat slot.
- **Beta:** vehicle crew and passengers. Drag characters aboard, generate NPC crews and roll vehicle checks with the assigned crew's actual skills.
- **Beta:** a vehicle combat dashboard, layered sky and space flight across Foundry scene levels, and cosmetic altitude shadows.
- **Beta:** distinctive generated portraits and tokens for every species and vehicle family, with vehicle footprints sized to the scene.

### Table tools that keep the GM in charge

- **Beta:** review-and-approve spending for Advantage, Threat, Triumph and Despair, with player proposals and undo.
- **Beta:** damage and recovery previews with change history, player initiative-slot claims, and session XP and reward review.
- **Beta:** spending presets from the four core combat spending tables and the weapon's active qualities, each with its core page.
- **Beta:** criticals rolled on the core Critical Injury and Critical Hit tables, with Vicious, existing criticals and the healing check.
- **Beta:** weapon qualities such as Accurate, Cumbersome, Pierce and Stun Damage feed the dice pool and damage.
- **Beta:** session start and end tools for the Obligation and Duty checks and Morality, plus equipment distribution with undo.
- **Beta:** one selected GM browser processes shared changes, so two players buying from the same XP pool cannot both spend it.

### An interface that looks the part

- An optional themed Foundry interface covering chat, combat tracker, windows, journals, sidebar and hotbar, over a public-domain NASA artist's concept of Saturn and Enceladus.
- **Beta:** a first-launch welcome with a copyright reminder, a GM bookshelf and a skippable seven-step interface tour.
- **Beta:** settings in six clear groups, plus a Help & rules coverage window that shows exactly what is automated and what stays a GM ruling.

### Open to the wider community

- A public **integration API** for character builders, campaign tools and community-rule sites to import and export characters, adversaries, vehicles, Groups and rule packs. Every import is reviewed in Foundry first. See the [integration guide](docs/integrations/integration-api.md).
- **SW Adversaries** imports for [site collections and local exports](docs/integrations/sw-adversaries.md).
- A private library import for structured data from sources you hold locally. Imported content stays in your world and is never published.
- An optional adapter for the **Director of Realms** module that hands it exact narrative roll results, actor facts and range measurements. See the [Director of Realms guide](docs/integrations/director-of-realms.md).

## Companion site: SW-RPG.info

<a href="https://sw-rpg.info/"><img src="https://sw-rpg.info/brand/sw-rpg-logo-square.png" alt="Star Wars RPG Info logo" width="128" align="left"></a>

**[SW-RPG.info](https://sw-rpg.info/)** is the field index and Foundry workshop for the Star Wars roleplaying game. Visit it alongside this system.

<br clear="left">

## What's included, and what isn't

Star Wars FFG ships original code, sheets, interface and artwork, the creator-authorized reference database, and familiar narrative dice symbols from an attributed community source. It does **not** include rulebook text, adventure text or official illustrations. You still need the books. Automation covers recorded, structured mechanics. Situational effects, many weapon qualities, critical-injury consequences and some vehicle rules stay explicit GM decisions. See [validation](docs/development/validation.md), [source coverage](docs/sources/advancement-coverage.md) and [production readiness](docs/development/production-readiness.md) for the exact evidence and remaining gaps.

Star Wars FFG is not affiliated with or endorsed by Lucasfilm, Fantasy Flight Games, Asmodee or EDGE Studio. Published by Hill To Die On.

## Guides

- [Documentation index](docs/README.md): every guide, integration reference, data-coverage register and maintainer record
- [GitHub wiki](https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/wiki): installation, books, interface, characters, combat, integrations and troubleshooting
- [GM quick start](docs/guides/gm-quick-start.md) · [Player quick start](docs/guides/player-quick-start.md) · [First launch and settings](docs/guides/onboarding-settings.md)
- [Character creation](docs/guides/character-creation.md) · [Tabletop workflows](docs/guides/tabletop-workflows.md) · [Range bands](docs/guides/range-bands.md) · [Vehicle crew](docs/guides/vehicle-crew.md) · [Minion groups](docs/guides/minion-groups.md)
- [Reference library](docs/guides/reference-library.md) · [Database enrichment](docs/sources/database-enrichment.md) · [Transaction authority](docs/guides/security-authority.md)
- [Backup and recovery](docs/guides/backup-recovery.md) · [Accessibility and performance](docs/guides/accessibility-performance.md)

## Development

Start contribution branches from `dev`. Maintainer promotion runs through protected `staging` and `main`. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [GitHub artifact inventory](.github/REPOSITORY_ARTIFACTS.md). Node 24 or later:

```sh
npm ci
npm run typecheck
npm test
npm run check
npm run build
```

The release ZIP is `dist/star-wars-ffg.zip`. It contains runtime files, original and attributed assets, notices and the authorized database. PDFs, SQL backups, private chart prose, adventure passages and SW Adversaries source data are excluded. The optional private import workflow is described in [database enrichment](docs/sources/database-enrichment.md#reproduction-and-review).

API references: [Foundry system development](https://foundryvtt.com/article/system-development/), [Foundry v14 API](https://foundryvtt.com/api/), [Dice So Nice custom terms](https://riccisi.gitlab.io/foundryvtt-dice-so-nice/api/terms/).

## Credits and licence

MIT licence for original project code and artwork only. Third-party content is excluded from that grant. The interface uses locally bundled Roboto, Signika and Rajdhani fonts. Font licences, dice-symbol provenance and retained notices are in [third-party notices](THIRD_PARTY_NOTICES.md).

The optional interface backdrop is NASA's public-domain *Saturn Through the Veil of Enceladus – Artist's Concept*. Credit: **NASA's Goddard Space Flight Center; art by Dan Gallagher (eMITS)**. A GM client creates the player-visible **Star Wars FFG · Artwork credits** Journal once per world, with the image, credit and a link to the [NASA SVS source and catalogue record](https://svs.gsfc.nasa.gov/14162). Existing Journal content is preserved. Full provenance, source hashes and NASA usage information are in [third-party notices](THIRD_PARTY_NOTICES.md).
