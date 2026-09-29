import { RANGES, SKILLS, SYSTEM_ID } from "../config.mjs";
import { automaticCheckPool, ROLL_DICE } from "../dice/builder.mjs";
import { loadCompactPool } from "../dice/compact-tray.mjs";
import { tokenLabelPosition } from "../turn-economy-foundry.mjs";
import { assignedCrewCheck, hasVehicle } from "../vehicle-crew-foundry.mjs";
import { crewForSkill } from "../vehicle-crew.mjs";
import { checkWeaponArc, weaponArcProfile } from "./arcs.mjs";
import { defenseZoneExposed, defenseZoneBoundaryPoints, firingZoneRays } from "./hull-zones.mjs";
import { expectedAttackImpact, compareAttackOptions } from "./strength.mjs";
import { openCanvasArcPicker, closeCanvasArcPicker, repositionCanvasArcPicker } from "./arc-picker-foundry.mjs";
import { escapeHTML } from "../mechanics.mjs";
import { footprintBoundaryPoint, footprintRayIntersections, footprintSightCandidates, footprintSightRay, measureFootprintGap, rangeFootprint, rangeOutline } from "./footprints.mjs";
import {
  RANGE_SCALES,
  buildAttackTraceSegments,
  calibrationFromPointer,
  chooseAttackTraceLabelLayout,
  chooseRangeLabelLayout,
  classifyRangeDistance,
  createRangeProfile,
  farthestViewportCornerAngle,
  hasSceneScaleReference,
  inferCombatRangeScale,
  interpolateRangeLabelAngle,
  normalizeRangeScale,
  pauseBannerScreenBounds,
  reconcileRangeOrigins,
  segmentEllipseIntersection,
} from "./core.mjs";

const FLAG = "rangeOverlay";
const CONTROL = "starWarsRange";
const SELECT_TOOL = "rangeSelect";
const COMBAT_MODE_SETTING = "combatRangeAssistant";
const COMBAT_FOLLOW_SETTING = "combatRangeFollowTurn";
const TARGET_TRACE_SETTING = "animatedTargetTrace";
export const ATTACK_TRACE_DURATION_MS = 2000;
const originsByScene = new Map();
const combatSessions = new Map();
const attackSelections = new Map();
const attackTraceEntries = new Map();
const labelStates = new Map();
const labelEntries = new Map();
const originTitles = new Map();
let overlayContainer = null;
let attackTraceContainer = null;
let calibrationSession = null;
let labelReflowFrame = null;
let registered = false;
let interfaceObserver = null;

const currentScene = () => globalThis.canvas?.scene ?? null;

function setting(key, fallback) {
  try {
    return globalThis.game?.settings?.get(SYSTEM_ID, key) ?? fallback;
  } catch {
    return fallback;
  }
}

function sceneGrid(scene = currentScene()) {
  const dimensions =
    scene?.id === globalThis.canvas?.scene?.id
      ? globalThis.canvas?.dimensions
      : null;
  return {
    type: scene?.grid?.type ?? 0,
    size: dimensions?.size ?? scene?.grid?.size ?? 0,
    distance: dimensions?.distance ?? scene?.grid?.distance ?? 0,
    units: dimensions?.units ?? scene?.grid?.units ?? "",
  };
}

export function getRangeOverlaySceneState(scene = currentScene()) {
  const raw = scene?.getFlag?.(SYSTEM_ID, FLAG) ?? {};
  const calibrations =
    raw.calibrations && typeof raw.calibrations === "object"
      ? raw.calibrations
      : {};
  return {
    scale: normalizeRangeScale(raw.scale),
    scaleConfigured: typeof raw.scale === "string" && raw.scale.length > 0,
    calibrations,
  };
}

export function getSceneRangeProfile(scene = currentScene()) {
  if (!scene) return null;
  const state = getRangeOverlaySceneState(scene);
  return createRangeProfile({
    scale: state.scale,
    grid: sceneGrid(scene),
    calibration: state.calibrations[state.scale],
  });
}

export function getTokenRangeScale(token, scene = currentScene()) {
  const sceneScale = getRangeOverlaySceneState(scene).scale;
  const resolved = resolveToken(token);
  const actorType = String(
    resolved?.actor?.type ?? resolved?.document?.actor?.type ?? "",
  );
  if (actorType === "vehicle")
    return sceneScale === "planetary" ? "planetary" : "space";
  if (actorType) return "personal";
  return sceneScale;
}

export function getTokenRangeProfile(token, scene = currentScene()) {
  if (!scene) return null;
  const state = getRangeOverlaySceneState(scene);
  const scale = getTokenRangeScale(token, scene);
  return createRangeProfile({
    scale,
    grid: sceneGrid(scene),
    calibration: state.calibrations[scale],
  });
}

function resolveToken(token) {
  if (!token) return null;
  if (typeof token === "string")
    return (
      globalThis.canvas?.tokens?.get?.(token) ??
      globalThis.canvas?.tokens?.placeables?.find(
        (candidate) => candidate.id === token,
      ) ??
      null
    );
  if (token.center && token.document) return token;
  if (token.object?.center) return token.object;
  if (token.document?.object?.center) return token.document.object;
  return token;
}

