import test from "node:test";
import assert from "node:assert/strict";
import {
  actorCreationUpdate,
  canPersistProceduralArtwork,
  createStarWarsTokenClass,
  generatedActorUpdate,
  registerActorArtwork,
  tokenArtworkUpdate,
  tokenFrameGeometry,
} from "../src/actor-artwork-foundry.mjs";
import { actorIconDescriptor } from "../src/actor-icons.mjs";

const actor = (overrides = {}) => ({
  id: "actor-1",
  name: "Test pilot",
  type: "character",
  img: "systems/star-wars-ffg/assets/character.svg",
  hasPlayerOwner: true,
  system: { species: "Human" },
  prototypeToken: { disposition: 1 },
  flags: {},
  ...overrides,
});

test("default actor art becomes a persisted procedural SVG when permitted", () => {
  const update = actorCreationUpdate(actor(), {}, { persist: true });
  assert.match(update.img, /^data:image\/svg\+xml;base64,/);
  assert.equal(update.prototypeToken.texture.src, update.img);
  assert.equal(update.prototypeToken.actorLink, true);
  assert.equal(update.prototypeToken.disposition, 1, "A new hero's token starts friendly");
  assert.equal(update.prototypeToken.rotation, 180, "The default north-facing portrait starts upright");
  assert.equal(update.flags["star-wars-ffg"].proceduralIcon.enabled, true);
  assert.equal(update.flags["star-wars-ffg"].proceduralIcon.category, "player");
});

test("explicit character disposition wins and enemy tokens keep their normal disposition", () => {
  const hostileHero = actorCreationUpdate(
    actor(), { prototypeToken: { disposition: -1 } }, { persist: true },
  );
  assert.equal(hostileHero.prototypeToken.disposition, -1);
  const enemy = actorCreationUpdate(actor({ type: "minion" }), {}, { persist: true });
  assert.equal(enemy.prototypeToken.disposition, undefined);
});

test("static artwork remains a safe fallback when image upload is unavailable", () => {
  const update = actorCreationUpdate(actor(), {}, { persist: false });
  assert.equal(update.img, "systems/star-wars-ffg/assets/character.svg");
  assert.equal(update.prototypeToken.texture.src, update.img);
  assert.equal(update.flags["star-wars-ffg"].proceduralIcon.enabled, true);
  assert.equal(canPersistProceduralArtwork({ isGM: false, hasPermission: () => false }), false);
  assert.equal(canPersistProceduralArtwork({ isGM: true }), true);
});

test("selected portraits are preserved and receive only token defaults", () => {
  const update = actorCreationUpdate(
    actor({ img: "portraits/test-pilot.webp" }),
    { img: "portraits/test-pilot.webp" },
    { persist: true },
  );
  assert.equal("img" in update, false);
  assert.equal(update.prototypeToken.texture.src, "portraits/test-pilot.webp");
  assert.equal(update.prototypeToken.sort, 0);
  assert.equal(update.prototypeToken.rotation, 180);
});

test("initial portrait facing preserves a supplied bearing and upgrades only untouched prototype defaults", () => {
  const created = actorCreationUpdate(actor(), { prototypeToken: { rotation: 45 } }, { persist: true });
  assert.equal(created.prototypeToken.rotation, 45);
  const source = actor({ prototypeToken: { rotation: 0, texture: { src: "icons/svg/mystery-man.svg" } } });
  const upgraded = generatedActorUpdate(source, {}, true);
  assert.equal(upgraded.prototypeToken.rotation, 180);
  assert.equal(source.prototypeToken.rotation, 0, "Migration returns a change without mutating an actor or placed token");
  source.prototypeToken.rotation = 90;
  assert.equal(generatedActorUpdate(source, {}, true).prototypeToken.rotation, undefined);
});

test("an explicitly selected token image is preserved separately from the portrait", () => {
  const update = actorCreationUpdate(
    actor({
      img: "portraits/test-pilot.webp",
      prototypeToken: { texture: { src: "tokens/test-pilot-token.webp" } },
    }),
    {
      img: "portraits/test-pilot.webp",
      prototypeToken: { texture: { src: "tokens/test-pilot-token.webp" } },
    },
    { persist: true },
  );
  assert.equal("src" in update.prototypeToken.texture, false);
});

