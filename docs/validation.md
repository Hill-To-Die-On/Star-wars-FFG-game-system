# Validation

## Automated evidence

The initial suite covers physical dice distributions, cancellation, upgrades, Force resources, invalid inputs, minion thresholds, damage, initiative ordering, XP costs, connected talent eligibility, SQL parsing, HTML escaping, private prose exclusion and creation rules across line profiles.

`npm run check` checks syntax, Handlebars templates, manifest paths, version consistency, and all 64 dice image sizes. `npm run build` uses a release allow-list.

## Live acceptance register

| Check | Status |
|---|---|
| Foundry 14.368 boot and sheets | Passed in an isolated licensed world for character, vehicle, minion, rival and nemesis |
| Dice So Nice 6.3.1 | Loaded and registered all seven custom terms; mixed dice rolls and standard symbol textures exercised in Chromium; physical hardware/multi-client visual acceptance remains pending |
| Local database import into world compendiums | Passed: 4,495 Items, 399 vehicles, 1,701 reference journals; repeat import preserves existing entries |
| Interactive advancement | Passed: two trees, paid additional specialization, blocked duplicate, mouse talent purchase, XP deduction, shared unranked traversal, resource effect and reload persistence |
| Ordinary Foundry dice coexistence | Passed: d20, d100, coin and Fate retain their native terms |
| DoR installed provider discovery | Passed in patched DoR 0.10.1100: Starfall's native provider selected |
| Three beginner PDF source intake | Passed after private text preparation: Edge 132 pages (OCR), Age 132 pages, Force 130 pages; 128 DoR text passages total, content review still pending |
| Three beginner adventures with automated GM | Blocked by local model resource admission; no completed play-through claimed |
| Mixed-ruleline campaign and progression | Pure-rule tests and native prompt facts passed; live campaign play pending |
| Multi-client privacy, permissions and simultaneous XP changes | Pending |

Never treat a unit test or preview as proof of a completed adventure playtest.

The initial Node suite has 14 passing tests. `tests/foundry-smoke.mjs` is an opt-in real-browser test requiring an authenticated, isolated `starfall-validation` world. Set `FOUNDRY_URL`, `FOUNDRY_STORAGE_STATE`, and optionally `CHROMIUM_PATH`; it creates one synthetic actor. Never point it at a campaign world.

The separate DoR adapter work passed its focused adapter/native-check tests, TypeScript checks, lint and full build. Its full suite recorded 894 passing suites and four failures; those same four failures were reproduced with the registry change removed. The failures are in compendium source selection, an AI policy contract, authored travel, and a module file-size contract. The patch is not a released DoR update.

Both the resident 12B local model and one installed 4B fallback were declined by DoR's existing resource guard. No guard was disabled and no resident model was forcibly unloaded. A successful direct connection probe is not evidence of an admitted DoR game session.
