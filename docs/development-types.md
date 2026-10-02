# Incremental TypeScript checking

The system keeps its native Foundry interface and browser ES modules. TypeScript checks the existing JavaScript through JSDoc, without emitting files or adding a browser runtime dependency.

Run `npm run typecheck` for the focused compiler check. `npm run check` includes it, so both hosted validation and the AtlasMind check command enforce the types.

## Current coverage

`tsconfig.json` explicitly includes the dice core and compile-time consumers under `tests/types`. Strict mode, indexed-access checks and exact optional properties are enabled. The checked contract covers all seven dice, the eight raw symbols, pool normalization, skill pools, upgrades/downgrades, resolved results, automatic symbols and display labels.

The contract tests include valid examples and six expected errors: an unknown die, text modifiers, a non-narrative die face, an unknown symbol, a numeric success flag and a text pool count. If a future edit weakens these APIs to untyped values, the unused expected-error assertion fails the check. Runtime validation remains necessary for Foundry documents and external JSON.

## Extending coverage

Add one pure module or integration boundary at a time to the configuration. Describe actual inputs and outputs with JSDoc types; use unknown values plus validation for untrusted input. Add positive and negative consumers where the public contract matters, then run the runtime tests, aggregate check and build. Avoid broad any declarations or ambient globals that hide Foundry API mistakes.

The initial change does not establish type coverage for every actor, sheet, transaction, range or integration module. Those remain open work in the canonical roadmap. React/Vite and a separate C# service require a concrete need and a separately scoped decision.

See the official TypeScript documentation for [checking JavaScript](https://www.typescriptlang.org/tsconfig/checkJs.html) and [supported JSDoc types](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html).