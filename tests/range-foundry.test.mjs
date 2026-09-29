import test from "node:test";
import assert from "node:assert/strict";
import {
  ATTACK_TRACE_DURATION_MS,
  canvasScreenViewport,
  addRangeSceneControl,
  beginCombatRangeAssistant,
  buildAttackTracePreview,
  endCombatRangeAssistant,
  getSceneRangeProfile,
  getTokenRangeProfile,
  measureTokenRange,
  registerRangeOverlay,
  loadAttackTracePool,
} from "../src/range-overlay/foundry.mjs";

const scene = ({ grid, state }) => ({
  id: "scene-test",
  grid,
  getFlag: () => state,
  levels: [{id:"ground",elevation:{bottom:-Infinity,top:Infinity}}],
  testSurfaceCollision: () => null,
});

const token = (id, x, y, elevation = 0) => ({
  id,
  center: { x, y },
  document: { id, elevation, level:"ground", parent: { id: "scene-test" } },
});

test("embarked crew cannot obstruct their vehicle's targeting line even in the GM view",()=>{
  const oldCanvas=globalThis.canvas,oldGame=globalThis.game;
  const map=scene({grid:{type:1,size:100,distance:1,units:"m"},state:{scale:"personal"}});
  const source=token("ship",0,0),target=token("target",800,0),crew=token("crew",200,0);
  crew.document.flags={"star-wars-ffg":{aboard:{vehicleId:"ship"}}};
  crew.document.parent.tokens=new Map([["ship",source.document]]);
  globalThis.canvas={tokens:{placeables:[source,target,crew]}};globalThis.game={user:{isGM:true}};
  try {
    assert.equal(measureTokenRange(source,target,{scene:map}).obstruction,null);
    crew.document.flags["star-wars-ffg"].aboard=null;
    assert.equal(measureTokenRange(source,target,{scene:map}).obstruction.tokenId,"crew");
  }finally{globalThis.canvas=oldCanvas;globalThis.game=oldGame;}
});
test("a vehicle without a native weapon asks for a weapon instead of inventing an unarmed attack",()=>{
  const map=scene({grid:{type:1,size:100,distance:1,units:"m"},state:{scale:"personal"}});
  const source={...token("ship",0,0),actor:{type:"vehicle",name:"Freighter",items:[]}};
  const result=buildAttackTracePreview(source,token("target",1000,0),{scene:map});
  assert.equal(result.pool,null);assert.match(result.error,/weapon/i);assert.equal(result.attack.skillKey,"gunnery");
});

test("V14's full-height navigation wrapper does not collapse the label viewport", () => {
  const previousCanvas = globalThis.canvas, previousDocument = globalThis.document;
  const bounds = (left, top, width, height) => ({ left, top, width, height, right: left+width, bottom: top+height });
  const elements = { "#scene-controls": bounds(16,16,72,1169), "#scene-navigation": bounds(104,16,200,1260),
    "#scene-navigation-viewed": bounds(104,16,170,32), "#sidebar": bounds(1714,0,42,1292), "#hotbar": bounds(496,1216,764,60) };
  globalThis.canvas = { app: { renderer: { screen: { width: 1756, height: 1292 } }, canvas: { getBoundingClientRect: () => bounds(0,0,1756,1292) } } };
  globalThis.document = { querySelector: selector => elements[selector] ? { getBoundingClientRect: () => elements[selector] } : null };
  try { assert.deepEqual(canvasScreenViewport(), { left: 100, top: 60, right: 1702, bottom: 1204 }); }
  finally { globalThis.canvas = previousCanvas; globalThis.document = previousDocument; }
});

test("token edges drive the shared range result and automatic attack difficulty", () => {
  const map = scene({ grid: { type: 1, size: 100, distance: 1, units: "m" }, state: { scale: "personal" } });
  const source = { ...token("s", 0, 0), w: 100, h: 100, actor: { type: "character" } };
  const target = { ...token("t", 700, 0), w: 100, h: 100, actor: { type: "character" } };
  const result = measureTokenRange(source, target, { scene: map });
  assert.equal(result.measurement, "edge-to-edge");
  assert.equal(result.horizontalDistancePx, 600);
  assert.equal(result.sceneDistance, 6);
  assert.equal(result.band, "short");
  assert.deepEqual(result.sourceEdge, { x: 50, y: 0 });
  assert.deepEqual(result.targetEdge, { x: 650, y: 0 });
});

