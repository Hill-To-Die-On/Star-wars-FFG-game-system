---
name: foundry-vtt
description: Foundry VTT knowledge for any work on a Foundry package (module, game system or world). Use for a new Foundry release or compatibility check, a Foundry API question (ApplicationV2, DialogV2, Scenes, Levels, Walls, Regions, Tiles, Tokens, Combat, Settings, Sockets, compendiums, Adventures, canvas, world time), a suspected Foundry bug or regression, running a Foundry of your own on a spare port for a live check, or roadmap ideas from new Foundry features. Read it before writing or reviewing code that calls Foundry, and whenever someone says "Foundry update", "new Foundry version" or "is this a Foundry bug".
---

# Foundry VTT

Works with any coding agent that reads this folder (the open Agent Skills layout). It names no
agent-specific tools: "fetch the page" means whatever web-fetch tool you have; "search the code"
means your file search. Paths are relative to the repository root.

This file holds what is true for **any** Foundry package, and so does `references/recent-builds.md`
(what changed in recent Foundry builds): both are the same in every repository that has this skill.
The one file that differs is `references/project.md`: this repository's own Foundry rules (its
manifest, the build it last verified live, its test port and helpers). If it is missing, write one
from `templates/project.md` before relying on project facts.

The shared files come from https://github.com/JoelBondoux/agent-skills/tree/main/skills/foundry/foundry-vtt.
Change them there, never in a repository's copy, then sync the copies with that repository's sync
script (its README says how). `references/project.md` belongs to each repository and is never synced.

## 1. Sources of truth (check these, not memory)

Foundry changes every few weeks and training data is out of date. Read the source.

| What | Where | Use it for |
|---|---|---|
| Release list | https://foundryvtt.com/releases/ | Newest build per channel (Stable, Testing, Development, Prototype) |
| One release's notes | `https://foundryvtt.com/releases/<build>`, e.g. https://foundryvtt.com/releases/14.370 | Breaking changes, new API, fixes. Read **every** build between the package's `verified` build and the newest |
| Live API reference | https://foundryvtt.com/api/ (current), https://foundryvtt.com/api/v14/ (one major) | Exact class, method, hook and field signatures. If a class URL 404s, search the reference's index |
| Issue tracker | https://github.com/foundryvtt/foundryvtt/issues | Foundry's own bugs and planned features (issues only, no source code). Release notes cite issues as `#14864` = https://github.com/foundryvtt/foundryvtt/issues/14864. A milestone is the work in one release; labels are areas |
| Discussions | https://github.com/foundryvtt/foundryvtt/discussions | Developer Q&A, proposals, announcements. Search before calling behaviour a bug |
| Official Discord | https://discord.com/channels/170995199584108546/@home (invite https://discord.gg/foundryvtt) | Live help (`#dev-support`, `#package-development` and similar). An agent cannot read it (it needs a login): write the question for the human to ask there |
| Knowledge base | https://foundryvtt.com/kb/ and https://foundryvtt.com/article/ | Official guides: Levels, Regions, ApplicationV2, adventures, packaging, hosting |
| Package guide | https://foundryvtt.com/article/package-development/ (or search the KB for "package development") | `module.json` / `system.json` manifest fields, compatibility, packs |
| Community wiki | https://foundryvtt.wiki/en/development | Unofficial how-tos and migration notes per major |
| Types | `@league-of-foundry-developers/foundry-vtt-types` (npm) | Type shapes. They can lag the newest build: the API reference wins |

**Our bug or Foundry's?** Search the issue tracker and Discussions for the symptom first. If
Foundry fixed it in a build the package has not verified, say so and name the issue; do not add a
workaround for a bug core has fixed. If you must work around an open core bug, put the issue URL in
a code comment so the workaround can be removed when the issue closes.

## 2. Checking a new Foundry release

1. Read the package manifest's `compatibility` (`minimum`, `verified`, `maximum`), then the release
   list. List every build after `verified`.
2. Fetch each build's notes. Collect **all** breaking changes, deprecations, API changes and fixes,
   with exact API names.
3. Search the code (and test doubles) for each API named. Look hardest at:
   - breaking changes and deprecations;
   - **data-shape changes** (integer vs fraction, `null` vs `0`, renamed fields, update operators):
     code that writes a value and reads it back is where these bite;
   - behaviour the package compensates for: a core fix can make a workaround apply twice;
   - fixes to bugs the package's users report.
4. Fix what breaks, with a test that fails without the fix. Mock Foundry with the **new** behaviour
   (a double that keeps the old behaviour hides the break).
