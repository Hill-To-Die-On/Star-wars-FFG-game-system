const encoder = new TextEncoder(),
  decoder = new TextDecoder();
export function encodeBytes(bytes) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 32768)
    text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text);
}
export function decodeBytes(text) {
  if (typeof text !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(text))
    throw new Error("Invalid source key or encrypted data.");
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
function cryptoAPI() {
  if (!globalThis.crypto?.subtle)
    throw new Error(
      "Private GM source notes require HTTPS or localhost. Connect securely, or import statistics without private notes.",
    );
  return crypto;
}
export function generateSourceKey() {
  return encodeBytes(cryptoAPI().getRandomValues(new Uint8Array(32)));
}
async function keyMaterial(encoded) {
  const raw = decodeBytes(encoded);
  if (raw.length !== 32)
    throw new Error("A GM source key must contain 32 bytes.");
  const api = cryptoAPI();
  return {
    key: await api.subtle.importKey("raw", raw, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]),
    keyId: encodeBytes(
      new Uint8Array(await api.subtle.digest("SHA-256", raw)).subarray(0, 16),
    ),
  };
}
export async function sourceKeyId(encoded) {
  return (await keyMaterial(encoded)).keyId;
}
const binding = (world, id) =>
  encoder.encode(`star-wars-ffg-gm-source|1|${world}|${id}`);
export async function sealSource(source, encodedKey, world, id) {
  const { key, keyId } = await keyMaterial(encodedKey),
    iv = cryptoAPI().getRandomValues(new Uint8Array(12));
  const bytes = encoder.encode(JSON.stringify(source));
  if (bytes.length > 2 * 1024 * 1024)
    throw new Error("A single source note exceeds 2 MB.");
  const ciphertext = await cryptoAPI().subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: binding(world, id) },
    key,
    bytes,
  );
  return {
    version: 1,
    algorithm: "AES-GCM",
    keyId,
    iv: encodeBytes(iv),
    ciphertext: encodeBytes(new Uint8Array(ciphertext)),
  };
}
export async function openSource(envelope, encodedKey, world, id) {
  if (envelope?.version !== 1 || envelope.algorithm !== "AES-GCM")
    throw new Error("Unsupported encrypted GM source note.");
  const { key, keyId } = await keyMaterial(encodedKey);
  if (keyId !== envelope.keyId)
    throw new Error(
      "Restore this world's GM source key to unlock its source notes.",
    );
  const iv = decodeBytes(envelope.iv),
    ciphertext = decodeBytes(envelope.ciphertext);
  if (iv.length !== 12 || ciphertext.length > 3 * 1024 * 1024)
    throw new Error("Invalid encrypted GM source note.");
  const result = await cryptoAPI().subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: binding(world, id) },
    key,
    ciphertext,
  );
  return JSON.parse(decoder.decode(result));
}