test("boarding range reaches a hull edge, including document-only dimensions", () => {
  const map = scene({ grid: { type: 1, size: 100, distance: 1, units: "m" }, state: { scale: "personal" } });
  const source = { ...token("s", 0, 0), w: 100, h: 100, actor: { type: "character" } };
  const target = { ...token("t", 550, 0), actor: { type: "vehicle" } };
  Object.assign(target.document, { width: 8, height: 8 });
  const result = measureTokenRange(source, target, { scene: map });
  assert.equal(result.horizontalDistancePx, 100);
  assert.equal(result.band, "engaged");
  target.document.rotation = 90;
  assert.equal(measureTokenRange(source, target, { scene: map }).horizontalDistancePx, 100);
});

test("edge gaps retain elevation on scaled maps while ToM remains two dimensional", () => {
  const source = { ...token("s", 0, 0), w: 100, h: 100 };
  const target = { ...token("t", 400, 0, 4), w: 100, h: 100 };
  const map = scene({ grid: { type: 1, size: 100, distance: 1, units: "m" }, state: { scale: "personal" } });
  assert.equal(measureTokenRange(source, target, { scene: map }).sceneDistance, 5);
  map.grid.type = 0;
  map.getFlag = () => ({ calibrations: { personal: { anchorRadiusPx: 300 } } });
  const theatre = measureTokenRange(source, target, { scene: map });
  assert.equal(theatre.distancePx, 300);
  assert.equal(theatre.band, "short");
  assert.equal(theatre.sceneDistance, null);
});

test("Foundry range service returns one machine-readable band for sheets and DoR", () => {
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "m" },
    state: { scale: "personal", calibrations: {} },
  });
  const profile = getSceneRangeProfile(map);
  const result = measureTokenRange(token("source", 0, 0), token("target", 300, 0), {
    scene: map,
  });

  assert.equal(profile.scale, "personal");
  assert.deepEqual(
    {
      available: result.available,
      band: result.band,
      label: result.label,
      mode: result.profileMode,
      scale: result.scale,
      sceneDistance: result.sceneDistance,
      units: result.units,
    },
    {
      available: true,
      band: "short",
      label: "Short",
      mode: "map",
      scale: "personal",
      sceneDistance: 3,
      units: "m",
    },
  );
});

test("vehicle origins use ship and vehicle ranges on a personal-scale scene", () => {
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "km" },
    state: { scale: "personal", calibrations: {} },
  });
  const source = {
    ...token("vehicle-source", 0, 0),
    actor: { id: "vehicle-actor", type: "vehicle" },
  };
  const target = token("vehicle-target", 10_000, 0);
  const result = measureTokenRange(source, target, { scene: map });

  assert.equal(getSceneRangeProfile(map).scale, "personal");
  assert.equal(getTokenRangeProfile(source, map).scale, "space");
  assert.deepEqual(
    {
      available: result.available,
      scale: result.scale,
      band: result.band,
    },
    { available: true, scale: "space", band: "short" },
  );
});

test("an explicit battlefield scene keeps vehicle origins on battlefield ranges", () => {
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "km" },
    state: { scale: "battlefield", calibrations: {} },
  });
  const source = {
    ...token("ground-vehicle", 0, 0),
    actor: { id: "ground-vehicle-actor", type: "vehicle" },
  };
  const character = {
    ...token("ground-character", 0, 0),
    actor: { id: "ground-character-actor", type: "character" },
  };

  assert.equal(getTokenRangeProfile(source, map).scale, "planetary");
  assert.equal(getTokenRangeProfile(character, map).scale, "personal");
});

test("Theatre-of-the-Mind origins use the calibration for their resolved attacker scale", () => {
  const theatre = scene({
    grid: { type: 0, size: 100, distance: 1, units: "m" },
    state: {
      scale: "personal",
      calibrations: {
        personal: { anchorRadiusPx: 120 },
        space: { anchorRadiusPx: 45 },
      },
    },
  });
  const vehicle = {
    ...token("tom-vehicle", 0, 0),
    actor: { id: "tom-vehicle-actor", type: "vehicle" },
  };
  const character = {
    ...token("tom-character", 0, 0),
    actor: { id: "tom-character-actor", type: "character" },
  };

  assert.equal(getTokenRangeProfile(vehicle, theatre).anchorRadiusPx, 45);
  assert.equal(getTokenRangeProfile(character, theatre).anchorRadiusPx, 120);
});

