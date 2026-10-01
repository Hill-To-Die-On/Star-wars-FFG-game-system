import test from "node:test";
import assert from "node:assert/strict";
import { facingFromPointer, normalizedFacing, tokenArtworkFacing, tokenMeshAngle } from "../src/facing-calibration.mjs";

test("portrait ring angles follow the image nose clockwise from its top", () => {
  assert.equal(facingFromPointer(50, 0, { left: 0, top: 0, width: 100, height: 100 }), 0);
  assert.equal(facingFromPointer(100, 50, { left: 0, top: 0, width: 100, height: 100 }), 90);
  assert.equal(facingFromPointer(50, 100, { left: 0, top: 0, width: 100, height: 100 }), 180);
  assert.equal(normalizedFacing(-45), 315);
});

test("portrait and independently selected token art have separate stored fronts", () => {
  const actor = { img: "portraits/pilot.webp", flags: { "star-wars-ffg": { portraitFacingOffset: 45 } },
    prototypeToken: { texture: { src: "tokens/pilot.webp" }, flags: { "star-wars-ffg": { tokenFacingOffset: 225 } } } };
  assert.equal(tokenArtworkFacing(actor, { texture: { src: actor.img } }), 45);
  assert.equal(tokenArtworkFacing(actor, { texture: { src: "tokens/pilot.webp" } }), 225);
  assert.equal(tokenMeshAngle(90, 45), 225);
  assert.equal(tokenMeshAngle(90, 225), 45);
  assert.equal(tokenArtworkFacing(actor, { texture: { src: "tokens/uncalibrated.webp" } }), 180);
});