test("default and managed placed tokens follow the actor portrait", () => {
  const proceduralActor = actor({
      img: "data:image/svg+xml;base64,PHN2Zy8+",
      flags: { "star-wars-ffg": { proceduralIcon: { enabled: true } } },
    }),
    defaultUpdate = tokenArtworkUpdate(proceduralActor, {
      texture: { src: "icons/svg/mystery-man.svg" },
      flags: {},
    }),
    managedUpdate = tokenArtworkUpdate(proceduralActor, {
      texture: { src: "old-generated.svg" },
      flags: { "star-wars-ffg": { proceduralToken: { enabled: true } } },
    });
  assert.equal(defaultUpdate.texture.src, proceduralActor.img);
  assert.equal(managedUpdate.texture.src, proceduralActor.img);
  assert.equal(defaultUpdate.flags["star-wars-ffg"].proceduralToken.enabled, true);
});

test("custom placed-token artwork is never replaced by portrait migration", () => {
  assert.equal(
    tokenArtworkUpdate(actor({ img: "portraits/test-pilot.webp" }), {
      texture: { src: "tokens/custom-top-down.webp" },
      flags: {},
    }),
    null,
  );
});

test("managed vehicle tokens get a fitted badge while the actor portrait stays square", () => {
  const vehicle = actor({type:"vehicle",img:"systems/star-wars-ffg/assets/vehicle.svg"});
  const token = {width:9,height:12,rotation:270,texture:{src:vehicle.img}};
  const update = tokenArtworkUpdate(vehicle,token,{persist:true});
  const svg = Buffer.from(update.texture.src.split(',')[1],'base64').toString('utf8');
  assert.match(svg,/viewBox="0 0 75 100"/);
  assert.equal(update.width,undefined);
  assert.equal(update.height,undefined);
  assert.equal(update.rotation,undefined);
  assert.match(actorIconDescriptor(vehicle).svg,/viewBox="0 0 100 100"/);
  assert.equal(tokenArtworkUpdate({...vehicle,img:'custom/ship.webp'},token,{persist:true}).texture.src,'custom/ship.webp');
});

test("resizing a generated vehicle refits its badge in the same update and preserves manual sizing", () => {
  const hooks = new Map(), oldHooks=globalThis.Hooks, oldGame=globalThis.game;
  globalThis.Hooks={on:(name,fn)=>hooks.set(name,fn),once(){}};
  globalThis.game={user:{isGM:true}};
  try {
    registerActorArtwork();
    const vehicle=actor({type:'vehicle',img:'systems/star-wars-ffg/assets/vehicle.svg'});
    const token={actor:vehicle,width:9,height:12,texture:{src:actorIconDescriptor(vehicle).src}};
    const changes={width:12,height:9};
    hooks.get('preUpdateToken')(token,changes,{});
    assert.match(Buffer.from(changes.texture.src.split(',')[1],'base64').toString('utf8'),/viewBox="0 0 100 75"/);
    assert.equal(changes.flags['star-wars-ffg'].automaticFootprint,false);
    assert.equal(changes.flags['star-wars-ffg'].proceduralToken.enabled,true);
    for (const textureChanges of [{texture:{src:token.texture.src}}, {'texture.src':token.texture.src}]) {
      const formChanges={width:3,height:9,...textureChanges};
      hooks.get('preUpdateToken')(token,formChanges,{});
      const src=formChanges['texture.src'] ?? formChanges.texture.src;
      assert.match(Buffer.from(src.split(',')[1],'base64').toString('utf8'),/viewBox="0 0 33\.333333 100"/);
      assert.equal(formChanges.flags['star-wars-ffg'].proceduralToken.enabled,true,"Unchanged form image must not become a custom image");
    }
    const customChanges={width:6,height:12,'texture.src':'tokens/custom-top-down.webp'};
    hooks.get('preUpdateToken')(token,customChanges,{});
    assert.equal(customChanges.texture,undefined);
    assert.equal(customChanges['texture.src'],'tokens/custom-top-down.webp');
    assert.equal(customChanges.flags['star-wars-ffg'].proceduralToken.enabled,false);
  } finally {globalThis.Hooks=oldHooks; globalThis.game=oldGame;}
});

