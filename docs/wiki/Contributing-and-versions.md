# Contributing and versions

Use focused branches and pull requests. Routine contributions target dev; promotion proceeds through protected staging and main. Preserve private material and unrelated changes.

The repository uses Node.js 24 or later. Typical validation is:

```sh
npm ci
npm test
npm run typecheck
npx playwright install chromium
npm run test:browser
npm run check
npm run build
npm run audit:release
```

Native Foundry tests need a licensed installation and an isolated disposable world. Never run them against a live table. Module-free system acceptance and DoR campaign acceptance are separate checks.

## Versions

Git commits identify code revisions; they do not automatically increment the installed system version. Release tooling includes:

```sh
npm run version:set -- 0.5.1
```

Choose the intended next number. The command synchronizes package metadata, lockfile, Foundry manifest/download and changelog. It neither tags nor publishes. Use three numeric parts, keep unreleased status explicit and never overwrite an existing release tag.

The 0.5.0 Beta release packages only English and retains draft translations in source. `npm run review:content` generates the exact-ZIP human text review packet after build/audit; it does not automatically approve content or publish a listing.

The review page offers source and rendered reading views side by side, with source-only and rendered-only options. It formats Markdown and static HTML/templates, resolves packaged English labels, and marks dynamic values and conditional branches. Its plain reading layout keeps source actions inactive. Human evidence and the exact archive binding remain required. The development compiler is pinned to the upstream Handlebars 4.7.10 security fix; the current dependency audit is clean.

Prepared in-module and listing text is the default authorship review. Code, configuration, changelog and technical package documentation use the code-maintenance requirements in section 4.4 of the [Foundry AI policy](https://foundryvtt.com/article/ai-policy/); they do not require a separate human-origin decision on each word. Reference metadata and licences use a separate rights review. Promotional copy follows the marketing rule wherever used. Shared file/category evidence can cover many records while retaining individual exceptions. Export saves an unfinished draft with the listing, gate answers and specific missing-evidence notes; the full inventory remains available and does not imply that every record needs a separate decision.

## Documentation

Wiki source pages live under docs/wiki in the development candidate. Update them with the implementation and changelog, then publish the reviewed Markdown to this repository's separate wiki Git repository. Keep stable and candidate behavior clearly distinguished. The AtlasMind canonical roadmap remains project_memory/roadmap/improvement-plan.md; the wiki is not a second completion ledger.

The wiki must remain accurate as the system evolves. For every change, assess documentation impact and update affected pages alongside the implementation, or explain why no update is needed. This includes renamed or removed features, settings, rules automation, compatibility, security guidance, known limitations, navigation, and outdated screenshots.

Check instructions against code and validation evidence. Label planned and candidate behaviour explicitly and confirm the release status before presenting features as available. Keep the README, changelog, and related guides consistent.

Publishing is a separate step: push reviewed pages to the wiki repository, preserve concurrent edits, and verify the published text and changed links. If publication cannot be completed, list the unpublished pages and the blocker. Never include credentials, private campaign data, copied book prose, or scans in documentation.
