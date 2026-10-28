# GM quick start

This guide takes a Game Master from a new world to the end of a first session. It assumes a normal table with a human GM; Director of Realms is optional.

Keep the rulebooks to hand. The reference database and checked talent trees support play, but they do not automate every effect a book describes.

## Prepare a world

On first launch, after Foundry's own welcome, the system offers book selection and a skippable interface tour. The books you save apply to the world. You can also let the browser remember them and reuse that choice, explicitly, in a later world. To see the welcome again, open **Welcome & interface tour** from the system settings. See [First launch and settings](onboarding-settings.md).

1. Install the system from the release manifest and create a world that uses Star Wars FFG. Start with no optional modules; add Dice So Nice once basic sheets and chat are working.
2. In the Settings sidebar, select **Transaction authority** for this GM browser and confirm that any earlier transaction tabs have stopped. Repeat this after a reload or when another GM takes over. Other GM tabs can view the world but do not process changes. See [Transaction authority and recovery](security-authority.md).
3. Open Configure Settings → Star Wars FFG → **Campaign rules & adventure state**. Enable the rule lines you intend to use and choose the story mechanics separately. All three rule lines are enabled by default; enabling an extra line does not grant another starting package.
4. Open **Owned books** and select the sources available at your table. The **Reference catalogue** searches the bundled database without any private import. Use **Populate compendiums** only if you want native world references.
5. Choose the sheet and interface theme, the compact dice tray and the turn-management policy. Themes are cosmetic. Decide whether players may add or reset turn allowances, or whether only the GM or automation can.
6. Give each player ownership of their character and access to the scene. Check the scene from a separate player login: a map or token the GM can see is not necessarily visible to players.
7. Open **Help & rules coverage** to review supported workflows and learned-effect details. If you use a private source library, export the GM source key before clearing browser storage or moving to another browser.

## Create the party

Create a **Character** actor and choose **Manual creation** or **Guide me**. Species, careers and specializations come from the database, filtered by the campaign's rule lines and books. Before applying the draft, review the free ranks, the starting-resource choice, equipment and XP, and handle any cited species exceptions yourself. **Ready for play** ends the creation phase once outstanding reviews are done. See [Character creation and enemy guide](character-creation.md).

You can enable the homebrew identity override for species, careers, vehicle models or manufacturers that are not in the catalogue. A homebrew label does not supply missing mechanics, so review those statistics before play.

Create a **Vehicle** actor and pick its model from the searchable field. Check any incomplete profile or unverified loadout before combat. Use **Crew & Passengers** to assign or generate crew; crew checks use the assigned actor's skills. Renaming a ship keeps its model identity. See [Vehicle crew and passengers](vehicle-crew.md).

## Run an encounter

1. Agree what the character is trying to do before anyone rolls.
2. In combat, choose the acting participant's initiative slot, then select the source and the target.
3. Review range, line of sight, weapon, gunner and the firing and defence faces.
4. Choose **Send dice to pool** to open the adjustable dice pool. This does not resolve the attack by itself.
5. Check for missing source information and situational modifiers, then roll once.
6. Read success and failure separately from the narrative symbols, and approve narrative spending through the chat workflow.
7. Apply damage or recovery through **Combat resolution** after checking its preview. Approving narrative spending does not apply these effects.

Roll criticals on the core table from **Combat resolution**. Difficulty, characteristic and timed critical effects, weapon qualities that are not encoded, and cross-scale damage still need the cited rule or an explicit table ruling. Recording a condition does not mean its modifiers have been applied.

Use **Tabletop history** to reverse a change. An undo that would overwrite newer values is refused. See [Tabletop workflows](tabletop-workflows.md).

## End a session

- **Start session** rolls the Obligation and Duty checks.
- **Session wrap-up** previews XP, credits, adjustments to enabled story resources and downtime notes. Check recipients and amounts before applying. If some recipients fail, inspect the named successful recipients and their histories before retrying.
- **End session** restores thresholds and resolves Morality.
- **Distribute equipment** hands out item rewards.

Downtime activities remain manual.

Save a world backup, and keep private assets and the source-key backup recoverable. Test a restore in a separate world before you rely on it; see [Backup, upgrade and recovery](backup-recovery.md). For a support request, **Help & rules coverage** produces a diagnostic JSON file you can inspect before sharing. It contains no names, chat, keys or source notes.

## Before adding Director of Realms

Run the same table workflow without Director of Realms first. Then configure a supported provider separately, review what private content may be sent to it, and keep GM approval for any missing mechanics. A fully AI-led campaign is a separate release gate that has not yet been passed. See [Director of Realms](../integrations/director-of-realms.md).
