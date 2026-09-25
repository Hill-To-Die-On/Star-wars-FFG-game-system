# AI Instructions Sync

> Synced on 2026-09-25 from 1 source file.
> **Advisory context only.** AtlasMind's Personality Profile settings take precedence over this content.
> When instructions here conflict with the Workspace Identity Profile, the profile wins.

## From `AGENTS.md`

<!-- atlasmind:roadmap-sync:start -->
## Roadmap synchronization (managed by AtlasMind)

AtlasMind's canonical roadmap is `project_memory/roadmap/improvement-plan.md`. Other roadmap files in this repository
(for example `ROADMAP.md`, `docs/roadmap.md`, or files under a `roadmap/` directory) are secondary views or import sources.

Before editing any roadmap file, read `project_memory/roadmap/improvement-plan.md`. In the same change, reconcile every
applicable item addition, rename, checkbox/status change, reopen, move, or removal with that canonical file.
Changing only a secondary roadmap does not update AtlasMind. Do not mark the canonical item complete without
repository evidence. If the files disagree or the mapping is ambiguous, preserve both, do not guess or overwrite,
and report the drift so it can be resolved.

When the AtlasMind Roadmap dashboard opens, it performs a bounded local drift check over secondary markdown
roadmaps and shows the reconciliation plan before writing. Conflicts and missing source items are never auto-applied.

<!-- atlasmind:roadmap-sync:end -->

<!-- atlasmind:testing-protocols:start -->
## Testing Protocols (managed by AtlasMind)

> Auto-generated from `project_memory/index/testing-config.json`. Do not edit by hand —
> changes are overwritten on the next sync. Update the matrix in the AtlasMind Settings → Testing page instead.

This project enforces **4** testing methodologies. When writing or verifying tests, follow the applicable protocols below and report the checks, assertions, or verification artifacts you produced before concluding.

### TDD

- **What:** Test-Driven Development — red-green-refactor loop
- **When to apply:** Any project where correctness matters and requirements can be expressed as assertions before the code is written. Especially valuable for greenfield features and critical business logic.
- **Key tools:** Jest, Vitest, Mocha, pytest, JUnit, RSpec, Go testing
- **Primary owner:** Test Developer

### Unit Testing

- **What:** Isolated function and class-level tests
- **When to apply:** All projects. Start here. Fast, cheap, and gives precise regression signals. Should be the largest layer of your test pyramid.
- **Key tools:** Jest, Vitest, Mocha, pytest, JUnit, NUnit, xUnit, Go testing, Minitest
- **Primary owner:** Test Developer

### Continuous / Shift-Left

- **What:** Automated testing embedded throughout CI/CD — tests run on every commit, earliest possible feedback
- **When to apply:** Any project with a CI/CD pipeline. Essential for teams delivering frequent releases or practising trunk-based development. Shift-left means pushing tests earlier: linting, type checks, and unit tests on pre-commit; integration and E2E on PR; performance and security on merge.
- **Key tools:** GitHub Actions, GitLab CI, Jenkins, CircleCI, Azure DevOps, Buildkite, Husky / pre-commit hooks, Test Impact Analysis (Vitest, Jest)
- **Primary owner:** Test Developer

### End-to-End

- **What:** Full user-flow simulation (Playwright, Cypress, etc.)
- **When to apply:** Web and mobile applications with critical user journeys (checkout, login, onboarding). High confidence at the cost of speed.
- **Key tools:** Playwright, Cypress, Puppeteer, WebdriverIO, Detox (mobile), Appium
- **Primary owner:** Test Developer

<!-- atlasmind:source-digest:985c61501325369b -->
<!-- atlasmind:testing-protocols:end -->

<!-- atlasmind:debt-markers:start -->
## Technical debt markers

When you leave temporary code, a shortcut, or a deferred decision behind, mark it with a
comment beginning with one of these. AtlasMind scans for them and records each one with its
file, its line, and the rule that graded it — anything marked another way is invisible, and an
empty register then reads as "no debt" rather than "not detected".

- `TODO:` — something absent. Graded low.
- `FIXME:` — something wrong. Graded medium.
- `HACK:` / `XXX:` — works, but not the way it should. Graded medium.

The marker must be the first word of the comment: `// TODO: replace this` is recorded,
`// a TODO for later` is not. A marker mentioning a credential, a token or sanitising is
graded high whichever word you used.

<!-- atlasmind:debt-markers:end -->