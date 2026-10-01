# Headless playtest loop

The browser fixture runner can repeat a fresh GM/player tabletop journey without touching a live Foundry world. Each fixture run starts a new Node process, local fixture server and headless Chromium browser, so actor, chat, combat and authority state cannot leak into the next run.

Run the focused tabletop journey three times with the package's default seed sequence:

```text
npm run test:playtest
```

For a longer or targeted loop, run the script directly:

```text
node scripts/browser-checks.mjs --fixture=tabletop-ui.mjs --runs=10 --seed=4100 --output=test-results/playtest
```

`--runs` accepts 1–100 iterations. `--seed` records the starting seed and increments it for each run; the seed and run number are passed into the fresh fixture page and written to `results.json`. `--fixture` may select any `tests/*-ui.mjs` fixture. Without it, the runner executes all browser fixtures on every iteration. `PLAYTEST_RUNS` and `PLAYTEST_SEED` provide equivalent environment settings.

Each run has its own directory under the selected output path when more than one iteration is requested:

```text
test-results/playtest/
  run-001/tabletop-ui/output.txt
  run-001/tabletop-ui/vehicle-dashboard-fixture.png
  run-002/tabletop-ui/output.txt
  results.json
```

The tabletop fixture covers combat preview/apply/undo, narrative symbol spending, GM transaction authority, player initiative-slot requests, session awards, and vehicle controls. Its GM and Player users are Foundry-shaped fixture clients in the same isolated browser journey, which exercises the request/authority handoff without modifying a world. The unit suite continues to cover native scene travel, minion grouping and vehicle crew rules.

This is a deterministic fixture loop, not native Foundry acceptance. Native multi-client runs still require an isolated licensed Foundry server and authenticated GM/player storage states; the `e2e/` configuration is the separate gate for that environment.
