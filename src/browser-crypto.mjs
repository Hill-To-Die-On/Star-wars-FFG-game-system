const encoder = new TextEncoder();
const hex = bytes => Array.from(bytes, n => n.toString(16).padStart(2, "0")).join("");

/** SHA-256 fingerprints are identical on HTTPS and ordinary HTTP LAN clients. */
export async function sha256Text(text, api = globalThis.crypto) {
  if (typeof text !== "string") throw new TypeError("Hash input must be text.");
  const bytes = encoder.encode(text);
  if (api?.subtle?.digest) return hex(new Uint8Array(await api.subtle.digest("SHA-256", bytes)));
  // Pinned MIT noble-hashes SHA-256, served locally; no weak-hash fallback.
  const {sha256} = await import("./vendor/noble-hashes/sha256.js");
  return hex(sha256(bytes));
}

/** getRandomValues is available on HTTP; randomUUID is secure-context-only. */
export function secureRandomId(api = globalThis.crypto) {
  if (typeof api?.getRandomValues !== "function") throw new Error("A secure random generator is required for transaction identities.");
  return hex(api.getRandomValues(new Uint8Array(16)));
}
