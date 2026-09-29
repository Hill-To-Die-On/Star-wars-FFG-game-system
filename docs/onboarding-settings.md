# First launch, settings and presentation

The unreleased 0.4.1 candidate adds a per-user welcome flow: a copyright reminder, a GM-only campaign bookshelf and an optional native Foundry interface tour. The world remains playable if setup is deferred. Nothing is imported, no dice are rolled and no actor is changed by the tutorial.

## Book ownership and persistence

- The campaign's book selection is saved as the existing world `campaign` setting, preserving rule lines, adventure state and other choices.
- Browser remembrance stores only a version, book titles, the all/owned filter and the unreferenced-entry preference. It uses the same browser profile and Foundry origin; it is not cloud synchronization.
- A future world offers explicit reuse. It does not silently apply the remembered filter. Forget removes the local preference only.
- Empty owned selections exclude all source-linked entries. Search hides rows without discarding checked books. All references remains an explicit choice and does not assert ownership.
- The existing Owned books form also updates or clears the remembered preference. Stale bookshelf snapshots are rejected if another window changed the books before saving. Foundry's GM permissions remain authoritative; this is not a cross-client atomic compare-and-swap service.
- No PDF, scan, book text, artwork or credential is saved by this workflow. The reminder is a content boundary, not a copyright licence.

Skip tutorial or Set up later writes a versioned flag on that Foundry user for the world. Closing the welcome window leaves it eligible next launch. Players get the reminder and tour invitation without a book mutation control. The first-launch queue waits for the core new-world tour to finish or exit; it uses a short-lived DOM observer, not a frame loop. Native Tour Management stores tour progress separately.

## Settings and window appearance

Foundry's settings are grouped in this order: Campaign setup; Appearance & accessibility; Combat & turn automation; Play tools & references; Imports & private sources; Help & diagnostics. Grouping moves the original native form rows, retaining values, listeners, permissions, search and submission. Empty groups hide during search; repeated grouping does not nest duplicate fieldsets.

Core configuration applications, campaign rules, owned books and GM-key backup keep Foundry styling. System play windows and ordinary dialogs use the system paper, ink, headings and window chrome. Journal reading panes use paper throughout, with a dark navigation sidebar. Journal styling follows the interface theme; Foundry default remains an opt-out. Sidebar directories are not mistaken for floating journal sheets.

The native tour adds keyboard names and focus access to Exit, Previous, Next and Finish. Missing or hidden controls become centred explanatory steps. Tour popovers are explicitly closed during teardown, including when a reduced-motion theme suppresses Foundry's expected transition event.

## Compact sheets

Actor sheets retain Foundry's native resize handle. CSS container queries follow the individual window width, reducing header/portrait size and spacing, wrapping tabs and showing skills in three, two or one columns. Inputs and roll actions stay available; narrow talent trees scroll within their panel instead of shrinking the nodes. The window is bounded to the viewport, including a 640 by 480 display. There are no per-frame resize listeners or actor mutations.

`tests/sheets-responsive-ui.mjs` checks the actual template at 1000, 820, 560 and 380 pixels, header compactness, keyboard skill access, overflow and small-viewport limits. Native acceptance additionally resizes the actual ActorSheet and opens a skill pool without rolling.

## Verification

`tests/onboarding.test.mjs` covers bounded profiles, malformed data, deduplication, preservation of unrelated campaign fields, stale edits, skip state, storage denial and forgetting. `tests/onboarding-ui.mjs` exercises actual wizard actions with a Foundry fixture: search/selection, reload, explicit future-world reuse, forgetting, direct player mutation rejection, narrow layout, native input identity/listeners, idempotent grouping and sidebar isolation.

`scripts/onboarding-acceptance.mjs` is an opt-in licensed native journey. It creates a fresh disposable world and data directory on an isolated port, installs the built archive, copies a supplied private licence without printing it, and stops only its owned server/browser. It never uses shared port 30002. Run with `--foundry-app=<main.js> --license=<private-license.json> --port=<isolated-port>`. Screenshots and native results remain under ignored `.local/onboarding-native/`.

Native Foundry 14.368 acceptance covers first-launch GM/player separation, reload persistence, all six settings groups, the owned-books form, seven tour steps with a hidden-tray fallback, journal theme switching and native compact-sheet controls. This is system-only acceptance with zero optional modules; it does not certify DoR campaign play.

## Wiki maintenance

The public [GitHub wiki](https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/wiki) contains ten original guide pages plus sidebar/footer navigation. Sources are committed under `docs/wiki/`; publish those reviewed files to the separate `.wiki.git` repository. Internal links and stable/candidate labels are checked in tests. The wiki distinguishes the published 0.3.0 release from the 0.4.1 candidate and does not imply a production release.