test("Foundry range service fails closed on an uncalibrated ToM scene", () => {
  const theatre = scene({
    grid: { type: 0, size: 100, distance: 1, units: "m" },
    state: { scale: "battlefield", calibrations: {} },
  });
  const result = measureTokenRange(token("source", 0, 0), token("target", 30, 0), {
    scene: theatre,
  });

  assert.equal(result.available, false);
  assert.equal(result.scale, "planetary");
  assert.match(result.reason, /not been calibrated/i);
});

test("scaled maps include token elevation and report sight-wall collisions", () => {
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "m" },
    state: { scale: "personal", calibrations: {} },
  });
  globalThis.CONFIG = {
    Canvas: {
      polygonBackends: {
        sight: {
          testCollision(origin, destination, options) {
            assert.deepEqual(origin, { x: 0, y: 0, elevation:0 });
            assert.deepEqual(destination, { x: 300, y: 400, elevation:12 });
            assert.equal(options.mode, "closest");
            assert.equal(options.type, "sight");
            return { x: 150, y: 200 };
          },
        },
      },
    },
  };
  try {
    const result = measureTokenRange(
      token("source", 0, 0, 0),
      token("target", 300, 400, 12),
      { scene: map },
    );

    assert.equal(result.horizontalSceneDistance, 5);
    assert.equal(result.elevationDifference, 12);
    assert.equal(result.sceneDistance, 13);
    assert.equal(result.distancePx, 1300);
    assert.equal(result.elevationApplied, true);
    assert.equal(result.band, "medium");
    assert.equal(result.lineOfSight, "blocked");
    assert.equal(result.lineOfSightBlocked, true);
    assert.deepEqual(result.obstruction.point, { x: 150, y: 200 });
  } finally {
    delete globalThis.CONFIG;
  }
});

test("range service reports unavailable sight checks without inventing a result", () => {
  delete globalThis.CONFIG;
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "m" },
    state: { scale: "personal", calibrations: {} },
  });
  const result = measureTokenRange(
    token("source", 0, 0),
    token("target", 300, 0),
    { scene: map },
  );

  assert.equal(result.lineOfSight, "unavailable");
  assert.equal(result.lineOfSightBlocked, null);
});

test("visible intervening actor tokens block the attack trace at their edge", () => {
  delete globalThis.CONFIG;
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "m" },
    state: { scale: "personal", calibrations: {} },
  });
  const source = token("source", 0, 0);
  const target = token("target", 400, 0);
  const blocker = {
    ...token("blocker", 200, 0),
    name: "Guard in the way",
    w: 100,
    h: 100,
    actor: { name: "Guard in the way" },
  };
  globalThis.game = { user: { isGM: false } };
  globalThis.canvas = {
    scene: map,
    dimensions: { size: 100, distance: 1, units: "m" },
    tokens: { placeables: [source, blocker, target] },
  };

  const result = measureTokenRange(source, target, { scene: map });

  assert.equal(result.lineOfSight, "blocked");
  assert.equal(result.lineOfSightBlocked, true);
  assert.equal(result.obstruction.kind, "token");
  assert.equal(result.obstruction.name, "Guard in the way");
  assert.ok(result.obstruction.point.x > 140);
  assert.ok(result.obstruction.point.x < 160);
});