function tokenCenter(token) {
  const resolved = resolveToken(token);
  const center =
    resolved?.center ??
    resolved?.document?.getCenterPoint?.() ??
    resolved?.getCenterPoint?.();
  const x = Number(center?.x);
  const y = Number(center?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function tokenRangeFootprint(token, scene = currentScene()) {
  const resolved = resolveToken(token), center = tokenCenter(resolved);
  if (!center) return null;
  const gridSize = Number(sceneGrid(scene).size) || 100;
  const width = Number(resolved?.w ?? resolved?.bounds?.width ?? resolved?.document?.width * gridSize);
  const height = Number(resolved?.h ?? resolved?.bounds?.height ?? resolved?.document?.height * gridSize);
  return rangeFootprint({ ...center, width, height,
    rotation: resolved?.document?.lockRotation ? 0 : resolved?.document?.rotation ?? resolved?.rotation ?? 0,
    shape: (resolved?.actor?.type ?? resolved?.document?.actor?.type) === "vehicle" ? "rectangle" : "circle" });
}

function tokenSceneId(token) {
  const resolved = resolveToken(token);
  return (
    resolved?.document?.parent?.id ??
    resolved?.parent?.id ??
    currentScene()?.id ??
    ""
  );
}

function tokenElevation(token) {
  const resolved = resolveToken(token),
    elevation = Number(resolved?.document?.elevation ?? resolved?.elevation ?? 0);
  return Number.isFinite(elevation) ? elevation : 0;
}

function segmentProgress(sourcePoint, targetPoint, point) {
  const deltaX = targetPoint.x - sourcePoint.x;
  const deltaY = targetPoint.y - sourcePoint.y;
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  if (lengthSquared <= Number.EPSILON) return 0;
  return Math.max(
    0,
    Math.min(
      1,
      ((point.x - sourcePoint.x) * deltaX +
        (point.y - sourcePoint.y) * deltaY) /
        lengthSquared,
    ),
  );
}

function collisionPoint(collision) {
  const candidate = Array.isArray(collision) ? collision[0] : collision;
  const point = candidate?.point ?? candidate?.target ?? candidate;
  const x = Number(point?.x);
  const y = Number(point?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function lineOfSightResult(sourcePoint, targetPoint) {
  const backend = globalThis.CONFIG?.Canvas?.polygonBackends?.sight;
  if (typeof backend?.testCollision !== "function")
    return {
      lineOfSight: "unavailable",
      lineOfSightBlocked: null,
      obstruction: null,
    };
  try {
    const collision = backend.testCollision(sourcePoint, targetPoint, {
      mode: "closest",
      type: "sight",
    });
    if (collision && typeof collision.then === "function")
      return {
        lineOfSight: "unavailable",
        lineOfSightBlocked: null,
        obstruction: null,
      };
    const point = collisionPoint(collision);
    const blocked = Boolean(collision);
    return {
      lineOfSight: blocked ? "blocked" : "clear",
      lineOfSightBlocked: blocked,
      obstruction: blocked
        ? {
            kind: "wall",
            name: "Sight-blocking wall",
            point:
              point ?? {
                x: (sourcePoint.x + targetPoint.x) / 2,
                y: (sourcePoint.y + targetPoint.y) / 2,
              },
            progress: point
              ? segmentProgress(sourcePoint, targetPoint, point)
              : 0.5,
          }
        : null,
    };
  } catch {
    return {
      lineOfSight: "unavailable",
      lineOfSightBlocked: null,
      obstruction: null,
    };
  }
}

function tokenDimensions(token) {
  const resolved = resolveToken(token);
  const bounds = resolved?.bounds;
  const gridSize = Number(globalThis.canvas?.dimensions?.size) || 100;
  const width = Number(
    bounds?.width ?? resolved?.w ?? resolved?.document?.width * gridSize,
  );
  const height = Number(
    bounds?.height ?? resolved?.h ?? resolved?.document?.height * gridSize,
  );
  return {
    width: width > 0 ? width : gridSize,
    height: height > 0 ? height : gridSize,
  };
}

function tokenObstructionResult(source, target, sourcePoint, targetPoint) {
  const sourceId = String(source?.id ?? source?.document?.id ?? "");
  const targetId = String(target?.id ?? target?.document?.id ?? "");
  let nearest = null;
  for (const candidate of globalThis.canvas?.tokens?.placeables ?? []) {
    const resolved = resolveToken(candidate);
    const id = String(resolved?.id ?? resolved?.document?.id ?? "");
    if (!resolved || !id || id === sourceId || id === targetId || hasVehicle(resolved)) continue;
    if (
      !globalThis.game?.user?.isGM &&
      (resolved.document?.hidden === true || resolved.visible === false)
    )
      continue;
    const center = tokenCenter(resolved);
    if (!center) continue;
    const { width, height } = tokenDimensions(resolved);
    const hit = segmentEllipseIntersection(sourcePoint, targetPoint, {
      x: center.x,
      y: center.y,
      radiusX: width * 0.46,
      radiusY: height * 0.46,
    });
    if (!hit || hit.progress >= 0.995) continue;
    if (!nearest || hit.progress < nearest.progress)
      nearest = {
        kind: "token",
        name:
          resolved.actor?.name ??
          resolved.name ??
          resolved.document?.name ??
          "Intervening token",
        tokenId: id,
        ...hit,
      };
  }
  return nearest;
}

function nearerObstruction(left, right) {
  if (!left) return right;
  if (!right) return left;
  return left.progress <= right.progress ? left : right;
}

function attackSightResult(source, target, sourceFootprint, targetFootprint, traceSource, traceTarget, weapon, fireArc, defenseZone) {
  const arcCheck=end=>source?.actor?.type==="vehicle" && weapon ? checkWeaponArc(weapon,{
    origin:tokenCenter(source),point:end,rotation:source.document?.rotation ?? 0,hull:sourceFootprint,
    sourceElevation:tokenElevation(source),targetElevation:tokenElevation(target),fireArc,
  }) : {inArc:true,arc:"",error:""};
  const check = (start,end) => {
    const wallSight=lineOfSightResult(start,end);
    const obstruction=nearerObstruction(wallSight.obstruction,tokenObstructionResult(source,target,start,end));
    const arc=arcCheck(end);
    const zone={inArc:!defenseZone || target?.actor?.type!=="vehicle" || defenseZoneExposed(targetFootprint,defenseZone,end,start)};
    return {...(obstruction ? {lineOfSight:"blocked",lineOfSightBlocked:true,obstruction} : wallSight),
      arcValid:arc.inArc===null||zone.inArc===null ? null : arc.inArc&&zone.inArc,firingArc:arc.arc,
      arcError:arc.error || (zone.inArc ? "" : `No clear shot reaches the target's ${defenseZone} defensive zone.`)};
  };
  const nearest={...check(traceSource,traceTarget),traceSource,traceTarget,sightPath:"nearest",partiallyObscured:false};
  // Ordinary clear shots retain the fast single-ray path. A failed/unavailable
  // wall query is never evidence for clearing a different shot.
  if (nearest.arcValid===null || !nearest.lineOfSightBlocked && nearest.arcValid) return nearest;
  const clearSides=new Map();
  // Exact hull corners keep defensive faces separate; source firing arcs still
  // need analytic intersections for shots shared at their 45-degree boundary.
  const boundaryPoints=defenseZone ? defenseZoneBoundaryPoints(targetFootprint,defenseZone,tokenCenter(source)) : [];
  if(source?.actor?.type==="vehicle" && weapon)for(const ray of firingZoneRays(sourceFootprint,fireArc?[fireArc]:weaponArcProfile(weapon).arcs))
    boundaryPoints.push(...footprintRayIntersections(targetFootprint,ray.origin,ray.direction));
  for (const ray of footprintSightCandidates(sourceFootprint,targetFootprint,boundaryPoints)) {
    if (Math.hypot(ray.source.x-traceSource.x,ray.source.y-traceSource.y)<1e-4 &&
        Math.hypot(ray.target.x-traceTarget.x,ray.target.y-traceTarget.y)<1e-4) continue;
    const sight=check(ray.source,ray.target);
    if (sight.lineOfSight!=="clear" || !sight.arcValid) continue;
    const cross=(traceTarget.x-traceSource.x)*(ray.target.y-traceTarget.y) -
      (traceTarget.y-traceSource.y)*(ray.target.x-traceTarget.x);
    const side=cross<0 ? -1 : 1;
    if (!clearSides.has(side)) clearSides.set(side,ray);
  }
  let best=null;
  for (const candidate of clearSides.values()) {
    // Refine both sides of the obstruction toward the nearest point. Keep only
    // tested-clear rays so a wall/token union or a backend failure cannot clear
    // an attack. Fourteen steps give sub-pixel precision on ordinary maps.
    let blocked=0, clear=1, ray=candidate;
    for (let step=0;step<14;step++) {
      const t=(blocked+clear)/2;
      const probe=footprintSightRay(sourceFootprint,targetFootprint,{
        x:traceTarget.x+(candidate.target.x-traceTarget.x)*t,
        y:traceTarget.y+(candidate.target.y-traceTarget.y)*t,
      });
      const sight=check(probe.source,probe.target);
      if (sight.lineOfSight==="clear" && sight.arcValid) {clear=t;ray=probe;}
      else blocked=t;
    }
    if (!best || ray.distance<best.distance) best=ray;
  }
  if (best) return {lineOfSight:"clear",lineOfSightBlocked:false,obstruction:null,
    traceSource:best.source,traceTarget:best.target,sightPath:"alternate",partiallyObscured:!!nearest.lineOfSightBlocked,
    arcValid:true,firingArc:arcCheck(best.target).arc,arcError:""};
  return nearest;
}

export function measureTokenRange(
  sourceToken,
  targetToken,
  { scene = currentScene(), weapon = null, fireArc = "", defenseZone = "" } = {},
) {
  const source = resolveToken(sourceToken);
  const target = resolveToken(targetToken);
  const sourcePoint = tokenCenter(source);
  const targetPoint = tokenCenter(target);
  if (!sourcePoint || !targetPoint)
    return {
      available: false,
      reason: "Both source and target need tokens on the current scene.",
    };
  if (
    tokenSceneId(source) &&
    tokenSceneId(target) &&
    tokenSceneId(source) !== tokenSceneId(target)
  )
    return {
      available: false,
      reason: "Source and target are on different scenes.",
    };
  const profile = getTokenRangeProfile(source, scene);
  if (!profile)
    return {
      available: false,
      reason: "This Theatre-of-the-Mind scene has not been calibrated.",
      scale: getTokenRangeScale(source, scene),
    };
  const sourceFootprint=tokenRangeFootprint(source, scene), targetFootprint=tokenRangeFootprint(target, scene);
  const gap = measureFootprintGap(sourceFootprint, targetFootprint);
  const sight=attackSightResult(source,target,sourceFootprint,targetFootprint,
    gap.distance>0 ? gap.source : sourcePoint, gap.distance>0 ? gap.target : targetPoint,weapon,fireArc,defenseZone);
  const horizontalDistancePx = sight.sightPath==="alternate"
    ? Math.hypot(sight.traceTarget.x-sight.traceSource.x,sight.traceTarget.y-sight.traceSource.y) : gap.distance;
  const grid = sceneGrid(scene),
    scaled = hasSceneScaleReference(grid),
    horizontalSceneDistance = scaled
      ? (horizontalDistancePx / grid.size) * grid.distance
      : null,
    elevationDifference = scaled
      ? Math.abs(tokenElevation(target) - tokenElevation(source))
      : null,
    verticalDistancePx = scaled
      ? (elevationDifference / grid.distance) * grid.size
      : 0,
    distancePx = Math.hypot(horizontalDistancePx, verticalDistancePx),
    sceneDistance = scaled
      ? Math.hypot(horizontalSceneDistance, elevationDifference)
      : null,
    result = classifyRangeDistance(distancePx, profile);
  const band = profile.bands.find((entry) => entry.id === result.band);
  return {
    available: true,
    ...result,
    label: band?.label ?? "Beyond Extreme",
    measurement: "edge-to-edge",
    distanceBasis: sight.sightPath==="alternate" ? "clear-shot" : "nearest-edges",
    nearestDistancePx: Math.hypot(gap.distance,verticalDistancePx),
    nearestSceneDistance: scaled ? Math.hypot(gap.distance/grid.size*grid.distance,elevationDifference) : null,
    sourceEdge: gap.source,
    targetEdge: gap.target,
    horizontalDistancePx,
    verticalDistancePx,
    horizontalSceneDistance,
    elevationDifference,
    elevationApplied: scaled && elevationDifference > 0,
    sceneDistance,
    units: sceneDistance === null ? "" : grid.units,
    ...sight,
    sourceTokenId: source?.id ?? source?.document?.id ?? "",
    targetTokenId: target?.id ?? target?.document?.id ?? "",
  };
}

export function findActorRangeOrigin(actor) {
  if (!actor) return null;
  const controlled = globalThis.canvas?.tokens?.controlled ?? [];
  return (
    controlled.find((token) => token.actor?.id === actor.id) ??
    actor.getActiveTokens?.()?.find(
      (token) => token.document?.parent?.id === currentScene()?.id,
    ) ??
    null
  );
}

export function measureActorTargetRange(actor, targetToken) {
  const source = findActorRangeOrigin(actor);
  return source
    ? measureTokenRange(source, targetToken)
    : {
        available: false,
        reason: "Select a token for the acting character to measure range.",
      };
}

function actorItems(actor) {
  return Array.from(actor?.items?.contents ?? actor?.items ?? []);
}

export function targetCombatOpposition(actor, { melee = false } = {}) {
  const traits = actor?.effectiveTraits?.();
  const defense = actor
    ? Math.max(
        0,
        Number(
          traits?.defense?.[melee ? "melee" : "ranged"] ??
            actor.system?.defense?.[melee ? "melee" : "ranged"],
        ) || 0,
      )
    : 0;
  const adversary = actor
    ? Math.max(
        0,
        ...actorItems(actor)
          .filter(
            (candidate) =>
              candidate.type === "talent" &&
              String(candidate.name ?? "").trim().toLowerCase() === "adversary",
          )
          .map((candidate) => Number(candidate.system?.rank) || 1),
      )
    : 0;
  return { defense, adversary };
}

function attackWeapon(actor, selection = {}) {
  const weapons = actorItems(actor).filter((item) => item.type === "weapon");
  const selected = weapons.find((item) => item.id === selection.itemId);
  if (selection.itemId) return selected ?? null;
  return (
    weapons.find((item) => item.system?.equipped === true) ?? weapons[0] ?? null
  );
}

function actorSkillDefinition(actor, key) {
  let resolved = null;
  try {
    resolved = actor?.skillDefinition?.(key);
  } catch {
    resolved = null;
  }
  if (resolved) return resolved;
  const definition = SKILLS[key];
  const state = actor?.system?.skills?.[key];
  return definition && state
    ? { key, ...definition, state }
    : null;
}

function poolLabel(pool) {
  if (!pool) return "Choose a gunner to build the roll pool";
  const labels = {
    ability: "Ability",
    proficiency: "Proficiency",
    boost: "Boost",
    difficulty: "Difficulty",
    challenge: "Challenge",
    setback: "Setback",
    force: "Force",
  };
  const parts = ROLL_DICE.filter((key) => Number(pool[key]) > 0).map(
    (key) => `${pool[key]} ${labels[key]}`,
  );
  return parts.length ? parts.join(" · ") : "No dice in pool";
}

function attackSelectionFor(actor) {
  return attackSelections.get(String(actor?.id ?? "")) ?? {};
}

function selectionForTarget(selection, target) {
  return selection.defenseTargetId && selection.defenseTargetId !== String(target?.id ?? target?.document?.id ?? "")
    ? {...selection, defenseZone: ""} : selection;
}

export function setAttackTraceSelection(
  actor,
  { skillKey = "", itemId = "", crewTokenId = "", fireArc = "", fireFacing = "", defenseZone = "", defenseTargetId = "" } = {},
) {
  const actorId = String(actor?.id ?? "");
  if (!actorId) return;
  attackSelections.set(actorId, {
    skillKey: String(skillKey ?? ""),
    itemId: String(itemId ?? ""),
    crewTokenId: String(crewTokenId ?? ""),
    fireArc: String(fireArc ?? ""),
    fireFacing: String(fireFacing ?? ""),
    defenseZone: String(defenseZone ?? ""),
    defenseTargetId: String(defenseTargetId ?? ""),
  });
  refreshTargetTraces({ animate: false, actorId });
}

export function buildAttackTracePreview(
  sourceToken, targetToken, {scene=currentScene(),selection=null}={},
) {
  const source=resolveToken(sourceToken), chosen=selection ?? attackSelectionFor(source?.actor);
  if(source?.actor?.type!=="vehicle")return buildSingleAttackPreview(sourceToken,targetToken,{scene,selection:chosen});
  const options=vehicleAttackOptions(sourceToken,targetToken,{scene,selection:chosen});
  const compatible=options.filter(option=>(!chosen.itemId || option.attack?.itemId===chosen.itemId) &&
    (!chosen.crewTokenId || option.attack?.crewTokenId===chosen.crewTokenId) &&
    (!chosen.fireArc || option.attack?.firingArc===chosen.fireArc));
  const best=compatible[0] ?? buildSingleAttackPreview(sourceToken,targetToken,{scene,selection:chosen});
  return {...best,attack:best.attack?{...best.attack,selectionMode:chosen.itemId||chosen.crewTokenId||chosen.fireArc||chosen.fireFacing?"Selected":"Auto strongest"}:null};
}

export function vehicleAttackOptions(sourceToken,targetToken,{scene=currentScene(),selection={}}={}) {
  const source=resolveToken(sourceToken), target=resolveToken(targetToken), actor=source?.actor;
  selection=selectionForTarget(selection,target);
  if(actor?.type!=="vehicle")return [];
  const weapons=actorItems(actor).filter(item=>item.type==="weapon");
  const equipped=weapons.filter(item=>item.system?.equipped);
  const mounts=selection.itemId ? weapons.filter(item=>item.id===selection.itemId) : equipped.length ? equipped : weapons;
  const document=source.document ?? source, cache=new Map(), options=[];
  for(const weapon of mounts) {
    const skillKey=weapon.system?.skill || "gunnery", profile=weaponArcProfile(weapon);
    if(selection.fireFacing && profile.vertical!==selection.fireFacing)continue;
    const members=crewForSkill(document,document.parent?.tokens ?? [],skillKey).filter(row=>{
      if(row.token.hidden && !globalThis.game?.user?.isGM)return false;
      try {assignedCrewCheck(source,skillKey,row.id);return true;}catch{return false;}
    });
    for(const fireArc of profile.error?[""]:profile.arcs) {
      if(selection.fireArc && fireArc!==selection.fireArc)continue;
      const key=JSON.stringify([profile,fireArc,selection.defenseZone]);
      if(!cache.has(key))cache.set(key,measureTokenRange(source,target,{scene,weapon,fireArc,defenseZone:selection.defenseZone}));
      for(const member of members.length?members:[null]) {
        if(selection.crewTokenId && member?.id!==selection.crewTokenId)continue;
        const chosen={itemId:weapon.id,skillKey,fireArc,fireFacing:selection.fireFacing ?? "",crewTokenId:member?.id ?? "",defenseZone:selection.defenseZone ?? ""};
        const preview=buildSingleAttackPreview(source,target,{scene,selection:chosen,rangeOverride:cache.get(key)});
        if(preview.attack)preview.attack={...preview.attack,firingArc:fireArc,crewTokenId:member?.id ?? "",crewName:member?.name ?? "Unassigned"};
        preview.selection=chosen;
        preview.strength=expectedAttackImpact({damage:weapon.system?.damage,scale:weapon.system?.scale,pool:preview.pool,automaticResults:preview.automaticResults});
        options.push(preview);
      }
    }
  }
  return options.sort(compareAttackOptions);
}

function buildSingleAttackPreview(
  sourceToken,
  targetToken,
  { scene = currentScene(), selection = null, rangeOverride = null } = {},
) {
  const source = resolveToken(sourceToken);
  const target = resolveToken(targetToken);
  const actor = source?.actor;
  const chosen = selectionForTarget(selection ?? attackSelectionFor(actor),target);
  const weapon = attackWeapon(actor, chosen);
  const range = rangeOverride ?? measureTokenRange(source, target, { scene,weapon,fireArc:chosen.fireArc,defenseZone:chosen.defenseZone });
  if (!range.available)
    return {
      available: false,
      range,
      attack: null,
      pool: null,
      poolLabel: "Roll pool unavailable",
      error: range.reason,
    };
  if (!actor)
    return {
      available: true,
      range,
      attack: null,
      pool: null,
      poolLabel: "Choose an actor to build the roll pool",
      error: "The attacking token has no actor.",
    };
  const skillKey = String(chosen.skillKey || weapon?.system?.skill || (actor.type === "vehicle" ? "gunnery" : "brawl"));
  const itemName = weapon?.name ?? (skillKey === "brawl" ? "Unarmed" : "");
  const skillLabel = SKILLS[skillKey]?.label ?? skillKey;
  const attack = {
    actorName: actor.name ?? source?.name ?? "Attacker",
    targetName: target?.actor?.name ?? target?.name ?? "Target",
    itemId: weapon?.id ?? "",
    itemName,
    skillKey,
    skillLabel,
    firingArc:range.firingArc ?? "",
    fireFacing:chosen.fireFacing ?? "",
  };
  if(chosen.itemId && !weapon)return {available:true,range,attack,pool:null,poolLabel:"Choose an available weapon",
    error:"The selected weapon is unavailable. Choose another weapon or restore Auto."};
  if(chosen.fireFacing && weaponArcProfile(weapon).vertical!==chosen.fireFacing)return {available:true,range,attack,pool:null,poolLabel:"No matching mount",
    error:`No available ${chosen.fireFacing} weapon matches this choice.`};
  let actingActor=actor,crew=null;
  if (actor.type === "vehicle") {
    if(!weapon)return {available:true,range,attack,pool:null,poolLabel:"Choose a vehicle weapon",
      error:"Add or select the vehicle's weapon on its sheet before building an attack pool."};
    try {
      crew=assignedCrewCheck(source,skillKey,chosen.crewTokenId);
      if(crew.token?.hidden && !globalThis.game?.user?.isGM)throw new Error("No visible crew member is assigned to this choice.");
      actingActor=crew.actor;
    }
    catch(error){return {
      available: true,
      range,
      attack,
      pool: null,
      poolLabel: "Choose a gunner to build the roll pool",
      error: `Choose a gunner: ${error.message}`,
    };}
  }
  const skill = actorSkillDefinition(actingActor, skillKey);
  attack.skillLabel = skill?.label ?? skillLabel;
  if (!skill || skill.group !== "Combat")
    return {
      available: true,
      range,
      attack,
      pool: null,
      poolLabel: "Choose a combat skill or weapon",
      error: "No valid combat skill is selected for this attacker.",
    };
  const characteristic =
    skill.state?.characteristic || skill.characteristic || "agility";
  const characteristicValue = Number(
    actingActor.system?.characteristics?.[characteristic],
  );
  const rank = Number(actingActor.skillRank?.(skillKey) ?? skill.state?.rank ?? 0);
  const melee = ["brawl", "melee", "lightsaber"].includes(skillKey);
  const opposition = targetCombatOpposition(target?.actor, { melee });
  const shields=target?.actor?.type==="vehicle" ? target.actor.system?.shields : null;
  const rawShield=shields && Object.hasOwn(shields,chosen.defenseZone) ? Number(shields[chosen.defenseZone]) : NaN;
  const shieldValue=Number.isFinite(rawShield) ? Math.max(0,rawShield) : null;
  if(shieldValue!==null)opposition.defense=shieldValue;
  const weaponRange = RANGES.includes(weapon?.system?.range)
    ? weapon.system.range
    : melee
      ? "engaged"
      : "";
  let talentRules = null;
  try {
    talentRules = actingActor.talentRulesForCheck?.(skillKey) ?? null;
  } catch {
    talentRules = null;
  }
  const result = automaticCheckPool({
    characteristic: Number.isFinite(characteristicValue)
      ? characteristicValue
      : 0,
    rank: Number.isFinite(rank) ? rank : 0,
    skill: skillKey,
    weaponRange,
    rangeBand: range.band,
    defense: opposition.defense,
    adversary: opposition.adversary,
    combat: true,
    melee,
    talentRules,
    vehicleAttack: !!crew,
    attackerSilhouette: actor.system?.silhouette,
    targetSilhouette: target?.actor?.system?.silhouette ?? (target?.actor?.type!=="vehicle" ? 1 : undefined),
  });
  if(target?.actor?.type==="vehicle" && shieldValue===null)result.error ||= "Choose the target's agreed defence zone on its token or in the vehicle check builder.";
  const obstructionError = range.lineOfSightBlocked
    ? `Line of sight is blocked by ${range.obstruction?.name ?? "an obstruction"}.`
    : "";
  return {
    available: true,
    range,
    attack: {
      ...attack,
      characteristic,
      characteristicValue,
      rank,
      melee,
      defense: opposition.defense,
      adversary: opposition.adversary,
      weaponRange,
      crewTokenId: crew?.id,
      crewName: crew?.name,
      defenseZone:shieldValue!==null ? chosen.defenseZone : "",
    },
    pool: result.pool,
    poolLabel: poolLabel(result.pool),
    reasons: [...result.reasons, ...(range.firingArc?[`${range.firingArc} firing arc · ${weapon.name} · ${crew?.name ?? actor.name}`]:[]), ...(range.sightPath==="alternate"
      ? ["Range and difficulty use the shortest clear firing line found to the target. The GM decides cover modifiers."] : [])],
    automaticResults: result.automaticResults,
    error: range.arcError || obstructionError || result.error,
  };
}

export function loadAttackTracePool(
  preview,
  { sourceToken = null, loader = loadCompactPool } = {},
) {
  const unavailable = preview?.error || (!preview?.pool
    ? "No automatic roll pool is available for this attack."
    : "");
  if (unavailable) {
    globalThis.ui?.notifications?.warn?.(unavailable);
    return null;
  }
  let actor = sourceToken?.actor;
  if (actor?.isOwner === false && !globalThis.game?.user?.isGM) {
    globalThis.ui?.notifications?.warn?.(
      "You do not control the attacking actor for this pool.",
    );
    return null;
  }
  const attack = preview.attack ?? {};
  if(attack.crewTokenId) {
    try {actor=assignedCrewCheck(sourceToken,attack.skillKey,attack.crewTokenId).actor;}
    catch(error){globalThis.ui?.notifications?.warn?.(error.message);return null;}
  }
  const subject = `${attack.actorName ?? "Attacker"} → ${attack.targetName ?? "Target"}`;
  const label = attack.itemName ? `${subject} · ${attack.itemName}` : subject;
  const loaded = loader(preview.pool, {
    label,
    actor,
    turnCost: "action",
    automaticResults: preview.automaticResults ?? {},
    ruleNotes: preview.reasons ?? [],
  });
  globalThis.ui?.notifications?.info?.(
    "Dice sent to the quick pool. Adjust the pool beside chat, then roll.",
  );
  return loaded;
}

function controlledIds() {
  return Array.from(
    globalThis.canvas?.tokens?.controlled ?? [],
    (token) => token.id,
  );
}

function originIds(scene = currentScene()) {
  return originsByScene.get(scene?.id) ?? [];
}

function setOriginIds(ids, scene = currentScene()) {
  if (!scene) return;
  originsByScene.set(scene.id, [...new Set(ids.filter(Boolean))]);
}

function seedOrigins() {
  const scene = currentScene();
  if (!scene) return;
  const controlled = controlledIds();
  if (!controlled.length) return;
  if (setting("rangeOverlayMulti", false))
    setOriginIds([...originIds(scene), ...controlled], scene);
  else setOriginIds(controlled.slice(-1), scene);
}

function cancelFrame(frame) {
  if (frame === null || frame === undefined) return;
  if (typeof globalThis.cancelAnimationFrame === "function")
    globalThis.cancelAnimationFrame(frame);
  else clearTimeout(frame);
}

function requestFrame(callback) {
  return typeof globalThis.requestAnimationFrame === "function"
    ? globalThis.requestAnimationFrame(callback)
    : setTimeout(() => callback(Date.now()), 16);
}

function stopLabelAnimations({ clearState = false } = {}) {
  for (const state of labelStates.values()) {
    cancelFrame(state.frame);
    state.frame = null;
  }
  if (clearState) labelStates.clear();
}

function destroyOverlay({ clearLabelState = false } = {}) {
  stopLabelAnimations({ clearState: clearLabelState });
  labelEntries.clear();
  originTitles.clear();
  if (overlayContainer && !overlayContainer.destroyed)
    overlayContainer.destroy({ children: true });
  overlayContainer = null;
}

function clearAttackTrace(targetId = "") {
  const id = String(targetId ?? "");
  for (const [key, entry] of attackTraceEntries) {
    if (id && entry.targetId !== id) continue;
    cancelFrame(entry.frame);
    cancelFrame(entry.labelFrame);
    entry.group?.destroy?.({ children: true });
    attackTraceEntries.delete(key);
  }
}

function destroyAttackTraces() {
  clearAttackTrace();
  if (attackTraceContainer && !attackTraceContainer.destroyed)
    attackTraceContainer.destroy({ children: true });
  attackTraceContainer = null;
}

function getAttackTraceContainer() {
  const parent = globalThis.canvas?.interface;
  if (!parent) return null;
  if (
    attackTraceContainer?.parent === parent &&
    !attackTraceContainer.destroyed
  )
    return attackTraceContainer;
  destroyAttackTraces();
  attackTraceContainer = new PIXI.Container();
  attackTraceContainer.name = `${SYSTEM_ID}-attack-traces`;
  attackTraceContainer.eventMode = "passive";
  attackTraceContainer.interactiveChildren = true;
  attackTraceContainer.sortableChildren = true;
  attackTraceContainer.zIndex = 25;
  parent.addChild(attackTraceContainer);
  parent.sortChildren?.();
  return attackTraceContainer;
}

function getOverlayContainer() {
  const parent = globalThis.canvas?.interface;
  if (!parent) return null;
  if (overlayContainer?.parent === parent && !overlayContainer.destroyed)
    return overlayContainer;
  destroyOverlay();
  overlayContainer = new PIXI.Container();
  overlayContainer.name = `${SYSTEM_ID}-range-overlay`;
  overlayContainer.eventMode = "none";
  overlayContainer.interactiveChildren = false;
  overlayContainer.sortableChildren = true;
  overlayContainer.zIndex = -1;
  parent.addChild(overlayContainer);
  parent.sortChildren?.();
  return overlayContainer;
}

function clearOverlay() {
  if (!overlayContainer || overlayContainer.destroyed) return;
  stopLabelAnimations();
  labelEntries.clear();
  originTitles.clear();
  for (const child of overlayContainer.removeChildren())
    child.destroy?.({ children: true });
}

function maximumVisibleRadius(origin) {
  const rect = globalThis.canvas?.dimensions?.sceneRect;
  if (!rect) return Number.POSITIVE_INFINITY;
  return (
    Math.max(
      Math.hypot(origin.x - rect.x, origin.y - rect.y),
      Math.hypot(origin.x - (rect.x + rect.width), origin.y - rect.y),
      Math.hypot(origin.x - rect.x, origin.y - (rect.y + rect.height)),
      Math.hypot(
        origin.x - (rect.x + rect.width),
        origin.y - (rect.y + rect.height),
      ),
    ) + 24
  );
}

function formatDistance(value) {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}

function textStyle(size, color = "#f7f3df") {
  return new PIXI.TextStyle({
    fontFamily: "Star Wars FFG Rajdhani, Arial Narrow, sans-serif",
    fontSize: size,
    fontWeight: "600",
    fill: color,
    stroke: "#071014",
    strokeThickness: Math.max(3, Math.round(size / 5)),
    letterSpacing: 0.5,
  });
}

function visibleElement(selector) {
  const element = typeof selector === "string" ? globalThis.document?.querySelector?.(selector) : selector;
  if (!element) return null;
  const style = globalThis.getComputedStyle?.(element);
  if (style?.display === "none" || style?.visibility === "hidden") return null;
  const bounds = element.getBoundingClientRect?.();
  return bounds?.width > 0 && bounds?.height > 0 ? bounds : null;
}

export function canvasScreenViewport() {
  const screen = globalThis.canvas?.app?.renderer?.screen;
  const width = Number(screen?.width ?? globalThis.innerWidth ?? 0);
  const height = Number(screen?.height ?? globalThis.innerHeight ?? 0);
  if (!(width > 0 && height > 0)) return null;
  const viewport = { left: 12, top: 12, right: width - 12, bottom: height - 12 };
  const view = globalThis.canvas?.app?.canvas ?? globalThis.canvas?.app?.view;
  const canvasBounds = view?.getBoundingClientRect?.();
  if (!(canvasBounds?.width > 0 && canvasBounds?.height > 0)) return viewport;
  const scaleX = width / canvasBounds.width;
  const scaleY = height / canvasBounds.height;
  const local = (bounds) => ({
    left: (bounds.left - canvasBounds.left) * scaleX,
    right: (bounds.right - canvasBounds.left) * scaleX,
    top: (bounds.top - canvasBounds.top) * scaleY,
    bottom: (bounds.bottom - canvasBounds.top) * scaleY,
  });
  const controls = visibleElement("#scene-controls") ?? visibleElement("#controls");
  if (controls) viewport.left = Math.max(viewport.left, local(controls).right + 12);
  const sidebar = visibleElement("#sidebar");
  if (sidebar) viewport.right = Math.min(viewport.right, local(sidebar).left - 12);
  // V14's navigation wrapper stretches to full viewport height; only its
  // viewed-scene row occupies the top of the canvas.
  const navigation = visibleElement("#scene-navigation-viewed") ?? visibleElement("#navigation");
  if (navigation)
    viewport.top = Math.max(viewport.top, local(navigation).bottom + 12);
  const hotbar = visibleElement("#hotbar");
  if (hotbar) viewport.bottom = Math.min(viewport.bottom, local(hotbar).top - 12);
  return viewport;
}

function canvasScreenBoundsToWorld(bounds) {
  if (!bounds) return null;
  const transform =
    globalThis.canvas?.interface?.worldTransform ??
    overlayContainer?.parent?.worldTransform;
  if (typeof transform?.applyInverse !== "function") return { ...bounds };
  const point = (x, y) =>
    transform.applyInverse(
      typeof PIXI.Point === "function" ? new PIXI.Point(x, y) : { x, y },
    );
  const topLeft = point(bounds.left, bounds.top);
  const bottomRight = point(bounds.right, bounds.bottom);
  return {
    left: Math.min(topLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, bottomRight.y),
    right: Math.max(topLeft.x, bottomRight.x),
    bottom: Math.max(topLeft.y, bottomRight.y),
  };
}

function rangeLabelViewport() {
  const screen = canvasScreenViewport();
  const world = canvasScreenBoundsToWorld(screen);
  if (world) return world;
  const rect = globalThis.canvas?.dimensions?.sceneRect;
  if (!rect) return null;
  return {
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
  };
}

function visibleCanvasElementWorldBounds(selector, padding = 10) {
  const bounds = visibleElement(selector);
  if (!bounds) return null;
  const screen = globalThis.canvas?.app?.renderer?.screen;
  const view = globalThis.canvas?.app?.canvas ?? globalThis.canvas?.app?.view;
  const canvasBounds = view?.getBoundingClientRect?.();
  if (!(canvasBounds?.width > 0 && canvasBounds?.height > 0)) return null;
  const scaleX = Number(screen?.width ?? canvasBounds.width) / canvasBounds.width;
  const scaleY = Number(screen?.height ?? canvasBounds.height) / canvasBounds.height;
  return canvasScreenBoundsToWorld({
    left: (bounds.left - canvasBounds.left - padding) * scaleX,
    top: (bounds.top - canvasBounds.top - padding) * scaleY,
    right: (bounds.right - canvasBounds.left + padding) * scaleX,
    bottom: (bounds.bottom - canvasBounds.top + padding) * scaleY,
  });
}

function pausedCanvasWorldBounds() {
  if (!globalThis.game?.paused) return null;
  const screen = globalThis.canvas?.app?.renderer?.screen;
  return canvasScreenBoundsToWorld(
    pauseBannerScreenBounds({
      width: Number(screen?.width ?? globalThis.innerWidth ?? 0),
      height: Number(screen?.height ?? globalThis.innerHeight ?? 0),
    }),
  );
}

function paddedPlaceableBounds(placeable, padding = 10) {
  const raw = placeable?.bounds;
  let left = Number(raw?.left ?? raw?.x);
  let top = Number(raw?.top ?? raw?.y);
  let right = Number(raw?.right);
  let bottom = Number(raw?.bottom);
  const width = Number(raw?.width);
  const height = Number(raw?.height);
  if (!Number.isFinite(right) && Number.isFinite(left) && Number.isFinite(width))
    right = left + width;
  if (!Number.isFinite(bottom) && Number.isFinite(top) && Number.isFinite(height))
    bottom = top + height;
  if (![left, top, right, bottom].every(Number.isFinite)) {
    const center = tokenCenter(placeable);
    const dimensions = tokenDimensions(placeable);
    if (!center || !(dimensions.width > 0) || !(dimensions.height > 0))
      return null;
    left = center.x - dimensions.width / 2;
    right = center.x + dimensions.width / 2;
    top = center.y - dimensions.height / 2;
    bottom = center.y + dimensions.height / 2;
  }
  const gap = Math.max(0, Number(padding) || 0);
  return {
    left: Math.min(left, right) - gap,
    top: Math.min(top, bottom) - gap,
    right: Math.max(left, right) + gap,
    bottom: Math.max(top, bottom) + gap,
  };
}

function boundsOverlap(left, right) {
  return !(
    left.right <= right.left ||
    left.left >= right.right ||
    left.bottom <= right.top ||
    left.top >= right.bottom
  );
}

function visiblePlaceable(placeable) {
  return placeable?.visible !== false && !(placeable?.document?.hidden === true && !globalThis.game?.user?.isGM);
}

function rangeLabelPlaceableBounds(viewport) {
  const candidates = [
    ...(globalThis.canvas?.tokens?.placeables ?? []),
    ...(globalThis.canvas?.tiles?.placeables ?? []),
    ...(globalThis.canvas?.drawings?.placeables ?? []),
    ...(globalThis.canvas?.notes?.placeables ?? []),
  ];
  return candidates
    .filter(visiblePlaceable)
    .map((placeable) => paddedPlaceableBounds(placeable))
    .filter((bounds) => bounds && boundsOverlap(bounds, viewport));
}

function attackTraceColor(preview) {
  const profile = RANGE_SCALES[normalizeRangeScale(preview.range?.scale)];
  return (
    profile?.bands.find((entry) => entry.id === preview.range?.band)?.color ??
    0xf0c54d
  );
}

function attackTraceLabelLines(preview) {
  const range = preview.range ?? {};
  const distance = Number.isFinite(range.sceneDistance)
    ? ` · ${formatDistance(range.sceneDistance)} ${range.units}`
    : "";
  const lineOfSight = range.lineOfSightBlocked
    ? `BLOCKED by ${range.obstruction?.name ?? "obstruction"}`
    : range.lineOfSight === "clear"
      ? range.partiallyObscured ? "CLEAR path · nearest point obscured" : "CLEAR line of sight"
      : "Line of sight unavailable";
  const attack = preview.attack;
  const lines = [
    `${attack?.actorName ?? "Attacker"} → ${attack?.targetName ?? "Target"}`,
    `${range.label ?? "Range unavailable"}${distance} · ${lineOfSight}`,
  ];
  if (attack) {
    const opposition =
      Number.isFinite(attack.defense) && Number.isFinite(attack.adversary)
        ? ` · Defence ${attack.defense} · Adversary ${attack.adversary}`
        : "";
    lines.push(
      `${attack.itemName || "Attack"} · ${attack.skillLabel}${opposition}`,
    );
    if(attack.firingArc)lines.push(`${attack.selectionMode ?? "Selected"} · ${attack.fireFacing?`${attack.fireFacing.toUpperCase()} / `:""}${attack.firingArc.toUpperCase()} arc · ${attack.crewName || "Assign gunner"}`);
    if(attack.defenseZone)lines.push(`TARGET · ${attack.defenseZone.toUpperCase()} shields · Defence ${attack.defense}`);
  }
  lines.push(`POOL · ${preview.poolLabel}`);
  if (range.partiallyObscured) lines.push("COVER · GM review");
  if (preview.error) lines.push(`STATUS · ${preview.error}`);
  else lines.push("ACTION · SEND DICE TO POOL");
  return lines;
}

export async function chooseAttackDialog(sourceToken,targetToken) {
  const source=resolveToken(sourceToken), target=resolveToken(targetToken), actor=source?.actor;
  if(!actor || actor.isOwner===false && !globalThis.game?.user?.isGM)return;
  const chosen=selectionForTarget(attackSelectionFor(actor),target), vehicle=actor.type==="vehicle";
  const shields=target?.actor?.type==="vehicle" ? target.actor.system?.shields : null;
  const options=vehicle ? vehicleAttackOptions(source,target,{selection:{defenseZone:chosen.defenseZone}}) : [];
  const current=options.findIndex(p=>p.attack?.itemId===chosen.itemId && p.attack?.crewTokenId===chosen.crewTokenId && p.attack?.firingArc===chosen.fireArc);
  const selected=await globalThis.foundry.applications.api.DialogV2.prompt({
    window:{title:"Weapon / gunner options",resizable:true},position:{width:740,height:"auto"},classes:["star-wars","sf-attack-choice"],
    content:`<div class="sf-dialog"><p><strong>${escapeHTML(actor.name)} → ${escapeHTML(target?.actor?.name ?? "Target")}</strong></p>
      ${vehicle?`<label>Arc · weapon · gunner<select name="attackChoice"><option value="auto" ${current<0?"selected":""}>Auto · strongest legal attack</option>${options.map((p,i)=>`<option value="${i}" ${i===current?"selected":""}>${escapeHTML([p.attack?.firingArc?.toUpperCase()||"Unknown arc",p.attack?.itemName,p.attack?.crewName,p.strength?`${p.strength.expectedImpact.toFixed(1)} expected impact · ${Math.round(p.strength.hitChance*100)}% hit`:"Unrated",p.error||p.range?.label].filter(Boolean).join(" · "))}</option>`).join("")}</select></label>
      <p class="sf-hint">Auto compares expected raw impact using the weapon's damage and the assigned gunner's actual pool, then prefers the shorter legal shot on a tie. Impact is compared in personal-scale units, before armour, qualities or optional symbol spending. A selected combination stays selected until Auto is restored.</p>`:""}
      ${shields?`<label>Agreed target defence zone<select name="defenseZone"><option value="">Choose the agreed zone…</option>${Object.entries(shields).map(([key,value])=>`<option value="${escapeHTML(key)}" ${key===chosen.defenseZone?"selected":""}>${escapeHTML(key)} · ${Number(value)||0} defence</option>`).join("")}</select></label><p class="sf-hint">Confirm the defender's permitted zone choice or the established relative position. Firing arcs do not choose the target's shields.</p>`:""}
      <p>Apply updates the targeting preview. Use <strong>Send dice to pool</strong> to stage its dice for adjustment.</p></div>`,
    ok:{label:"Apply to targeting",callback:(_event,button)=>Object.fromEntries(new FormData(button.form))},rejectClose:false,
  });
  if(!selected)return;
  const next=vehicle ? selected.attackChoice==="auto" ? {} : options[Number(selected.attackChoice)]?.selection : chosen;
  if(!next)return;
  setAttackTraceSelection(actor,{...next,defenseZone:selected.defenseZone ?? "",defenseTargetId:target?.id ?? ""});
}

export function chooseAttackArcs(sourceToken,targetToken) {
  const source=resolveToken(sourceToken),target=resolveToken(targetToken),actor=source?.actor;
  if(!actor || actor.isOwner===false && !globalThis.game?.user?.isGM)return;
  return openCanvasArcPicker({source,target,selection:selectionForTarget(attackSelectionFor(actor),target),
    preview:selection=>showAttackTrace(source,target,{animate:false,selection}),
    commit:selection=>setAttackTraceSelection(actor,selection),
    cancel:()=>currentAttackSource()?.id===source.id && Array.from(globalThis.game?.user?.targets ?? []).some(t=>t.id===target.id)
      ? showAttackTrace(source,target,{animate:false}) : refreshTargetTraces({animate:false}),
  });
}

const RANGE_UI_OBSTACLES = ".application, .app.window-app, #token-hud, .sf-token-turn, .sf-vehicle-crew-strip, .sf-arc-picker-help, #pause, #notifications .notification, #chat-notifications .chat-message, #chat-message, .sf-compact-dice, #chat-controls, #players-active, #scene-controls, #scene-navigation > menu > *, #hotbar, #sidebar";

function interfaceObstacleBounds() {
  return Array.from(globalThis.document?.querySelectorAll?.(RANGE_UI_OBSTACLES) ?? [],
    element => visibleCanvasElementWorldBounds(element)).filter(Boolean);
}

function watchInterfaceObstacles() {
  interfaceObserver?.disconnect();
  if (!globalThis.MutationObserver || !globalThis.document?.body) return;
  const relevant = node => node?.matches?.(RANGE_UI_OBSTACLES) || node?.closest?.(RANGE_UI_OBSTACLES)
    || node?.querySelector?.(RANGE_UI_OBSTACLES);
  interfaceObserver = new globalThis.MutationObserver(records => {
    if (!labelEntries.size && !attackTraceEntries.size) return;
    if (records.some(record => record.type === "attributes"
      ? record.target?.closest?.(RANGE_UI_OBSTACLES)
      : [...record.addedNodes, ...record.removedNodes].some(relevant))) scheduleRangeLabelReflow();
  });
  interfaceObserver.observe(globalThis.document.body, { subtree: true, childList: true,
    attributes: true, attributeFilter: ["style", "class", "hidden", "open"] });
}

function originTitleBounds() {
  return Array.from(overlayContainer?.children ?? []).flatMap(group =>
    Array.from(group.children ?? []).filter(child => child.name === "sf-range-origin-title").map(title => ({
      left: title.position.x-title.width/2-8, right: title.position.x+title.width/2+8,
      top: title.position.y-8, bottom: title.position.y+title.height+8,
    })));
}

function tokenNameBounds() {
  return (globalThis.canvas?.tokens?.placeables ?? []).filter(token => visiblePlaceable(token) && token.nameplate?.visible)
    .map(token => {
      const bounds = tokenNameplateWorldBounds(token);
      return bounds && { left: bounds.left-8, right: bounds.right+8, top: bounds.top-8, bottom: bounds.bottom+8 };
    }).filter(Boolean);
}

function moveAttackTraceLabel(entry, layout, animate) {
  if (entry.labelDestination && Math.hypot(entry.labelDestination.x - layout.x, entry.labelDestination.y - layout.y) < 0.5) return;
  cancelFrame(entry.labelFrame);
  entry.labelFrame = null;
  const from = { x: entry.label.position.x, y: entry.label.position.y };
  entry.labelDestination = layout;
  if (!animate || !entry.label.visible || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    entry.label.position.set(layout.x, layout.y);
    return;
  }
  const start = globalThis.performance?.now?.() ?? Date.now();
  const step = now => {
    if (entry.label.destroyed || attackTraceEntries.get(entry.key) !== entry) { entry.labelFrame = null; return; }
    const progress = Math.min(1, Math.max(0, (now-start)/420));
    const eased = 1 - (1-progress)**3;
    entry.label.position.set(from.x+(layout.x-from.x)*eased, from.y+(layout.y-from.y)*eased);
    entry.labelFrame = progress < 1 ? requestFrame(step) : null;
  };
  entry.labelFrame = requestFrame(step);
}

function positionAttackTraceLabel(entry, viewport, occupied, { animate = true } = {}) {
  const { label, source, target } = entry;
  const availableWidth = Math.max(1, viewport.right - viewport.left - 24);
  const availableHeight = Math.max(1, viewport.bottom - viewport.top - 24);
  label.scale.set(Math.min(1, availableWidth / entry.labelSize.width, availableHeight / entry.labelSize.height));
  const layout = chooseAttackTraceLabelLayout({
    source,
    target,
    size: { width: label.width, height: label.height },
    viewport,
    occupied,
    current: entry.labelDestination,
  });
  if (layout) moveAttackTraceLabel(entry, layout, animate);
  return layout;
}

function createAttackTraceLabel(
  group,
  preview,
  source,
  target,
  color,
  sourceToken,
) {
  const label = group.addChild(new PIXI.Container());
  label.visible = false;
  label.alpha = 0;
  label.eventMode = "static";
  label.cursor = preview.pool && !preview.error ? "pointer" : "not-allowed";
  const text = label.addChild(
    new PIXI.Text(
      attackTraceLabelLines(preview).join("\n"),
      new PIXI.TextStyle({
        fontFamily: "Star Wars FFG Rajdhani, Arial Narrow, sans-serif",
        fontSize: 17,
        fontWeight: "600",
        fill: "#f7f3df",
        lineHeight: 21,
        wordWrap: true,
        wordWrapWidth: 520,
      }),
    ),
  );
  text.anchor.set(0.5, 0.5);
  const paddingX = 16;
  const paddingY = 11;
  const targetToken=resolveToken(preview.range?.targetTokenId);
  const hasChoice=sourceToken?.actor?.type==="vehicle" || targetToken?.actor?.type==="vehicle";
  let choiceWidth=0;
  if(hasChoice) {
    const choiceLabel=sourceToken?.actor?.type==="vehicle" ? "CHOOSE ARCS ON SHIPS" : "CHOOSE TARGET DEFENCE ZONE";
    const choose=label.addChild(new PIXI.Text(choiceLabel,new PIXI.TextStyle({
      fontFamily:"Star Wars FFG Rajdhani, Arial Narrow, sans-serif",fontSize:17,fontWeight:"700",fill:"#7ee7dc",
    })));
    choose.anchor.set(.5,0);choose.position.set(0,text.height/2+9);choose.eventMode="static";choose.cursor="pointer";
    choiceWidth=choose.width;
    choose.on?.("pointertap",event=>{event?.stopPropagation?.();chooseAttackArcs(sourceToken,targetToken);});
    if(sourceToken?.actor?.type==="vehicle") {
      const advanced=label.addChild(new PIXI.Text("WEAPON / GUNNER OPTIONS",new PIXI.TextStyle({
        fontFamily:"Star Wars FFG Rajdhani, Arial Narrow, sans-serif",fontSize:15,fontWeight:"600",fill:"#c4d1d5",
      })));
      advanced.anchor.set(.5,0);advanced.position.set(0,text.height/2+35);advanced.eventMode="static";advanced.cursor="pointer";
      advanced.on?.("pointertap",event=>{event?.stopPropagation?.();chooseAttackDialog(sourceToken,targetToken)
        .catch(error=>globalThis.ui?.notifications?.error?.(error.message));});
    }
  }
  const background = new PIXI.Graphics();
  background.lineStyle({ color, alpha: 0.95, width: 2 });
  background.beginFill(0x071014, 0.94);
  const x = -Math.max(text.width,choiceWidth) / 2 - paddingX;
  const y = -text.height / 2 - paddingY;
  const width = Math.max(text.width,choiceWidth) + paddingX * 2;
  const height = text.height + paddingY * 2 + (hasChoice?(sourceToken?.actor?.type==="vehicle"?60:34):0);
  if (typeof background.drawRoundedRect === "function")
    background.drawRoundedRect(x, y, width, height, 8);
  else background.drawRect(x, y, width, height);
  background.endFill();
  label.addChildAt(background, 0);
  let loading = false;
  label.on?.("pointertap", (event) => {
    event?.stopPropagation?.();
    if (loading) return;
    loading = true;
    label.alpha = 0.72;
    try {
      loadAttackTracePool(preview, { sourceToken });
    } catch (error) {
      console.error(`${SYSTEM_ID} attack-trace pool load failed`, error);
      globalThis.ui?.notifications?.error?.(
        error?.message ?? "The targeting pool could not be loaded.",
      );
    } finally {
      loading = false;
      if (!label.destroyed) label.alpha = 1;
    }
  });
  return label;
}

function renderAttackTraceFrame(entry, progress) {
  const segments = buildAttackTraceSegments({
    source: entry.source,
    target: entry.target,
    obstruction: entry.preview.range?.obstruction,
    progress,
  });
  entry.progress = progress;
  entry.segmentStyles = segments.map((segment) => segment.style);
  entry.graphics.clear();
  for (const segment of segments) {
    entry.graphics.lineStyle({
      color: segment.style === "dotted" ? 0xe85d4a : entry.color,
      alpha: 0.96,
      width: segment.style === "dotted" ? 4 : 5,
      cap: PIXI.LINE_CAP?.ROUND,
    });
    entry.graphics
      .moveTo(segment.from.x, segment.from.y)
      .lineTo(segment.to.x, segment.to.y);
  }
  const current = segments.at(-1)?.to;
  if (current) {
    entry.graphics.lineStyle({ color: 0x071014, alpha: 0.9, width: 2 });
    entry.graphics.beginFill(entry.color, 0.95).drawCircle(current.x, current.y, 6).endFill();
  }
  const obstruction = entry.preview.range?.obstruction;
  if (obstruction && progress >= obstruction.progress) {
    entry.graphics.lineStyle({ color: 0xf7f3df, alpha: 0.95, width: 2 });
    entry.graphics
      .beginFill(0xe85d4a, 0.95)
      .drawCircle(obstruction.point.x, obstruction.point.y, 8)
      .endFill();
  }
}

export function getAttackTraceState() {
  return Array.from(attackTraceEntries.values(), (entry) => ({
    sourceId: entry.sourceId,
    targetId: entry.targetId,
    progress: Number(entry.progress ?? 0),
    labelVisible: entry.label?.visible === true,
    lineOfSight: entry.preview.range?.lineOfSight ?? "unavailable",
    sightPath: entry.preview.range?.sightPath ?? "nearest",
    partiallyObscured: entry.preview.range?.partiallyObscured === true,
    distanceBasis: entry.preview.range?.distanceBasis ?? "nearest-edges",
    obstruction: entry.preview.range?.obstruction
      ? { ...entry.preview.range.obstruction }
      : null,
    range: entry.preview.range?.label ?? "",
    sceneDistance: entry.preview.range?.sceneDistance ?? null,
    units: entry.preview.range?.units ?? "",
    attack: entry.preview.attack ? { ...entry.preview.attack } : null,
    pool: entry.preview.pool ? { ...entry.preview.pool } : null,
    poolLabel: entry.preview.poolLabel,
    error: entry.preview.error,
    segmentStyles: [...(entry.segmentStyles ?? [])],
  }));
}

function currentAttackSource() {
  const controlled = globalThis.canvas?.tokens?.controlled ?? [];
  return (
    controlled.at?.(-1) ??
    resolveToken(originIds().at(-1)) ??
    combatTurnToken(globalThis.game?.combat) ??
    null
  );
}

export function showAttackTrace(
  sourceToken,
  targetToken,
  { animate = true, selection = null } = {},
) {
  if (!setting(TARGET_TRACE_SETTING, true)) return null;
  const sourceTokenObject = resolveToken(sourceToken);
  const targetTokenObject = resolveToken(targetToken);
  const preview = buildAttackTracePreview(sourceTokenObject, targetTokenObject,{selection});
  const source = preview.range?.traceSource ?? tokenCenter(sourceTokenObject);
  const target = preview.range?.traceTarget ?? tokenCenter(targetTokenObject);
  if (!source || !target || sourceTokenObject === targetTokenObject) return null;
  const container = getAttackTraceContainer();
  if (!container) return null;
  const targetId = String(
    targetTokenObject?.id ?? targetTokenObject?.document?.id ?? "",
  );
  const previous = Array.from(attackTraceEntries.values()).find(entry => entry.targetId === targetId && entry.sourceId === String(sourceTokenObject?.id));
  const previousPosition = previous ? { x: previous.label.position.x, y: previous.label.position.y } : null;
  const previousVisible = previous?.label.visible && !animate;
  clearAttackTrace(targetId);
  const group = container.addChild(new PIXI.Container());
  group.eventMode = "passive";
  group.interactiveChildren = true;
  group.zIndex = 10;
  const graphics = group.addChild(new PIXI.Graphics());
  const color = attackTraceColor(preview);
  const label = createAttackTraceLabel(
    group,
    preview,
    source,
    target,
    color,
    sourceTokenObject,
  );
  const key = `${sourceTokenObject?.id ?? "source"}:${targetId}`;
  const entry = {
    key,
    sourceId: String(sourceTokenObject?.id ?? sourceTokenObject?.document?.id ?? ""),
    sourceActorId: String(sourceTokenObject?.actor?.id ?? ""),
    targetId,
    source,
    target,
    preview,
    group,
    graphics,
    label,
    labelSize: { width: label.width, height: label.height },
    labelDestination: previousPosition,
    labelFrame: null,
    color,
    progress: 0,
    segmentStyles: [],
    frame: null,
  };
  attackTraceEntries.set(key, entry);
  if (previousPosition) {
    label.position.set(previousPosition.x, previousPosition.y);
    label.visible = previousVisible;
    label.alpha = previousVisible ? 1 : 0;
  }
  reflowRangeLabels();
  const reducedMotion = globalThis.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  const duration = animate && !reducedMotion ? ATTACK_TRACE_DURATION_MS : 0;
  const reveal = () => {
    label.visible = true;
    label.alpha = 1;
    scheduleRangeLabelReflow();
  };
  if (!duration) {
    renderAttackTraceFrame(entry, 1);
    reveal();
    return preview;
  }
  const startedAt = globalThis.performance?.now?.() ?? Date.now();
  const step = (now) => {
    if (group.destroyed || attackTraceEntries.get(key) !== entry) {
      entry.frame = null;
      return;
    }
    const elapsed = Math.max(0, Number(now) - startedAt);
    const linear = Math.min(1, elapsed / duration);
    const eased = linear < 0.5
      ? 4 * linear ** 3
      : 1 - ((-2 * linear + 2) ** 3) / 2;
    renderAttackTraceFrame(entry, eased);
    if (linear < 1) entry.frame = requestFrame(step);
    else {
      entry.frame = null;
      renderAttackTraceFrame(entry, 1);
      reveal();
    }
  };
  entry.frame = requestFrame(step);
  return preview;
}

function refreshTargetTraces({ animate = false, actorId = "" } = {}) {
  if (!setting(TARGET_TRACE_SETTING, true)) {
    clearAttackTrace();
    return;
  }
  const source = currentAttackSource();
  if (!source || (actorId && String(source.actor?.id ?? "") !== actorId)) return;
  const targets = Array.from(globalThis.game?.user?.targets ?? []);
  const targetIds = new Set(targets.map((target) => String(target.id)));
  for (const entry of attackTraceEntries.values())
    if (entry.sourceId !== String(source.id) || !targetIds.has(entry.targetId))
      clearAttackTrace(entry.targetId);
  for (const target of targets) showAttackTrace(source, target, { animate });
}

function handleTargetToken(user, token, targeted) {
  if (user?.id !== globalThis.game?.user?.id) return;
  if (!targeted) clearAttackTrace(token?.id ?? token?.document?.id);
  else {
    const source = currentAttackSource();
    if (source) showAttackTrace(source, token, { animate: true });
  }
  refreshRangeOverlay();
  refreshCombatRangeBadges();
}

function setLabelArcPosition(entry, angle) {
  const point = footprintBoundaryPoint(entry.footprint, entry.radius, angle);
  entry.label.position.set(point.x, point.y);
}

function animateRangeLabel(entry, layout) {
  let state = labelStates.get(entry.key);
  if (!state) {
    state = { angle: layout.angle, frame: null };
    labelStates.set(entry.key, state);
    if (layout.onArc) setLabelArcPosition(entry, layout.angle);
    else entry.label.position.set(layout.x, layout.y);
    return;
  }
  cancelFrame(state.frame);
  state.frame = null;
  const from = state.angle;
  const to = layout.angle;
  const fromPosition = {
    x: Number(entry.label.position.x),
    y: Number(entry.label.position.y),
  };
  const setPosition = (progress, angle) => {
    if (layout.onArc) setLabelArcPosition(entry, angle);
    else
      entry.label.position.set(
        fromPosition.x + (layout.x - fromPosition.x) * progress,
        fromPosition.y + (layout.y - fromPosition.y) * progress,
      );
  };
  if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    state.angle = to;
    entry.label.position.set(layout.x, layout.y);
    return;
  }
  const startedAt = globalThis.performance?.now?.() ?? Date.now();
  const duration = 420;
  const step = (now) => {
    if (entry.label.destroyed || labelEntries.get(entry.key)?.label !== entry.label) {
      state.frame = null;
      return;
    }
    const elapsed = Math.max(0, Number(now) - startedAt);
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - (1 - progress) ** 3;
    state.angle = interpolateRangeLabelAngle(from, to, eased);
    setPosition(eased, state.angle);
    if (progress < 1) state.frame = requestFrame(step);
    else {
      state.angle = to;
      state.frame = null;
      entry.label.position.set(layout.x, layout.y);
    }
  };
  const angularDistance = Math.abs(
    Math.atan2(Math.sin(to - from), Math.cos(to - from)),
  );
  const positionDistance = Math.hypot(
    layout.x - fromPosition.x,
    layout.y - fromPosition.y,
  );
  if (angularDistance < 0.0001 && positionDistance < 0.5) {
    state.angle = to;
    entry.label.position.set(layout.x, layout.y);
    return;
  }
  state.frame = requestFrame(step);
}

function reflowRangeLabels() {
  if (labelReflowFrame !== null) cancelFrame(labelReflowFrame);
  labelReflowFrame = null;
  const viewport = rangeLabelViewport();
  if (!viewport) return;
  // Names may become visible or gain a minion count after the overlay is drawn.
  // Re-measure before reserving caption space for band labels and combat cards.
  for (const [title, token] of originTitles) {
    const below = rangeOriginTitlePosition(token);
    title.position.set(below.x, below.y);
  }
  const occupied = [
    ...rangeLabelPlaceableBounds(viewport),
    ...originTitleBounds(),
    ...tokenNameBounds(),
    ...interfaceObstacleBounds(),
    pausedCanvasWorldBounds(),
  ].filter(Boolean);
  // Place the larger cards first; range labels can slide around them. Ordering
  // prevents the two avoidance solvers from repeatedly chasing one another.
  for (const entry of attackTraceEntries.values()) {
    const layout = positionAttackTraceLabel(entry, viewport, occupied);
    if (layout) occupied.push(layout.bounds);
  }
  for (const entry of labelEntries.values()) {
    const state = labelStates.get(entry.key);
    const preferredAngle = farthestViewportCornerAngle(entry.origin, viewport);
    const layout = chooseRangeLabelLayout({
      origin: entry.origin,
      radius: entry.radius,
      footprint: entry.footprint,
      viewport,
      size: { width: entry.label.width, height: entry.label.height },
      currentAngle: state?.angle,
      preferredAngle: preferredAngle ?? -Math.PI / 4,
      occupied,
    });
    entry.label.visible = Boolean(layout);
    if (!layout) continue;
    occupied.push(layout.bounds);
    animateRangeLabel(entry, layout);
  }
}

function scheduleRangeLabelReflow() {
  if (!labelEntries.size && !attackTraceEntries.size && !originTitles.size) return;
  if (labelReflowFrame !== null) return;
  labelReflowFrame = requestFrame(reflowRangeLabels);
}

function pruneRangeLabelStates() {
  for (const [key, state] of labelStates) {
    if (labelEntries.has(key)) continue;
    cancelFrame(state.frame);
    labelStates.delete(key);
  }
}

function tokenNameplateWorldBounds(token) {
  const name = token.nameplate;
  if (!name?.visible || name.renderable === false) return null;
  const bounds = name.getBounds?.();
  if (bounds?.width > 0 && bounds?.height > 0) {
    return canvasScreenBoundsToWorld({left:bounds.x,top:bounds.y,right:bounds.x+bounds.width,bottom:bounds.y+bounds.height});
  }
  const below = tokenLabelPosition(token);
  return {left:below.x-(name.width ?? 0)/2,right:below.x+(name.width ?? 0)/2,
    top:below.y,bottom:below.y+(name.height ?? 0)};
}

export function rangeOriginTitlePosition(token) {
  const below = tokenLabelPosition(token);
  const name = tokenNameplateWorldBounds(token);
  if (!name) return below;
  const view = globalThis.canvas?.app?.canvas ?? globalThis.canvas?.app?.view;
  const cssHeight = view?.getBoundingClientRect?.().height;
  const screenHeight = globalThis.canvas?.app?.renderer?.screen?.height;
  const gapPx = cssHeight > 0 && screenHeight > 0 ? 6*screenHeight/cssHeight : 6;
  const gapBounds = canvasScreenBoundsToWorld({left:0,top:0,right:0,bottom:gapPx});
  const gap = Math.max(8, gapBounds.bottom-gapBounds.top);
  return { x: below.x, y: Math.max(below.y, name.bottom+gap) };
}

function drawOrigin(container, token, profile, { preview = false } = {}) {
  const origin = tokenCenter(token);
  if (!origin) return;
  const footprint = tokenRangeFootprint(token);
  const group = container.addChild(new PIXI.Container());
  const graphics = group.addChild(new PIXI.Graphics());
  graphics.position.set(origin.x, origin.y);
  graphics.angle = footprint.rotation;
  const cap = maximumVisibleRadius(origin);
  const reversed = [...profile.bands].reverse();
  for (const entry of reversed) {
    const clipped = entry.radiusPx > cap;
    const radius = Math.min(entry.radiusPx, cap);
    graphics.lineStyle({
      alignment: 0.5,
      alpha: clipped ? 0 : preview ? 1 : 0.88,
      color: entry.color,
      width: preview ? 4 : 3,
    });
    const outline = rangeOutline(footprint, radius);
    graphics.beginFill(entry.color, preview ? 0.12 : 0.075)
      .drawRoundedRect(outline.x-origin.x, outline.y-origin.y, outline.width, outline.height, outline.radius).endFill();
  }
  graphics.lineStyle({ color: 0xf8f4dc, alpha: 0.95, width: 2 });
  graphics
    .drawCircle(0, 0, 10)
    .moveTo(-16, 0)
    .lineTo(16, 0)
    .moveTo(0, -16)
    .lineTo(0, 16);

  for (const entry of profile.bands) {
    if (entry.radiusPx > cap) continue;
    const distance =
      entry.distance === null
        ? ""
        : ` · ${formatDistance(entry.distance)} ${entry.units}`;
    const label = group.addChild(
      new PIXI.Text(`${entry.label}${distance}`, textStyle(18)),
    );
    label.anchor.set(0.5, 0.5);
    const key = `${currentScene()?.id ?? "scene"}:${token?.id ?? token?.document?.id ?? "origin"}:${entry.id}${preview ? ":preview" : ""}`;
    labelEntries.set(key, {
      key,
      label,
      origin,
      footprint,
      radius: entry.radiusPx,
    });
  }

  const actorName = token?.actor?.name ?? token?.document?.name ?? "Range origin";
  const title = group.addChild(
    new PIXI.Text(
      `${actorName} · ${profile.scaleLabel}${preview ? " · SET RANGE" : ""}`,
      textStyle(20, preview ? "#fff2a8" : "#ffffff"),
    ),
  );
  title.anchor.set(0.5, 0);
  title.name = "sf-range-origin-title";
  originTitles.set(title, token);
  const below = rangeOriginTitlePosition(token);
  title.position.set(below.x, below.y);
}

export function refreshRangeOverlay({ preview = null } = {}) {
  const container = getOverlayContainer();
  if (!container) return;
  clearOverlay();
  const visible = setting("rangeOverlayVisible", false);
  if (!visible && !preview) {
    pruneRangeLabelStates();
    return;
  }
  const scene = currentScene();
  if (!scene) {
    pruneRangeLabelStates();
    return;
  }
  if (preview?.token) {
    const profile = preview.profile ?? getTokenRangeProfile(preview.token, scene);
    if (!profile) {
      pruneRangeLabelStates();
      return;
    }
    drawOrigin(container, preview.token, profile, { preview: true });
    pruneRangeLabelStates();
    reflowRangeLabels();
    return;
  }
  for (const id of originIds(scene)) {
    const token = resolveToken(id);
    const profile = getTokenRangeProfile(token, scene);
    if (token && profile) drawOrigin(container, token, profile);
  }
  pruneRangeLabelStates();
  reflowRangeLabels();
}

function handleTokenControl(token, controlled) {
  const scene = currentScene();
  if (!scene || token.document?.parent?.id !== scene.id) return;
  setOriginIds(
    reconcileRangeOrigins(originIds(scene), {
      tokenId: token.id,
      controlled,
      controlledIds: controlledIds(),
      multi: setting("rangeOverlayMulti", false),
    }),
    scene,
  );
  refreshRangeOverlay();
  refreshTargetTraces({ animate: controlled });
  void ui.controls?.render?.({ reset: true });
  if (
    controlled &&
    setting("rangeOverlayVisible", false) &&
    !hasSceneScaleReference(sceneGrid(scene)) &&
    !getTokenRangeProfile(token, scene)
  ) {
    const scale = getTokenRangeScale(token, scene);
    ui.notifications.info(
      `${RANGE_SCALES[scale].label} range needs a Theatre-of-the-Mind calibration on this scene.`,
    );
  }
}

function handleOverlayToggle(active) {
  const combatSession = currentCombatSession();
  if (combatSession) combatSession.manualVisibility = true;
  if (active) seedOrigins();
  void game.settings.set(SYSTEM_ID, "rangeOverlayVisible", active);
  const scene = currentScene();
  const token = resolveToken(originIds(scene).at(-1));
  const profile = token
    ? getTokenRangeProfile(token, scene)
    : getSceneRangeProfile(scene);
  if (active && !profile)
    ui.notifications.info(
      "Select a token, then use Calibrate range on this Theatre-of-the-Mind scene.",
    );
  refreshRangeOverlay();
  refreshCombatRangeBadges();
}

function handleMultiToggle(active) {
  void game.settings.set(SYSTEM_ID, "rangeOverlayMulti", active);
  const scene = currentScene();
  if (!scene) return;
  if (active)
    setOriginIds([...originIds(scene), ...controlledIds()], scene);
  else {
    const selected = controlledIds();
    setOriginIds(
      (selected.length ? selected : originIds(scene)).slice(-1),
      scene,
    );
  }
  refreshRangeOverlay();
}

function handleTargetTraceToggle(active) {
  void game.settings.set(SYSTEM_ID, TARGET_TRACE_SETTING, active);
  if (active) refreshTargetTraces({ animate: false });
  else clearAttackTrace();
}

async function writeSceneState(update, scene = currentScene()) {
  if (!scene || !game.user?.isGM)
    throw new Error("Only the GM can change scene range settings.");
  const current = getRangeOverlaySceneState(scene);
  const next = {
    scale: normalizeRangeScale(update.scale ?? current.scale),
    calibrations: update.calibrations ?? current.calibrations,
  };
  await scene.setFlag(SYSTEM_ID, FLAG, next);
  return next;
}

export async function setSceneRangeScale(scale, scene = currentScene()) {
  const next = await writeSceneState({ scale }, scene);
  refreshRangeOverlay();
  refreshTargetTraces({ animate: false });
  refreshCombatRangeBadges();
  await ui.controls?.render?.({ reset: true });
  return next.scale;
}

export async function openRangeScaleDialog() {
  const scene = currentScene();
  if (!scene) throw new Error("Open a scene before choosing a range scale.");
  const state = getRangeOverlaySceneState(scene);
  const grid = sceneGrid(scene);
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Star Wars FFG · Range context" },
    classes: ["star-wars"],
    position: { width: 520 },
    content: `<div class="sf-dialog sf-range-scale-dialog">
      <p>Choose the large-scale context for this scene. Personal attackers retain Personal ranges. Vehicles on a surface-wide battlefield use Battlefield; ships and other vehicles use Ship / vehicle.</p>
      <label>Scene range context<select name="scale">
        ${Object.values(RANGE_SCALES)
          .map(
            (entry) =>
              `<option value="${entry.id}" ${entry.id === state.scale ? "selected" : ""}>${entry.label}</option>`,
          )
          .join("")}
      </select></label>
      <p class="sf-hint">${hasSceneScaleReference(grid) ? `This scene uses its ${grid.distance} ${grid.units || "unit"} grid scale. Theatre-of-the-Mind calibration is ignored.` : "This scene is gridless. Calibrate the selected scale by clicking its Short or Close boundary."}</p>
    </div>`,
    ok: {
      label: "Use context",
      icon: "fa-solid fa-ruler-combined",
      callback: (_event, button) =>
        new FormData(button.form).get("scale"),
    },
    rejectClose: false,
  });
  if (!result) return state.scale;
  const selected = await setSceneRangeScale(result, scene);
  ui.notifications.info(`Range context set to ${RANGE_SCALES[selected].label}.`);
  return selected;
}

function stopCalibration() {
  if (!calibrationSession) return;
  canvas.stage?.off("pointermove", calibrationSession.move);
  canvas.stage?.off("pointerdown", calibrationSession.down);
  calibrationSession = null;
  refreshRangeOverlay();
}

async function commitCalibration(event) {
  const session = calibrationSession;
  if (!session) return;
  event.stopPropagation?.();
  const pointer = event.getLocalPosition(canvas.stage);
  let calibration;
  try {
    calibration = calibrationFromPointer(session.origin, pointer, {
      footprint: tokenRangeFootprint(session.token),
      minimumRadiusPx: Math.max(24, (canvas.dimensions?.size ?? 100) / 3),
      maximumRadiusPx: maximumVisibleRadius(session.origin),
    });
  } catch (error) {
    ui.notifications.warn(error.message);
    return;
  }
  const scene = currentScene();
  const state = getRangeOverlaySceneState(scene);
  stopCalibration();
  await writeSceneState({
    calibrations: {
      ...state.calibrations,
      [session.scale]: {
        ...calibration,
        updatedAt: new Date().toISOString(),
        updatedBy: game.user.id,
      },
    },
  });
  await ui.controls?.activate?.({ control: CONTROL, tool: SELECT_TOOL });
  refreshRangeOverlay();
  ui.notifications.info(
    `${RANGE_SCALES[session.scale].anchorBand === "short" ? "Short" : "Close"} range calibrated for this scene.`,
  );
}

function previewCalibration(event) {
  const session = calibrationSession;
  if (!session) return;
  const pointer = event.getLocalPosition(canvas.stage);
  const radius = measureFootprintGap(tokenRangeFootprint(session.token), rangeFootprint(pointer)).distance;
  if (!Number.isFinite(radius) || radius < 1) return;
  const profile = createRangeProfile({
    scale: session.scale,
    grid: { type: 0 },
    calibration: { anchorRadiusPx: radius },
  });
  refreshRangeOverlay({ preview: { token: session.token, profile } });
}

async function startCalibration({ preserveOrigins = false } = {}) {
  stopCalibration();
  if (!game.user?.isGM) return;
  const scene = currentScene();
  if (!scene) return;
  if (hasSceneScaleReference(sceneGrid(scene))) {
    ui.notifications.info(
      "This scene already has a grid scale reference, so Theatre-of-the-Mind calibration is not applied.",
    );
    await ui.controls?.activate?.({ control: CONTROL, tool: SELECT_TOOL });
    return;
  }
  if (!preserveOrigins || !originIds(scene).length) seedOrigins();
  const token = resolveToken(originIds(scene).at(-1));
  const origin = tokenCenter(token);
  if (!token || !origin) {
    ui.notifications.warn("Select an actor token before calibrating range.");
    await ui.controls?.activate?.({ control: CONTROL, tool: SELECT_TOOL });
    return;
  }
  if (!setting("rangeOverlayVisible", false))
    await game.settings.set(SYSTEM_ID, "rangeOverlayVisible", true);
  const scale = getTokenRangeScale(token, scene);
  calibrationSession = {
    token,
    origin,
    scale,
    move: previewCalibration,
    down: commitCalibration,
  };
  canvas.stage.on("pointermove", calibrationSession.move);
  canvas.stage.on("pointerdown", calibrationSession.down);
  const anchor = RANGE_SCALES[scale].anchorBand;
  ui.notifications.info(
    `Move the pointer to the outer edge of ${anchor === "short" ? "Short" : "Close"} range, then click.`,
  );
}

async function resetCalibration() {
  const scene = currentScene();
  if (!scene) return;
  if (hasSceneScaleReference(sceneGrid(scene))) {
    ui.notifications.info("This scaled map does not use ToM calibration.");
    return;
  }
  const state = getRangeOverlaySceneState(scene);
  const calibrations = { ...state.calibrations };
  const token = resolveToken(originIds(scene).at(-1));
  const scale = token ? getTokenRangeScale(token, scene) : state.scale;
  delete calibrations[scale];
  await writeSceneState({ calibrations });
  refreshRangeOverlay();
  ui.notifications.info(`${RANGE_SCALES[scale].label} calibration was cleared.`);
}

function combatantList(combat) {
  if (combat?.turns) return Array.from(combat.turns);
  return Array.from(combat?.combatants ?? []);
}

function combatSceneMatches(combat, scene = currentScene()) {
  if (!combat || !scene) return false;
  const sceneId = combat.scene?.id ?? combat.scene ?? combat.sceneId;
  return !sceneId || sceneId === scene.id;
}

function combatTurnToken(combat, turn = null) {
  const turns = Array.from(combat?.turns ?? combat?.combatants ?? []);
  const turnIndex = turn !== null && turn !== undefined && Number.isInteger(Number(turn))
    ? Number(turn)
    : Number(combat?.turn);
  const combatant =
    turns[turnIndex] ?? combat?.combatant ?? combat?.current?.combatant ?? null;
  return resolveToken(
    combatant?.token?.object ?? combatant?.token ?? combatant?.tokenId,
  );
}

function sameIds(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function followCombatTurn(combat, turn = null, session = null) {
  if (!setting(COMBAT_FOLLOW_SETTING, true) || !combatSceneMatches(combat))
    return;
  const token = combatTurnToken(combat, turn);
  if (!token) return;
  const scene = currentScene();
  const next = setting("rangeOverlayMulti", false)
    ? [...originIds(scene), token.id]
    : [token.id];
  setOriginIds(next, scene);
  if (session) session.autoOriginIds = originIds(scene);
  refreshRangeOverlay();
  refreshCombatRangeBadges();
  refreshTargetTraces({ animate: true });
}

async function confirmCombatRangeAssistant() {
  return foundry.applications.api.DialogV2.confirm({
    window: { title: "Star Wars FFG · Combat range" },
    content:
      '<div class="sf-dialog"><p>Show range bands for this encounter and follow the active combatant?</p><p class="sf-hint">You can still pin multiple origins or hide the overlay from the scene controls.</p></div>',
    yes: { label: "Show range bands" },
    no: { label: "Not for this encounter" },
    rejectClose: false,
  });
}

async function prepareCombatRangeScale(combat, mode) {
  const scene = currentScene();
  if (!scene) return;
  const state = getRangeOverlaySceneState(scene);
  if (!state.scaleConfigured && game.user?.isGM) {
    const inferred = inferCombatRangeScale(combatantList(combat));
    if (mode === "automatic" && inferred) await setSceneRangeScale(inferred, scene);
    else await openRangeScaleDialog();
  }
  const activeToken = combatTurnToken(combat);
  const profile = activeToken
    ? getTokenRangeProfile(activeToken, scene)
    : getSceneRangeProfile(scene);
  if (profile) return;
  if (!game.user?.isGM) {
    ui.notifications.info(
      "The GM needs to calibrate range for this Theatre-of-the-Mind scene.",
    );
    return;
  }
  const calibrate = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Calibrate encounter range" },
    content:
      '<div class="sf-dialog"><p>This Theatre-of-the-Mind scene needs one range boundary before the combat assistant can measure it.</p><p>Calibrate it from the active combatant now?</p></div>',
    yes: { label: "Calibrate now" },
    no: { label: "Use manual range" },
    rejectClose: false,
  });
  if (calibrate) await startCalibration({ preserveOrigins: true });
}

