# Linked minion combat groups

Place matching minions as **single-member**, unwounded tokens, select them together and use **Star Wars FFG · Range bands → Link selected minions / manage group**. The GM may link 2–100 members on one scene before adding them to combat. Members must have matching statistics, ownership and equipment, and must be disembarked.

Linking creates a fresh shared actor while retaining each token's location and the original actors as reusable templates. Wounds, trained group ranks, equipment and turn spending belong to this one actor. Adding several members to the combat tracker through the system creates only one group slot. The linked actor itself cannot be dragged out as an extra unregistered token; use the original template for another group.

Selecting any visible member shows animated dashed connections between surviving members. The lines use a minimal connecting tree, stop at the token bases, and disappear when none of the group is selected. Reduced-motion preferences use static dashes. Player views omit hidden or locally invisible members. The animation uses CSS and event-driven geometry updates, with no idle canvas polling.

Use **Manage group members** on the shared sheet, the token HUD or the same sidebar control. Wounds use the existing pooled minion threshold calculation. Casualties leave the connections in roster order; healing restores them in reverse order. A visible crossed circle marks an out-of-action member. **Temporarily unavailable** handles a specific disabled or separated member without destroying its membership. The remaining member count sets trained group ranks, capped at 5; untrained skills remain rank 0. A completely inactive group cannot roll a check.

**Apply damage** on the sheet accounts for soak; the roster's wound field is a direct total. Deleting a token removes its membership, with wounds attributable to an already-defeated member removed from the shared total so another survivor is not defeated twice. Deleted tokens cannot rejoin through healing. Keeping casualties on the scene is the reversible workflow.

During combat, the first member's committed drag spends a shared manoeuvre. Each other active member can complete one drag under that same manoeuvre. A further drag by an already-moved member needs another ready manoeuvre. This is persisted in the common turn ledger and survives reloads. It does not infer how many narrative manoeuvres a long map move should cost. Minions cannot buy manoeuvres with strain; the group can trade its action under the usual turn controls.

Linked combat groups cannot currently split among vehicle stations or board as individual members. Use the existing aggregated minion crew workflow for vehicle occupants. Splitting/merging established linked groups and choosing a different casualty order are not yet implemented.
