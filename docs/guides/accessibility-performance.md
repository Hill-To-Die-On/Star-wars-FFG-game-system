# Accessibility and performance

This guide describes the keyboard controls for the system's searchable fields, vehicle attack choices and crew portraits, and how the system responds to a reduced-motion preference. It is for players and GMs who use a keyboard or assistive technology, or who prefer less animation.

These improvements cover complete keyboard selection and cancellation workflows. They are not a WCAG conformance certification.

## Searchable fields

The **Species**, **Career**, **Model** and **Manufacturer** fields are editable comboboxes.

| Key | Action |
| --- | --- |
| Type | Filter the results |
| Up / Down | Preview a result |
| Home / End | Preview the first or last result |
| Enter | Choose the previewed result |
| Escape | Restore the current value and close the results |
| Tab | Close the results without choosing unfinished text |

Focus stays in the text field throughout. The list reports whether it is open, which result is active and which is previewed, and a polite status message announces the number of matches. The campaign rules, database checks and the GM's homebrew policy still decide which choices are available.

## Vehicle attack choices

Alongside the sectors on the canvas, vehicle attack selection offers ordinary buttons with a visible focus outline.

1. Choose a firing arc.
2. Choose a defensive zone.

Every button is at least 44 pixels tall. **Escape** or **Cancel**, like a completed choice, returns focus to the control that opened the selector. The target still has four shield zones; **Up** and **Down** remain the weapon mount choices.

## Crew portraits

- **Enter** or **Space** on a crew portrait opens that character's sheet, with the same permission check as clicking it.
- **Escape**, or switching away from the window, cancels a crew drag.
- Closing the scene or the window that contains the drag also removes the drag and its preview image.

## Reduced motion

The range overlay follows your operating system or browser reduced-motion preference while it is open, including changes you make during play.

- When reduced motion is switched on, the attack trace and moving labels stop at once and show their final status.
- Switching back to normal motion does not replay a trace that has already finished.
- Minion group connection lines become static.

The preference is watched by a single listener while it is needed, which is removed when the canvas closes; there is no polling loop. Altitude shadows are projections that update on events, not decorative animation, so they are unaffected.

## Fixes to repeated actions

- Re-rendering a sheet replaces its drop listeners instead of adding more, so an item dropped on a sheet is no longer processed more than once.
- Searchable fields likewise replace their listeners when they are set up again.
- A crew drag has a single owner for cancellation, including when it is interrupted.

## Limitations

- The keyboard controls have so far been tested against the system's own templates in a browser, not yet inside Foundry itself with real database choices, including the rules-driven auto-fill and confirmation path.
- Dialog focus has not been checked alongside Foundry's keyboard shortcuts, browser zoom or a screen reader such as NVDA. No manual screen-reader audit has been carried out.
- Switching reduced motion on during an animated target trace, and changing scenes while a trace and a crew drag are active, have not been checked in Foundry.
- Long sessions in a large world with many modules have not been measured, so multi-hour memory use and performance are not established.
