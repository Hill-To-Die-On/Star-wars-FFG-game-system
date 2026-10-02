import { SYSTEM_ID } from "./config.mjs";
import { escapeHTML } from "./mechanics.mjs";
import { facingFromPointer, normalizedFacing, tokenArtworkFacing } from "./facing-calibration.mjs";

export function bindFacingRing(frame, onLock, signal) {
  const ring = frame?.querySelector("[data-facing-ring]");
  if (!ring) return;
  let lockedAngle = normalizedFacing(frame.dataset.facingOffset);
  const setAngle = (value) => {
    const angle = normalizedFacing(value);
    frame.dataset.facingOffset = String(angle);
    frame.style.setProperty("--sf-facing-angle", `${angle}deg`);
    ring.setAttribute("aria-label", `${frame.dataset.facingLabel || "Artwork"} front: ${angle} degrees. ${frame.dataset.facingEditing === "true" ? "Click to lock" : "Click to unlock and turn"}.`);
  };
  setAngle(lockedAngle);
  const toggle = async () => {
    if (frame.dataset.facingEditing !== "true") {
      frame.dataset.facingEditing = "true";
      ring.setAttribute("aria-pressed", "true");
      setAngle(lockedAngle);
      return;
    }
    const angle = normalizedFacing(frame.dataset.facingOffset);
    try {
      await onLock(angle);
      lockedAngle = angle;
      frame.dataset.facingEditing = "false";
      ring.setAttribute("aria-pressed", "false");
      setAngle(angle);
    } catch (error) {
      globalThis.ui?.notifications?.error(error.message);
    }
  };
  ring.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); void toggle(); }, { signal });
  frame.addEventListener("pointermove", (event) => {
    if (frame.dataset.facingEditing === "true") setAngle(facingFromPointer(event.clientX, event.clientY, frame.getBoundingClientRect()));
  }, { signal });
  ring.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key)) { event.preventDefault(); void toggle(); }
    else if (frame.dataset.facingEditing === "true" && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault(); setAngle(normalizedFacing(frame.dataset.facingOffset) + (event.key === "ArrowRight" ? 5 : -5));
    } else if (event.key === "Escape" && frame.dataset.facingEditing === "true") {
      event.preventDefault(); frame.dataset.facingEditing = "false"; ring.setAttribute("aria-pressed", "false"); setAngle(lockedAngle);
    }
  }, { signal });
}

export function mountFacingRing(frame) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  for (const [key, value] of Object.entries({ class: "sf-facing-ring", viewBox: "0 0 100 100", role: "button", tabindex: "0", "aria-pressed": "false", "aria-label": "Artwork front. Click to unlock and turn." })) svg.setAttribute(key, value);
  svg.dataset.facingRing = "";
  const circle = document.createElementNS(ns, "circle");
  circle.setAttribute("class", "sf-facing-ring-hit");
  for (const [key, value] of Object.entries({ cx: "50", cy: "50", r: "45" })) circle.setAttribute(key, value);
  const indicator = document.createElementNS(ns, "g");
  indicator.setAttribute("class", "sf-facing-ring-indicator");
  for (const d of ["M50 0 L43 14 L57 14 Z", "M27 8 L34 15 M73 8 L66 15"]) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    indicator.append(path);
  }
  svg.append(circle, indicator);
  frame.append(svg);
}

export async function openTokenFacingEditor(actor) {
  const { DialogV2 } = foundry.applications.api;
  const prototype = actor.prototypeToken;
  const originalSource = prototype?.texture?.src || actor.img;
  const angle = tokenArtworkFacing(actor, prototype);
  const placed = Array.from(globalThis.canvas?.tokens?.placeables ?? []).filter((token) =>
    token.actor?.id === actor.id || token.document?.actorId === actor.id);
  const result = await DialogV2.prompt({
    window: { title: `Token image and facing · ${actor.name}`, resizable: true },
    classes: ["star-wars", "sf-token-facing-dialog"],
    position: { width: 440 },
    content: `<div class="sf-dialog"><p>Choose the token image, then click its outer ring to unlock the front marker. Move the pointer or use arrow keys. Click again to lock it.</p>
      <div class="sf-facing-frame sf-facing-token-preview" data-facing-label="Token image" data-facing-offset="${angle}"><img src="${escapeHTML(originalSource)}" alt="Token image preview"></div>
      <label>Token image path<input name="tokenImage" value="${escapeHTML(originalSource)}" required></label>
      <button type="button" data-use-portrait>Use portrait image</button>
      <input type="hidden" name="tokenFacingOffset" value="${angle}">
      ${placed.length ? `<label><input type="checkbox" name="updatePlaced" checked> Update ${placed.length} placed token${placed.length === 1 ? "" : "s"} in this scene</label>` : ""}</div>`,
    render: (_event, dialog) => {
      const root = dialog.element, preview = root.querySelector(".sf-facing-token-preview"), image = root.querySelector('[name="tokenImage"]');
      mountFacingRing(preview);
      bindFacingRing(preview, (offset) => { root.querySelector('[name="tokenFacingOffset"]').value = String(offset); });
      image.addEventListener("input", () => { preview.querySelector("img").src = image.value; });
      root.querySelector("[data-use-portrait]").addEventListener("click", () => { image.value = actor.img; image.dispatchEvent(new Event("input")); });
    },
    ok: { label: "Save token image and facing", callback: (_event, button) => {
      const form = button.form;
      return { source: form.elements.tokenImage.value.trim(), angle: normalizedFacing(form.elements.tokenFacingOffset.value), updatePlaced: !!form.elements.updatePlaced?.checked };
    } },
    rejectClose: false,
  });
  if (!result) return;
  if (!result.source) throw new Error("Choose a token image path.");
  await actor.update({ "prototypeToken.texture.src": result.source, [`prototypeToken.flags.${SYSTEM_ID}.tokenFacingOffset`]: result.angle });
  if (result.updatePlaced) {
    for (const token of placed) await token.document.update({ "texture.src": result.source, [`flags.${SYSTEM_ID}.tokenFacingOffset`]: result.angle });
  }
}