test("attack trace preview uses equipped weapon, target opposition and range", () => {
  delete globalThis.CONFIG;
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "m" },
    state: { scale: "personal", calibrations: {} },
  });
  const weapon = {
    id: "blaster",
    name: "Service blaster",
    type: "weapon",
    system: {
      equipped: true,
      skill: "rangedLight",
      range: "short",
      scale: "personal",
    },
  };
  const sourceActor = {
    id: "hero",
    name: "Hero",
    type: "character",
    system: {
      characteristics: { agility: 3 },
      skills: { rangedLight: { rank: 2, characteristic: "agility" } },
    },
    items: [weapon],
    skillDefinition: () => ({
      key: "rangedLight",
      label: "Ranged (Light)",
      characteristic: "agility",
      group: "Combat",
      state: { rank: 2, characteristic: "agility" },
    }),
    skillRank: () => 2,
    talentRulesForCheck: () => null,
  };
  const targetActor = {
    id: "rival",
    name: "Rival",
    system: { defense: { melee: 0, ranged: 1 } },
    items: [
      {
        type: "talent",
        name: "Adversary",
        system: { rank: 1 },
      },
    ],
    effectiveTraits: () => ({ defense: { melee: 0, ranged: 1 } }),
  };
  const source = { ...token("source", 0, 0), actor: sourceActor, w: 100, h: 100 };
  const target = { ...token("target", 700, 0), actor: targetActor, w: 100, h: 100 };
  globalThis.game = { user: { isGM: true } };
  globalThis.canvas = {
    scene: map,
    dimensions: { size: 100, distance: 1, units: "m" },
    tokens: { placeables: [source, target] },
  };

  const preview = buildAttackTracePreview(source, target, { scene: map });

  assert.equal(ATTACK_TRACE_DURATION_MS, 2000);
  assert.equal(preview.available, true);
  assert.equal(preview.range.label, "Short");
  assert.equal(preview.range.sceneDistance, 6);
  assert.equal(preview.attack.itemName, "Service blaster");
  assert.equal(preview.attack.skillLabel, "Ranged (Light)");
  assert.deepEqual(
    {
      ability: preview.pool.ability,
      proficiency: preview.pool.proficiency,
      difficulty: preview.pool.difficulty,
      challenge: preview.pool.challenge,
      setback: preview.pool.setback,
    },
    { ability: 1, proficiency: 2, difficulty: 0, challenge: 1, setback: 1 },
  );
  assert.match(preview.poolLabel, /2 Proficiency/i);
  assert.match(preview.error, /Sight collision checks are unavailable/);
});

test("vehicle attack trace asks for a gunner rather than inventing a pool", () => {
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "km" },
    state: { scale: "personal", calibrations: {} },
  });
  const vehicle = {
    id: "ship",
    name: "Courier",
    type: "vehicle",
    skillDefinition() {
      throw new TypeError("Vehicle actors do not expose character skills");
    },
    items: [
      {
        id: "cannon",
        name: "Laser cannon",
        type: "weapon",
        system: { equipped: true, skill: "gunnery", range: "short", scale: "vehicle" },
      },
    ],
  };
  const source = { ...token("ship-token", 0, 0), actor: vehicle };
  const target = { ...token("target-token", 1000, 0), actor: { name: "Target" } };
  globalThis.game = { user: { isGM: true } };
  globalThis.canvas = {
    scene: map,
    dimensions: { size: 100, distance: 1, units: "km" },
    tokens: { placeables: [source, target] },
  };

  const preview = buildAttackTracePreview(source, target, { scene: map });

  assert.equal(preview.available, true);
  assert.equal(preview.range.scale, "space");
  assert.equal(preview.pool, null);
  assert.match(preview.poolLabel, /choose (?:a )?gunner/i);
  assert.match(preview.error, /gunner/i);
});

test("clicking a valid attack trace card sends its displayed pool to the dice tray", () => {
  const pool = {
    ability: 1,
    proficiency: 2,
    boost: 0,
    difficulty: 0,
    challenge: 1,
    setback: 1,
    force: 0,
  };
  const actor = { id: "hero", name: "Hero" };
  const calls = [];
  const loaded = { pool, context: { label: "loaded" } };
  const result = loadAttackTracePool(
    {
      pool,
      error: "",
      reasons: ["Long range: difficulty 3", "Target defense: 1 setback"],
      automaticResults: { advantage: 1 },
      attack: {
        actorName: "Hero",
        targetName: "Rival",
        itemName: "Service blaster",
      },
    },
    {
      sourceToken: { actor },
      loader: (...args) => {
        calls.push(args);
        return loaded;
      },
    },
  );

  assert.equal(result, loaded);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], pool);
  assert.equal(calls[0][1].actor, actor);
  assert.equal(calls[0][1].label, "Hero → Rival · Service blaster");
  assert.deepEqual(calls[0][1].automaticResults, { advantage: 1 });
  assert.deepEqual(calls[0][1].ruleNotes, [
    "Long range: difficulty 3",
    "Target defense: 1 setback",
  ]);
});

