# Range bands

The system adds a **Star Wars FFG · Range bands** group to Foundry's left scene controls. The overlay is a table aid for narrative distance. It does not replace weapon qualities, movement rules or a GM decision.

## Use at the table

1. Open the range-band control group and use **Select range origin** to select a token.
2. Toggle **Show colour range bands**. Every boundary has a text label as well as a colour.
3. Leave **Keep multiple selected origins** off to make the overlay follow the latest selected token. Turn it on to retain each newly selected origin until **Clear range origins** is used.
4. The GM uses **Range context** to describe the scene, while the selected attacker resolves the displayed scale:
   - A character, minion, rival or nemesis uses **Personal** ranges: Engaged, Short, Medium, Long and Extreme. A Theatre-of-the-Mind click anchors Short.
   - A ship or vehicle in an ordinary or space scene uses **Ship / vehicle / space** ranges: Close, Short, Medium, Long and Extreme. A Theatre-of-the-Mind click anchors Close.
   - A ship or vehicle in a **Battlefield / planetary** scene uses the longer surface-battle ranges. A personal attacker on the same scene retains Personal ranges.

On a gridded scene, the configured grid size, distance and unit supply the scale. Common metric and imperial units are converted to the approximate boundaries in the supplied range reference. Other unit labels use relative grid-space boundaries. A stored Theatre-of-the-Mind calibration is ignored while that map scale is available.

On a gridless scene, select an origin and choose **Calibrate Short range** or **Calibrate Close range**. Move the pointer to that boundary and click. The calibration is stored on that scene and retained separately for each of the three scales. **Clear current ToM calibration** removes only the active scale's value.

The origin caption sits beneath the token's displayed name and minion count, with a gap that remains visible when zooming out. Placement uses the rendered nameplate bounds, including wrapped text and Foundry's UI scale. Late name/count updates reflow the caption and the space reserved around it for range labels and combat cards.

Range labels aim along one guide from each origin toward the furthest corner of the unobscured browser viewport. This makes the most distant visible bracket use the longest available sightline. Each label follows its band's outline when the camera, sidebar or origin changes. Tokens, tiles, drawings, map notes, actor names, turn indicators, combat cards and open windows repel overlapping labels along that outline. If a band contains the whole viewport and its outline is off screen, its label glides to a non-overlapping edge position. A band that is wholly outside the viewport remains hidden.

The overlay begins at the origin token's **edge**. Character bands expand around a round base; vehicle bands expand around the rectangular occupied footprint, with curved corners. A target enters a band when its nearest edge reaches that boundary. Vehicle footprints and their expanded outlines follow token rotation unless rotation is locked. Portrait padding and image scaling do not change the measured footprint.

## Combat range assistant

**Combat range assistant** in System Settings controls what happens when an encounter begins:

- **Automatic** shows the overlay and follows the active combatant. Each origin combines its actor type with the scene context: personal actors use Personal, ordinary vehicles use Ship / vehicle and vehicles in a Battlefield scene use Battlefield. A new all-person encounter starts with Personal context and a new all-vehicle encounter starts with Ship / vehicle context. Mixed encounters ask the GM to choose the context.
- **Ask when combat starts** lets each user decide whether to show the encounter overlay.
- **Off** leaves the range tool entirely manual.

**Follow the active combatant with range bands** moves the primary origin at each turn change. Multiple-origin mode continues to retain pinned origins. An uncalibrated Theatre-of-the-Mind encounter asks the GM to place its range anchor. When the encounter ends, an automatically opened overlay returns to its previous visibility and origin state; manual changes made during combat are respected.

Targeting a combatant adds its measured range to that combatant's tracker row. A blocked Foundry sight line is identified on the same badge. Target changes and completed token moves refresh the badge without continuously polling the canvas.

## Animated attack trace

**Animate attacker-to-target line** is enabled by default and can be toggled from the range controls. Select or activate an attacker, then target an opponent. The system draws the line over two seconds and reveals its status card only when the animation completes.

