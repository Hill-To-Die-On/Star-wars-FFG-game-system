import { SYSTEM_ID } from "./config.mjs";
import { escapeHTML } from "./mechanics.mjs";
import {
  generateSourceKey,
  sourceKeyId,
  sealSource,
  openSource,
} from "./source-crypto.mjs";
export const GM_NOTES_PACK = "world.starfall-gm-notes";
const notes = new Map();
let refreshQueue = Promise.resolve();
const worldId = () => game.world.id;
const assertGM = () => {
  if (!globalThis.game?.user?.isGM)
    throw new Error("Only the GM can access private source notes.");
};
const storedKey = () =>
  game.settings.get(SYSTEM_ID, "gmSourceKeys")?.[worldId()];
async function saveKey(key) {
  await sourceKeyId(key);
  await game.settings.set(SYSTEM_ID, "gmSourceKeys", {
    ...game.settings.get(SYSTEM_ID, "gmSourceKeys"),
    [worldId()]: key,
  });
}
async function requireKey(pack, create = false) {
  assertGM();
  if (pack)
    await pack.getIndex({ fields: [`flags.${SYSTEM_ID}.gmSealed.keyId`] });
  const keyIds = new Set(
    [...(pack?.index ?? [])]
      .map((doc) => doc.flags?.[SYSTEM_ID]?.gmSealed?.keyId)
      .filter(Boolean),
  );
  let key = storedKey();
  if (!key && (keyIds.size || !create))
    throw new Error(
      "Restore this world's GM source key in system settings to unlock its notes.",
    );
  if (!key) {
    if (game.users?.activeGM && game.users.activeGM.id !== game.user.id)
      throw new Error(
        "The active GM must create the source library key first.",
      );
    key = generateSourceKey();
    await saveKey(key);
    ui.notifications.info(
      "GM source key created. Back it up from GM source key in system settings before changing browsers.",
      { permanent: true },
    );
  }
  const id = await sourceKeyId(key);
  if ([...keyIds].some((existing) => existing !== id))
    throw new Error(
      "This browser's GM source key does not match the library. Restore the original key.",
    );
  return key;
}
const placeholder =
  "<p>Encrypted GM source material. Open the actor's GM source notes button or use the GM source library in system settings.</p>";
