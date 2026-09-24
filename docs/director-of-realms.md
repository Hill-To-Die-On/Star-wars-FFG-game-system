# Director of Realms integration

The native adapter is published at `game.system.api.directorOfRealms` during system initialization. The installed Director of Realms registry must consult this provider before its generic fallback. A system-specific adapter must not translate narrative dice into d20 rules.

A companion registry change has been built and tested in an isolated DoR 0.10.1100 worktree. It checks the installed system's provider in both active-system and explicit-system lookup, after explicitly registered overrides. The normal DoR installation was not replaced. This system's release alone does not install that unreleased DoR change.

## Private adventure intake

1. Choose the campaign rule lines and beginner/core mode in Starfall settings.
2. Import the private reference library and create characters from the correct starting package.
3. Enable Director of Realms and configure the intended AI provider.
4. Use Campaign Studio's local PDF intake for a legally held adventure. Keep extracted adventure material inside the private Foundry world.
5. Bind characters, source references and scenes; validate the imported encounter difficulty, native skills, enemy statistics and chapter transitions.

## Required acceptance scenarios

- Edge of the Empire beginner adventure: staged pool teaching, Obligation context, personal combat, escaping in a vehicle.
- Age of Rebellion beginner adventure: Duty context, mission progression, native combat and group objectives.
- Force and Destiny beginner adventure: Force pips, Morality/Conflict context, lightsaber skills and Force powers.
- Mixed party: all three character origins, one Destiny pool, independent story resources, one XP ledger per actor, no duplicated starting bonuses.

Passing one scenario is not evidence that the other two pass. Source extraction, adapter execution, narration and a full autonomous play-through are separate checks.

The beginner books use staged teaching and pre-generated folios. Core Obligation, Duty and Morality checks are additional acceptance cases after choosing to enable those mechanics, not assumptions to inject into every beginner encounter.

## Scanned and oversized PDFs

The three supplied beginner bundles exceed DoR's 24 MiB direct file limit. The Edge bundle has no embedded text. A local preparation command produces a private Markdown source with explicit original PDF page markers:

```sh
python -m pip install pymupdf
python scripts/prepare-adventure.py "path/to/adventure.pdf"
# For scanned material:
python -m pip install rapidocr onnxruntime
python scripts/prepare-adventure.py "path/to/scanned-adventure.pdf" --ocr
```

Import the generated `.local/adventures/<name>/<name>.md` in Campaign Studio's source library. All three prepared bundles were imported into the isolated world. Source passages remain unreviewed: OCR can misread custom dice symbols, tables and unusual layouts. Compare encounter pools and statistics with the PDF before play. This text workflow does not import maps or handout artwork.

## Automation boundary

The native provider supplies actor facts, book configuration, legal talent purchases, check guidance and explicit skill-pool execution. Most talent/weapon effects, Force-power upgrades, critical consequences and vehicle maneuvers still need source adjudication. Autonomous tactical attacks need native range-band and pool integration; `executeAttack` deliberately reports that missing capability. Full unattended play has not passed acceptance.

Current acceptance status is recorded in [validation.md](validation.md).