- A clear line is solid and uses the target's measured range colour.
- If the nearest part of a large target is obscured or outside the selected weapon's firing arc, the assistant checks other parts of its outline against sight walls, visible tokens and the weapon's arcs. It refines clear paths on either side and draws the shortest usable shot it finds. That shot's length sets range and weapon reach. A personal ranged attack can gain another difficulty die when a farther exposed section crosses a band; vehicle Gunnery retains silhouette-based difficulty. An obscured nearest point reports **CLEAR path · nearest point obscured** and **COVER · GM review**; cover dice are never guessed.
- The line stays solid to the first sight wall or visible intervening token, then continues as a red dotted line to the target. Hidden tokens are not exposed to players.
- The card names the attacker, target, weapon and skill and reports range, map distance, line of sight, Defence, Adversary and the complete automatic pool.
- The card glides clear of visible tokens, props, map annotations, actor names, turn indicators, other combat cards and open windows. Camera, window, sidebar and placeable changes trigger a new placement only when needed; there is no idle animation loop. Range labels then move around the card. Reduced-motion preferences disable the glide. If the screen has no clear space large enough, the card stays inside the viewport at the least obstructed position.
- A valid card says **SEND DICE TO POOL**. Clicking it replaces the compact chat-side pool with those exact dice while retaining the attacker, weapon, automatic results and applied-rule notes.
- Add or remove Boost, Setback and other dice in the tray before using its roll button. Loading a second attack replaces the previous staged pool rather than combining two attacks.
- A blocked, out-of-range or otherwise invalid card explains the status and will not send dice. The character sheet's Manual pool remains the GM override path.
- Vehicles automatically compare legal mounted weapons with eligible assigned gunners. They use the crew actors' actual characteristics, skills and automatic modifiers; an uncrewed vehicle cannot invent a gunner.

## Vehicle arcs and attack selection

By default **Auto strongest** chooses the legal weapon/gunner combination with the greatest expected raw impact, then hit chance and shorter shot as tie-breakers. It calculates the exact success/failure distribution of the pool and converts vehicle damage to personal-scale units for comparison. This is a transparent heuristic before armour, weapon qualities, ammunition expenditure and optional symbol spending, not a guarantee of the tactically best choice. Ion effects, limited ammunition and other situational priorities remain table decisions.

Use **Choose arcs on ships** on the combat card for the canvas workflow:

1. Target an opponent as usual.
2. Hover the attacking ship's Fore, Aft, Port or Starboard section to preview that arc's strongest available attack. The two smaller central **Up / Down** sections select recorded dorsal / ventral mounts. Click a valid section to lock the firing choice. Red sections explain why they cannot fire.
3. For a vehicle target, hover its defensive hull faces to move the shot to an exposed point on that face and preview its shields, distance and pool; click to confirm the agreed zone. A far-side or obscured zone cannot be selected through the hull. Standard vehicle data has four shield zones; the central Up / Down controls are disabled on this step instead of inventing extra shield values. The sheet's Manual mode remains available when the GM makes a narrative shield-zone ruling instead of using this canvas convention.

Hovering only previews; it does not alter the saved choice, roll dice or spend a resource. **Back to attacker**, **Auto strongest**, and **Cancel / Escape** are available. Keyboard focus previews each section and Enter selects it. Pan and zoom keep the controls attached to the hull. Token changes or changing targets cancel an unfinished selection. The final **Send dice to pool** still stages editable dice without rolling.

The optional **Weapon / gunner options** control retains explicit mount and crew selection. A manual choice remains selected for that client until Auto is restored or the page reloads; if it becomes blocked or the weapon is removed, the system reports the problem instead of silently replacing it. Shield choices are bound to the chosen target.

Both the attacker and defender overlays anchor their boundaries to the hull corners. Fore and Aft cover the front and rear faces; Port and Starboard cover the side plating. The internal joins bisect each corner at 45 degrees, and firing-zone boundaries extend outward from those same corners. Long hulls therefore have small end wedges and longer side regions. Labels, hover regions, shot validation and the range used for the automatic pool use this shared geometry. The defence endpoint must reach the actual selected face; it cannot stop partway down the side and count as Fore. Shared corners and firing boundaries permit either adjacent zone.

A defensive corner also needs the correct approach direction: the shot must arrive from outside the selected face. A shot coming from above-left can reach the Aft/Port corner of a south-facing target, but cannot count as hitting the hidden right-hand Port face. Exactly tangent rays do not expose a face. The same test follows the target's rotation and prevents the picker from committing or staging an inaccessible zone.

This corner-based layout is the system's canvas convention, rather than the centre-based 90-degree diagram in the core book's Fire Arcs section. Native Foundry rotation is retained, with south at zero. Imported `metadata.fireArcs` and `metadata.location` still restrict which zones a weapon supports; **Firing arcs override** on the weapon sheet permits a deliberate correction. Unknown arcs fail closed. Dorsal/ventral restrictions use relative token elevation and never infer a vertical mount from a side-mounted weapon. Manual pools remain available for a GM ruling.

