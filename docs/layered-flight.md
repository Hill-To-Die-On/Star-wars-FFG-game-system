# Layered flight and vertical combat

Use Foundry 14's native scene levels for Ground, Sky, Orbit, decks, or other altitude intervals. Configure each level's lower and upper elevation and which other levels it displays. Altitude is absolute in the scene's distance units: changing the viewed level does not change a token's altitude or identity.

Select an owned token and open **Star Wars → Flight · level and altitude**. Choose a level and altitude, then Move. The dialog uses Foundry's normal movement operation, preserves facing, and keeps the existing actor and token. Embarked occupants follow the vehicle's level and elevation with their assignments intact. Disembarking places them at the vehicle's current level. A character passing across a ship on the screen cannot board it from a different level or non-overlapping altitude.

Players can move their own tokens to visible levels while the game is running. Other levels require the GM. Invalid heights, unowned tokens, independently moving an embarked occupant, and a paused game reject the request. The GM still adjudicates the manoeuvre or action required by the flight; the control does not infer new turning or flight-cost rules.

## Firing paths

The attack card displays how far above or below the attacker the target lies. Physical maps combine the usable horizontal firing line with the absolute elevation difference. Personal, Ship/vehicle and Battlefield ranges continue to follow the attacker and scene context. Dorsal and ventral remain recorded weapon-mount restrictions; they do not add shield zones or invent pitch angles.

Sight checks use Foundry's level-specific wall collision API and its native Region surfaces for floors, ceilings and other opaque planes. Each part of a cross-level ray is checked only within the corresponding altitude interval, including intermediate levels. A low wall therefore does not block a shot passing above its level, while the same wall placed at the ray's altitude does. Native walls span their assigned level. To represent a lower obstruction, give it an appropriate level interval; images alone do not establish solid geometry.

Visible intervening actors use their configured token depth, converted from grid spaces to scene units. Vehicle obstructions use rotated rectangular hulls. Characters use their round or oval footprints. A shot must intersect both footprint and height before an actor blocks it. Embarked occupants do not obstruct their vehicle. Hidden and currently unseen tokens are excluded from player-facing measurements; supplying a hidden target's ID does not return its distance, name, or token ID.

Automatic firing requires a verified sight result. Missing collision support, unmodeled altitude gaps, overlapping cross-level volumes, invalid token-level assignments, and vertical Theatre-of-the-Mind checks request a GM ruling. The Manual pool remains available. The normal same-level path does not import unrelated alternative levels occupying the same altitude.

This remains a bounded canvas interpretation of abstract range and firing arcs. It does not infer solid geometry from art, choose extra shield zones, or search every possible three-dimensional firing point on a hull. Very narrow clear gaps and ambiguous level layouts still need the GM.

## Integration result

The shared `game.system.api.range.measureTokenRange` result now includes:

- `vertical`: target direction (`above`, `below`, `level`) and absolute separation.
- `sourceLevelId` and `targetLevelId`: the measured tokens' native levels.
- `sightBasis`: `native-levels`, `two-dimensional`, or `unverified`.
- `requiresGmRuling` and `sightReason`: an explicit stop for automation when geometry cannot establish a valid shot.

Consumers must treat `requiresGmRuling: true` as a stop for automatic combat even if a two-dimensional range band is available. Foundry level visibility and token permissions apply to each client's result.

The implementation uses the public [Scene surface collision API](https://foundryvtt.com/api/v14/classes/foundry.documents.Scene.html#testsurfacecollision), [PointSourcePolygon collision API](https://foundryvtt.com/api/v14/classes/foundry.canvas.geometry.PointSourcePolygon.html#testcollision), and [native Level documents](https://foundryvtt.com/api/v14/classes/foundry.documents.Level.html). It does not call protected detection-mode methods or copy Foundry implementation source.

## Verification: 29 September 2026

Red-first geometry tests cover ascending/descending rays, height slabs, intermediate levels, invalid or overlapping intervals, same-level view isolation, rotated hull volumes, vertical intersections, and relationship labels. Adapter tests cover level and surface options, asynchronous/failing backends, permissions, hidden targets, invalid heights and paused games. The visibility test was mutation-proved: removing its guard failed the test; restoring it passed. Crew tests reproduce and fix both missing level-follow and boarding across different heights.

Live acceptance used Foundry **14.368**, system **0.3.0**, no active add-on modules, and a separate world on a separate server. Nine native-runtime checks passed: a 9 m horizontal / 39 m vertical shot measured 40.024992 m; Ground versus Sky wall placement changed obstruction correctly; a native deck surface blocked the shot; the existing pilot retained identity and assignment after moving with its ship; measurements survived a real view switch; disembarking retained altitude; and vehicles retained their separate range scale.

Five further checks passed with one GM and two independent player browser contexts. All three agreed on cross-level range. Both players received no target details for hidden or unviewed-level targets. Only the owner could request flight. A player submitted the Flight dialog and the same token's altitude synchronized on all three clients. Browser error capture was empty. The Flight dialog was also inspected for padding, text contrast and first-login-window interference.

These checks cover the native level model and basic player visibility. Third-party occlusion modules, image-derived geometry and arbitrary intersecting level volumes are not certified by this evidence.