test("attack trace cards refuse invalid pools and actors the user cannot control", () => {
  const previousGame = globalThis.game;
  const previousUi = globalThis.ui;
  const warnings = [];
  let loads = 0;
  globalThis.game = { user: { isGM: false } };
  globalThis.ui = { notifications: { warn: (message) => warnings.push(message) } };
  try {
    const loader = () => loads++;
    assert.equal(
      loadAttackTracePool(
        { pool: { ability: 1 }, error: "Line of sight is blocked." },
        { sourceToken: { actor: { isOwner: true } }, loader },
      ),
      null,
    );
    assert.equal(
      loadAttackTracePool(
        { pool: { ability: 1 }, error: "", attack: {} },
        { sourceToken: { actor: { isOwner: false } }, loader },
      ),
      null,
    );
    assert.equal(loads, 0);
    assert.match(warnings[0], /blocked/i);
    assert.match(warnings[1], /control/i);
  } finally {
    globalThis.game = previousGame;
    globalThis.ui = previousUi;
  }
});

test("range control keeps the token layer active without reopening Token Controls", () => {
  let activations = 0;
  globalThis.game = {
    user: { isGM: true },
    settings: { get: () => false },
  };
  globalThis.canvas = {
    scene: scene({
      grid: { type: 1, size: 100, distance: 1, units: "m" },
      state: { scale: "personal", calibrations: {} },
    }),
    tokens: {
      active: true,
      activate: () => activations++,
    },
  };

  const controls = {};
  addRangeSceneControl(controls);
  controls.starWarsRange.onChange({}, true);

  assert.equal(activations, 0);
  assert.equal(controls.starWarsRange.activeTool, "rangeSelect");
  assert.ok(controls.starWarsRange.tools.rangeVisible.toggle);
  assert.ok(controls.starWarsRange.tools.targetTrace.toggle);
});

test("combat range assistant enables and restores a client's overlay", async () => {
  const values = new Map([
    ["combatRangeAssistant", "automatic"],
    ["combatRangeFollowTurn", true],
    ["rangeOverlayVisible", false],
    ["rangeOverlayMulti", false],
  ]);
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "m" },
    state: { scale: "personal", calibrations: {} },
  });
  const actingToken = token("acting-token", 200, 200);
  globalThis.game = {
    user: { isGM: true },
    settings: {
      get(_system, key) {
        return values.get(key);
      },
      async set(_system, key, value) {
        values.set(key, value);
      },
    },
  };
  globalThis.canvas = {
    scene: map,
    dimensions: { size: 100, distance: 1, units: "m" },
    tokens: { controlled: [], get: () => null },
  };
  const combat = {
    id: "combat-assistant-test",
    scene: map,
    turn: 0,
    turns: [{ actor: { type: "character" }, token: actingToken }],
  };

  await beginCombatRangeAssistant(combat);
  assert.equal(values.get("rangeOverlayVisible"), true);

  await endCombatRangeAssistant(combat);
  assert.equal(values.get("rangeOverlayVisible"), false);
});

