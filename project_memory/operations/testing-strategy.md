# Testing Strategy Playbook

> Managed by AtlasMind. Regenerated from `project_memory/index/testing-config.json` on each
> scaffold run. Hand edits to this file are overwritten — change the Settings → Testing matrix instead.

**Detected stack:** JavaScript · runner: node-test · archetype: generic
**Active methodologies:** 4 / 69

## For a generic project

Unit testing applies everywhere. Declaring an archetype is what unlocks a recommendation worth acting on.

- **Suits this shape:** unit

## TDD

Test-Driven Development — red-green-refactor loop

- **When to apply:** Any project where correctness matters and requirements can be expressed as assertions before the code is written. Especially valuable for greenfield features and critical business logic.
- **Key tools:** Jest, Vitest, Mocha, pytest, JUnit, RSpec, Go testing
- **Trade-offs:** Requires discipline to write the test first; initial velocity feels slower before the refactor payoff. Poorly scoped tests can become brittle.
- **Starter file:** `tests/example.test.js`

## Unit Testing

Isolated function and class-level tests

- **When to apply:** All projects. Start here. Fast, cheap, and gives precise regression signals. Should be the largest layer of your test pyramid.
- **Key tools:** Jest, Vitest, Mocha, pytest, JUnit, NUnit, xUnit, Go testing, Minitest
- **Trade-offs:** Tests of implementation details (not behaviour) become expensive to maintain. Mocking boundaries can give false confidence at integration points.
- **Starter file:** `tests/example.test.js`

## Continuous / Shift-Left

Automated testing embedded throughout CI/CD — tests run on every commit, earliest possible feedback

- **When to apply:** Any project with a CI/CD pipeline. Essential for teams delivering frequent releases or practising trunk-based development. Shift-left means pushing tests earlier: linting, type checks, and unit tests on pre-commit; integration and E2E on PR; performance and security on merge.
- **Key tools:** GitHub Actions, GitLab CI, Jenkins, CircleCI, Azure DevOps, Buildkite, Husky / pre-commit hooks, Test Impact Analysis (Vitest, Jest)
- **Trade-offs:** Requires significant upfront investment in pipeline configuration and test suite speed. Slow suites become a bottleneck on developer velocity. Shallow-but-fast suites give false safety if coverage is insufficient.
- **Starter file:** _none for Node (JS/TS) — follow the set-up and key tools above._

## End-to-End

Full user-flow simulation (Playwright, Cypress, etc.)

- **When to apply:** Web and mobile applications with critical user journeys (checkout, login, onboarding). High confidence at the cost of speed.
- **Key tools:** Playwright, Cypress, Puppeteer, WebdriverIO, Detox (mobile), Appium
- **Trade-offs:** Slowest tests in the suite; brittle to DOM changes. High maintenance burden if driven by selectors rather than accessible roles.
- **Set up (Node (JS/TS)):** npm install -D @playwright/test && npx playwright install
- **Starter file:** `e2e/example.spec.js`
