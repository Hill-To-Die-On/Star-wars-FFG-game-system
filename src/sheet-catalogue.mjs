import { getLibraryPack } from "./library-packs.mjs";
import { publishedLibrary } from "./published-library.mjs";

const idOf = entry => String(entry?.id ?? entry?._id ?? "");

export async function createSheetLibrary(documents, pack, fields = []) {
  const bundled = new Map(Array.from(documents ?? [], entry => [idOf(entry), entry]));
  const entries = new Map(bundled);
  const overrides = new Set();
  if (pack && pack.visible !== false) {
    await pack.getIndex({ fields });
    for (const entry of pack.index) {
      const id = idOf(entry);
      entries.set(id, entry);
      overrides.add(id);
    }
  }
  return {
    index: [...entries.values()],
    async getDocument(id) {
      if (overrides.has(id)) return pack.getDocument(id);
      return bundled.has(id) ? structuredClone(bundled.get(id)) : null;
    },
  };
}

export async function sheetLibrary(kind, fields = []) {
  const bundle = await publishedLibrary();
  return createSheetLibrary(bundle.documents[kind], getLibraryPack(kind), fields);
}

export const sheetDocumentData = entry => entry.toObject?.() ?? structuredClone(entry);