5. Write the review down (builds read, each relevant change with a verdict: no impact / fixed /
   needs live check), with roadmap ideas from the new features.
6. **Never raise `verified` from reading alone.** It tells users the package was tested on that
   build. Raise it after a live test on that build. Never raise `maximum` past the verified major:
   it pre-approves a core version nobody has run.
7. A new **major** (v15, v16): read its migration notes and deprecation list first and plan it as
   its own piece of work, not a patch. Deprecated APIs usually keep working, with a console
   warning, for about two majors, then are removed.

## 3. v14 facts that agents get wrong

- **Applications:** `ApplicationV2` and `DialogV2` (with `HandlebarsApplicationMixin` for
  templates). V1 `Application` and `Dialog` are deprecated and are removed in v16.
- **Dialog size** is `position: { width, height }`. `window` has no size; a size there is ignored.
- **`DialogV2.wait({ render })`** passes the *application*, not an HTML element. Read its
  `element`. A throw in that callback aborts the render before the dialog is positioned.
- **Buttons** in an application are `type="button"` with `data-action` handlers; a submit button
  triggers native form submission.
- **Settings:** a setting that needs a reload declares `requiresReload: true`; never reload the
  page yourself. Core settings can be read before `init` (14.370).
- **Scenes:** `environment` replaced top-level `darkness` / `globalLight`. Scenes have native
  **Levels** (`levels`, `initialLevel`); placeables belong to a Level.
- **Regions** replace Measured Templates. Template-like areas are Region shapes, configured by
  `CONFIG.Region.templateModeConfig` (14.370).
- **Deleting a key in an update** uses the v14 operator form (`foundry.data.operators`
  `ForcedDeletion`), not the old `'-=key': null`.
- **Flags and settings are stored as JSON.** A `Map` or `Set` comes back as `{}`; encode it.
- **Module socket messages carry no trusted sender.** Any client can put any `userId` in a payload.
- **One active GM:** `game.users.activeGM` is the client that should do GM-only writes, so they
  happen once even with two GM browsers open.
- **Batch document writes** (`createEmbeddedDocuments`, `updateEmbeddedDocuments`); never loop
  single creates.
- **World time is whole seconds** (14.370). `game.time.advance(1.4)` is rounded; code that advances
  to a fractional target and then checks it was reached must round the target up first.
- **Tiles** created without a `name` are named from their texture file (14.370). Find your own
  documents by flags, never by name.

## 4. Running Foundry yourself (live checks)

Reading code and notes is not a live test. When you need to see Foundry run (a compatibility check
before raising `verified`, a bug repro, a UI check), run **your own** Foundry and drive it from
**your own built-in browser**:

- **Never use port 30000** (Foundry's default). It belongs to the human's everyday Foundry on their
  desktop. Start a separate server on a free, unusual port with its own data folder:
  `--port=<port> --dataPath=<folder>` (desktop app: `"Foundry Virtual Tabletop.exe" --port=…`;
  Node build: `node resources/app/main.js --port=…`). Check the port is free first, and avoid
  ports the project's own helpers use.
- **Own data folder:** never point a test server at the everyday `Data` folder, and install your
  build into the test folder only. Ask before creating the folder. On first start, enter the
  licence and install the game system and modules there (or copy them across).
- **One licence, two servers:** if the licence will not let both run at once, ask the human whether
  to stop their everyday Foundry; never stop it yourself.
- **Your browser, not theirs:** open `http://localhost:<port>` in your built-in browser tool, so the
  human's tabs and logins are untouched. One tab for the GM; a separate private context per Player
  seat (logins share cookies otherwise). A hidden tab may stop animating or lose WebGL: open a
  fresh tab instead of reloading a hidden one. With no built-in browser, ask which to use.
- **Where it can run:** on the human's machine (or one that has Foundry installed and licensed). A
  cloud container or CI runner has no Foundry binary or licence: say so, do what the repository
  allows, and leave the live check to a session on that machine.
- Stop your server when done unless asked to leave it; keep its data folder for next time.
- Report the Foundry build, port and data folder with any live result.

The project file says which port and folder this repository uses.

## 5. Writing down what you learned

When you review a new build, add it to `references/recent-builds.md` (keep about five). When you
learn a Foundry fact the hard way, add it to section 3 if it holds for any package, or to the
project file if it is a project rule. Shared files are edited in the agent-skills repository and
synced out; a change made only in one repository's copy is overwritten by the next sync.
