# Changelog

## 0.4.1 — Unreleased

### Added

- Use the credited NASA artwork for Foundry's automatic new-world welcome scene, removing its stock illustration and demonstration effects while preserving existing/custom scenes.

- Character and vehicle sheets adapt to their own resized width: compact identity/header spacing, wrapping tabs, three/two/one-column skills and readable narrow layouts with scrolling talent graphs.

- First-launch welcome with a copyright reminder, GM-owned bookshelf, optional browser remembrance for future worlds, per-user skip state and a seven-step replayable Foundry interface tour.
- Native settings grouped by setup, appearance, combat automation, play tools, private imports and help; consistent system styling for play dialogs and journals, with native configuration windows preserved.
- A public GitHub wiki with installation, book ownership, interface, character, combat/vehicle, integration, troubleshooting, contribution and credit guides, clearly separating published and candidate behavior.

- Add a resizable Help & rules coverage window with implementation limits, campaign-filtered learned talent/signature effects, source references, graph-verification distinctions and observer permission checks.
- Add GM/player quick starts and an explicit local diagnostic export limited to versions, known integration states and document counts.

- Manual and guided character creation with shared starting-resource and XP validation, plus a GM guide for editable, original enemy presets.
- Deterministic SVG portraits and default tokens distinguished by role, species and vehicle family, with retained frames on custom portraits and vehicle footprints sized from silhouette estimates or exact dimensions through the scene scale.
- Vehicle Crew & Passengers sheets, generated crew previews, drag-to-board workflows, compact roster badges, role assignments, selective disembarking and character-sheet shortcuts. Vehicle checks use the assigned crew's skills and talents.
- Linked minion groups with animated connections, shared wounds and trained skill ranks, casualty removal and recovery, and shared combat slots and turn budgets.
- Action/manoeuvre indicators on sheets and selected tokens, automatic spending for committed combat checks and movement, strain purchases, action trades, undo, round resets and GM-controlled player permissions.
- Reviewed narrative-symbol spending and player proposals with separate Advantage, Threat, Triumph and Despair budgets, GM approval, reusable reviewed options, persisted records and undo.
- Combat damage/recovery previews and change history, player-facing initiative-slot claims, and reviewed session XP, credit and story-resource adjustments with downtime notes.
- A vehicle combat dashboard combining crew duties, turn indicators, shields, speed, damage and weapon targeting; open dashboards update after document changes and remove their listeners when closed.
- Native level/altitude flight controls that preserve vehicle and crew identity, height-aware wall and surface checks, above/below targeting details, and explicit GM stops for ambiguous geometry.
- Cosmetic altitude shadows across lower levels and actor portraits, with logarithmic displacement and softness and GM-configurable receiving surfaces.

### Changed

- Species, career, model and manufacturer selectors support keyboard navigation and selection. Vehicle arcs have focusable button alternatives, and active range/minion animations honor reduced-motion preferences.

- Range overlays can follow combat and select the scale from both scene and attacker. Labels rotate along their range arcs, stay readable near viewport edges and avoid actors, props and other controls.
- Combat targeting searches usable edge-to-edge paths, accounts for rotated hulls and eligible firing/defence faces, animates clear and blocked trajectory segments, and sends the resulting dice to the adjustable pool. Vehicle weapon/gunner choices and interactive arc selection retain manual control.
- Species, career, vehicle model and manufacturer fields use database-backed fuzzy choices. Vehicle selection supplies default identity, artwork and reviewed statistics; a GM setting permits explicitly identified homebrew entries.
- Vehicle enrichment adds 288 searchable weapon-mount relationships, bringing the catalogue to 6,950 rows across 45 tables. Only the 11 printed-page-checked loadouts equip automatically; 141 candidates remain pending review, and model changes preserve custom or modified equipment.

### Fixed

- Keep authenticated transactions, approval fingerprints and vehicle loadouts working on ordinary HTTP LAN clients using secure random IDs and an attributed local SHA-256 fallback; private source-note encryption retains its HTTPS requirement.

- Preserve manually sized legacy vehicle tokens during upgrades; automatic resizing requires explicit opt-in.
- Reject damage previews when reviewed inputs such as soak change before approval, even if the prior wound value is unchanged.
- Remove stale sheet drop handlers, crew drag state and range-motion listeners on rerender, cancellation and teardown.

- Keep the characteristic/rank base dice explanation separate from talent changes; preserve cited structured modifier contributions and source references in check results.

