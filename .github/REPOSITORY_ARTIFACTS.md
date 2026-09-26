# GitHub repository artifact inventory

This register defines the public repository artifacts, their owners, and the GitHub-hosted settings that support the `dev` → `staging` → `main` delivery path. Review it when the build, release process, dependency ecosystems, branch policy, or public content boundary changes.

Last verified: **2026-09-26**.

## Repository health and governance

| Artifact | Location | Purpose |
| --- | --- | --- |
| Project overview and install manifest | `README.md` | Installation, capabilities, limitations, and development entry point |
| Licence | `LICENSE` | MIT grant for original project material and explicit third-party exclusions |
| Third-party notices | `THIRD_PARTY_NOTICES.md` | Font, dice-symbol, imagery, and retained-licence provenance |
| Contribution guide | `CONTRIBUTING.md` | Branch flow, validation, and copyright/data boundaries |
| Community conduct | `CODE_OF_CONDUCT.md` | Participation standards and private reporting route |
| Security policy | `SECURITY.md` | Supported versions and private vulnerability reporting |
| Support guide | `SUPPORT.md` | Routes help, defects, data corrections, and security reports |
| Ownership rules | `.github/CODEOWNERS` | Requests maintainer review, including dependency and release-boundary changes |
| Pull request template | `.github/PULL_REQUEST_TEMPLATE.md` | Requires validation, compatibility, and licensing evidence |
| Structured issue forms | `.github/ISSUE_TEMPLATE/*.yml` | Bug, feature, support, and rules/reference-data intake |

## Automation and dependency artifacts

| Artifact | Location | Purpose |
| --- | --- | --- |
| System validation | `.github/workflows/ci.yml` | Tests, checks, builds, and uploads the three build outputs with immutable v7 checkout, Node setup, and artifact action commits |
| Reviewed local CI controller | `.github/workflows/atlasmind-reviewed-pr-local-ci.yml` | Runs the AtlasMind command contract against an approved immutable PR SHA |
| Local CI contract | `.atlasmind/local-ci.json` and `.atlasmind/local-ci-runner.mjs` | Declares and executes the trusted local validation commands |
| Dependency maintenance | `.github/dependabot.yml` | Monitors npm and GitHub Actions; routine PRs target `dev`, security PRs target `main` |
| Generated release notes | `.github/release.yml` | Groups GitHub-generated notes by compatibility, feature, fix, content, dependency, and documentation labels |
| Package manifests | `package.json` and `package-lock.json` | Locked Node.js development and build dependencies |

Dependabot is configured in paired entries per ecosystem. An entry without `target-branch` customizes security updates on the default branch and sets its routine version limit to zero. A second entry targets routine version updates at `dev`. Minor and patch updates are grouped; major updates remain individually reviewable.

The validation workflow pins reviewed GitHub Action commits rather than mutable tags. The current pins resolve to `actions/checkout@v7`, `actions/setup-node@v7`, and `actions/upload-artifact@v7`; the latter two run on Node.js 24, matching the project's supported CI runtime. Dependabot remains responsible for proposing later immutable revisions.

## Build and release artifacts

`npm run build` creates an ignored local `dist` directory. A public GitHub release contains:

| Asset | Consumer |
| --- | --- |
| `star-wars-ffg.zip` | Foundry system package |
| `system.json` | Foundry manifest and latest-release installer URL |
| `contents.json` | Reviewable inventory of paths inside the ZIP |

The ZIP is assembled from the positive allow-list in `scripts/build.mjs`. It includes runtime source, templates, styles, localizations, original/attributed assets, public documentation, notices, the two authorized reference JSON files, the copyright-bounded advancement graphs, and their verification register. It excludes PDFs, scans, SQL/database backups, `.local` imports, environment files, tests, previews, and private campaign/source material.

Published tags and releases are retained as historical delivery artifacts. Current releases use semantic tags such as `v0.2.1` and the three asset names above.

## GitHub-hosted baseline

| Setting or artifact | Required state |
| --- | --- |
| Visibility and default branch | Public; `main` is default |
| Delivery branches | `dev` for integration; protected `staging` and `main` for promotion |
| Protected-branch policy | Pull requests, linear history, resolved conversations, stale-review dismissal, admin enforcement, no force pushes or deletion |
| Dependency security | Dependency graph, Dependabot alerts, and Dependabot security updates enabled |
| Vulnerability intake | Private vulnerability reporting enabled |
| Secret protection | Secret scanning and push protection enabled when available to the organization |
| Merge hygiene | Long-lived promotion branches retained; branch-update suggestions enabled; feature branches deleted deliberately after merge |
| Discovery topics | `foundry-vtt`, `foundry-vtt-system`, `star-wars-rpg`, `ffg`, `genesys`, `tabletop-rpg`, `narrative-dice`, `javascript` |
| Managed labels | `breaking-change`, `content`, `dependencies`, `github-actions`, `javascript`, `needs-triage`, `security`, `skip-changelog`, plus GitHub defaults |

At the verification date, GitHub-hosted Actions jobs were prevented from starting by an account billing lock. This is a service-level limitation rather than test evidence. Local container execution of the AtlasMind contract and the validation commands remains recorded separately in `docs/validation.md`; protected branches deliberately do not require an unavailable hosted status check.

## Maintenance check

For a repository inventory review:

1. compare tracked artifacts with this register and GitHub's community profile;
2. inspect branch protection, security settings, topics, labels, releases, workflow runs, and retained Actions artifacts through the GitHub API;
3. run `npm ci`, `npm test`, `npm run check`, and `npm run build` in the supported Node.js version;
4. inspect `dist/contents.json` and the ZIP entries for forbidden private or source material;
5. confirm the remote SHAs and Git trees after promotion through all three branches.
