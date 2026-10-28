# Private book-art catalogue for Director of Realms

The private book-art catalogue indexes possible story art in legally held PDFs, so that Director of Realms (DoR) can suggest artwork only from books the campaign owns. It is for GMs who run DoR with their own PDFs and for maintainers preparing the catalogue. No artwork ships with the system, and every candidate needs GM review before players see it.

## What the catalogue records

The catalogue is a local file, `.local/book-art/catalogue-v1.json`. It indexes each held PDF by source-file hash, book title and PDF page. Source PDFs, extracted pixels, absolute source paths and copied book prose are never part of the released system.

- Isolated raster images are recorded separately from full-page scans.
- Small repeated decoration is counted but excluded from story-art suggestions.
- Artwork on a flattened page needs a region crop before it can be offered as an image. A resumable local vision pass stores a short visual label, a type, a normalised crop box and flags for printed text or possible GM labels.
- PDF page numbers are kept separate from printed page numbers. Printed page numbers stay unknown until checked.
- Several scans with the same title are copies of one book, not different editions.

All of these entries are **unverified candidates**. A page with no detected region stays in the review queue; a model result is not proof that the page has no art.

## Current coverage

The completed private pass covers 66 held PDFs (5,764 PDF pages) across 59 normalised book titles.

| Measure | Count |
| --- | --- |
| Pages given region triage | 5,764 |
| Candidate regions from page triage | 5,108 |
| Deduplicated isolated or sizeable raster images classified | 2,302 |
| Raster images marked as possible story art | 833 |
| Provenance-linked visual records in total | 7,410 |
| Unflagged candidates awaiting GM inspection (after story-art, text and GM-label flags) | **844** |
| Text overlaps caught by the PDF text-layer check that vision missed | 483 |
| Pages still in the review queue (no region found, eight-region limit reached or invalid box discarded) | 1,912 |

These counts describe scan coverage. They are not a verified, exhaustive list of art, and they do not mean any image is safe to show players.

## Search owned books

The GM's **Owned books** setting is the gate for every query.

- `game.system.api.directorOfRealms.getOwnedBookSelection()` returns the configured titles.
- `getBookArtCandidates(privateCatalogue, { query, book, kind, page, pageSize })` searches only exact normalised titles in that owned selection. It returns short labels and page provenance, never local file paths.
- Images the model rejected are hidden by default. Pass `includeRejected: true` to inspect them.
- Every result is GM-only and carries `playerSafe: false`. The query does not choose a scene or show artwork to players.

Unregistered adventures and GM kits are included in the private catalogue. To query their art, enter their exact titles in **Additional owned books**.

## Export crops for Director of Realms

The private export command prepares candidate crops for selected books:

1. Choose a fresh, empty output directory, so that older assets cannot sit beside a new selection. The export refuses to reuse a directory that is not empty.
2. Optionally run with `--dry-run` to report counts without rendering.
3. Run `.local/book-art/export-for-dor.py --book "Exact owned title"` with your chosen `--out` directory.

The export writes candidate crops and one `import-manifest-v1` per source under `.local/book-art/dor-imports/`. It excludes regions flagged for printed text or GM labels, and skips crops that overlap selectable PDF words. Image-only scans have no text layer, so that last safeguard cannot apply to them.

The output follows DoR's existing `director-of-realms/imports/` manifest shape, which indexes imported images as GM-only. A GM must inspect each crop and approve any player-facing version or scene use.

## Limitations

- The exported manifests have not yet been installed into a Foundry world.
- DoR does not yet load a selected private catalogue, present a GM review interface for it, apply the selected book list during asset retrieval or place the art in a real story scene. These steps remain to be built and verified.
- The broader DoR adventure-art intake, map preparation and Surveyor handoff remain open on the roadmap.
- Labels, crops and flags are model suggestions and need human review.