- Keep vehicle facing independent of movement direction and provide clockwise/counterclockwise token controls. Improve token-art resolution and frame placement, and keep names, elevation labels, turn controls and targeting cards from covering one another.
- Route XP, turn and crew changes through authenticated native requests with durable receipts, complete synthetic actor identities, queued permission rechecks and explicit GM-browser selection. Fence late completions and retain interrupted work for GM review. Keep routine protocol cards out of play chat.
- Protect tabletop mechanical requests with authenticated authorship, unchanged-payload checks and replay guards. Spending approvals check the proposer's blind/whisper visibility, and initiative choices follow the actual turn order.
- Serialize actor changes across tabletop effects, XP purchases, turn spending and crew operations. Preserve dotted snapshot paths through Foundry document transport so previews and undo use the correct saved values.
- Reject DoR targeted checks before rolling when sight is blocked, unknown or requires a GM ruling. Bind the rolled actor and assigned-crew lookup to the measured source token.

### Development and documentation

- Correct the accumulated unreleased gameplay and hardening candidate to 0.4.0. Add a single version-setting command and fail checks/builds when package, lockfile, Foundry manifest/download or changelog versions disagree; published 0.3.0 remains unchanged until release.

- Add repeatable packaged installation, upgrade and backup/restore acceptance, with released 0.2.1 and 0.3.0 baselines and private evidence.
- Run browser fixtures in hosted validation and stop their owned process trees after timeout; leave unrelated processes running.

- Start incremental strict TypeScript checking with narrative-dice pool, face, symbol and outcome contracts, including negative compile-time assertions in the normal validation command.
- Add actual release-archive auditing with path/content checks, manifest and inventory comparison, and file/archive hashes. Expand the AtlasMind local command contract and require validated GitHub checks on protected promotion branches.
- Add usage and acceptance guides for creation, minions, crew, turn indicators, flight, shadows and tabletop tools; update the README, contribution instructions, range/DoR guides and canonical roadmap. Record native multi-client acceptance separately from browser fixtures and provider-dependent campaign testing.

### Remaining limitations

- GM transaction selection must be repeated after reload or handover. Simultaneous deliberate GM takeovers are not atomic, and receipt storage remains unbounded pending safe compaction and long-campaign load testing.

- Reviewed narrative-option tables are not bundled. Critical/condition records do not apply every rules modifier; remaining weapon qualities, equipment rewards and automated story/downtime effects still require source-backed work or an explicit GM ruling.
- Full DoR beginner and mixed-rule campaigns, cinematic interpretation, image derivatives and Surveyor acceptance remain open. Native roll facts and private artwork catalogue review have been verified separately; those checks do not establish a completed AI-led campaign.

## 0.3.0 — 2026-09-26

