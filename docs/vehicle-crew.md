# Vehicle crew and passengers

The vehicle sheet's **Crew & Passengers** tab follows **Overview**. The GM can prepare a crew before placing a vehicle, or generate extra occupants for an existing token. Boarding belongs to a placed vehicle on the current scene. Select the intended token when several copies of an actor exist.

## Generate a crew

Choose **Generate crew**, select a species from the campaign-filtered catalogue, set specialist skill rank, and enter counts for each duty. The species field includes fuzzy search. Defaults fill vacant crew places with one pilot and unassigned support crew; passenger places remain empty until requested. **Preview crew** shows every proposed NPC sheet before **Create crew** writes anything. Back preserves the choices; closing either window cancels creation.

Pilot, Co-pilot, Gunner, Engineer, Navigator and Commander presets are individual rivals trained in the corresponding duty skills. Support crew and passengers are untrained minion groups of at most 100. Species characteristics and thresholds come from the recorded profile. These are original editable NPC presets, not complete official adversary blocks: the sheets retain a species-ability review marker, and do not invent equipment, talents or XP. Procedural portraits follow the species and NPC category. No AI service is involved.

For an unplaced vehicle, the NPC Actors appear in the directory and in its prepared roster. Open their sheets to edit them; **Remove** removes only the prepared reference and keeps the Actor. When a GM is connected, placing a vehicle automatically attaches unlinked copies of its prepared crew to that token. Each vehicle copy receives independent crew tokens. The sheet also offers **Board prepared crew** to retry after a missing actor or capacity issue is repaired. Already deployed members are not recreated after they disembark.

For an existing vehicle token, generation boards only the new members and preserves current occupants. Capacity and pilot exclusivity are checked again inside the boarding transaction before creation. At most 1,000 occupants or 50 NPC Actors are generated per batch; large support complements use minion groups. A failed creation rolls back only documents created by that batch and reports any cleanup failure explicitly.

## Canvas controls

Double-click an occupant row in **Crew & Passengers**, or its portrait in the crew pop-up, to open its character sheet. Focus the row or portrait and press Enter or Space for the keyboard equivalent. Prepared entries open the world Actor; occupants aboard open their own token Actor, including individual minion groups. Foundry sheet-view permissions still apply. The compact pop-up uses portraits instead of separate sheet-opening buttons.

Two small circles sit together in the vehicle's lower-right corner. The vacancy circle shows the combined number of free crew and passenger places; hover for the separate counts. It displays `+` for one free place, `0` when full, and `?` when the GM needs to configure an exact capacity. Large complements use compact numbers.

The adjoining circle displays the assigned pilot's portrait and represents everyone aboard. Without a pilot it uses a crew symbol. Click it to open the complete roster, assign duties, open an owned character's sheet, or choose who disembarks. The window can be resized; its roster scrolls independently of the bottom action button. Neither individual portraits nor role buttons cover the canvas. Both circles, their text and their spacing shrink with the token when zooming out. Placement uses the actual rotated hull boundary, so screen-edge clamping cannot push them outside the vehicle. The pair moves to the upper corner when the lower edge is off screen; it hides if too little of the hull remains visible to contain it. The sheet tab remains available at every zoom level.

Drag a character or NPC onto a vehicle and confirm entry as crew or passenger. The original token is suppressed on the canvas while aboard, retaining its own actor, items, dimensions and turn state. Its position and vision origin follow the vehicle. The vacancy circle also offers a character chooser.

Drag the pilot/roster circle back onto the canvas to choose which occupants appear at that position. The chooser starts with zero selected, so the representative pilot portrait never causes the whole crew to disembark accidentally. The pop-up also permits departure beside the vehicle without dragging.

## Groups and duties

Minion groups occupy one place per surviving member. Their roster entry includes the member count. Separate groups remain separate documents even when they share a name and portrait; numbered group labels, counts and owned-character wound totals help distinguish them. A partial departure creates a separate unlinked group. Existing wounds remain aboard; the departing members are unwounded. This preserves total group size and avoids changing other copies of the base actor.

Crew can hold Pilot, Co-pilot, Gunner, Engineer, Navigator and Commander duties. Only one primary pilot is assigned at a time; clear the current pilot before assigning another. Passengers must leave and reboard into a crew place before taking a station. Assignment changes take effect immediately in the pop-up.

Checks from the vehicle sheet use the assigned character's actual characteristics, skill ranks and learned talent modifiers. Multiple eligible characters produce an explicit chooser. Piloting adds the vehicle's positive or negative handling before applicable talent adjustments. Gunnery uses silhouette comparison for base difficulty while still checking weapon reach; a vehicle target's defence zone must be agreed and selected. No crew member or statistic is invented when an assignment is missing.

Completed crew checks use the character's own combat allowance, including when only the vehicle is listed in combat. The vehicle's pilot-manoeuvre allowance remains separate. Personal manoeuvre expenditure for piloting, individual weapon firing limits, arcs, speed restrictions, narrative positioning and unencoded special actions still require player/GM adjudication. Role assignment alone does not automate all starship combat rules.

## Ownership and persistence

The GM can board or assign any character. Players need ownership of both character and vehicle to board or change duties, and character ownership to disembark. Other visible occupants appear read-only; hidden occupants are omitted from player-facing rosters. Seat changes are serialized by the active authority, including competing requests for the last place.

Numeric crew/passenger capacities come from the actor's database profile. **Configure seating**, available to the GM on the sheet tab, sets explicit usable capacities where the published complement is prose or differs from the desired seats. Capacity never creates background crew actors automatically.

Membership persists on scene Token documents across reloads. Live occupants and their ongoing state do not transfer automatically to another scene or to a copied token. A prepared roster is a reusable creation template, not a transfer of existing crew. Removing a vehicle releases its occupants. A production campaign should keep its original source material available for rules not encoded by the system.

## Integration

`game.system.api.crew` provides `roster(vehicleToken)`, `context(vehicleActor)`, `capacities(vehicleToken)`, `vehicleForActor(actor)`, `assignedCheck(vehicleToken, skill, optionalMemberId)`, `board(characterToken, vehicleToken, seat)`, `leave(characterToken, optionalPoint)`, `toggleRole(characterToken, role)` and `openCheck(vehicleToken, skill, optionalWeapon)`.

These functions use real Foundry documents in the authenticated client. Boarding and duty changes follow the same ownership and transaction checks as the interface. A point is a scene-space `{x, y}` centre for the departing token. `context` supplies serializable capacities and visible token/actor references; the Director adapter includes these as `crewAssignments`.

GM clients can also call `generate(vehicleActorOrToken, {speciesId, rank, counts})` and `deployPrepared(vehicleToken)`. Counts use `pilot`, `copilot`, `gunner`, `engineer`, `navigator`, `commander`, `support` and `passenger`. The generation API validates the current campaign catalogue and seats just like the interface.

`vehicleActor.rollSkill(skill, options)` delegates to the assigned character, accepting `vehicleToken` and `crewTokenId` to resolve ambiguity. Programmatic callers must supply an adjudicated difficulty and situational modifiers; use `openCheck` for the interactive range, silhouette and defence-zone workflow. DoR consumption of the new crew context has not yet received a live campaign test.
