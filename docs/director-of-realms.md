# Director of Realms integration

The native adapter is published at `game.system.api.directorOfRealms` during system initialization. The installed Director of Realms registry must consult this provider before its generic fallback. A system-specific adapter must not translate narrative dice into d20 rules.

The companion correction in Director of Realms [PR #452](https://github.com/Hill-To-Die-On/Director-Of-Realms/pull/452) has merged. It restores the registry bridge, preserves native narrative result axes, grounds narration in visible documents and committed resource changes, filters hidden tokens and requires source-authorized combat. Current isolated validation uses DoR 0.10.1219 built from verified source `f28cb4a`; see the [acceptance record](dor-acceptance.md) for artifact hashes, completed checks and remaining campaign gates. A version label alone is insufficient: an installed snapshot labelled 0.10.1232 lacked Campaign Studio and returned an older narration timeout. This system does not install or replace DoR.

## Private adventure intake

1. Choose the campaign rule lines and beginner/core mode in Star Wars FFG settings.
2. Populate the bundled reference compendiums, add any private chart enrichment and create characters from the correct starting package.
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
# Sourcebooks use a separate private index. Force OCR when a scan has a bad text layer:
python scripts/prepare-adventure.py "path/to/sourcebook.pdf" --kind sourcebook --force-ocr
```

Import the generated `.local/adventures/<name>/<name>.md` in Campaign Studio's source library. All three prepared bundles were imported in the earlier isolated acceptance world. Source passages remain unreviewed: OCR can misread custom dice symbols, tables and unusual layouts. Compare encounter pools and statistics with the PDF before play. This text preparation does not retain artwork: use DoR's native PDF intake for image extraction.

## Private artwork catalogue

DoR's current PDF intake saves text and queues image extraction in the background. It records image categories, source/page provenance and review status inside the private world. The queue pauses under Foundry rendering pressure and resumes when it recovers. In current-build acceptance, a held PDF produced 25 candidates; 23 initially needed GM review. One approval persisted after reopening the catalogue.

Use Studio's Media task to review extracted images and request Remaster, Upscale or Label-free variants. The original remains available. An operational image provider and a reviewed derivative are still needed before an image can be accepted for players. Extraction and visible controls do not prove that an AI removed every spoiler. Live remastering and Surveyor placement of walls, lights, windows, doors, traps and zones remain separate acceptance gates.

## Targeted check safety

For automated token targeting, call `executeCheck(actor, skill, {sourceToken, targetToken, rangeOptions, ...rollOptions})`. The adapter recomputes the range immediately before rolling. It rejects an unavailable measurement, blocked sight, unknown sight, or `requiresGmRuling`, even if another field says the line is clear. `rangeOptions` supplies the same scene, weapon, firing arc and defence zone accepted by `getCombatRange`.

The source token must belong to the rolled actor, matched by full actor UUID so distinct unlinked tokens cannot borrow one another's path. For a vehicle, pass its vehicle actor and token; the existing vehicle skill workflow resolves assigned crew, with `crewTokenId` retained when explicitly chosen. The adapter binds `vehicleToken` to that measured source even when several linked copies exist. Crew permissions and role eligibility remain the responsibility of the existing crew workflow.

`getCombatRange` preserves the engine's level IDs, vertical relation, `sightBasis` and `sightReason`, and adds `automaticRangedCheckAllowed` plus `automationReason`. That permission concerns the measured path only; it does not validate a weapon, skill, range limit, ammunition or the final pool. A precomputed range or permission flag cannot authorize `executeCheck`. The range engine is queried again.

Untargeted skill checks continue through the ordinary actor roll path. Direct `actor.rollSkill` calls and the GM's Manual pool remain explicit adjudication tools and do not automatically acquire targeting context. `executeAttack` still refuses unrestricted attack automation. Integrations must use the guarded token-aware entry point for targeted checks; the prose guidance alone is not an execution boundary.

## Rules evidence boundary

The adapter publishes `getRulesKnowledgePolicy()` and `getRuleEvidence(query)`. Structured system calculations are the only mechanics that may be applied automatically. A matching private source passage is reference evidence and still requires GM review, especially when it came from OCR. If neither structured data nor reviewed book-and-page evidence exists, the required result is **rule unavailable; explicit GM ruling required**. DoR must not fill the gap from general model knowledge, Genesys, another Star Wars rule line or a similarly named ability.

This boundary is repeated in every narrative actor context and in the native-check guidance so it remains present during narration and rolls. It limits unsupported state changes; it does not make an AI incapable of writing an incorrect sentence. Full acceptance therefore also needs adversarial prompt tests that ask for absent rules and verify that the model declines to invent them.

For campaign preparation, the adapter also offers GM-only `getBookPlayGuidance({ book, kind })` and `getAdventureSeeds({ query, book, page, pageSize })`. Both follow the owned-book selection. Reviewed guidance is a source-linked planning or reward checklist; catalogue seeds are brief starting ingredients. Neither interface applies rewards or invents encounter mechanics. See [book-specific adventure and reward guidance](book-play-guidance.md) for checked coverage and remaining scan work.

The private [book-art catalogue](book-art-catalogue.md) indexes held-PDF image candidates by exact book title and PDF page. The adapter exposes the GM's owned-book selection and a GM-only art-candidate query over a private catalogue supplied by DoR. Crop suggestions and short visual labels require human review; this system does not bundle the images or automatically present them to players. DoR's existing private import-manifest pipeline can index approved crops after the GM selects owned titles.

## Automation boundary

The expanded SW Adversaries importer retains descriptions, ability rules and related source records in a GM-only compendium. The adapter supplies those notes alongside native statistics when running as the GM. Group actors expose their base, membership, resources, contacts and shared Destiny through narrative context. The public database search API applies the GM's owned-book selection. See [SW Adversaries](sw-adversaries.md) and [the reference library](reference-library.md) for access and coverage details.

The native provider supplies actor facts, book configuration, structured motivations, legal talent and signature-ability purchases, signature link/unlock state, graph/source verification, learned guidance, per-rule automation status, check guidance, token-to-token range and explicit skill-pool execution. `readNativeCheckRoll(message)` returns exact actor/skill identity, the allowlisted pool and success, failure, advantage, threat, Triumph, Despair and Force pips as independent facts; contradictory flags fail closed and freeform rule notes are excluded. `getCombatRange(sourceToken, targetToken)` returns the Personal, Battlefield/planetary or Ship/vehicle/space band from the same scene profile used by the visible overlay and character-sheet pool builder. On scaled maps it also reports horizontal distance, elevation difference, three-dimensional scene distance and Foundry sight-wall state. A blocked sight line prevents the ordinary automatic ranged roll; DoR must stop unless the GM uses the prefilled Manual pool as an explicit override. `getCheckTalentRules(actor, skill)` returns applied passive modifiers, fixed result symbols and active decisions; `executeCheck` uses the same `actor.rollSkill` path as the character sheet. Structured passive effects therefore cannot diverge between DoR and manual play. Motivations guide portrayal, hooks and source-defined rewards but do not invent dice modifiers. Guidance-only abilities remain visible to DoR and require explicit adjudication.

The public structured catalogue supplies all 2,700 specialization nodes and 342 nodes across 38 signature graphs without source prose. Private enrichment can add local player guidance for those specialization nodes, most signature nodes and 298 motivation references. Automatic dice/result effects exist for 28 unique passive talents. Four signature graphs still contain at least one node with only a book reference; Peerless Interception and Unmatched Teamwork have checked structural graphs but their private effect guidance is absent. Other active talent and signature effects, weapon qualities, Force-power upgrades, critical consequences, cover and terrain, and vehicle maneuvers still need additional codification or source adjudication. The adapter can obtain native range, elevation and sight-wall facts, but `executeAttack` still requires an explicit weapon, target defence and GM-approved final pool. Full unattended play has not passed acceptance.

Current acceptance status is recorded in [validation.md](validation.md).