export async function beginCombatRangeAssistant(
  combat,
  { turn = null } = {},
) {
  const id = combat?.id;
  const mode = setting(COMBAT_MODE_SETTING, "automatic");
  if (!id || mode === "off" || !combatSceneMatches(combat)) return null;
  const existing = combatSessions.get(id);
  if (existing) {
    if (existing.pending) await existing.pending;
    if (existing.accepted) followCombatTurn(combat, turn, existing);
    return existing;
  }
  const scene = currentScene();
  const session = {
    combatId: id,
    sceneId: scene.id,
    previousVisible: setting("rangeOverlayVisible", false),
    previousOrigins: originIds(scene),
    autoOriginIds: [],
    visibilityChanged: false,
    manualVisibility: false,
    accepted: false,
    pending: null,
  };
  combatSessions.set(id, session);
  session.pending = (async () => {
    if (mode === "prompt" && !(await confirmCombatRangeAssistant())) return;
    session.accepted = true;
    followCombatTurn(combat, turn, session);
    await prepareCombatRangeScale(combat, mode);
    if (!session.previousVisible) {
      session.visibilityChanged = true;
      await game.settings.set(SYSTEM_ID, "rangeOverlayVisible", true);
      refreshCombatRangeBadges();
    } else refreshRangeOverlay();
  })().finally(() => {
    session.pending = null;
  });
  await session.pending;
  return session;
}

