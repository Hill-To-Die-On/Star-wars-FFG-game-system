# Local rule-scan gap audit

The 2026-09-29 LM Studio pass made **no failed model requests**. Its main gap was pages with too little extractable text: the text pass skipped them before asking the model for rules. A separate local vision pass has now inspected every such page. Its labels are triage suggestions, not verified mechanics or proof that all instructions were found.

| Measure | Result |
| --- | ---: |
| Held PDFs / PDF pages | 66 / 5,764 |
| Preferred-source PDFs / pages in the text rule pass | 60 / 5,080 |
| Pages read by the text model | 3,028 |
| Pages skipped for short or absent text | 2,052 |
| Skipped pages with no extracted text / 1–99 characters | 1,958 / 94 |
| Skipped pages inspected by local vision / processing errors | 2,052 / 0 |
| Vision-flagged possible mechanics / roll-table pages | 983 / 19 |
| Vision-flagged adventure-guidance / reward pages | 569 / 61 |
| Readable pages at the eight-rule candidate cap | 1,191 |
| Readable pages with no candidates but an incomplete flag | 1,014 |

These categories overlap. A zero-candidate result or a page type such as lore does not establish that the page has no rule. The eight-candidate cap deliberately leaves some dense pages incomplete. The first pass produced 11,113 unverified candidate rule occurrences across its 5,080 selected pages; page-image comparison is still required before any becomes an authoritative rule.

A continuation pilot on capped pages repeated indexed instructions and inferred unsupported scenario conditions. Its output was discarded. The capped pages stay in the review queue rather than gaining unreliable extra rows.

The 60-source pass preferred higher-text scans of six same-title PDFs and omitted 684 alternate-scan page records. A page-image comparison found strong alignment for *Far Horizons*, *Forged in Battle* and *Cyphers & Masks*; *Dawn of Rebellion*, *Endless Vigil* and *Special Modifications* need further page-by-page comparison because scan layout or quality differs. These files are alternate scans of book titles, not separate rulebook editions. The private comparison record is `.local/rule-scan/source-copy-comparison.json`.

## Examples confirmed on page images

| Book | PDF page | What the text pass missed |
| --- | ---: | --- |
| *Cyphers & Masks* | 75 | Skulduggery use procedures on a page without a usable text layer. |
| *Forged in Battle* | 96 | Soldier rewards and the Battle Scars XP-cost table; the visible printed page is 95. |
| *Dangerous Covenants* | 89–91 | Hired Gun XP and pay guidance, including the job pay table and treatment of loaned gear. |
| *Stay on Target* | 93–94 | Ace XP and other reward guidance; the visible printed pages are 92–93. |
| *Endless Vigil* | 79 | A vertical-space result table and contact-network material. The text pass read this corrupted-text page but hit its candidate cap. |

Two original, page-checked reward summaries from *Dangerous Covenants* and *Stay on Target* now appear in the GM-only, owned-book-filtered guidance registry. They carry no automatic reward amount or state change. The Battle Scars cost table and other newly flagged mechanics remain review items, not executable rules.

## Review queue

The complete private page-by-page triage is `.local/rule-scan/gap-page-index.jsonl`; each record has the exact source scan, PDF page, page type, candidate flags and up to three short visible headings. `.local/rule-scan/gap-audit.json` groups those pointers by book. Neither contains copied rule passages or page images. PDF page numbers are not silently presented as printed page numbers.

Next, OCR or visually review the flagged pages in the campaign's selected books, verify printed citations and dice symbols, compare repeated rules across books, and connect only reviewed effects to the system. Keep an explicit GM ruling for rules that remain unsupported. The canonical roadmap items for complete rules coverage and book-specific play guidance remain open.
