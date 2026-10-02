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

## Keep the GitHub wiki current

The GitHub wiki is maintained product documentation, not a one-time deliverable. Its version-controlled source is `docs/wiki/`; the public site is https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/wiki and is published through the separate `.wiki.git` repository.

- For every change, assess its documentation impact. Update affected wiki source pages in the same change whenever features, rules automation, UI, settings, installation, compatibility, integrations, security, limitations, troubleshooting, or release behaviour change. Include renames and removals, navigation links, and screenshots that no longer match. If no wiki update is needed, state why in the pull request or delivery notes.
- Verify guidance against the implementation, relevant validation evidence, and the actual release state. Clearly label candidate or planned behaviour; never present an unmerged feature or unreleased build as available in the stable release. Do not claim a workflow was tested when it was not.
- Keep the wiki, README, changelog, and relevant guides consistent. Recheck version-sensitive instructions and remove stale caveats when the evidence supports doing so. Roadmap changes still follow the canonical AtlasMind synchronization rules above; the wiki is not a separate completion ledger.
- Publish reviewed wiki source changes to the separate wiki repository as part of the authorized delivery, preserving concurrent edits. Verify that the published pages match the source and that changed links and navigation work. A commit to `docs/wiki/` alone does not update the public wiki. If publication is blocked or not authorized, report the exact unpublished pages and blocker rather than declaring the wiki current.
- Keep all examples, screenshots, and troubleshooting material within the project's public-content boundaries: no credentials, private campaign data, copyrighted book prose, or scans.
