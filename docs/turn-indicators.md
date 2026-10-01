# Actions and manoeuvres

The character sheet keeps the turn strip visible on every tab. On the canvas, only selected, controlled tokens show the same lights above their artwork. Filled lights are available; hollow lights are spent. A purchased or awarded manoeuvre adds a temporary amber light with a dashed edge.

The canvas strip moves clear of the token's right-click controls, including the elevation field, rotation buttons and expanded palettes. It also avoids visible windows and canvas controls, choosing a nearby position inside the viewport when there is no room above. Closing the HUD restores the usual position. Layout follows pan, zoom, window movement and palette changes through coalesced frame updates; there is no idle polling.

Rendered elevation, level and name labels also reserve space, including labels on nearby tokens. Their measured canvas bounds account for camera zoom and display scale. Height edits and token visibility refreshes reposition or restore the strip without requiring reselection.

Under **Game Settings → Star Wars FFG → Turn indicators: player control**, the GM chooses:

- **GM / automatic only** (default): the GM manages manual spending, additions, undo and resets. Player checks and committed moves still update automatically.
- **Players manage their own indicators**: owners may also spend, buy, trade, grant, undo and reset their own indicators. The same manoeuvre cap applies. Configuring base allowances and confirming conditional talent activations remain GM tasks.

The selected world policy is checked when the authoritative GM or owner commits a request, as well as when rendering controls. Requests are serialized by actor UUID, including separate unlinked actors. Resource payment and the expenditure ledger are saved together. A second request cannot spend the same remaining action. This is a cooperative Foundry workflow; owners retain Foundry's normal document-editing permissions.

Characters start with one action, one free manoeuvre and a maximum of two manoeuvres in a turn. After using the free manoeuvre, **+** pays two strain by default and prepares another light. **Trade action** instead exchanges the action for that light. Spending the light then uses the manoeuvre. **Adjust → Grant manoeuvre** handles a rules award, within the cap. **Undo** reverses the last entry and its recorded resource payment; **Reset turn** restores allowances without healing strain or wounds.

During combat, completed native skill checks spend the selected **Turn cost**: Action, Manoeuvre, or Incidental / already spent. The full pool builder and a combat attack sent to the quick tray expose that choice. Cancelling the builder and failed dice evaluation do not spend. Initiative is excluded. Unclassified raw dice and Force-resource rolls do not infer an action. Both `actor.rollSkill` and the native DoR adapter use the same check path; integrations can pass `turnCost: "none"` for a check already paid for.

With **automatic token drags** enabled, one committed drag in combat spends one ready manoeuvre after the move completes. A movement preview does not spend. An exhausted actor must buy, trade or receive a light before another drag. Keyboard nudges, token configuration, API moves, undo and forced moves do not infer expenditure. Integrations may mark an update `starWarsFreeMovement: true` or explicitly spend through the API. A drag is one movement declaration, not a conversion from metres into narrative manoeuvres: the GM handles a move requiring more than one manoeuvre and movement granted outside the actor's turn. The automatic-drag setting can be disabled for tables that prefer manual declarations.

Vehicle movement preserves the hull's current facing, even when Foundry's **Automatic Token Rotation** preference is enabled. Reversing or translating sideways does not automatically rotate the hull or its firing arcs. Use the right-click **CW/CCW** buttons to turn explicitly (45°, or 15° with Shift); integrations can supply an explicit rotation update. Personal tokens retain Foundry's preference. This separates facing from movement presentation; vehicle-specific manoeuvre restrictions remain a rules/GM decision.

Advancing a combat round restores the lights without changing accumulated strain. Revisiting a recent round restores its recorded spending; the ledger retains the latest twenty visited round keys. Outside combat the strip is manual, with an explicit reset. Ordinary Star Wars initiative slots still require the table to decide who acts in a slot; the tracker does not spend another actor's allowance when the combat cursor moves.

Minions cannot voluntarily pay strain. Rivals pay wounds instead. Vehicles show a separate pilot-only manoeuvre budget: one free, at most two for silhouettes 1–4, at most one for silhouette 5+. The extra vehicle manoeuvre costs system strain. The pilot must also spend their own manoeuvre and any personal strain; no arbitrary crew member is charged automatically. Vehicle actions belong to crew members.

Base allowances are editable by the GM under **Adjust → Allowances** on a character sheet. Prepared Active Effects on `system.turnEconomy` are included. Learned specialization/signature nodes and owned talent Items may declare structured effects such as:

```json
{
  "activation": "Passive",
  "effects": [
    { "type": "turn", "target": "freeManeuvers", "operation": "add", "count": 1 }
  ]
}
```

Targets are `actions`, `freeManeuvers`, `maneuverLimit` and `strainCost`; values are bounded to 0–10. A turn effect can require a native skill key and minimum rank through `requirements: {"skill":"pilotingSpace","minimumRank":3}`. Ranked learned nodes stack; duplicate unranked rules do not. Skill rank alone does not grant extra actions. Active turn effects appear for GM confirmation after checking their prerequisites and separate costs. A talent without an encoded effect does not silently modify the budget, and changing the cost of a particular task is not treated as an extra general action.

Public integration surface:

```js
game.system.api.turns.read(actor);
await game.system.api.turns.perform(actor, "maneuver");
await game.system.api.turns.perform(actor, "buyManeuver");
await game.system.api.turns.perform(actor, "reset");
await game.system.api.turns.rotateToken(token.document, "cw", 45);
```

DoR actor context includes the same remaining allowances, expenditure, resource, applicable rules and unresolved talent decisions. This records known mechanics; it does not imply every expansion talent has been encoded or live-tested with DoR.

Rules checked against *Edge of the Empire Core Rulebook*: pp. 199–203 (incidental, manoeuvre and action economy), p. 232 (vehicle pilot-only manoeuvres), and pp. 389–391 (adversary handling). This guide is original implementation documentation; use the books for complete rules and exceptions.