Elevation contributes to distance, but the current wall/sight backend is two-dimensional. Layered flight, height-aware occluders and cross-level visibility are the next roadmap item. A clear planar ray does not establish unobstructed three-dimensional flight or fire; the GM must adjudicate those cases until that work is verified.

Range resolution combines the GM's scene context with the attacker. Selecting a personal token displays and measures Personal bands. Selecting a vehicle displays and measures Ship / vehicle bands, except on a Battlefield scene where that vehicle uses the longer Battlefield bands. This same resolved scale drives attack traces, automatic pools and the public/DoR measurement APIs. A newly started all-character or all-vehicle combat can infer the initial context through the combat assistant, while mixed encounters ask the GM.

## Rolls and integrations

When an acting character has a token on the scene and the user targets another token, the skill-sheet pool builder reads the measured band automatically. **Modify this pool** and Manual mode remain available for narrative adjustments.

External tools can read the same result:

```js
const source = canvas.tokens.controlled[0];
const target = [...game.user.targets][0];

game.system.api.range.measureTokenRange(source, target);
game.system.api.directorOfRealms.getCombatRange(source, target);

// Pass a mounted weapon to constrain the measurement to its recorded arcs.
game.system.api.range.measureTokenRange(source, target, { weapon, fireArc: "fore", defenseZone: "aft" });
game.system.api.range.vehicleAttackOptions(source, target);
game.system.api.range.chooseAttackArcs(source, target);
```

The result reports availability, canonical scale, band, map or Theatre-of-the-Mind mode, pixel distance, map distance/units, vertical separation and wall line of sight when those Foundry scene references are available. An uncalibrated gridless scene fails closed instead of guessing a band. A target outside the displayed Extreme boundary reports `beyond`, which prevents an automatic attack pool until the table changes the range or makes a manual ruling. A sight-blocking wall also stops an automatic ranged roll; Manual mode remains available for a GM-approved exception.

Measurements start with the shortest **edge-to-edge** gap between token footprints. When that segment is blocked but an alternate shot is clear, combat measurements use the clear shot's length instead. Scaled maps combine the chosen horizontal distance with the tokens' elevation difference before selecting a band; no token height is assumed. Touching or overlapping bases have zero geometric horizontal separation. Gridless Theatre-of-the-Mind calibration remains two-dimensional. Its pointer sets the distance from the origin's edge to the Short/Close boundary. Existing saved anchor distances are retained and now extend from the edge; recalibrate to keep a previous visual boundary in exactly the same place. The range overlay continues to show distance from the footprint, while the targeting line identifies the usable firing path.

The shared sheet/DoR result identifies `measurement: "edge-to-edge"` and returns `sourceEdge` and `targetEdge` as the geometric closest points, including rectangle corners and rotated hulls. `traceSource` and `traceTarget` describe the selected firing segment. `distanceBasis: "clear-shot"`, `sightPath: "alternate"` and `partiallyObscured: true` identify a diverted shot; ordinary shots report `nearest-edges` and `nearest`. The main distance and band fields always drive the attack pool; `nearestDistancePx` and `nearestSceneDistance` preserve the geometric gap separately. Overlapping footprints fall back to centres for their initial sight ray. If no checked path is clear, the original blocked ray and first obstruction remain visible.

The visibility search uses 32 outline samples plus exact intersections with outward firing rays from hull corners and face centre lines, the selected defensive face's corners and its nearest point, followed by 14 refinement steps on each side. It runs only after the nearest ray is blocked or outside the allowed arcs/zones. The extra boundary points preserve shots shared at exact hull corners and firing boundaries. Ordinary clear shots require one wall query; other cases remain bounded by 88 per distinct arc profile. Weapon/gunner comparisons reuse geometry within the same evaluation. Each candidate must clear walls, visible tokens and the allowed arc/zone on the same segment, and missing wall checks never count as clear. There is no idle polling. This is a bounded search, not a full visibility polygon: a very narrow gap between samples may still require the Manual pool. Cover, access to a hatch, and whether an apparent engagement is possible require GM judgement.

This is a canvas measurement convention, not a precise miniature rule prescribed by the books. *Edge of the Empire Core Rulebook*, printed pages 208–209, describes abstract relative range and places final range adjudication with the GM. The numeric boundaries used by this overlay remain a table aid.
