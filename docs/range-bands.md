# Range bands

The system adds a **Star Wars FFG · Range bands** group to Foundry's left scene controls. The overlay is a table aid for narrative distance. It does not replace line-of-sight, elevation, weapon qualities, movement rules or a GM decision.

## Use at the table

1. Open the range-band control group and use **Select range origin** to select a token.
2. Toggle **Show colour range bands**. Every boundary has a text label as well as a colour.
3. Leave **Keep multiple selected origins** off to make the overlay follow the latest selected token. Turn it on to retain each newly selected origin until **Clear range origins** is used.
4. The GM uses **Range scale** to choose the scene context:
   - **Personal** uses Engaged, Short, Medium, Long and Extreme. A Theatre-of-the-Mind click anchors Short.
   - **Ship / vehicle / space** uses Close, Short, Medium, Long and Extreme for spacecraft-scale scenes. A Theatre-of-the-Mind click anchors Close.
   - **Battlefield / planetary** uses Close, Short, Medium, Long and Extreme for surface battles that can span districts or cities. A Theatre-of-the-Mind click anchors Close.

On a gridded scene, the configured grid size, distance and unit supply the scale. Common metric and imperial units are converted to the approximate boundaries in the supplied range reference. Other unit labels use relative grid-space boundaries. A stored Theatre-of-the-Mind calibration is ignored while that map scale is available.

On a gridless scene, select an origin and choose **Calibrate Short range** or **Calibrate Close range**. Move the pointer to that boundary and click. The calibration is stored on that scene and retained separately for each of the three scales. **Clear current ToM calibration** removes only the active scale's value.

## Rolls and integrations

When an acting character has a token on the scene and the user targets another token, the skill-sheet pool builder reads the measured band automatically. **Modify this pool** and Manual mode remain available for narrative adjustments.

External tools can read the same result:

```js
const source = canvas.tokens.controlled[0];
const target = [...game.user.targets][0];

game.system.api.range.measureTokenRange(source, target);
game.system.api.directorOfRealms.getCombatRange(source, target);
```

The result reports availability, canonical scale, band, map or Theatre-of-the-Mind mode, pixel distance, and map distance/units when present. An uncalibrated gridless scene fails closed instead of guessing a band. A target outside the displayed Extreme boundary reports `beyond`, which prevents an automatic attack pool until the table changes the range or makes a manual ruling.

Measurements are two-dimensional and center-to-center. Token size, vertical separation, obstructions and terrain do not change the computed band.