test("range overlay registers combat lifecycle automation and camera reflow", async () => {
  const settings = new Map();
  const hooks = new Map();
  globalThis.game = {
    settings: {
      register(_system, key, config) {
        settings.set(key, config);
      },
    },
  };
  globalThis.Hooks = {
    on(name, callback) {
      hooks.set(name, callback);
    },
  };

  registerRangeOverlay();

  assert.equal(settings.get("combatRangeAssistant").default, "automatic");
  assert.deepEqual(
    Object.keys(settings.get("combatRangeAssistant").choices),
    ["automatic", "prompt", "off"],
  );
  assert.equal(settings.get("combatRangeFollowTurn").default, true);
  assert.equal(settings.get("animatedTargetTrace").default, true);
  assert.equal(typeof hooks.get("combatStart"), "function");
  assert.equal(typeof hooks.get("combatTurnChange"), "function");
  assert.equal(typeof hooks.get("deleteCombat"), "function");
  assert.equal(typeof hooks.get("canvasPan"), "function");
  assert.equal(typeof hooks.get("targetToken"), "function");
  assert.equal(typeof hooks.get("renderCombatTracker"), "function");
  assert.equal(typeof hooks.get("refreshToken"), "function");
  assert.equal(typeof hooks.get("refreshTile"), "function");
  assert.equal(typeof hooks.get("updateTile"), "function");
  for(const name of ["Wall","Region","RegionBehavior","Level"])for(const action of ["create","update","delete"])
    assert.equal(typeof hooks.get(`${action}${name}`),"function");

  const map=scene({grid:{type:1,size:100,distance:1,units:"m"},state:{scale:"personal"}});
  const original={id:"slot",actor:{type:"character"},token:token("original",0,0)};
  const claimed={id:"claimant",actor:{type:"character"},token:token("claimant",100,0)};
  let current=original;
  const combat={id:"claim-follow",scene:map,started:true,turn:0,turns:[original],getClaimedCombatant:()=>current};
  game.user={isGM:true};game.settings.get=()=>undefined;game.settings.set=async()=>{};
  globalThis.canvas={scene:map,tokens:{controlled:[],get:()=>null}};
  const session=await beginCombatRangeAssistant(combat);
  assert.deepEqual(session.autoOriginIds,["original"]);
  current=claimed;
  assert.equal(typeof hooks.get("updateCombat"),"function");
  hooks.get("updateCombat")(combat,{flags:{"star-wars-ffg":{slotClaims:[]}}});
  assert.deepEqual(session.autoOriginIds,["claimant"],"a claim of the current slot follows immediately");
  current=original;
  hooks.get("updateCombat")(combat,{"flags.star-wars-ffg.slotClaims":[]});
  assert.deepEqual(session.autoOriginIds,["original"],"flattened claim updates are recognized");
  const previousDocument=globalThis.document,badges=[];
  try {
    current=claimed;game.combat=combat;game.user.targets=new Set([claimed.token]);
    game.settings.get=(_system,key)=>key==="rangeOverlayVisible"?true:undefined;
    canvas.tokens.get=id=>id==="original"?original.token:claimed.token;
    globalThis.document={createElement:()=>({})};
    const row={dataset:{combatantId:"slot"},querySelector:()=>null,append:badge=>badges.push(badge)};
    hooks.get("renderCombatTracker")(null,{querySelectorAll:selector=>selector==="[data-combatant-id]"?[row]:[]});
    assert.equal(badges.length,1,"range badges use the slot claimant's token");
  } finally {globalThis.document=previousDocument;}
  await endCombatRangeAssistant(combat);
});


test("the nearest rotated corner changes the shared band, personal difficulty and sight ray", async () => {
  const oldCanvas=globalThis.canvas, oldConfig=globalThis.CONFIG;
  const map=scene({grid:{type:1,size:100,distance:1,units:"m"},state:{scale:"personal"}});
  const source={...token("corner-source",0,0),w:100,h:100,actor:{type:"character"}};
  const target={...token("corner-target",1000,0),w:400,h:1000,actor:{type:"vehicle"}};
  target.document.rotation=45;
  let ray;
  globalThis.canvas={tokens:{placeables:[source,target]}};
  globalThis.CONFIG={Canvas:{polygonBackends:{sight:{testCollision:(a,b)=>{ray={source:a,target:b};return null;}}}}};
  try {
    const result=measureTokenRange(source,target,{scene:map});
    assert.equal(result.band,"short");
    assert.ok(Math.abs(result.sceneDistance-(Math.hypot(1000-700/Math.sqrt(2),300/Math.sqrt(2))-50)/100)<1e-8);
    assert.deepEqual(ray,{source:{...result.sourceEdge,elevation:0},target:{...result.targetEdge,elevation:0}});
    const { automaticCheckPool }=await import("../src/dice/builder.mjs");
    const options={characteristic:3,rank:2,skill:"rangedLight",rangeBand:result.band,weaponRange:"long"};
    assert.equal(automaticCheckPool(options).pool.difficulty,1);
    target.document.rotation=0;
    const straight=measureTokenRange(source,target,{scene:map});
    assert.equal(straight.band,"medium");
    assert.equal(automaticCheckPool({...options,rangeBand:straight.band}).pool.difficulty,2);
    target.document.rotation=45; target.document.lockRotation=true;
    assert.equal(measureTokenRange(source,target,{scene:map}).band,"medium");
  } finally {globalThis.canvas=oldCanvas;globalThis.CONFIG=oldConfig;}
});
