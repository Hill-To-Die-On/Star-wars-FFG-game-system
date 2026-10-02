# Accessibility and interaction performance

This pass improves complete keyboard selection and cancellation workflows. It does not constitute a WCAG conformance certification or a long-running Foundry soak.

## Keyboard workflows

- Species, Career, Model and Manufacturer use an editable combobox. Type to filter; Up/Down preview a result; Home/End select the first/last preview; Enter commits the result. Focus stays in the text field. Escape restores the current value and closes results; Tab closes results without committing unfinished text.
- The list exposes its expanded state, active result and selected preview. A polite status reports the matching result count. The existing campaign rules, database validation and GM homebrew policy still determine available choices.
- Vehicle attack selection has ordinary, visibly focused buttons alongside the canvas sectors. Choose a firing arc, then a defensive zone. All buttons are at least 44 pixels tall. Escape/Cancel and a completed choice return focus to the invoking control. The target continues to have four shield zones; Up/Down remain weapon mount choices.
- Crew portraits retain Enter/Space sheet access with the same permission check as pointer access. Escape and loss of window focus cancel a crew drag. Canvas teardown and closing its containing application also remove the active drag listeners and ghost.

## Motion and lifecycle

The range overlay observes changes to the operating system/browser reduced-motion preference while it is active. Enabling reduced motion settles the attack trace and moving labels immediately, cancels their animation frames and displays the final status. Returning to normal motion does not replay an already completed trace. Minion linking lines become static through the existing reduced-motion stylesheet.

The preference has one shared media-query listener while subscribed and none after the final subscriber leaves. Canvas teardown removes its subscription. It introduces no polling loop. Altitude shadows are already event-driven projections rather than decorative animation; their existing lifecycle tests remain applicable.

Sheet rerenders now abort the prior root drop listeners before installing replacements. This fixes repeated item-drop processing after rerenders. Combobox rebinding similarly replaces its prior listeners. Active crew drags have a single cancellation owner, including interrupted drags.

## Reproducible verification

Run from the repository root:

```sh
node --test tests/motion-preference.test.mjs tests/range-motion.test.mjs tests/sheet-listeners.test.mjs
node tests/accessibility-ui.mjs
node --test tests/*.test.mjs
node scripts/check.mjs
node scripts/build.mjs
```

The browser fixture uses Playwright Chromium, the actual character/vehicle header template, bundled styling and production interaction helpers, with Foundry-shaped document/controller fixtures. It does not modify a live world. Set `CHROMIUM_PATH` if an explicit installed browser is needed. `TEST_ARTIFACTS_DIR` selects the evidence directory; the default is ignored `.local/accessibility`.

Artifacts are `keyboard-selectors.png`, `arc-alternatives.png` and `browser-results.json`. Assertions cover all four selectors, fuzzy matching, permitted homebrew selection, focus restoration, attack/defence selection, crew permissions and cancellation, preference changes, small viewport controls, and repeated binding/rerender cleanup.

The 29 September 2026 fixture run measured 60 interaction cycles over 30.5 seconds: maximum synchronous interaction work was 3.8 ms, no browser long tasks were observed, and no arc panels or crew ghosts remained. These are local fixture observations, not a Foundry frame-rate guarantee. A separate test settles pending trace/label work when the preference changes and repeats 200 canvas teardown/reinitialization cycles without stale frames or listeners. The sheet tests perform 50 rerenders and a replaced-root drop; the browser performs 200 rerenders and 250 combobox rebindings.

Mutation checks temporarily removed sheet-listener cancellation and reversed the reduced-motion guard. Each corresponding behavioral test failed, then passed again after restoration. This verifies that the regression assertions exercise the fixes.

## Remaining acceptance

- Repeat the selectors in native Foundry with real database choices, including the rule-bound auto-population/confirmation path.
- Check native dialog focus alongside Foundry keyboard shortcuts, browser zoom and a screen reader (for example NVDA). This pass has not performed a manual screen-reader audit.
- Toggle reduced motion during a native animated target trace; change scenes while the trace and a crew drag are active.
- Run sustained native interaction with a representative large world and extension set. The short fixture run cannot establish multi-hour memory or performance stability.

No shared live world or DoR installation was changed for this pass. Native integration acceptance is intentionally recorded separately from the fixture results.
