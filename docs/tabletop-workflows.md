# Tabletop workflows

Open **Star Wars · Tabletop tools** at the bottom of the Actors directory. The same change history and vehicle dashboard are available from actor-sheet headers. An active GM is required for committed changes.

## Narrative results

Native narrative chat rolls have **Spend narrative symbols**. The window shows remaining Advantage, Threat, Triumph and Despair independently. An actor owner can propose a choice; a GM checks the cost, source, timing and prerequisites before approval. Simultaneous approvals cannot spend the same proposal twice. Confirmed choices persist on the original message and can be undone.

A GM can save a reviewed choice as a reusable option. Source-checked options follow the campaign book filter; explicit table rulings remain identified as rulings. No unverified rule table is preloaded. The option catalogue starts empty until the table reviews its sources.

Spending describes the narrative outcome. Damage, recovery and other actor changes use **Combat resolution** separately, so a suggestion cannot silently alter a sheet. Refunding symbols does not reverse separately applied effects; use the affected actor's history for those changes.

## Combat resolution and history

Choose the affected actor and preview damage after soak/armour, Pierce and Breach, or resource recovery. Opening the tool from a native roll allows selection of the actual weapon and fills its damage plus successful symbols where supported. Vehicle mounts operated by another actor must be selected/adjudicated separately. Cross-scale damage, missing statistics and vehicle Pierce require GM review instead of an invented calculation.

Critical injuries and conditions can be recorded with names, references and notes. These records **do not yet apply unencoded modifiers**. Apply those modifiers through the existing manual dice-pool controls after source review. The workflow does not roll an incomplete critical table or infer all weapon-quality activations.

Each committed actor change stores before/after values, the approving GM, time and source or ruling. **Tabletop history** offers undo. Undo refuses to overwrite values altered since the entry; undo later changes first or adjudicate the conflict. Actor data and its history entry are persisted in one document update. Repeating an acknowledged operation does not charge it again.

## Initiative slots

**Choose initiative slot** appears in the Combat tracker and Tabletop tools. A participating owner chooses a character and a slot on the matching side. A participant or shared minion group can claim one slot per round; defeated participants, past slots and unrolled slots are rejected. A GM can reassign a claimed slot while retaining the one-turn rule.

Claims are stored separately from combatant documents. The original initiative order and participant identities remain intact, and rewinding rounds restores their claims. `combat.getClaimedCombatant(slotId)` resolves the acting character; the current `combat.combatant` getter follows the claim. Integrations that read `combat.turns[index]` directly should call the resolver before using an actor or token.

The native tracker still displays the original initiative contributor with an **Acting:** annotation for the claimant. Live compatibility with third-party combat trackers requires separate acceptance.

## Vehicle dashboard

The dashboard puts hull trauma, system strain, armour, silhouette, speed, shields, crew duties, crew skill ranks, turn lights and installed weapons together. Crew checks call the existing assigned-crew dice builder. The arc button opens the existing canvas attack selector for the selected target; it uses the same range and shield checks as normal targeting.

A placed vehicle and assigned, owned crew are required for crew checks. The dashboard does not invent background crew or substitute the vehicle's statistics for a gunner. Speed and shield changes require a reviewed preview and enter the same undo history. Refresh the dashboard after changes; automatic live rerendering is not yet implemented.

## Session wrap-up

The GM selects recipients, previews XP and credits for each, and can record explicit adjustments to enabled Obligation, Duty, Morality and Conflict. Downtime is recorded as a note. The tool does not infer story-resource triggers or crafting/recovery rewards. Use separate awards for characters receiving different outcomes.

Awards update both available and total XP. Each actor is committed independently; a partial failure names the confirmed recipients so the GM can inspect their histories before retrying. An award preview becomes invalid if an affected value changes before application. Equipment distribution and automated source-backed session triggers remain future work.

## Authority and testing

Requests are private Foundry chat documents addressed to the requester and GMs. The first active GM by user ID serializes them. Actor changes share a per-actor lock with XP purchases, turn spending and crew changes, so a session award cannot overwrite a concurrent purchase or recovery erase a manoeuvre cost. Authorization cross-checks the authenticated Foundry create-message hook user against the document author and records a GM-owned payload fingerprint. Later processing requires that receipt and an unchanged payload. Player-edited author/request fields cannot promote a request to GM authority. Narrative approval evaluates blind/whisper visibility for the proposer, even though the approval runs on the GM client. Replays use persisted operation IDs, and narrative proposals have an additional one-proposal guard.

Automated coverage includes concurrent damage, duplicate approvals, overspending, stale previews, permissions, initiative identity/rewind, missing source information, disabled story mechanics, recovery bounds and conflict-safe undo. `node tests/tabletop-ui.mjs` runs actual browser interactions against a Foundry-shaped document/dialog fixture. Set `CHROMIUM_PATH` to an installed browser if Playwright's bundled browser is unavailable. This fixture is separate from live Foundry acceptance and never contacts an existing world or AI provider.

## Verified acceptance and remaining work

Validated on 2026-09-29 in an isolated Foundry 14.368 world running this Star Wars 0.3.0 source, with zero modules and one GM plus two independent player clients. The shared development world was untouched. The temporary server and all test clients were stopped afterwards.

- The two players raced for the same initiative slot: exactly one claim succeeded, with original actor identities intact.
- A player submitted a request with forged GM author/user fields. Foundry retained the player author, and the authority rejected the mechanical effect without changing wounds.
- The native damage window previewed 7 damage minus 2 soak, applied wounds from 2 to 7, and history undo restored 2. Before/after snapshots persisted as JSON strings so Foundry did not reinterpret dotted paths.
- A player's 2-Advantage proposal reached the GM chat controls and approval spent it once. Its explicit test-session ruling stayed attached; no copied rule prose or guessed options were used.
- A native session award added 5 XP and 100 credits with a downtime note. Actor values and history survived a browser reload.
- The dashboard showed the actual assigned crew and their Round 1 budgets. Selecting the assigned gunner with Agility 2 and Gunnery 3 built 1 Ability plus 2 Proficiency through the existing crew builder.
- Both live passes completed without browser page errors. Native firing-arc geometry and DoR narration remain their separate acceptance tracks.

The final local unit suite passes 398 tests, including concurrent purchase/award and manoeuvre/recovery operations. The syntax/template/manifest check and 279-file public build pass. The browser fixture additionally verifies sorted initiative labels with reversed actor insertion order, the current-slot claim and a refresh that replaces the dashboard window. Temporarily restoring the old GM-global visibility check makes the blind-owner regression fail; GM authorization and shared actor-lock mutations were also detected and restored.

Remaining scope is explicit: reviewed narrative option tables are not bundled; critical/condition modifiers and all weapon-quality activations are not encoded; automated story-resource triggers, equipment distribution and downtime mechanics require further source-backed implementation. The current session tool supports reviewed XP/credit/story adjustments and notes. Third-party combat trackers and integrations reading raw slot contributors need their own compatibility acceptance.