export async function endCombatRangeAssistant(combat) {
  const session = combatSessions.get(combat?.id);
  if (!session) return;
  if (session.pending) await session.pending;
  combatSessions.delete(combat.id);
  const scene = currentScene();
  if (scene?.id === session.sceneId) {
    const currentOrigins = originIds(scene);
    if (sameIds(currentOrigins, session.autoOriginIds))
      setOriginIds(session.previousOrigins, scene);
  }
  if (
    session.visibilityChanged &&
    !session.manualVisibility &&
    setting("rangeOverlayVisible", false)
  )
    await game.settings.set(
      SYSTEM_ID,
      "rangeOverlayVisible",
      session.previousVisible,
    );
  else refreshRangeOverlay();
  refreshCombatRangeBadges();
  refreshTargetTraces({ animate: false });
}

function currentCombatSession() {
  return combatSessions.get(game.combat?.id);
}

function combatantTokenId(combatant) {
  return String(
    combatant?.tokenId ??
      combatant?.token?.id ??
      combatant?.token?.document?.id ??
      "",
  );
}

function renderCombatRangeBadges(_application, html) {
  const root = html?.querySelectorAll ? html : html?.[0];
  if (!root?.querySelectorAll) return;
  for (const badge of root.querySelectorAll(".sf-combat-range-badge"))
    badge.remove();
  if (!setting("rangeOverlayVisible", false)) return;
  const combat = game.combat;
  const scene = currentScene();
  if (!combat?.started || !combatSceneMatches(combat, scene)) return;
  const source = resolveToken(originIds(scene).at(-1));
  if (!source) return;
  const targeted = new Map(
    Array.from(game.user?.targets ?? [], (target) => [String(target.id), target]),
  );
  if (!targeted.size) return;
  const combatants = combatantList(combat);
  for (const row of root.querySelectorAll("[data-combatant-id]")) {
    const combatant = combatants.find(
      (entry) => String(entry.id) === String(row.dataset.combatantId),
    );
    const target = targeted.get(combatantTokenId(combatant));
    if (!target) continue;
    const result = measureTokenRange(source, target, { scene });
    if (!result.available) continue;
    const badge = globalThis.document.createElement("span");
    badge.className = `sf-combat-range-badge${result.lineOfSightBlocked ? " is-blocked" : ""}`;
    badge.textContent = `${result.label}${result.lineOfSightBlocked ? " · blocked" : ""}`;
    badge.title = result.sceneDistance === null
      ? `${result.label} range`
      : `${result.label} range · ${formatDistance(result.sceneDistance)} ${result.units}`;
    const anchor = row.querySelector(".token-name, .combatant-name") ?? row;
    anchor.append(badge);
  }
}

