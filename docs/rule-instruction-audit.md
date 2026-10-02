# Gameplay instruction source audit

Scan date: 2026-09-29. This is an inventory of **candidate** mechanics and citations, not a claim that every written rule has been captured or checked against a printed page. The public reference database contains names and structured values; it does not contain complete rulebook instructions. Book text, page images and private OCR stay outside the public system.

## Book-specific occurrences

The catalogue has 45 registered book titles. A rule heading that occurs in several books keeps a separate row and page for each title. A matching heading is a comparison queue, not evidence that the conditions, values or exceptions are identical. For example, `Mass Combat` appears under both *Age of Rebellion - Lead By Example* and *Collapse of the Republic*. The scan found 36 same-name groups across books, mainly Duty, Morality and Obligation entries. They must be compared before sharing one verified rule identity.

The GM's existing **Owned books** selection filters catalogue rows, creation choices and imports by exact normalized book title. `filterRuleInstructionCandidates` applies that same selection to this audit's candidate rows. The audit filter is informational: changing owned books does not remove existing character abilities or alter already committed mechanical effects.

## Public catalogue scan

Run `node scripts/audit-rule-instructions.mjs` to repeat the scan. Add `--book "Age of Rebellion - Core Book"` to view one book, or repeat `--book` for several. `--out .local/rule-instruction-candidates.jsonl` writes the book-filtered candidate rows to an ignored local file. The script keeps source book/page and catalogue identity on each row, with `review: "candidate"`; it does not copy source prose.

| Measure | Result |
| --- | ---: |
| Rule-bearing catalogue rows across 18 tables | 2,238 |
| Rows without a book | 1,109 |
| Rows without a usable printed page | 1,110 |
| Same-name groups appearing in more than one book | 36 |
| Book titles referenced but absent from the 45-title register | 0 |

The missing-page count treats `0` as an absent citation. In particular:

| Area | Rows | Source gap |
| --- | ---: | --- |
| Item qualities | 1,008 | All lack book and page |
| Talents | 618 | 24 lack book and use page `0` |
| Career rules | 100 | One crafting entry uses page `0` |
| Seven dice tables | 67 | All lack book and page |
| Silhouette table | 10 | All lack book and page |

These are catalogue metadata gaps. A present book/page is only an index citation, not proof that the full instruction, every exception, or a repeated rule in another book has been captured.

## Implemented mechanics versus written rules

| Area | Current system evidence | Source-review state |
| --- | --- | --- |
| Character starting resources | `src/creation-resources.mjs`; the three core books' relevant sections were checked as recorded in [source coverage](source-coverage.md) | Section-level citations exist; a per-instruction, per-book comparison remains to be recorded |
| Personal and vehicle turn allowances | `src/turn-economy.mjs`; [turn guide](turn-indicators.md) records Edge core pp. 199–203, 232 and 389–391 | Edge sections checked; equivalent Age/Force occurrences and exceptions are not indexed |
| Abstract range | `src/range-overlay/core.mjs`; [range guide](range-bands.md) records Edge core pp. 208–209 | The overlay's numeric boundaries and geometry are table conventions, requiring GM adjudication |
| Dice pools, upgrades and narrative result axes | `src/dice/core.mjs` and `src/dice/builder.mjs` have unit coverage | Per-instruction book/page and cross-book comparisons are missing |
| XP, damage, initiative and minions | `src/advancement.mjs` and `src/mechanics.mjs` have unit coverage | Per-instruction book/page and exceptions are missing |
| Talent and turn modifiers | `src/talent-rules.mjs`, `src/turn-economy.mjs`, and the advancement overlay | 173 items / 3,042 nodes exist; 734 nodes have effects. The 168 full-chart checks cover names, costs and connectors, not every effect; 5 chart checks are pending |
| Weapon qualities, Force upgrades, critical consequences, vehicle manoeuvres, crafting, mass combat and squadron rules | Referenced or partial, as described in the [roadmap](../project_memory/roadmap/improvement-plan.md) | Complete, source-reviewed effect coverage remains open; the system must request a GM ruling where unsupported |

The first private LM Studio pass covered 450 OCR pages from three beginner-game bundles and two partial Cyphers & Masks extracts, producing 2,265 **unverified** candidate instructions. The newly filed library has 66 distinct PDFs covering 5,764 pages. A completed pass over 60 preferred-source PDFs (5,080 pages) read 3,028 pages and recorded 11,113 unverified candidate occurrences with no model-request failures. It skipped 2,052 pages for short or absent text, and 1,191 readable pages reached the eight-candidate limit. A local vision pass has now triaged all 2,052 skipped pages with no processing errors; 983 were flagged as possible mechanics pages. Six alternate same-title scans (684 pages) were not independently processed by the text pass and remain in the private source-comparison queue. See the [gap audit](rule-scan-gap-audit.md) for exact counts and reviewed examples. Model-suggested printed pages are discarded from the reconciled index until visual review because the model sometimes repeats the PDF page. Every candidate, especially dice symbols, tables and exceptions, needs page-image review. Same-name rules in different books remain separate occurrences.

The first checked addition from the new source is three Cyphers & Masks roll tables: Spy Duties (p. 17), Random Spy Motivation (p. 32) and Specific Secrets (p. 32). Their dice, ranges and short result labels were checked against page images and recorded in `data/roll-tables.json`. The reference browser filters them by owned book and can roll for a result; explanatory text and compound outcomes still require the book. Two Spy Duty catalogue labels were corrected to match the printed table.

Book-specific reward procedures, adventure-running guidance and seeds are tracked separately from mechanical instructions. The catalogue already has 421 sourced seed entries. The private section finder found 78 candidate pages in the newly filed PDFs; eight original guidance/reward summaries from five books have page-image review and a book-filtered DoR lookup. See [book play guidance](book-play-guidance.md). Candidate pages and seed titles alone do not establish complete adventure or reward coverage.

## Required reconciliation

1. Check the 983 vision-flagged possible mechanics pages and 1,191 readable pages that reached the candidate limit against page images, prioritizing the selected campaign's books. Complete core books still need a comparable source pass where local extractable copies are unavailable.
2. Review each local-model candidate against its actual printed page. Record the exact book and page for every instruction; keep different values or exceptions as separate variants.
3. Compare repeated headings across books before assigning a shared rule identity. Preserve each book occurrence so the owned-book filter can display only selected sources.
4. Link every automated modifier to its reviewed rule identity, input calculation and verification status. Keep unsupported effects as explicit GM rulings.

The roadmap's rules-coverage and remaining-rules items remain open until those comparisons and the campaign-filtered in-system coverage view are complete.
