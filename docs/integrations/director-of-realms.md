# Director of Realms integration

Director of Realms (DoR) is an optional, separately installed AI game-master module. Star Wars FFG publishes a native adapter that gives DoR exact narrative dice results, actor facts, range measurements and owned-book-filtered references, so that DoR works with this system's rules instead of a generic fallback. This page is for GMs who want to try DoR and for DoR maintainers; ordinary human-GM games do not need it.

## Requirements

- The adapter is published at `game.system.api.directorOfRealms` during system initialisation.
- The installed DoR registry must consult this provider before its generic fallback. A system-specific adapter must not translate narrative dice into d20 rules.
- DoR needs the companion correction from [DoR PR #452](https://github.com/Hill-To-Die-On/Director-Of-Realms/pull/452), which has merged. It restores the registry bridge, preserves the native narrative result axes, grounds narration in visible documents and committed resource changes, filters hidden tokens and requires source-authorized combat.
- The integration has been checked against DoR 0.10.1219 built from verified source. A version label alone is not enough: an installed snapshot labelled 0.10.1232 lacked Campaign Studio and returned an older narration timeout. The exact build checked is recorded in the [DoR acceptance record](../development/dor-acceptance.md).
- This system does not install or replace DoR.

## Import a private adventure

1. In the Star Wars FFG settings, choose the campaign rule lines and beginner or core mode.
2. Populate the bundled reference compendiums, add any private chart enrichment and create characters from the correct starting package.
3. Enable Director of Realms and configure the AI provider you intend to use.
4. Use Campaign Studio's local PDF intake for an adventure you legally hold. Keep the extracted adventure material inside the private Foundry world.
5. Bind characters, source references and scenes. Check the imported encounter difficulty, native skills, enemy statistics and chapter transitions.

The beginner games use staged teaching and pre-generated folios. Obligation, Duty and Morality checks from the core rules apply only once the GM has chosen to enable those mechanics; they should not be assumed in every beginner encounter.

### Prepare scanned or oversized PDFs

The three beginner-game bundles exceed DoR's 24 MiB direct file limit, and the Edge of the Empire bundle has no embedded text. A local preparation command produces a private Markdown source with explicit page markers from the original PDF:

```sh
python -m pip install pymupdf
python scripts/prepare-adventure.py "path/to/adventure.pdf"
# For scanned material:
python -m pip install rapidocr onnxruntime
python scripts/prepare-adventure.py "path/to/scanned-adventure.pdf" --ocr
# Sourcebooks use a separate private index. Force OCR when a scan has a bad text layer:
python scripts/prepare-adventure.py "path/to/sourcebook.pdf" --kind sourcebook --force-ocr
```

Import the generated `.local/adventures/<name>/<name>.md` into Campaign Studio's source library.

Prepared passages are unreviewed. OCR can misread custom dice symbols, tables and unusual layouts, so compare encounter pools and statistics with the PDF before play. This text preparation does not keep artwork; use DoR's native PDF intake to extract images.

## Review extracted artwork

DoR's PDF intake saves the text and queues image extraction in the background. It records image categories, source and page provenance, and review status inside the private world. The queue pauses when Foundry is under rendering pressure and resumes when it recovers.

Use Studio's **Media** task to review extracted images and request **Remaster**, **Upscale** or **Label-free** variants. The original image remains available.

Before an image can be accepted for players, it needs a working image provider and a reviewed derivative. Extraction and visible controls do not prove that an AI has removed every spoiler.

## Run targeted checks

For automated token targeting, call:

```js
executeCheck(actor, skill, {sourceToken, targetToken, rangeOptions, ...rollOptions})
```

- The adapter recomputes the range immediately before rolling. It rejects an unavailable measurement, blocked sight, unknown sight or `requiresGmRuling`, even if another field says the line is clear.
- `rangeOptions` takes the same scene, weapon, firing arc and defence zone that `getCombatRange` accepts.
- The source token must belong to the rolled actor, matched by full actor UUID, so that distinct unlinked tokens cannot borrow one another's path.
- For a vehicle, pass the vehicle actor and its token. The existing vehicle skill workflow resolves the assigned crew, keeping `crewTokenId` when it was explicitly chosen. The adapter binds `vehicleToken` to the measured source even when several linked copies exist. Crew permissions and role eligibility remain the responsibility of the crew workflow.

`getCombatRange` preserves the range engine's level IDs, vertical relation, `sightBasis` and `sightReason`, and adds `automaticRangedCheckAllowed` and `automationReason`. That permission concerns the measured path only. It does not validate a weapon, skill, range limit, ammunition or the final pool. A precomputed range or permission flag cannot authorize `executeCheck`; the range engine is always queried again.

Untargeted skill checks continue through the ordinary actor roll path. Direct `actor.rollSkill` calls and the GM's Manual pool remain explicit adjudication tools and do not pick up targeting context automatically. `executeAttack` still refuses unrestricted attack automation. Integrations must use the guarded, token-aware entry point for targeted checks; prose guidance alone is not an execution boundary.

## Rules evidence boundary

The adapter publishes `getRulesKnowledgePolicy()` and `getRuleEvidence(query)`.

- Structured system calculations are the only mechanics that may be applied automatically.
- A matching private source passage is reference evidence and still needs GM review, especially when it came from OCR.
- If there is neither structured data nor reviewed book-and-page evidence, the required result is **rule unavailable; explicit GM ruling required**. DoR must not fill the gap from general model knowledge, Genesys, another Star Wars rule line or a similarly named ability.

This boundary is repeated in every narrative actor context and in the native-check guidance, so it stays present during narration and rolls.

## Campaign preparation data

The adapter offers GM-only `getBookPlayGuidance({ book, kind })` and `getAdventureSeeds({ query, book, page, pageSize })`. Both follow the owned-book selection. Reviewed guidance is a source-linked planning or reward checklist; catalogue seeds are brief starting ingredients. Neither interface applies rewards or invents encounter mechanics. See [book-specific adventure and reward guidance](book-play-guidance.md) for checked coverage.

The private [book-art catalogue](book-art-catalogue.md) indexes image candidates in held PDFs by exact book title and PDF page. The adapter exposes the GM's owned-book selection and a GM-only art-candidate query over a private catalogue supplied by DoR. Crop suggestions and short visual labels need human review. This system does not bundle the images or show them to players automatically. DoR's existing private import-manifest pipeline can index approved crops after the GM selects owned titles.

## What the adapter provides

The native provider supplies actor facts, book configuration, structured motivations, legal talent and signature-ability purchases, signature link and unlock state, graph and source verification, learned guidance, per-rule automation status, check guidance, token-to-token range and explicit skill-pool execution.

- **Roll results.** `readNativeCheckRoll(message)` returns the exact actor and skill identity, the allowlisted pool, and success, failure, advantage, threat, Triumph, Despair and Force pips as independent facts. Contradictory flags fail closed, and freeform rule notes are excluded.
- **Range.** `getCombatRange(sourceToken, targetToken)` returns the Personal, Battlefield/planetary or Ship/vehicle/space band from the same scene profile used by the visible overlay and the character-sheet pool builder. On scaled maps it also reports horizontal distance, elevation difference, three-dimensional scene distance and Foundry sight-wall state. A blocked sight line prevents the ordinary automatic ranged roll; DoR must stop unless the GM uses the prefilled Manual pool as an explicit override.
- **Talents.** `getCheckTalentRules(actor, skill)` returns applied passive modifiers, fixed result symbols and active decisions. `executeCheck` uses the same `actor.rollSkill` path as the character sheet, so structured passive effects cannot differ between DoR and manual play.
- **Motivations** guide portrayal, hooks and source-defined rewards. They do not invent dice modifiers.
- **Guidance-only abilities** remain visible to DoR and need explicit adjudication.
- **Private adversary notes.** The [SW Adversaries](sw-adversaries.md) importer keeps descriptions, ability rules and related source records in a GM-only compendium. When running as the GM, the adapter supplies those notes alongside native statistics.
- **Groups.** Group actors expose their base, membership, resources, contacts and shared Destiny through narrative context.
- **Database search.** The public database search API applies the GM's owned-book selection. See [the reference library](../guides/reference-library.md).

## Rules coverage available to DoR

The public structured catalogue supplies all 2,700 specialization nodes and 342 nodes across 38 signature graphs, without source prose. Private enrichment can add local player guidance for those specialization nodes, most signature nodes and 298 motivation references.

- Automatic dice or result effects exist for 28 unique passive talents.
- Four signature graphs still contain at least one node with only a book reference.
- Peerless Interception and Unmatched Teamwork have checked structural graphs, but their private effect guidance is absent.
- Other active talent and signature effects, weapon qualities, Force-power upgrades, critical consequences, cover and terrain, and vehicle manoeuvres still need further codification or source adjudication.
- The adapter can obtain native range, elevation and sight-wall facts, but `executeAttack` still requires an explicit weapon, target defence and GM-approved final pool.

## Limitations

- **Full unattended play has not passed acceptance.** The Edge of the Empire, Age of Rebellion and Force and Destiny beginner adventures, and a mixed party drawing on all three lines, still need complete play-throughs. Passing one scenario is not evidence that the others pass.
- Source extraction, adapter execution, narration and a full autonomous play-through are separate checks.
- The rules evidence boundary limits unsupported state changes; it does not stop an AI from writing an incorrect sentence. Full acceptance also needs adversarial prompt tests that ask for absent rules and confirm that the model declines to invent them.
- Live remastering of images and Surveyor placement of walls, lights, windows, doors, traps and zones are separate, unaccepted steps.
- OCR output and prepared adventure text are unreviewed until the GM compares them with the source.

Current acceptance status and remaining campaign gates are recorded in the [DoR acceptance record](../development/dor-acceptance.md) and the [validation log](../development/validation.md).
