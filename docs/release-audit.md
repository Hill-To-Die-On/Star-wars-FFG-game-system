# Release readiness evidence — 2026-09-29

## Combined production-hardening candidate

Four isolated workstreams are integrated in `codex/production-integration`: authenticated GM session authority, rules guidance/diagnostics, keyboard/lifecycle improvements and packaged recovery. The combined Windows suite passes 474 tests, all four browser fixtures and a 307-file audited build. Native fresh installation, upgrades from released 0.2.1/0.3.0 and separate restores pass with no optional modules; full details and remaining limits are in [production readiness](production-readiness.md), [transaction authority](security-authority.md) and [backup/recovery](backup-recovery.md).

This is an unreleased review candidate. It does not promote protected branches or replace the published 0.3.0 package. The records below describe the earlier release-hardening baseline; hosted and local evidence for subsequent candidate heads must be checked separately.

## Earlier release-hardening baseline

This worktree starts at PR #20 commit `108d432d0e2eca758a17f19e9babd1ce09e47f58`. It adds a reproducible archive audit and expands the AtlasMind local command contract to install, test, check, build and audit.

## Verified

- PR #20 has two successful GitHub-hosted `validate` checks from the GitHub Actions app (15368).
- Staging and main now require that check against the current base. Existing pull-request, admin, linear-history, conversation-resolution and no-force/no-delete protections were retained. Dev remains the integration branch.
- Dependabot replacement PR #16 merged into dev at `3ef52c6ef466723269630a040a2e6f5668e22f4d`. No Dependabot PR was open at verification.
- Windows: 376 tests passed, followed by syntax/template/data checks, package build and archive audit.
- The expanded AtlasMind command contract passed in a fresh Node 24 Bookworm Linux container limited to one CPU and 2 GiB RAM. It had no network or GitHub credentials, read the candidate and verified npm cache through read-only mounts, and executed in disposable storage. Only offline npm operation was configured; TLS verification was not disabled.
- Archive tests reject traversal/private paths, forbidden source extensions, disguised PDF/database signatures, credential material, unexpected package identity or URLs, missing entrypoints, a detached manifest and mismatched inventories. The audit writes per-file hashes plus the final ZIP SHA-256 to `dist/release-audit.json`.

## Open release gates

The production-hardening lanes are now combined and the synthetic install/upgrade/restore matrix has passed. Actual-campaign restoration, final release version/archive acceptance and protected promotion remain open. No new public release or promotion was performed.

GitHub currently reports zero registered runners for this repository. Local Docker evidence is distinct from a hosted AtlasMind run. The reviewed dispatcher also requires `github.actor == github.repository_owner`; the owner is an organization, so the human maintainer cannot satisfy that equality. This authorization policy was left unchanged after automatic approval review rejected a broader maintainer gate.

A narrow alternative is ready for explicit approval: replace that single condition with `github.actor == 'JoelBondoux'`, allowing only the existing named maintainer to dispatch the same-repository, exact-SHA job. It does not register a runner or create a successful status. The existing read-only token, approved identity checks, trusted controller checkout and sanitized candidate environment would remain. A runner still needs to be supplied before hosted local CI can execute.

## Running the audit

Run `npm test`, `npm run check`, `npm run build` and `npm run audit:release`. The audit reads the actual ZIP and compares it with the detached manifest and inventory. Automated scanning cannot establish copyright ownership or verify a live upgrade; those remain explicit reviews.