- Publish a copyright-bounded vehicle-stat overlay that raises complete coverage from 162 to 312 of 399 native vehicles, upgrades only untouched placeholder Actors, records exact evidence for every match and lists all 87 unresolved book/page profiles without guessing missing values.
- Record the exact held and missing printed-page ranges for the partial Cyphers & Masks source, including the equipment, adversary and vehicle block that still needs a private scan; publish only page-level request metadata.
- Replace the three pending GitHub Actions v4-to-v7 updates with reviewed immutable v7 commit pins for checkout, Node setup and artifact upload.
- Complete live public API version-two acceptance and add a reviewed preserve-or-replace choice for matching community rules, defaulting to preservation.
- Complete starting-resource selection for all three rule lines: party-size Obligation/Duty, Edge and Age benefit combinations, Force Morality choices, the Age Base gear allowance, owned-book-filtered equipment purchasing, retained-credit validation and the one-time d100 pocket-money roll.
- Add a player-visible, idempotent artwork-credit Journal with the NASA source record and named artist attribution; preserve it after creation and repeat the credit in the README.
- Publish copyright-bounded structured advancement data for all 135 specializations and 38 signature abilities: 171 usable graphs and 3,024 nodes with costs, topology, references and declarative effects, while excluding source prose, artwork and private paths. Distinguish structural validation from 143 full printed-chart comparisons and 30 pending comparisons.
- Preserve native Star Wars narrative rolls for Director of Realms as exact actor, skill, pool, success/failure, advantage/threat, Triumph/Despair and Force-pip facts; reject contradictory flags and exclude chat rule notes from trusted mechanics.
- Move one-or-many ruleset selection into GM campaign settings with all three enabled by default; add database-only fuzzy Species and Career pickers, automatic base-stat/career-skill population, source-derived creation rules and immutable origins after finalisation or campaign start.
- Add evidence-required Director of Realms guidance and rule lookup: structured mechanics remain the only automatic authority, while missing or unreviewed source material stops for an explicit GM ruling.
- Add private sourcebook OCR preparation, forced replacement of unreliable embedded text and public comparison metadata. Fully compare 111 specialization charts and 32 signature-ability charts, correct four specialization connectors, replace two signature placeholder key sets with printed mechanical names and fix the legacy Unmatched Devastation spelling while keeping private prose and page images out of releases.
- Add a dedicated scene-control range overlay with labelled colour bands, single or retained multiple origins, map-scale measurement, persistent per-scene Theatre-of-the-Mind calibration, Personal/Battlefield/Ship scale selection, three-dimensional scaled-map elevation, Foundry sight-wall checks, automatic sheet-pool range input and a shared public/Director of Realms measurement API. Block automatic ranged rolls through a sight wall while preserving the prefilled Manual pool for a GM ruling.
- Complete the public GitHub repository health set with contribution, conduct, support, security, ownership, issue, pull-request, release-note and artifact-inventory metadata; add grouped npm and GitHub Actions updates through Dependabot.
- Add a versioned public integration API for character and campaign builders, including backward-compatible version-one character/rule packages and version-two character, adversary, vehicle and Group Actor packages, declarative community rule packs, mixed bundles and registered connectors, with reviewed JSON, direct-link and origin-bound one-package browser handoffs.
- Give rolled narrative dice their physical square, diamond and strongly faceted d12 silhouettes in chat, including compatibility styling for stored rolls.
- Fit Ability and Difficulty glyphs inside Dice So Nice's triangular d8 safe area, stack paired Difficulty symbols like the physical dice, and use versioned face textures that refresh without breaking images in existing chat history; complete all-seven-die concurrent GM/player visual acceptance.
- Raise muted, accent and active-control color pairs to WCAG 2.1 AA text contrast across all three sheet and Foundry interface themes.
- Add an original print-inspired sheet treatment with a bundled paper texture, technical panel rules and three distinct color schemes.
- Select sheet colors automatically from character creation rules or campaign rules while retaining client-wide and per-sheet manual overrides.
- Add an optional themed Foundry interface with a losslessly bundled public-domain NASA artist's concept of Saturn beyond Enceladus's geysers and retained provenance, locally bundled Rajdhani typography, custom navigation and pause icons, chat cards, combat tracker, windows, journals and handouts, plus the sidebar, scene controls, player list and hotbar. Retain automatic, manual and Foundry-default modes.
- Keep unlimited custom-skill rows aligned by revealing edit and delete controls inside the name cell on hover or keyboard focus.
- Correct AtlasMind's canonical delivery model to `dev` → protected `staging` → protected `main` and add the missing readiness roadmap SSOT.

## 0.2.1 — 2026-09-24

- Complete the Star Wars rename across code classes, stylesheet names, CSS namespaces, import formats, application IDs and new compendium names.
- Restore older saved narrative dice using their serialized type markers and reuse existing reference and encrypted GM libraries without changing document UUIDs.
- Accept existing version-one private library exports and retain the `starWarsFFGReady` integration hook.

## 0.2.0 — 2026-09-24

- Use **Star Wars FFG** throughout the visible system, replacing the initial working title. Existing world and compendium identifiers remain compatible.
- Publish the complete creator-authorized reference database: 6,662 rows, 44 tables and 45 book titles, including creator notes and source pages.
- Add a searchable reference catalogue, shared owned-book filtering and native compendium population; retain formatted credit prices and flag missing prices.
- Add Group sheets with Base of Operations, linked member records, story scores, resources, possessions, contacts and shared Destiny.
- Expand private SW Adversaries intake to six site collections, resolve separate weapon references and retain full source knowledge in a GM-only compendium for DoR.
- Encrypt GM source prose before persistence, with a browser-held key, key backup/restore and a private source search menu. Direct document retrieval exposes ciphertext rather than source text.
- Preserve NPC skill values above player advancement caps and alternative Lightsaber characteristics; flag incomplete weapons without discarding the NPC.

## 0.1.0 — 2026-09-24

- Initial independent Foundry 14 system, original three-theme character and vehicle sheets.
- Seven custom narrative dice and Dice So Nice presets with 64 generated standard-symbol faces.
- Native roll resolution, XP paths, starting character choices, campaign rule-line settings and private library import.
- Source coverage register for specialization PDFs, graphs and photo requests.
- Director of Realms adapter contract with explicit integration and acceptance status.
- Local SW Adversaries JSON import with native NPC statistics and explicit unresolved weapon references.
- Self-hosted Roboto body text and Signika headings with their font licences retained.