function refreshCombatRangeBadges() {
  void globalThis.ui?.combat?.render?.({ force: true });
}

function activateTokenLayerForRangeControl() {
  if (!canvas.tokens || canvas.tokens.active) return;
  canvas.tokens.activate();
  setTimeout(() => {
    if (
      ui.controls?.controls?.[CONTROL] &&
      ui.controls.control?.name !== CONTROL
    )
      void ui.controls.activate({ control: CONTROL, tool: SELECT_TOOL });
  }, 0);
}

export function addRangeSceneControl(controls) {
  const state = getRangeOverlaySceneState();
  const selectedToken = resolveToken(
    controlledIds().at(-1) ?? originIds().at(-1),
  );
  const scale = selectedToken ? getTokenRangeScale(selectedToken) : state.scale;
  const anchor = RANGE_SCALES[scale].anchorBand;
  controls[CONTROL] = {
    name: CONTROL,
    order: 70,
    title: "Star Wars FFG · Range bands",
    icon: "fa-solid fa-bullseye",
    visible: !!currentScene(),
    activeTool: SELECT_TOOL,
    onChange: (_event, active) => {
      if (active) activateTokenLayerForRangeControl();
      else stopCalibration();
    },
    onToolChange: (_event, tool, active) => {
      if (active && tool.name !== "calibrate") stopCalibration();
    },
    tools: {
      [SELECT_TOOL]: {
        name: SELECT_TOOL,
        order: 1,
        title: "Select range origin",
        icon: "fa-solid fa-location-crosshairs",
        interaction: true,
        control: true,
      },
      rangeVisible: {
        name: "rangeVisible",
        order: 2,
        title: "Show colour range bands",
        icon: "fa-solid fa-layer-group",
        toggle: true,
        active: setting("rangeOverlayVisible", false),
        onChange: (_event, active) => handleOverlayToggle(active),
      },
      rangeMulti: {
        name: "rangeMulti",
        order: 3,
        title: "Keep multiple selected origins",
        icon: "fa-solid fa-circle-nodes",
        toggle: true,
        active: setting("rangeOverlayMulti", false),
        onChange: (_event, active) => handleMultiToggle(active),
      },
      targetTrace: {
        name: "targetTrace",
        order: 4,
        title: "Animate attacker-to-target line",
        icon: "fa-solid fa-route",
        toggle: true,
        active: setting(TARGET_TRACE_SETTING, true),
        onChange: (_event, active) => handleTargetTraceToggle(active),
      },
      rangeScale: {
        name: "rangeScale",
        order: 5,
        title: `Range context · ${RANGE_SCALES[scale].label}`,
        icon: "fa-solid fa-ruler-combined",
        button: true,
        visible: !!game.user?.isGM,
        onChange: () =>
          openRangeScaleDialog().catch((error) =>
            ui.notifications.error(error.message),
          ),
      },
      calibrate: {
        name: "calibrate",
        order: 6,
        title: `Calibrate ${anchor === "short" ? "Short" : "Close"} range (ToM)`,
        icon: "fa-solid fa-crosshairs",
        interaction: true,
        control: true,
        visible: !!game.user?.isGM,
        onChange: (_event, active) => {
          if (active)
            startCalibration().catch((error) =>
              ui.notifications.error(error.message),
            );
          else stopCalibration();
        },
      },
      clearOrigins: {
        name: "clearOrigins",
        order: 7,
        title: "Clear range origins",
        icon: "fa-solid fa-eraser",
        button: true,
        onChange: () => {
          setOriginIds([]);
          refreshRangeOverlay();
          clearAttackTrace();
        },
      },
      resetCalibration: {
        name: "resetCalibration",
        order: 8,
        title: "Clear current ToM calibration",
        icon: "fa-solid fa-rotate-left",
        button: true,
        visible: !!game.user?.isGM,
        onChange: () =>
          resetCalibration().catch((error) =>
            ui.notifications.error(error.message),
          ),
      },
    },
  };
}

