# Layered flight and vertical combat

Layered flight lets ships, vehicles and characters move between Foundry 14's native scene levels, such as Ground, Sky and Orbit, and checks line of sight and range across those levels in combat. It is for GMs who build multi-level scenes and for players who fly or move their own tokens.

## Set up levels

Use Foundry's native scene levels for Ground, Sky, Orbit, decks or any other altitude interval. For each level, set its lower and upper elevation and choose which other levels it displays.

Altitude is absolute and measured in the scene's distance units. Changing the level you are viewing does not change a token's altitude or identity.

## Move a token between levels

1. Select a token you own.
2. Open **Star Wars → Flight · level and altitude**.
3. Choose a level and altitude, then select **Move**.

The dialog uses Foundry's normal movement operation, preserves facing, and keeps the existing actor and token. Embarked occupants follow the vehicle's level and elevation with their assignments intact. Disembarking places them at the vehicle's current level. A character who appears to pass across a ship on screen cannot board it from a different level or a non-overlapping altitude.

### Who can move

Players can move their own tokens to visible levels while the game is running. Other levels require the GM. The request is rejected for an invalid height, an unowned token, an embarked occupant moving on its own, or a paused game.

The GM still decides which manoeuvre or action the flight requires. The control does not add turning or flight-cost rules.

## How vertical shots are checked

The attack card shows how far above or below the attacker the target is. On physical maps, the usable horizontal firing line is combined with the absolute elevation difference. Personal, Ship / vehicle and Battlefield ranges still follow the attacker and scene context, as described in [Range bands](range-bands.md). Dorsal and ventral remain recorded weapon-mount restrictions; they do not add shield zones or invent pitch angles.

### Walls and surfaces

Sight checks use Foundry's level-specific wall collision and its native Region surfaces for floors, ceilings and other opaque planes. Each part of a cross-level ray is checked only within the matching altitude interval, including any intermediate levels. A low wall therefore does not block a shot passing above its level, while the same wall placed at the ray's altitude does.

Native walls span their assigned level. To represent a lower obstruction, give it a suitable level interval. Images alone do not create solid geometry.

### Actors in the way

Visible intervening actors use their configured token depth, converted from grid spaces to scene units. Vehicles block as rotated rectangular hulls; characters block as round or oval footprints. A shot must intersect both the footprint and the height before an actor blocks it. Embarked occupants do not obstruct their own vehicle.

Hidden and currently unseen tokens are left out of player-facing measurements. Supplying a hidden target's ID does not return its distance, name or token ID.

### When the GM must rule

Automatic firing needs a verified sight result. The system asks for a GM ruling, and the Manual pool remains available, when any of these apply:

- collision support is missing;
- there is an altitude gap that the levels do not model;
- level volumes overlap across levels;
- a token's level assignment is invalid;
- the check is a vertical Theatre-of-the-Mind check.

On a normal same-level path, unrelated alternative levels occupying the same altitude are not included.

## For integrators

The shared `game.system.api.range.measureTokenRange` result includes:

- `vertical`: target direction (`above`, `below` or `level`) and absolute separation.
- `sourceLevelId` and `targetLevelId`: the measured tokens' native levels.
- `sightBasis`: `native-levels`, `two-dimensional` or `unverified`.
- `requiresGmRuling` and `sightReason`: an explicit stop for automation when the geometry cannot establish a valid shot.

Treat `requiresGmRuling: true` as a stop for automatic combat, even if a two-dimensional range band is available. Foundry level visibility and token permissions apply to each client's result.

The implementation uses Foundry's public [Scene surface collision API](https://foundryvtt.com/api/v14/classes/foundry.documents.Scene.html#testsurfacecollision), [PointSourcePolygon collision API](https://foundryvtt.com/api/v14/classes/foundry.canvas.geometry.PointSourcePolygon.html#testcollision) and [native Level documents](https://foundryvtt.com/api/v14/classes/foundry.documents.Level.html). It does not call protected detection-mode methods or copy Foundry implementation source.

## Limitations

- This is a bounded canvas interpretation of abstract range and firing arcs. It does not infer solid geometry from artwork, choose extra shield zones, or search every possible three-dimensional firing point on a hull.
- Very narrow clear gaps and ambiguous level layouts still need the GM.
- The flight control does not decide which manoeuvre or action a change of level costs.
- Third-party occlusion modules, image-derived geometry and arbitrary intersecting level volumes have not been tested with this feature.
