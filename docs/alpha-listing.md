# Beta listing candidate and submission gates

Version **0.4.2 Beta** is published as a GitHub prerelease for broader user testing and defect fixing. The latest stable release remains **0.3.0**. The Beta uses its version-specific manifest; ZIP and manifest version metadata must agree. A GitHub release is separate from a Foundry listing submission or approval. This guide retains its existing filename so earlier links continue to work.

## Beta scope

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

The packet retains all shipped text for audit coverage, but its default authorship queue contains prepared in-module and listing text. Code, configuration, the changelog and technical package documentation use the code-maintenance attestation under section 4.4, without a prepared-copy authorship assessment of every word. Source-only repository material that is not delivered is outside this inventory. Promotional copy still follows the marketing rules wherever it appears or is reused. Selectors and code constants are routed using their source context; a short UI label or help string stays prepared text. Reference metadata, binary assets and retained third-party licences use their separate permission/provenance gates.

AI-assisted development means this candidate is ineligible for the **Zero AI** designation. Review the **AI Tools** category against the final optional DoR integration and Foundry's current instructions. Any runtime source context must have rights that permit that use; selecting or owning a book does not itself provide an AI-processing licence. DoR provider/campaign acceptance remains separate from the module-free Beta tests.

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

Open `.local/beta-review/content-review.html`. Search by text, category, file or source location. Use **Source and rendered**, **Rendered only** or **Source only** to compare exact source with a formatted reading preview. HTML/templates and Markdown are formatted; English template labels are resolved from the shipped catalogue. Dynamic values appear in brackets and conditional branches appear together. Previews use a plain reading layout and inert controls; they do not reproduce a live Foundry window or execute source actions.

Record shared evidence for a file/category and retain per-entry exceptions or independently human-written replacements. Separate decisions are not required for every audit record. The review-purpose filter separates prepared text, code/technical documentation, reference metadata/licences and the complete inventory. Export always saves an unfinished draft with all existing answers and specific missing-evidence notes; pending inventory records do not prevent a backup. The JSON includes every packaged file hash and occurrence. Work stays local; there is no upload.

Decisions bind to the exact archive SHA-256. Applying replacements changes the package: rebuild, audit and regenerate the review, then reconcile the changed records. Do not carry an approval from a different archive forward as final acceptance. Complete the native acceptance matrix on the final archive after all changes.

An existing review page and ZIP can retain earlier Alpha filenames for continuity while the planned listing phase is Beta. Keep that archive and browser storage key intact until its draft has been exported. Phase changes to packaged documentation require a new archive, an explicit document delta and reconciliation of any existing evidence before publication; unchanged prepared-text IDs can be matched without requiring a new row-by-row classification.

## Publication sequence

After human evidence is complete, commit reviewed changes, pass hosted validation and promote through dev → staging → main. Publish a unique release with the matching ZIP and detached manifest, verify both public downloads, and check installation from the public manifest. Publish reviewed wiki pages separately and verify them. Submit the human-written Foundry listing using those working public URLs and accurate compatibility/Beta labels. Foundry's listing decision remains external.

The English-only choice reduces translation review; it does not waive English authorship, provenance or maintainer requirements. A successful local test run, pending review packet or draft pull request is not an approved listing.
