# Security Policy

## Supported versions

| Version | Security support |
| --- | --- |
| Latest published release | Supported |
| `main` | Receives fixes for the next release |
| Older releases | Upgrade to the latest release |

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/security/advisories/new). Do not disclose a suspected vulnerability in a public issue, pull request, discussion, or chat.

Include the affected version, impact, smallest safe reproduction, and any suggested mitigation. Remove Foundry administrator keys, world data, private campaign material, local file paths, rulebook or adventure PDFs, and copied book text. A minimal synthetic world or payload is preferred when evidence is needed.

The maintainer will assess the report, coordinate follow-up privately, and publish a fix or advisory when appropriate. Public credit is welcome when requested and safe to provide.

## Dependency and release security

GitHub's dependency graph, Dependabot alerts, and Dependabot security updates monitor npm packages and GitHub Actions. Routine version updates enter through `dev`; GitHub directs security-update pull requests to the default branch. Every generated update still requires review and the repository's validation commands.

Release ZIPs are produced from the positive allow-list in `scripts/build.mjs`. PDFs, SQL backups, `.local` imports, environment files, and private source material are excluded from the public package.
