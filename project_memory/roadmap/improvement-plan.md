# Developer Roadmap

This is AtlasMind's canonical backlog for the Star Wars FFG Foundry system. Evidence in source, tests, build outputs and live validation must exist before an item is marked complete.

## Project Context

- Project: Star Wars FFG game system
- Project type: Foundry VTT 14 system
- Delivery: `dev` → protected `staging` → protected `main`
- Scope: Edge of the Empire, Age of Rebellion and Force and Destiny, separately or together
- Public-content boundary: creator-authorized database plus original code and art; held PDFs, extracted pages, copied rule prose and private campaign material stay outside releases

## Prioritized Backlog

<!-- atlasmind:roadmap-items:start -->
- [ ] Complete isolated Foundry acceptance with Director of Realms 0.10.1162 or later: run the Edge, Age and Force beginner adventures plus a mixed-ruleline campaign with two player clients and two GM-controlled party members. Verify conversational decision making before rolls, all narrative result axes, cinematic advantage/threat use, exact actor/skill/ship identity, visible scenes, map or Theatre-of-the-Mind transitions, personal combat, navigation, evasion and ship combat. <!-- rm:complete-dor-live-acceptance -->
- [ ] Finish printed-chart verification for advancement. The public catalogue contains 135 specialization graphs and 36 of 38 signature graphs, but only five charts have full node/cost/connector comparisons and four more have connector-only checks. Compare every available held PDF chart; request the 24 missing specialization pages and the two missing signature charts listed in `docs/source-coverage.md`. <!-- rm:finish-advancement-source-verification -->
- [ ] Codify remaining rules only from structured or reviewed sources: active and situational talents, weapon qualities, Force-power upgrades, critical consequences, vehicle maneuvers, crafting, mass combat and squadron rules. Unsupported mechanics must continue to request a GM ruling. <!-- rm:codify-remaining-rules -->
- [ ] Complete vehicle statistics with book/page evidence. The current structured match fills 162 of 399 vehicles; 237 records remain incomplete and must not receive guessed values. <!-- rm:complete-vehicle-statistics -->
- [x] Complete character-creation choices for starting credits, equipment and ruleline story-resource options, preserving the existing campaign-owned rulebook filter and post-creation species lock. Unit, build and isolated Foundry evidence covers the three rulesets' resource plans plus a live Edge equipment and d100 funds workflow. <!-- rm:complete-character-creation-choices -->
- [ ] Add generic Director of Realms adventure-art intake: extract and catalogue lawful PDF art, select maps versus Theatre-of-the-Mind images, create player-safe versions without GM labels through a reviewed workflow, upscale non-destructively, and pass the chosen scene to Surveyor for walls, lights, windows, doors, traps and zones. Keep this feature ruleset-agnostic in DoR. <!-- rm:add-dor-adventure-art-intake -->
- [x] Complete live acceptance for the public integration API version 2, including character-builder handoff, adversary/vehicle/Group import, community rules, origin isolation, review, replacement and multi-client behavior. The current build passed all Actor types, direct-link and exact-origin handoffs, safe preservation, explicit in-place replacement and concurrent GM/player permission and compendium checks. <!-- rm:complete-api-v2-live-acceptance -->
- [x] Complete range-overlay acceptance for multi-origin mode, map scale, persisted Theatre-of-the-Mind calibration, all three range scales, elevation and line-of-sight behavior. Existing Foundry acceptance covers the overlay modes, map and Theatre-of-the-Mind isolation, persistence and three scales; a current-checkout Foundry 14.368 follow-up verified that 5 m horizontal distance plus 12 m elevation resolves to 13 m / Medium, a sight wall disables Auto while retaining the prefilled Manual pool, and a clear sight line re-enables Auto. <!-- rm:complete-range-overlay-acceptance -->
- [x] Complete Dice So Nice physical-hardware and multi-client visual acceptance for all seven dice, including the revised Ability and Difficulty face alignment. Foundry 14.368 and Dice So Nice 6.3.1 animated the same seven-die public pool on concurrent GM/player clients with correct geometry, colors and d8 face fit, then delivered the same chat result without dice-related browser errors. <!-- rm:complete-dsn-live-acceptance -->
- [ ] Resolve hosted GitHub Actions availability and then require the validated check on protected promotion branches. Until the organization billing/service lock is cleared, local/container results are evidence only for local validation. <!-- rm:restore-hosted-ci -->
- [ ] Review and merge or replace the open Dependabot npm and GitHub Actions updates after the full local matrix passes. <!-- rm:close-dependabot-updates -->
- [ ] Re-run the public release audit after all readiness work: verify ZIP contents, no private paths or source files, manifest URLs, clean-world install, upgrade from 0.2.1, branch SHAs and protected `dev` → `staging` → `main` promotion. <!-- rm:run-release-audit -->
- [x] Publish the complete creator-authorized reference database with owned-book filtering and explicit incomplete fields instead of guessed values. <!-- rm:publish-reference-database -->
- [x] Implement database-backed fuzzy species/career selection, GM-owned multi-ruleline configuration, automatic character population and immutable species after campaign start. <!-- rm:implement-character-origins -->
- [x] Implement resizable character sheets, grouped/alphabetical skills, unlimited custom skills, clickable automatic/manual dice pools, Group/Base sheet, motivations, multiple talent trees and signature abilities. <!-- rm:implement-core-sheets -->
- [x] Publish copyright-bounded advancement graphs and verification metadata in the release archive, merge them into public compendium imports, and validate the complete 173-item catalogue. The 112-test suite, release checks and 168-file build pass; printed comparisons remain tracked separately. <!-- rm:publish-advancement-graphs -->
- [ ] Preserve complete native narrative-roll facts for Director of Realms. System-side focused tests pass on `codex/readiness-gaps`; the companion DoR 0.10.1162 implementation and full suite are in PR #452, with a validated follow-up that rejects malformed metadata and imitated roll headings. Live merged-build acceptance remains open. <!-- rm:preserve-native-roll-facts -->
<!-- atlasmind:roadmap-items:end -->

## Release Gates

- Local unit, syntax, template and build checks pass.
- The release allow-list contains no PDF, SQL, private extraction, environment file or copied source prose.
- Isolated Foundry acceptance passes without overwriting another active test installation.
- Director of Realms acceptance uses the exact installed build under test and records its version.
- Protected-branch and hosted-CI status is reported separately from local evidence.

## Prioritisation Notes

1. Rules correctness, evidence boundaries and player-visible state integrity.
2. Complete three-ruleline and mixed-campaign acceptance.
3. Advancement, vehicle and character-creation completeness.
4. Scene, art, Dice So Nice, range and API acceptance.
5. Dependency, CI and release promotion hygiene.
