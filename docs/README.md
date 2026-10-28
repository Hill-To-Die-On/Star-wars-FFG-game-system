# Star Wars FFG documentation

Guides for players and GMs, references for integrators, data-coverage registers and maintainer records for the Star Wars FFG system for Foundry VTT. If you are new, start with the [GM quick start](guides/gm-quick-start.md) or the [Player quick start](guides/player-quick-start.md).

These guides describe the code on this branch, which can be ahead of the published releases. The latest stable release is **0.3.0** and the latest Beta is **0.5.0**; check the [changelog](../CHANGELOG.md) for what each release contains. The [GitHub wiki](https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/wiki) gives a shorter overview of the same material.

## Folders

| Folder | Contents |
| --- | --- |
| [`guides/`](#guides) | How-to guides for players and GMs |
| [`integrations/`](#integrations) | Optional modules, imports and the public integration API |
| [`sources/`](#sources) | What the bundled data covers and where it comes from |
| [`development/`](#development) | Validation logs, audits and release records for maintainers |
| [`adr/`](#architecture-decisions) | Architecture decision records |
| `schemas/` | JSON Schemas for integration packages, versions 1 to 3 |
| `images/` | Screenshots and diagrams used by these pages |
| `wiki/` | Source pages for the GitHub wiki |

## Guides

### Getting started

- [GM quick start](guides/gm-quick-start.md): set up a world, create the party, run an encounter and end a session.
- [Player quick start](guides/player-quick-start.md): create a character, make checks, take combat turns and crew vehicles.
- [First launch and settings](guides/onboarding-settings.md): the welcome window, choosing books, settings groups and sheet layout.
- [Character creation and enemy guide](guides/character-creation.md): manual and guided creation, and quick NPC presets.

### Playing

- [Tabletop workflows](guides/tabletop-workflows.md): narrative spending, damage, criticals, initiative, the vehicle dashboard, session checks and awards.
- [Actions and manoeuvres](guides/turn-indicators.md): tracking and spending each actor's turn allowance.
- [Range bands](guides/range-bands.md): range overlays, the combat range assistant, attack traces and vehicle firing arcs.
- [Layered flight and vertical combat](guides/layered-flight.md): moving between scene levels and checking shots across them.
- [Altitude shadows](guides/altitude-shadows.md): height cues from shadows cast onto lower levels and actors.
- [Vehicle crew and passengers](guides/vehicle-crew.md): generating, boarding and assigning crew.
- [Linked minion groups](guides/minion-groups.md): running several minion tokens as one group.
- [Procedural actor icons](guides/actor-icons.md): default portraits and tokens, facing and vehicle token size.

### Reference and administration

- [Reference library and owned books](guides/reference-library.md): searching the database, filtering by owned books, homebrew entries and the Group record.
- [Transaction authority and recovery](guides/security-authority.md): choosing the GM browser that processes changes, and reviewing interrupted requests.
- [Backup, upgrade and recovery](guides/backup-recovery.md): backing up before an upgrade, undoing changes and restoring a world.
- [Accessibility and performance](guides/accessibility-performance.md): keyboard controls and reduced-motion behaviour.

## Integrations

- [Director of Realms integration](integrations/director-of-realms.md): the optional AI game-master adapter and its rules boundary.
- [Book-specific adventure and reward guidance](integrations/book-play-guidance.md): source-checked planning and reward prompts for Director of Realms.
- [Private book-art catalogue](integrations/book-art-catalogue.md): indexing artwork in books you hold, for Director of Realms.
- [SW Adversaries import](integrations/sw-adversaries.md): importing NPCs and vehicles from the SW Adversaries site.
- [Public integration API](integrations/integration-api.md): package formats, transports and the API for character builders and campaign tools.

## Sources

- [Advancement source coverage](sources/advancement-coverage.md): talent-tree and signature-ability charts and their printed-page checks.
- [Playable species ability coverage](sources/species-ability-coverage.md): which species abilities are checked and which are automated.
- [Vehicle source coverage](sources/vehicle-source-coverage.md): vehicle profiles still needing a source page (generated).
- [Database enrichment](sources/database-enrichment.md): vehicle loadouts and other additions to the reference database, and how to rebuild them.
- [Origin data accuracy](sources/origin-data-accuracy.md): audit of the species, career, specialization and signature-ability identities used in creation and advancement.
- [NASA backdrop rights review](sources/nasa-artwork-rights.md): terms and attribution for the default background artwork.

## Development

These records are for maintainers and reviewers. They are kept for traceability and are not needed to play.

- [Validation log](development/validation.md): dated test and acceptance results, and how to rerun the checks.
- [Production readiness](development/production-readiness.md): release gates, known limits and open acceptance work.
- [Release audit record](development/release-audit.md): evidence for the 2026-09-29 release-hardening build and its archive audit.
- [Foundry listing record](development/foundry-listing.md): the 0.4.2 Beta listing preparation and review gates. Foundry has declined the official directory listing.
- [Director of Realms acceptance](development/dor-acceptance.md): build, native and campaign acceptance for the Director of Realms integration.
- [Headless playtest loop](development/headless-playtest.md): repeating the browser playtest fixtures.
- [Gameplay instruction source audit](development/rule-instruction-audit.md): inventory of candidate mechanics and citations.
- [Local rule-scan gap audit](development/rule-scan-gap-audit.md): results and review queue from the 2026-09-29 local rules scan.
- [Development template compiler advisory review](development/dependency-advisory-review.md): the Handlebars advisory resolution.
- [Incremental TypeScript checking](development/development-types.md): type checking the JavaScript sources.
- [`actor-icon-audit.json`](development/actor-icon-audit.json): latest machine-readable actor icon audit result.

## Architecture decisions

- [ADR 0001: Client-mediated public integration API](adr/0001-public-integration-api.md)
- [ADR 0002: Preserve authored actor-group relationships across imports](adr/0002-authored-actor-group-interchange.md)

## Maintaining these pages

- User guides describe behaviour. Record dated test results, counts and hashes in the [validation log](development/validation.md), not in a guide.
- `sources/vehicle-source-coverage.md` is written by `scripts/publish-vehicle-stats.py`, and most of `sources/advancement-coverage.md` by `scripts/enrich-library.py`. Change the scripts rather than editing their generated sections by hand.
- `wiki/` holds the source of the public GitHub wiki: ten guide pages plus sidebar and footer. Tests check its internal links and the stable and Beta labels. Editing these files does not update the public wiki; after review, publish them to the separate `.wiki.git` repository.
- The roadmap lives in `project_memory/roadmap/improvement-plan.md`, not in these pages.