async function encryptedDocument(doc, key) {
  const source = doc.flags[SYSTEM_ID].gmSource;
  return {
    ...doc,
    flags: {
      ...doc.flags,
      [SYSTEM_ID]: {
        gmOnly: true,
        gmSealed: await sealSource(source, key, worldId(), doc._id),
      },
    },
    pages: [
      {
        name: "Private source notes",
        type: "text",
        text: { format: 1, content: placeholder },
      },
    ],
    ownership: { default: 0 },
  };
}
export async function preparePrivateNotes(documents, pack) {
  if (!documents.length) return [];
  const key = await requireKey(pack, true),
    result = [];
  for (const doc of documents) {
    if (!doc.flags?.[SYSTEM_ID]?.gmSource)
      throw new Error(
        "Private source notes require a structured source record.",
      );
    result.push(await encryptedDocument(doc, key));
  }
  return result;
}
export function refreshGMNotes() {
  const work = async () => {
    notes.clear();
    if (!game.user.isGM) return;
    const pack = game.packs.get(GM_NOTES_PACK);
    if (!pack) return;
    const docs = await pack.getDocuments();
    if (!docs.length) return;
    const key = await requireKey(
      pack,
      docs.some((doc) => doc.getFlag(SYSTEM_ID, "gmSource")),
    );
    // Migrate pre-release plaintext records before hydrating the GM-only cache.
    const legacy = docs.filter((doc) => doc.getFlag(SYSTEM_ID, "gmSource"));
    if (legacy.length) {
      const locked = pack.locked;
      await pack.configure({ locked: false });
      try {
        for (let i = 0; i < legacy.length; i += 100) {
          const updates = [];
          for (const doc of legacy.slice(i, i + 100)) {
            const secured = await encryptedDocument(doc.toObject(), key);
            updates.push({
              _id: doc.id,
              [`flags.${SYSTEM_ID}.-=gmSource`]: null,
              [`flags.${SYSTEM_ID}.gmSealed`]:
                secured.flags[SYSTEM_ID].gmSealed,
              pages: doc.pages.map((page) => ({
                ...page.toObject(),
                name: "Private source notes",
                flags: {},
                text: { format: 1, content: placeholder },
              })),
            });
          }
          await pack.documentClass.updateDocuments(updates, {
            pack: pack.collection,
            render: false,
          });
        }
      } finally {
        await pack.configure({ locked });
      }
    }
    for (const doc of docs) {
      const sealed = doc.getFlag(SYSTEM_ID, "gmSealed");
      if (sealed)
        notes.set(doc.id, await openSource(sealed, key, worldId(), doc.id));
    }
  };
  refreshQueue = refreshQueue.catch(() => {}).then(work);
  return refreshQueue;
}
export function getGMSourceNotes(actor) {
  if (!globalThis.game?.user?.isGM) return undefined;
  const id = actor.getFlag?.(SYSTEM_ID, "swa")?.notesId;
  return id ? notes.get(id) : undefined;
}
export async function openGMSourceNotes(actor) {
  assertGM();
  const id = actor.getFlag(SYSTEM_ID, "swa")?.notesId;
  if (!notes.has(id)) await refreshGMNotes();
  const note = notes.get(id);
  if (!note)
    throw new Error("Import and unlock GM source notes for this actor first.");
  return showNote(note);
}
function showNote(note) {
  return foundry.applications.api.DialogV2.wait({
    window: { title: `${note.name} · GM source notes` },
    position: { width: 800 },
    content: `<p>${escapeHTML(note.source)}</p><pre style="white-space:pre-wrap;max-height:65vh;overflow:auto">${escapeHTML(note.text)}</pre>`,
    buttons: [{ action: "close", label: "Close" }],
    rejectClose: false,
  });
}
export function searchGMSourceNotes(query, limit = 10) {
  assertGM();
  const tokens = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return [...notes.values()]
    .filter((note) =>
      tokens.every((token) =>
        `${note.name} ${note.text}`.toLowerCase().includes(token),
      ),
    )
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 10)));
}
export async function gmSourceLibrary() {
  assertGM();
  await refreshGMNotes();
  const query = await foundry.applications.api.DialogV2.prompt({
    window: { title: "GM source library" },
    content:
      '<label>Find an adversary, vehicle or rule<input name="query" type="search"></label>',
    ok: {
      label: "Search",
      callback: (_event, button) => button.form.elements.query.value,
    },
    rejectClose: false,
  });
  if (query === null) return;
  const matches = searchGMSourceNotes(query, 50);
  if (!matches.length)
    return ui.notifications.info("No matching GM source notes.");
  const selected = await foundry.applications.api.DialogV2.prompt({
    window: { title: "GM source library · Results" },
    content: `<p>Up to 50 matching records. Use a more specific search to narrow the results.</p><select name="note">${matches.map((note, index) => `<option value="${index}">${escapeHTML(note.name)} · ${escapeHTML(note.kind)}</option>`).join("")}</select>`,
    ok: {
      label: "Open source note",
      callback: (_event, button) => Number(button.form.elements.note.value),
    },
    rejectClose: false,
  });
  if (selected !== null && matches[selected])
    return showNote(matches[selected]);
}
export async function gmSourceKeyDialog() {
  assertGM();
  const pack = game.packs.get(GM_NOTES_PACK);
  return foundry.applications.api.DialogV2.wait({
    window: { title: "GM source key · Backup and restore" },
    content:
      '<p>Source prose is encrypted in the world. Its key stays in this browser. Keep a private backup to unlock notes on another GM browser or after clearing browser data. Share it only with a trusted GM.</p><label>Restore key from backup<input type="file" name="keyFile" accept=".json"></label>',
    buttons: [
      {
        action: "backup",
        label: "Download key backup",
        callback: async () => {
          try {
            const key = await requireKey(pack, false);
            const blob = new Blob(
              [
                JSON.stringify(
                  {
                    format: "star-wars-ffg-gm-source-key",
                    version: 1,
                    world: worldId(),
                    key,
                  },
                  null,
                  2,
                ),
              ],
              { type: "application/json" },
            );
            const url = URL.createObjectURL(blob),
              anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `star-wars-ffg-${worldId()}-gm-source-key.json`;
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (error) {
            ui.notifications.error(error.message);
          }
        },
      },
      {
        action: "restore",
        label: "Restore key",
        callback: async (_event, button) => {
          try {
            const file = button.form.elements.keyFile.files[0];
            if (!file || file.size > 4096)
              throw new Error(
                "Choose the GM source key backup JSON (under 4 KB).",
              );
            const data = JSON.parse(await file.text());
            if (
              data.format !== "star-wars-ffg-gm-source-key" ||
              data.version !== 1 ||
              data.world !== worldId()
            )
              throw new Error("Choose a source key backup for this world.");
            const id = await sourceKeyId(data.key);
            if (pack)
              await pack.getIndex({
                fields: [`flags.${SYSTEM_ID}.gmSealed.keyId`],
              });
            if (
              [...(pack?.index ?? [])].some(
                (doc) =>
                  doc.flags?.[SYSTEM_ID]?.gmSealed?.keyId &&
                  doc.flags[SYSTEM_ID].gmSealed.keyId !== id,
              )
            )
              throw new Error(
                "That key does not match the encrypted source library.",
              );
            await saveKey(data.key);
            await refreshGMNotes();
            ui.notifications.info("GM source notes unlocked in this browser.");
          } catch (error) {
            ui.notifications.error(error.message);
          }
        },
      },
    ],
    rejectClose: false,
  });
}
