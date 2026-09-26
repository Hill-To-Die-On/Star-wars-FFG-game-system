# Project Soul

> This file is the living identity of the project.

## Project Type
Unknown

## Vision
A free, independent **Foundry VTT 14** game system for campaigns using **Edge of the Empire**, **Age of Rebellion**, and **Force and Destiny**, separately or together. Published by Hill To Die On.

## Principles
- Default to the safest reasonable behavior.
- Keep project knowledge structured, current, and reviewable.
- Prefer explicit approvals and traceable automation for risky work.
- Treat documentation, versioning, and release hygiene as part of correctness.

## Key Decisions
- Safety and security regressions are correctness bugs, not polish work.
- Long-term project context belongs in the SSOT under `project_memory/`.
- Provider credentials live in SecretStorage, not in project memory or source.
- `dev` is the routine integration branch, `staging` is the protected rehearsal branch, and `main` is the protected release branch.
- See `decisions/development-guardrails.md`, `operations/security-and-safety.md`, and `architecture/runtime-and-surfaces.md` for supporting detail.

## Imported References
- architecture/project-overview.md
- architecture/runtime-and-surfaces.md
- architecture/model-routing.md
- architecture/agents-and-skills.md
- operations/development-workflow.md
- decisions/development-guardrails.md
- roadmap/improvement-plan.md
