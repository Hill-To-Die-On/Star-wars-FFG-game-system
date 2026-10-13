# Content review drafts and source evidence

`npm run review:content` prepares a local, archive-bound inventory. It is not a requirement to classify every technical literal independently. The standalone page supports source-level evidence, individual exceptions and a complete draft export.

- **Export review JSON** always saves a structurally valid unfinished draft, including reviewer, listing, gates, source notes, per-record decisions and replacements. Missing evidence is listed in `reviewIssues` and never prevents a backup. `submissionReady` is always false.
- **Check recorded decisions** identifies changed decisions that lack reviewer or evidence. Each issue links to its record. Pending inventory rows are allowed and are not automatically approved.
- **Shared evidence by source** groups by exact file and category. Record a source, permission or authorship note once for that scope. An individual decision can refer to shared evidence when every occurrence is covered; explicit exceptions and replacements are retained. Source notes do not classify the underlying entries as human-authored or certify legal compliance.
- Keep code maintenance distinct from authorship of displayed text, including single-word UI labels. Mixed runtime source contains both. Reference dataset provenance can be described once with its permission scope rather than repeated on IDs, names and table metadata.

The existing `star-wars-ffg.review.<archiveSha256>` storage key and schema version 1 remain compatible with previous unfinished browser drafts. Imports reject another archive, unknown entries, decisions or source scopes. Before a valid import, the current draft is retained under `<key>.before-import` when storage is available.

The generator, workflow scripts, tests and this development note are not shipped in the system ZIP. Regenerating only the review HTML from an unchanged archive leaves the package hash and existing review identities intact. Replacements to shipped content require a new archive and the release review described in `docs/alpha-listing.md`.

No wiki publication is needed for this tooling-only fix: the installed system, public instructions and released version are unchanged. Prepared candidate wiki copy remains pending its separate human review.