test("prototype forms retain automatic artwork until an image actually changes", () => {
  const hooks = new Map(), oldHooks=globalThis.Hooks, oldGame=globalThis.game;
  globalThis.Hooks={on:(name,fn)=>hooks.set(name,fn),once(){}};
  globalThis.game={user:{isGM:true}};
  try {
    registerActorArtwork();
    const vehicle=actor({type:"vehicle"});
    vehicle.img=actorIconDescriptor(vehicle).src;
    vehicle.prototypeToken={texture:{src:vehicle.img},flags:{"star-wars-ffg":{proceduralToken:{enabled:true,version:5}}}};
    const unchanged={prototypeToken:{texture:{src:vehicle.img},displayName:50}};
    hooks.get("preUpdateActor")(vehicle,unchanged,{});
    assert.notEqual(unchanged.prototypeToken.flags?.["star-wars-ffg"]?.proceduralToken?.enabled,false);
    const custom={prototypeToken:{texture:{src:"tokens/chosen.webp"}}};
    hooks.get("preUpdateActor")(vehicle,custom,{});
    assert.equal(custom.prototypeToken.flags["star-wars-ffg"].proceduralToken.enabled,false);
  } finally {globalThis.Hooks=oldHooks;globalThis.game=oldGame;}
});

test("vehicle creation keeps its square badge and a boardable default footprint", () => {
  const update = actorCreationUpdate(
    actor({
      name: "IG-227 Hailfire Tank",
      type: "vehicle",
      img: "systems/star-wars-ffg/assets/vehicle.svg",
      system: {
        silhouette: 3,
        metadata: { Purpose: "Ground Vehicle", Hull: "Droid Tank" },
        footprint: { mode: "automatic", hull: "auto", length: 0, width: 0 },
      },
    }),
    {},
    { persist: true },
  );
  assert.equal(update.flags["star-wars-ffg"].proceduralIcon.family, "vehicle");
  assert.equal(update.flags["star-wars-ffg"].proceduralIcon.archetype, "tank");
  assert.equal(update.prototypeToken.width, 2);
  assert.equal(update.prototypeToken.height, 2);
  assert.equal(update.prototypeToken.sort, -10);
});

test("portrait overlay geometry stays circular for characters and square for vehicles", () => {
  const character = tokenFrameGeometry(actor(), {
      width: 100,
      height: 100,
      rotation: 45,
    }),
    vehicle = tokenFrameGeometry(actor({ type: "vehicle" }), {
      width: 160,
      height: 100,
      rotation: 90,
    });
  assert.equal(character.family, "character");
  assert.equal(character.ring.kind, "ellipse");
  assert.equal(character.rotation, 45);
  assert.equal(vehicle.family, "vehicle");
  assert.equal(vehicle.ring.kind, "roundedRect");
  assert.equal(vehicle.ring.width > vehicle.ring.height, true);
  assert.equal(vehicle.marks.length, 2);
});

test("vehicle portrait frame follows contained artwork rather than the larger occupied footprint", () => {
  const geometry = tokenFrameGeometry(actor({ type: "vehicle" }), {
    width: 900,
    height: 1200,
    artworkWidth: 900,
    artworkHeight: 900,
    rotation: 45,
  });
  assert.equal(geometry.ring.width, geometry.ring.height);
  assert.equal(geometry.ring.x + geometry.ring.width / 2, 450);
  assert.equal(geometry.ring.y + geometry.ring.height / 2, 600);
  assert.equal(geometry.ring.y, 213);
  const [x1, y1, x2, y2] = geometry.marks[0];
  const ringCenter = { x: geometry.ring.x + geometry.ring.radius, y: geometry.ring.y + geometry.ring.radius };
  assert.ok(Math.abs(Math.hypot((x1 + x2) / 2 - ringCenter.x, (y1 + y2) / 2 - ringCenter.y) - geometry.ring.radius) < 0.2);
  assert.equal(geometry.rotation, 45);
});

