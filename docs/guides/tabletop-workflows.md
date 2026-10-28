# Tabletop workflows

The tabletop tools help the GM turn the results of play into sheet changes: spending narrative symbols, applying damage and criticals, claiming initiative, running the vehicle dashboard, handling start- and end-of-session checks, handing out equipment and awarding XP. Each change is previewed before it is applied and recorded so it can be undone. Players propose; the GM approves.

## Open the tools

Open **Star Wars · Tabletop tools** at the bottom of the Actors directory. The change history and the vehicle dashboard are also available from actor-sheet headers.

Committed changes need an active GM, processed by the GM browser selected as **Transaction authority**. See [Transaction authority and recovery](security-authority.md).

## Spend narrative symbols

Narrative chat rolls have a **Spend narrative symbols** control. The window shows the remaining Advantage, Threat, Triumph and Despair separately.

1. An actor's owner proposes a choice.
2. The GM checks its cost, source, timing and prerequisites, then approves it.
3. The confirmed choice is saved on the original chat message and can be undone.

If two approvals arrive at once, the same proposal is still spent only once.

### Choose a reviewed option

The **Reviewed option** list has three groups:

- **Weapon qualities** lists the rolled weapon's active qualities with their Advantage cost, from the core rulebooks' item-quality pages.
- **Personal combat** and **Vehicle combat** list the 55 options from the four core spending tables: *Edge of the Empire* pp. 206–207 and 236, *Age of Rebellion* pp. 219 and 251, and *Force and Destiny* pp. 212 and 243. Costs and symbols have been checked against all three printed books, and the labels use original wording.

Only options for symbols still left on the roll are shown, and each one cites a core rulebook that the campaign's book filter allows. The lightsaber option appears only with *Force and Destiny*.

Choosing an option fills in its cost and source; the GM still records the decision. A GM can also save a reviewed choice as a reusable option. Explicit table rulings stay labelled as rulings.

### What spending does and does not change

Spending describes the narrative outcome only. Damage, recovery and other actor changes go through **Combat resolution**, so a suggestion can never silently alter a sheet. Refunding symbols does not reverse effects applied separately; use the affected actor's history for those.

## Resolve damage and recovery

1. In **Combat resolution**, choose the affected actor.
2. Preview damage after soak and armour, Pierce and Breach, or preview resource recovery.
3. Check the preview and apply it.

When you open the tool from a roll, you can pick the weapon actually used. Its damage, plus the successful symbols, are filled in where supported. Pierce, Breach and Stun Damage come from the selected weapon's qualities.

Weapon mounts operated by another actor must be selected and adjudicated separately. Cross-scale damage, missing statistics and vehicle Pierce are left for GM review rather than given an invented calculation.

### Weapon qualities during checks

When building a check, the dice pool applies these qualities automatically and cites the core page for each in the roll notes:

- **Accurate** adds Boost dice; **Inaccurate** adds Setback dice.
- **Superior** and **Inferior** add automatic Advantage or Threat.
- **Cumbersome** and **Unwieldy** add one Difficulty for each point by which the wielder's Brawn or Agility falls short.

### Roll a critical

A **Critical** rolls on the core Critical Injury table (personal scale) or Critical Hit table (vehicles). The d100 result adds:

- 10 for each critical the target already has;
- 10 per Vicious rank, filled from the weapon;
- any reviewed talent modifier, such as Lethal Blows or Durable.

The minimum result is 1. The record keeps the result's name, roll, total, severity, an original summary and its healing check (Medicine, or Mechanics for vehicles, from Easy to Daunting).

Some effects apply automatically: immediate strain (Minor Nick, Bowled Over), immediate system strain (Mechanical Stress, Fire!) and Maimed's lasting Setback die. Difficulty, characteristic, status and timed effects are shown as reminders for you to apply by hand.

You can also record a condition, or a critical you did not roll here, by name, with an optional Boost or Setback modifier.

## Undo a change

Every committed actor change stores the before and after values, the approving GM, the time and the source or ruling. Open **Tabletop history** to undo it.

Undo is refused if the values have changed since that entry. Undo the later change first, or resolve the conflict yourself. The actor's data and its history entry are saved in a single update, and repeating an operation that was already acknowledged does not charge it twice.

## Claim initiative slots

**Choose initiative slot** appears in the Combat tracker and in Tabletop tools.

1. A participating owner chooses a character.
2. They pick a slot on the matching side.

Each participant, or shared minion group, can claim one slot per round. Claims for defeated participants, past slots and unrolled slots are rejected. A GM can reassign a claimed slot; the one-turn-per-round rule still applies.

Claims are stored separately from the combatants, so the original initiative order and participants stay intact. Rewinding rounds restores the earlier claims. The Combat tracker still shows the original initiative holder, with an **Acting:** note for the character who claimed the slot.

