# This repository: Star Wars FFG game system

Last build verified live: **14.370** (`system.json` `compatibility.verified`, recorded 2026-11-04 in
`docs/development/validation.md`).

A Foundry **game system** (id `star-wars-ffg`, manifest `system.json`), v14 only: `compatibility`
`minimum` and `maximum` are `14`. Installed into a Foundry data folder at `Data/systems/star-wars-ffg`.

## Checking a new Foundry release here

- Record the review and every live result in `docs/development/validation.md` (a summary row plus a
  dated section); the 2026-11-04 "Foundry 14.370 compatibility" entry is the model.
- Raise `compatibility.verified` only after the native acceptance below passes on that build, then
  update the "Last build verified live" line above in the same change.
- The wiki source `docs/wiki/` states compatibility to users: update it, and publish it, as
  `AGENTS.md` says. Never describe an unreleased build as available.
- Advance the version with `npm run version:set -- <version>` and update `CHANGELOG.md`.
- Fast checks: `npm test`, `npm run check`, `npm run typecheck`, `npm run build`, `npm run audit:release`.

## A Foundry of your own

- The native acceptance scripts start their own Foundry: `scripts/onboarding-acceptance.mjs`,
  `scripts/alpha-play-acceptance.mjs`, `scripts/native-feature-acceptance.mjs` and
  `scripts/foundry-recovery-acceptance.mjs`. They need `--foundry-app=<licensed main.js>` and
  `--license=<private license.json>`, create disposable data folders and never modify a supplied
  world. Exact commands: `docs/development/validation.md`, section "Reproducing the checks".
- For a server you start by hand, use port **30210** (the next free one above it if taken) and its
  own data folder, never 30000 (the everyday Foundry) or 30200 (Director of Realms' test Foundry).
- The Playwright tests (`playwright.config.mjs`) run against `FOUNDRY_URL` (and
  `FOUNDRY_STORAGE_STATE` for a signed-in session); point it at your own server, never the
  everyday one.
- Director of Realms integration checks: `docs/development/dor-acceptance.md`.
- Public-content limits apply to evidence too: no credentials, private campaign data, book prose or
  scans in anything you commit.
