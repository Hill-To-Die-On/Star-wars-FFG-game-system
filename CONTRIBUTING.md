# Contributing to Star Wars FFG

Thank you for helping improve the system. Contributions should make the Foundry experience clearer, more reliable, or easier to integrate while preserving the project's independent design and content boundaries.

## Before making a change

Use the issue forms for defects, feature proposals, support, and structured rules-data corrections. Small, self-contained fixes may go directly to a pull request. For a broad feature or data import, open an issue first so its public/private boundary and Foundry behaviour can be agreed before implementation.

The books remain the source needed to interpret rule entries. Public contributions may contain original implementation, structured mechanics, creator-authorized data, and book/page references. Do not submit:

- copied rulebook or adventure prose;
- scans, photographs, or official illustrations;
- private PDFs, database backups, campaign notes, credentials, or licence keys;
- content scraped from a third party without permission and retained provenance.

Record every permitted third-party asset in `THIRD_PARTY_NOTICES.md` and keep its licence alongside the asset when required.

## Branch and pull request flow

Create a focused branch from `dev` and target the pull request at `dev`. Maintainer promotion runs from `dev` to protected `staging`, then from `staging` to protected `main`. Do not target routine feature or dependency work directly at the release branches.

Keep commits focused and avoid mixing generated artifacts, private imports, or unrelated formatting. Complete the pull request template with the observed problem, resulting behaviour, validation evidence, compatibility impact, and content/licensing checks.

## Local setup

Node.js 24 or later is required.

```sh
npm ci
npm test
npm run check
npm run build
```

`npm run build` creates `dist/star-wars-ffg.zip`, `dist/system.json`, and `dist/contents.json`. The `dist` directory is ignored and should not be committed. The build uses a positive allow-list so private local imports do not enter a release.

Follow the testing protocols in `AGENTS.md`. Add focused assertions for changed logic, then run the full test, check, and build commands before requesting review. A passing automated check does not replace Foundry runtime verification for sheets, settings, migrations, multi-client behaviour, Dice So Nice rendering, or Director of Realms integration.

## Data and rules automation

Public reference changes must retain creator authorization and the source book/page fields used to locate the corresponding print or PDF entry. Describe corrections in original words. Private specialization guidance, signature-ability guidance, adventure passages, and similar source text stay in local imports and must not enter Git history or release assets.

Automation should expose unresolved or situational decisions to players, game masters, and Director of Realms rather than silently inventing a rule. Update the relevant coverage or validation document when a change affects a stated capability or gap.

## Security

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md) and use GitHub's private vulnerability reporting form.
