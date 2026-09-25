# Validation

## Automated evidence

The 74-test suite covers dice distributions and persisted term compatibility, distinct chat-die silhouettes, WCAG AA theme tokens, public interchange validation and transport limits, connector isolation, community-rule safety, library upgrades, cancellation, upgrades, Force resources, unlimited custom skills, grouped and alphabetical skill layouts, automatic and manual theme resolution, structured motivations, signature attachment/unlock paths, talent-rule validation and stacking, minion thresholds, damage, initiative, XP paths, SQL parsing, complete database coverage, formatted prices, owned-book filtering, Group context, private source conversion, authenticated encryption and player access guards.

`npm run check` checks syntax, Handlebars templates, manifest paths, version consistency, and all 64 dice image sizes. `npm run build` uses a release allow-list.

## Live acceptance register

| Check                                        | Status                                                                                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundry 14.368 boot and sheets               | Passed in an isolated licensed world for character, vehicle, minion, rival, nemesis and Group                                                                                       |
| Dice So Nice 6.3.1                           | Loaded and registered all seven custom terms; mixed dice rolls and standard symbol textures exercised in Chromium; physical hardware/multi-client visual acceptance remains pending |
| Local database import into world compendiums | Passed: 4,495 Items, 399 vehicles, 1,701 reference journals; repeat import preserves existing entries                                                                               |
| SW Adversaries file import                   | Passed through the Foundry menu: 1,345 NPCs, 51 vehicles and 2,309 source notes; repeat import preserved all records                                                                |
| Complete public database                     | All 44 tables / 6,662 rows match the supplied SQL fields and null values; all 6,595 native documents pass Foundry model validation                                                  |
| GM source confidentiality                    | All 2,309 source records encrypted before storage; direct document reads contain ciphertext and placeholder pages; fresh GM browser stays locked without its key                    |
| GM key backup / restore                      | Passed through the Foundry menus in a fresh browser, including download round trip and decrypted source reader                                                                      |
| New encrypted source import                  | Native NPC and new encrypted note created; GM context recovered prose; persisted document contained no plaintext marker                                                             |
| Bundled interface fonts                      | Roboto, Signika and Rajdhani loaded from local assets; computed sheet, long-form and interface fonts verified in Chromium                                                            |
| Print-inspired sheets and theme mapping      | Passed for Edge/Frontier, Age/Rebellion and Force/Mystic in automatic mode; per-sheet and client-wide overrides, original paper texture, vehicle/Group campaign mapping and zero browser errors verified |
| Optional Foundry interface theme             | Passed for Frontier, Rebellion and Mystic across the lossless public-domain Saturn and Enceladus artist's concept, six custom navigation icons, pause mark, chat, populated combat tracker, windows, journals/handouts, scene controls, players and hotbar; automatic selection, manual overrides, Foundry-default opt-out, local asset loading and zero page errors verified |
| Chat dice shapes and theme contrast          | Automated checks pass all three themes at WCAG 2.1 AA text contrast and verify seven semantic dice classes with square, diamond and strongly faceted d12 silhouettes; refreshed Foundry visual acceptance recorded with the current build |
| Public integration API                       | Version-one character and community-rule contracts, bundles, field allow-lists, declarative talent effects, direct-link limits, exact-origin nonces, JSON Schema and connector registry pass validation; live Foundry character round trip, create/preserve/replace rule import and a separate-origin website handoff all passed with the current build |
| Interactive advancement                      | Passed: two trees, paid additional specialization, blocked duplicate, mouse talent purchase, XP deduction, shared unranked traversal, resource effect and reload persistence        |
| Talent guidance and automatic pools          | Passed: 2,700 private node summaries validated; existing compendiums enriched additively; learned Command changed both the visual pool and `actor.rollSkill`; DoR received the same rule and no browser errors |
| Signature abilities and motivations          | Passed: 38 native signature references imported, 36 private graphs validated, matching bottom-row link enforced, base plus upgrade purchased for 40 XP, two structured motivations rendered and DoR received active/dormant guidance; no browser errors |
| Glanceable and custom skills                 | Passed: 35 standard skills plus eight custom skills rendered across three columns without horizontal or vertical overflow; Grouped/A–Z switching, per-user persistence, add/edit/remove, XP, minion rank and DoR context passed; add remains unlimited |
| Ordinary Foundry dice coexistence            | Passed: d20, d100, coin and Fate retain their native terms                                                                                                                          |
| DoR installed provider discovery             | Passed in patched DoR 0.10.1100: Star Wars FFG's native provider selected                                                                                                           |
| Three beginner PDF source intake             | Passed after private text preparation: Edge 132 pages (OCR), Age 132 pages, Force 130 pages; 128 DoR text passages total, content review still pending                              |
| Three beginner adventures with automated GM  | Last attempt blocked by local model resource admission; no completed play-through claimed                                                                                           |
| Mixed-ruleline campaign and progression      | Pure-rule tests and native prompt facts passed; live campaign play pending                                                                                                          |
| Shared book filtering                        | Passed with GM and player browsers: 6,662 rows with all books, 530 for Edge core, zero for an empty owned selection; direct detail lookup and open results refreshed                |
| Group sheet                                  | Passed: member add/edit, linked-character sync, preserved inaccessible links, shared ownership editing, shared Destiny updates, totals and reload persistence                       |
| Player and trusted-player source access      | Passed: no GM controls or browser key; source helpers deny access; direct source-document reads reveal no prose                                                                     |
| Concurrent XP changes                        | Pending                                                                                                                                                                             |

Never treat a unit test or preview as proof of a completed adventure playtest.

Version 0.2.1 was also checked as an upgrade of the existing isolated world: renamed character, vehicle, Group and item sheets loaded their stylesheet; all seven older narrative die types and an existing chat roll restored; native dice remained intact; all four existing compendiums were found without duplicate creation; 2,309 encrypted GM notes remained accessible with the original browser key; and the catalogue returned all 6,662 rows. No browser errors were recorded.

The Node suite has 63 passing tests. `tests/foundry-smoke.mjs` is an opt-in real-browser test requiring an authenticated, isolated `star-wars-validation` world. Set `FOUNDRY_URL`, `FOUNDRY_STORAGE_STATE`, and optionally `CHROMIUM_PATH`; `FOUNDRY_TEST_WORLD` can select an existing dedicated world whose ID ends in `-validation`. It creates one synthetic actor. Never point it at a campaign world.

The separate DoR adapter work passed its focused adapter/native-check tests, TypeScript checks, lint and full build. Its full suite recorded 894 passing suites and four failures; those same four failures were reproduced with the registry change removed. The failures are in compendium source selection, an AI policy contract, authored travel, and a module file-size contract. The patch is not a released DoR update.

Both the resident 12B local model and one installed 4B fallback were declined by DoR's existing resource guard. No guard was disabled and no resident model was forcibly unloaded. A successful direct connection probe is not evidence of an admitted DoR game session.

GitHub Actions did not start the first public repository workflow because the account was locked by a billing issue. Local test and build results are separate from hosted CI, which remains unverified.