### For integrations

`combat.getClaimedCombatant(slotId)` returns the acting character for a slot, and the `combat.combatant` getter follows the claim. Integrations that read `combat.turns[index]` directly should call the resolver before using an actor or token.

## Use the vehicle dashboard

The dashboard brings together hull trauma, system strain, armour, silhouette, speed, shields, crew duties, crew skill ranks, turn lights and installed weapons.

- Crew checks use the same assigned-crew dice builder as other crew checks.
- The arc button opens the canvas attack selector for the selected target, with the same range and shield checks as normal targeting.
- Speed and shield changes show a preview before they are applied, and go into the same undo history.

Crew checks need a placed vehicle with assigned crew who are owned actors. The dashboard does not invent background crew or use the vehicle's statistics in place of a gunner.

An open dashboard updates itself when the vehicle, its crew, items, tokens or combat change, without constant polling. Closing it removes all of its listeners. A **Refresh** button is also available.

## Start a session

**Start session · story checks** shows the Obligation and Duty charts for player-owned characters, with each character's band sized by their value, from highest to lowest.

1. The GM rolls a d100 for each enabled mechanic.
2. A result at or below the party total triggers the character who holds that band.
3. The roll is posted to chat, and every change is previewed before it is applied.

| Mechanic | Effect when triggered | Source |
| --- | --- | --- |
| Obligation | Every character's strain threshold drops by 1; the triggered character's drops by 2 | *Edge of the Empire* pp. 41–42 |
| Duty | Every character's wound threshold rises by 1; the triggered character's rises by 2 | *Age of Rebellion* pp. 48–49 |

Matching digits on the roll double the change.

When party Obligation is above 100, the tool shows the XP-spending restriction (*Edge of the Empire* p. 43). When party Duty is above 100, it offers the Contribution rank increase and Duty reset (*Age of Rebellion* pp. 49–50); the reward itself remains a table choice.

## End a session

**End session · Morality** first restores every threshold changed by that session's checks.

For *Force and Destiny*, it then rolls a d10 for each player-owned character, subtracts the session's Conflict, changes Morality by the difference and resets Conflict to zero (*Force and Destiny* pp. 51–52). The GM can:

- double the change for an engaged Morality trigger;
- block an increase for a character who was absent or incapacitated.

Crossing 30, 20, 10, 70, 80 or 90 shows the matching dark side, paragon or threshold reminder. The resulting threshold and Destiny changes are left to the GM. Every step is added to the character's history and can be undone.

## Distribute equipment

**Distribute equipment** copies weapons, armour, gear and attachments onto one player character.

1. Tick items from the world, or drop items in from the Items sidebar or a compendium.
2. Set each quantity.
3. Apply the handout.

Each copy records where it came from in Foundry's `_stats.compendiumSource` or `_stats.duplicateSource` field, and does not take the original's folder or permissions. The handout is added to the character's history; undo removes it only while the items are unchanged.

## Wrap up a session

1. Select the recipients.
2. Preview XP and credits for each one.
3. Optionally record explicit adjustments to enabled Obligation, Duty, Morality and Conflict, and a downtime note.
4. Apply the award.

Awards update both available and total XP. Use separate awards for characters who receive different outcomes.

Each recipient is updated independently. If some fail, the tool names the recipients that were confirmed so you can check their histories before retrying. A preview becomes invalid if an affected value changes before you apply it.

The wrap-up does not work out story-resource triggers, crafting or recovery rewards for you; **Start session** and **End session** handle the story-resource checks.

## How requests are processed

- Requests are private Foundry chat messages addressed to the requester and the GMs, and are processed by the GM browser selected as **Transaction authority**.
- Actor changes share a per-actor lock with XP purchases, turn spending and crew changes. A session award therefore cannot overwrite a purchase made at the same moment, and a recovery cannot erase a manoeuvre's cost.
- Authority is checked against the Foundry user who actually created the request message, which must match the message's author. The GM's browser records a fingerprint of the request, and later processing requires that record and an unchanged request. Editing the author or request fields cannot give a player's request GM authority.
- Narrative approval respects blind and whispered roll visibility for the player who made the proposal, even though the approval runs in the GM's browser.
- Replays use saved operation IDs, and narrative proposals have an extra guard so each proposal is spent only once.

## Limitations

- Critical difficulty, characteristic, status and timed effects are not yet encoded. Neither are weapon-quality activation effects such as Blast, Burn or Linked; these are offered as reviewed options instead.
- Morality threshold and Destiny changes, the Duty reward, crafting and downtime activities remain GM decisions.
- Session wrap-up supports reviewed XP, credit and story-resource adjustments and notes only.
- Third-party combat trackers, and integrations that read raw slot holders, have not been tested for compatibility with initiative claims.
