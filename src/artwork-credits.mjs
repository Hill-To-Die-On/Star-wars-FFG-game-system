import { SYSTEM_ID, SYSTEM_PATH } from "./config.mjs";

export const ARTWORK_CREDITS_ID = "SFFGArtCredits01";
export const INTERFACE_ARTWORK = Object.freeze({
  title: "Saturn Through the Veil of Enceladus – Artist's Concept",
  credit: "NASA's Goddard Space Flight Center; art by Dan Gallagher (eMITS)",
  source: "https://svs.gsfc.nasa.gov/14162",
  policy: "https://svs.gsfc.nasa.gov/help/",
});

export function artworkCreditsData(observer = 2) {
  return {
    _id: ARTWORK_CREDITS_ID,
    name: "Star Wars FFG · Artwork credits",
    ownership: { default: observer },
    flags: {
      [SYSTEM_ID]: { artworkCredits: 1 },
    },
    pages: [
      {
        name: "Interface artwork",
        type: "text",
        text: {
          format: 1,
          content: `<h1>Interface artwork</h1><figure><img src="${SYSTEM_PATH}/assets/ui/saturn-enceladus-concept.webp" alt="Artist's concept of Saturn beyond the geysers of Enceladus, with Titan and Rhea in the distance"><figcaption><em>${INTERFACE_ARTWORK.title}</em></figcaption></figure><p><strong>Credit:</strong> ${INTERFACE_ARTWORK.credit}.</p><p>The optional Foundry interface theme uses a lossless local transcode of this public-domain NASA artwork. Earth is not present in the image.</p><p><a href="${INTERFACE_ARTWORK.source}">NASA SVS source and catalogue record</a> · <a href="${INTERFACE_ARTWORK.policy}">NASA SVS usage information</a></p><p>This credit does not imply NASA endorsement. Star Wars and associated terminology remain the property of their respective owners.</p>`,
        },
      },
    ],
  };
}

export async function ensureArtworkCreditsJournal({
  currentGame = globalThis.game,
  journalClass = globalThis.JournalEntry,
  ownership = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2,
} = {}) {
  if (!currentGame?.user?.isGM) return null;
  const existing =
    currentGame.journal?.get?.(ARTWORK_CREDITS_ID) ??
    currentGame.journal?.find?.(
      (entry) => entry.getFlag?.(SYSTEM_ID, "artworkCredits") === 1,
    );
  if (existing) return existing;
  if (!journalClass?.create)
    throw new Error("Foundry's JournalEntry API is unavailable.");
  return journalClass.create(artworkCreditsData(ownership), { keepId: true });
}
