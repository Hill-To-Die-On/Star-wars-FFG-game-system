# Production readiness

This record describes release gates for the combined gameplay candidate. It is not a claim of production acceptance and does not include unfinished sourcebook extraction from another checkout. AtlasMind's canonical status is the repository's `project_memory/roadmap/improvement-plan.md`.

## Ordinary human-GM play

Release acceptance requires authenticated mechanical requests, replay-safe changes, conflict-aware undo, reproducible install/upgrade/restore checks, and complete creation → encounter → recovery → advancement → session-wrap workflows. Unit tests, browser fixtures, native multi-client acceptance and protected hosted checks are separate evidence.

The Help & rules coverage window exposes implemented/assisted/manual workflows and learned talent/signature effects. It preserves source references and separates graph comparison from effect verification. An owned-book filter changes the report, not existing actor mechanics. The report is an inventory; it does not automatically adjudicate missing rules.

Remaining mechanics include unencoded critical/condition modifiers, all weapon-quality activations, cross-scale adjudication, source-backed narrative option tables, equipment rewards and automatic downtime/story triggers. Those require an explicit GM decision and must not be represented as complete automation.

## Privacy and recovery

Diagnostics are deliberately allowlisted: Foundry/system versions, the Dice So Nice and DoR integration states, and counts of actors/scenes/messages. They exclude names, world identifiers, settings, content, provider URLs, logs and credentials. Downloading is an explicit local action; there is no telemetry or automatic upload.

World backups and browser-held GM source keys are different recovery assets. Keep the key separately, restore into an isolated world/browser, and prove the library can be decrypted. Reinstalling an old system ZIP alone is not a rollback of changed world data.

## Accessibility and performance

Verify keyboard operation, focus visibility, contrasting themes, small windows, browser zoom and reduced-motion preferences. Canvas-only controls need sheet or dialog alternatives. Check dense scenes and multiple clients over an extended session, then compare memory, frame times and listener counts after closing applications. A browser fixture or brief frame-rate sample is not a long-session soak test.

## Director of Realms

Ordinary play must remain usable with DoR absent. AI-led acceptance additionally requires complete Edge, Age, Force and mixed-rule campaigns, source-grounded decisions, independent symbol interpretation, private-data boundaries, provider failures/cancellation and resumable operations.

Existing native-roll and private-art-catalogue evidence does not establish completed model narration, remastering or Surveyor acceptance. A compatible configured provider and available image service remain separate prerequisites; never silently change another session's running model to satisfy a test.

## Official-listing and maintainer gates

Before official listing, review the current [Foundry AI Content Policy](https://foundryvtt.com/article/ai-policy/) and [licensing guide](https://foundryvtt.com/article/licensing-guide/). The AI policy covers prepared text and media, code maintenance and runtime integrations. SVG treatment does not authorise evading its visual-media rules.

Keep provenance and licence records for every distributed asset, font and data source. The archive audit detects forbidden content patterns and paths, but cannot establish legal rights or human authorship. Technical documentation may use AI assistance under the code policy; prepared user-facing copy and listing text need the policy's applicable human-authorship review or replacement. The maintainer must be able to explain and maintain the code. These are human review gates, not checkboxes that automated tests can certify.

## Delivery

Validate the actual archive and detached manifest, assign a consistent release version, run clean installation plus supported upgrades, and promote through protected branches. Do not publish experimental AI acceptance as a stable promise. Hosted validation and the separately configured AtlasMind runner must be reported accurately.

[Player quick start](player-quick-start.md) · [GM quick start](gm-quick-start.md) · [Tabletop workflows](tabletop-workflows.md) · [Release audit](release-audit.md)


## Guidance validation — 2026-09-29

The guidance lane passed 431 unit tests, TypeScript/syntax/template/data checks, a 293-file build and archive audit. The isolated browser fixture verifies keyboard search, status selection, hidden-actor exclusion, escaped actor names, diagnostic download and a 560-pixel viewport. Removing the observer permission check makes both permission/revocation tests fail; the guard was restored and both passed. This is fixture evidence, not native Foundry help-window acceptance or a full campaign.