export function registerRangeOverlay() {
  if (registered) return;
  registered = true;
  game.settings.register(SYSTEM_ID, "rangeOverlayVisible", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
    onChange: refreshRangeOverlay,
  });
  game.settings.register(SYSTEM_ID, "rangeOverlayMulti", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });
  game.settings.register(SYSTEM_ID, TARGET_TRACE_SETTING, {
    name: "Animated attacker-to-target line",
    hint: "When you target a token, draw a two-second combat trace. It becomes dotted after the first sight-blocking wall or visible intervening token, then shows range, opposition and the automatic dice pool.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: (active) => {
      if (active) refreshTargetTraces({ animate: false });
      else clearAttackTrace();
    },
  });
  game.settings.register(SYSTEM_ID, COMBAT_MODE_SETTING, {
    name: "Combat range assistant",
    hint: "Show range bands when combat begins. Automatic uses an existing scene choice or infers clear personal and vehicle encounters; ambiguous encounters ask the GM.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      automatic: "Automatic",
      prompt: "Ask when combat starts",
      off: "Off",
    },
    default: "automatic",
  });
  game.settings.register(SYSTEM_ID, COMBAT_FOLLOW_SETTING, {
    name: "Follow the active combatant with range bands",
    hint: "Move the primary range origin to the acting token as each combat turn changes. Multiple-origin mode continues to retain pinned origins.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });
  Hooks.on("getSceneControlButtons", addRangeSceneControl);
  Hooks.on("canvasReady", () => {
    watchInterfaceObstacles();
    seedOrigins();
    refreshRangeOverlay();
    refreshTargetTraces({ animate: false });
    if (game.combat?.started)
      void beginCombatRangeAssistant(game.combat).catch((error) =>
        ui.notifications.error(`Combat range assistant: ${error.message}`),
      );
  });
  Hooks.on("canvasTearDown", () => {
    closeCanvasArcPicker({restore:false});
    interfaceObserver?.disconnect();
    interfaceObserver = null;
    stopCalibration();
    cancelFrame(labelReflowFrame);
    labelReflowFrame = null;
    destroyOverlay({ clearLabelState: true });
    destroyAttackTraces();
  });
  Hooks.on("canvasPan", scheduleRangeLabelReflow);
  Hooks.on("canvasPan", repositionCanvasArcPicker);
  Hooks.on("controlToken", ()=>closeCanvasArcPicker());
  Hooks.on("targetToken", ()=>closeCanvasArcPicker());
  Hooks.on("updateToken", ()=>closeCanvasArcPicker());
  Hooks.on("starWarsTurnIndicatorsChanged", scheduleRangeLabelReflow);
  Hooks.on("starWarsTokenNameplateChanged", scheduleRangeLabelReflow);
  Hooks.on("collapseSidebar", scheduleRangeLabelReflow);
  Hooks.on("pauseGame", scheduleRangeLabelReflow);
  Hooks.on("controlToken", handleTokenControl);
  Hooks.on("refreshToken", (token) => {
    if (originIds().includes(token.id)) refreshRangeOverlay();
    else scheduleRangeLabelReflow();
  });
  Hooks.on("refreshTile", scheduleRangeLabelReflow);
  Hooks.on("createTile", scheduleRangeLabelReflow);
  Hooks.on("updateTile", scheduleRangeLabelReflow);
  Hooks.on("deleteTile", scheduleRangeLabelReflow);
  Hooks.on("updateToken", (document) => {
    if (document.parent?.id === currentScene()?.id) {
      refreshRangeOverlay();
      refreshTargetTraces({ animate: false });
      if (game.combat?.started) refreshCombatRangeBadges();
    }
  });
  Hooks.on("deleteToken", (document) => {
    const scene = currentScene();
    if (!scene || document.parent?.id !== scene.id) return;
    setOriginIds(
      originIds(scene).filter((id) => id !== document.id),
      scene,
    );
    clearAttackTrace(document.id);
    refreshTargetTraces({ animate: false });
    refreshRangeOverlay();
  });
  Hooks.on("updateScene", (scene) => {
    if (scene.id !== currentScene()?.id) return;
    refreshRangeOverlay();
    refreshTargetTraces({ animate: false });
    refreshCombatRangeBadges();
    void ui.controls?.render?.({ reset: true });
  });
  Hooks.on("combatStart", (combat, updateData) => {
    void beginCombatRangeAssistant(combat, { turn: updateData?.turn }).catch(
      (error) =>
        ui.notifications.error(`Combat range assistant: ${error.message}`),
    );
  });
  Hooks.on("combatTurnChange", (combat, _prior, current) => {
    void beginCombatRangeAssistant(combat, { turn: current?.turn }).catch(
      (error) =>
        ui.notifications.error(`Combat range assistant: ${error.message}`),
    );
  });
  Hooks.on("targetToken", handleTargetToken);
  Hooks.on("renderCombatTracker", renderCombatRangeBadges);
  Hooks.on("deleteCombat", (combat) => {
    void endCombatRangeAssistant(combat).catch((error) =>
      ui.notifications.error(`Combat range assistant: ${error.message}`),
    );
  });
  globalThis.addEventListener?.("resize", scheduleRangeLabelReflow);
  globalThis.addEventListener?.("resize", repositionCanvasArcPicker);
}

export const rangeOverlayApi = Object.freeze({
  getProfile: getSceneRangeProfile,
  getProfileForToken: getTokenRangeProfile,
  getScaleForToken: getTokenRangeScale,
  getSceneState: getRangeOverlaySceneState,
  measureTokenRange,
  measureActorTargetRange,
  buildAttackTracePreview,
  vehicleAttackOptions,
  chooseAttackDialog,
  chooseAttackArcs,
  findActorOrigin: findActorRangeOrigin,
  setAttackSelection: setAttackTraceSelection,
  showAttackTrace,
  getAttackTraceState,
  clearAttackTraces: clearAttackTrace,
  setSceneScale: setSceneRangeScale,
  openScaleDialog: openRangeScaleDialog,
  refresh: refreshRangeOverlay,
});
