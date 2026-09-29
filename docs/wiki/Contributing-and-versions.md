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

Git commits identify code revisions; they do not automatically increment the installed system version. The candidate adds:

```sh
npm run version:set -- 0.4.1
```

Choose the intended next number. The command synchronizes package metadata, lockfile, Foundry manifest/download and changelog. It neither tags nor publishes. Use three numeric parts, keep unreleased status explicit and never overwrite an existing release tag.

## Documentation

Wiki source pages live under docs/wiki in the development candidate. Update them with the implementation and changelog, then publish the reviewed Markdown to this repository's separate wiki Git repository. Keep stable and candidate behavior clearly distinguished. The AtlasMind canonical roadmap remains project_memory/roadmap/improvement-plan.md; the wiki is not a second completion ledger.

The wiki must remain accurate as the system evolves. For every change, assess documentation impact and update affected pages alongside the implementation, or explain why no update is needed. This includes renamed or removed features, settings, rules automation, compatibility, security guidance, known limitations, navigation, and outdated screenshots.

Check instructions against code and validation evidence. Label planned and candidate behaviour explicitly and confirm the release status before presenting features as available. Keep the README, changelog, and related guides consistent.

Publishing is a separate step: push reviewed pages to the wiki repository, preserve concurrent edits, and verify the published text and changed links. If publication cannot be completed, list the unpublished pages and the blocker. Never include credentials, private campaign data, copied book prose, or scans in documentation.
