import { SYSTEM_ID } from "./config.mjs";

export function normalizedFacing(value) {
  const degrees = Number(value);
  return Number.isFinite(degrees) ? ((degrees % 360) + 360) % 360 : 0;
}

export function facingFromPointer(clientX, clientY, bounds) {
  const x = clientX - (bounds.left + bounds.width / 2);
  const y = clientY - (bounds.top + bounds.height / 2);
  return normalizedFacing(Math.round((Math.atan2(y, x) * 180 / Math.PI + 90) / 5) * 5);
}

const stored = (document, key) => document?.getFlag?.(SYSTEM_ID, key) ?? document?.flags?.[SYSTEM_ID]?.[key];

export function portraitArtworkFacing(actor) {
  return normalizedFacing(stored(actor, "portraitFacingOffset"));
}

export function tokenArtworkFacing(actor, document, followsPortrait = false) {
  const source = document?.texture?.src;
  if (followsPortrait || !source || source === actor?.img) return portraitArtworkFacing(actor);
  const explicit = stored(document, "tokenFacingOffset");
  const prototype = actor?.prototypeToken;
  const inherited = source === prototype?.texture?.src ? stored(prototype, "tokenFacingOffset") : undefined;
  // Independent token art retains Foundry's original south-at-zero rendering until calibrated.
  return normalizedFacing(explicit ?? inherited ?? 180);
}

export function tokenMeshAngle(rotation, facingOffset) {
  return normalizedFacing((Number(rotation) || 0) + 180 - facingOffset);
}
