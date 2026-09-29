import { bookFilterMode, normalizeBookTitle } from "./rules.mjs";

const SCHEMA = "star-wars-book-art-catalogue-v1";

/** Private source art is offered only when the GM explicitly selects owned books. */
export function selectOwnedBookArt(catalogue, campaign, { query = "", book = "", kind = "", includeRejected = false, page = 0, pageSize = 20 } = {}) {
  if (catalogue?.$schema !== SCHEMA || !Array.isArray(catalogue.assets))
    throw new Error("Invalid private book-art catalogue.");
  const selected = bookFilterMode(campaign) === "owned"
    ? new Set((campaign.books ?? []).map(normalizeBookTitle).filter(Boolean))
    : new Set();
  const requested = normalizeBookTitle(book);
  const needle = String(query ?? "").trim().toLowerCase();
  const safePage = Number.isSafeInteger(page) && page >= 0 ? page : 0;
  const safePageSize = Number.isSafeInteger(pageSize) ? Math.max(1, Math.min(100, pageSize)) : 20;
  const assets = catalogue.assets.filter((asset) => {
    if (asset?.isStoryArt === false && !includeRejected) return false;
    const key = normalizeBookTitle(asset?.book);
    if (!key || !selected.has(key) || (requested && key !== requested)) return false;
    if (kind && asset.kind !== kind) return false;
    return !needle || [asset.kind, asset.label, asset.summary, ...(Array.isArray(asset.tags) ? asset.tags : [])]
      .some((value) => String(value ?? "").toLowerCase().includes(needle));
  });
  const start = safePage * safePageSize;
  return {
    status: selected.size ? "gm-review-required" : "owned-books-not-selected",
    automatic: false,
    total: assets.length,
    page: safePage,
    pages: Math.max(1, Math.ceil(assets.length / safePageSize)),
    assets: assets.slice(start, start + safePageSize).map((asset) => ({
      id: String(asset.id ?? ""),
      book: String(asset.book),
      kind: String(asset.kind ?? "unclassified"),
      label: String(asset.label ?? ""),
      tags: Array.isArray(asset.tags) ? asset.tags.map(String).slice(0, 12) : [],
      review: String(asset.review ?? "unverified"),
      importedAssetId: /^imported:[0-9a-f]{12}:img-[0-9a-f]{12}$/.test(asset.importedAssetId ?? "")
        ? asset.importedAssetId : null,
      containsText: asset.containsText === true,
      gmLabels: asset.gmLabels === true,
      gmOnly: true,
      playerSafe: false,
      occurrences: Array.isArray(asset.occurrences)
        ? asset.occurrences.slice(0, 20).map((item) => ({
            pdfPage: Number.isSafeInteger(item.pdfPage) ? item.pdfPage : null,
            printedPage: Number.isSafeInteger(item.printedPage) ? item.printedPage : null,
          }))
        : [],
    })),
  };
}
