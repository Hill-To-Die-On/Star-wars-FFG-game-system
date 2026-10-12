# Alpha listing candidate and submission gates

The candidate version is **0.4.2**, based on the protected 0.4.1 code baseline. The current public release is **0.3.0**. Version metadata, the detached manifest and ZIP must agree; preparing this candidate does not publish it or submit a Foundry listing.

## Alpha scope

- Free, independent, unofficial game system for Foundry VTT 14; native validation targets 14.368.
- English only in the release manifest and ZIP. The other sixteen locale files remain in the repository for later fluent review.
- Ordinary human-GM play works without optional modules. Dice So Nice and Director of Realms have separate integration requirements and acceptance.
- Back up worlds before installing or upgrading. Restore an old world backup with its matching system version; replacing a ZIP alone is not a rollback.
- Books remain necessary. Incomplete source coverage, narrative spending, situational effects and some combat/vehicle rules require GM adjudication. See [production readiness](production-readiness.md).

## Human evidence still required

The [Foundry AI policy](https://foundryvtt.com/article/ai-policy/) requires human-origin prepared text, UI labels and marketing copy. Reading and approving generated prose does not establish human authorship. Technical package documentation and code may use AI assistance subject to the maintainer's personal understanding and responsibility.

1. **Prepared text:** The User or an accountable contributor records original human-authorship evidence for shipped interface labels, inline help, journals and prepared guidance. Replace AI-origin prepared copy with independently human-authored text. Unknown provenance stays pending.
2. **Listing:** The User writes the final listing description and verifies its claims. The review page supplies factual scope prompts rather than generated marketing copy.
3. **Data and assets:** Retain creator permission for this project's reference database publication and confirm its applicability to the shipped derivatives. Do not claim a general downstream data licence without evidence. Confirm the third-party font/symbol terms and human origin of raster artwork. [NASA review](nasa-artwork-rights.md) documents the bundled background separately.
4. **Code maintenance:** The submitting maintainer personally understands, can explain, modify and maintain the entire submitted codebase. Automated tests cannot attest to this.
   The [development template compiler advisories](dependency-advisory-review.md) are resolved by the pinned upstream Handlebars 4.7.10 update; the dependency audit is clean. The earlier compiler-risk gate is closed.
5. **Independent GM:** A human GM other than the implementer follows the quick starts, creates and owns a character, runs an encounter/check, applies and undoes damage, recovers, advances, wraps up a session, reloads and checks persistence. Record versions, exceptions and the conclusion.

The packet includes all shipped text conservatively, including technical literals. A technical classification is appropriate for selectors, configuration and software documentation; it must not be used to exempt prepared UI or rules copy merely because the string appears in source code. Asset and maintainer gates cover binary and vendored files separately.

AI-assisted development means this candidate is ineligible for the **Zero AI** designation. Review the **AI Tools** category against the final optional DoR integration and Foundry's current instructions. Any runtime source context must have rights that permit that use; selecting or owning a book does not itself provide an AI-processing licence. DoR provider/campaign acceptance remains separate from the module-free Alpha tests.

## Produce and retain the packet

```sh
npm ci
npm test
npm run check
npm run test:browser
npm run build
npm run audit:release
npm run review:content
```

Open `.local/alpha-review/content-review.html`. Search by text, category, file or source location. Use **Source and rendered**, **Rendered only** or **Source only** to compare exact source with a formatted reading preview. HTML/templates and Markdown are formatted; English template labels are resolved from the shipped catalogue. Dynamic values appear in brackets and conditional branches appear together. Previews use a plain reading layout and inert controls; they do not reproduce a live Foundry window or execute source actions.

Record a reviewer, evidence and any independently human-written replacements, then export the decisions JSON. The JSON inventory includes every packaged file hash and all text occurrences. Work stays local; there is no upload. Export before leaving the browser.

Decisions bind to the exact archive SHA-256. Applying replacements changes the package: rebuild, audit and regenerate the review, then reconcile the changed records. Do not carry an approval from a different archive forward as final acceptance. Complete the native acceptance matrix on the final archive after all changes.

## Publication sequence

After human evidence is complete, commit reviewed changes, pass hosted validation and promote through dev → staging → main. Publish a unique release with the matching ZIP and detached manifest, verify both public downloads, and check installation from the public manifest. Publish reviewed wiki pages separately and verify them. Submit the human-written Foundry listing using those working public URLs and accurate compatibility/Alpha labels. Foundry's listing decision remains external.

The English-only choice reduces translation review; it does not waive English authorship, provenance or maintainer requirements. A successful local test run, pending review packet or draft pull request is not an approved listing.