test("generated token artwork never receives a second frame even with stale unlinked actor flags", () => {
  const hooks = new Map();
  const oldHooks = globalThis.Hooks, oldPIXI = globalThis.PIXI;
  try {
    globalThis.Hooks = { on: (name, fn) => hooks.set(name, fn), once() {} };
    globalThis.PIXI = { Graphics: class { constructor() { assert.fail("A generated badge already has a frame"); } } };
    registerActorArtwork();
    const generated = actorIconDescriptor(actor({ type: "vehicle" })).src;
    const legacy = `data:image/svg+xml;base64,${Buffer.from('<svg><rect data-frame="vehicle"/><g data-archetype="fighter"/><path data-facing="port"/></svg>').toString("base64")}`;
    for (const src of [generated, legacy, "systems/star-wars-ffg/assets/vehicle.svg"]) {
      let removed = false, destroyed = false;
      const token = {
        actor: actor({ type: "vehicle", img: generated, flags: {} }),
        document: { texture: { src } },
        _starWarsPortraitFrame: { destroy() { destroyed = true; } },
        removeChild() { removed = true; },
      };
      hooks.get("drawToken")(token);
      assert.equal(removed, true);
      assert.equal(destroyed, true);
      assert.equal(token._starWarsPortraitFrame, null);
    }
  } finally {
    globalThis.Hooks = oldHooks;
    globalThis.PIXI = oldPIXI;
  }
});

test("artwork resolution upgrades preserve an explicitly chosen prototype token", () => {
  const source = actor({
    flags: { "star-wars-ffg": { proceduralIcon: { enabled: true } } },
    prototypeToken: { texture: { src: "tokens/custom-top-down.webp" } },
  });
  const created = actorCreationUpdate(source, {}, { persist: true });
  const upgraded = generatedActorUpdate(source, {}, true);
  assert.match(upgraded.img, /^data:image\/svg\+xml;base64,/);
  assert.equal(created.prototypeToken.texture.src, undefined);
  assert.equal(upgraded.prototypeToken, undefined);
});

test("the forward tags follow Foundry movement in all eight directions without changing rules rotation", () => {
  class BaseToken {
    _refreshRotation() { this.mesh.angle = this.document.lockRotation ? 0 : this.document.rotation; }
  }
  const Token = createStarWarsTokenClass(BaseToken);
  for (const type of ["character", "vehicle"]) {
    for (const [dx, dy] of [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]) {
      const rotation = (Math.atan2(dy, dx) * 180 / Math.PI - 90 + 360) % 360;
      const token = new Token();
      token.actor = actor({ type });
      token.document = { rotation, lockRotation: false, texture: { src: actorIconDescriptor(token.actor).src } };
      token.mesh = {};
      token._refreshRotation();
      const radians = token.mesh.angle * Math.PI / 180;
      assert.ok(Math.abs(Math.sin(radians) - dx / Math.hypot(dx, dy)) < 1e-8);
      assert.ok(Math.abs(-Math.cos(radians) - dy / Math.hypot(dx, dy)) < 1e-8);
      assert.equal(token.document.rotation, rotation, "Vision and movement keep Foundry's native convention");
    }
  }
});

test("facing correction respects rotation locks and separately selected token art", () => {
  class BaseToken {
    _refreshRotation() { this.mesh.angle = this.document.lockRotation ? 0 : this.document.rotation; }
  }
  const Token = createStarWarsTokenClass(BaseToken), token = new Token();
  token.actor = actor({ img: "portraits/pilot.webp" });
  token.document = { rotation: 90, lockRotation: false, texture: { src: "portraits/pilot.webp" } };
  token.mesh = {};
  token._refreshRotation();
  assert.equal(token.mesh.angle, 270);
  token.document.lockRotation = true;
  token._refreshRotation();
  assert.equal(token.mesh.angle, 0);
  token.document.lockRotation = false;
  token.document.texture.src = "tokens/native-facing-top-down.webp";
  token._refreshRotation();
  assert.equal(token.mesh.angle, 90);
  token.actor.prototypeToken = { texture: { src: "tokens/native-facing-top-down.webp" }, flags: { "star-wars-ffg": { tokenFacingOffset: 270 } } };
  token._refreshRotation();
  assert.equal(token.mesh.angle, 0);
});
