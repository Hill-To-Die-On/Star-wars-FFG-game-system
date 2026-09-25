import { SYSTEM_ID } from "../config.mjs";
import {
  RANGE_SCALES,
  calibrationFromPointer,
  classifyRangeDistance,
  createRangeProfile,
  hasSceneScaleReference,
  normalizeRangeScale,
  reconcileRangeOrigins,
} from "./core.mjs";

const FLAG = "rangeOverlay";
const CONTROL = "starWarsRange";
const SELECT_TOOL = "rangeSelect";
const originsByScene = new Map();
let overlayContainer = null;
let calibrationSession = null;
let registered = false;

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

function tokenSceneId(token) {
  const resolved = resolveToken(token);
  return (
    resolved?.document?.parent?.id ??
    resolved?.parent?.id ??
    currentScene()?.id ??
    ""
  );
}

export function measureTokenRange(
  sourceToken,
  targetToken,
  { scene = currentScene() } = {},
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
  const profile = getSceneRangeProfile(scene);
  if (!profile)
    return {
      available: false,
      reason: "This Theatre-of-the-Mind scene has not been calibrated.",
      scale: getRangeOverlaySceneState(scene).scale,
    };
  const distancePx = Math.hypot(
    targetPoint.x - sourcePoint.x,
    targetPoint.y - sourcePoint.y,
  );
  const result = classifyRangeDistance(distancePx, profile);
  const grid = sceneGrid(scene);
  const sceneDistance = hasSceneScaleReference(grid)
    ? (distancePx / grid.size) * grid.distance
    : null;
  const band = profile.bands.find((entry) => entry.id === result.band);
  return {
    available: true,
    ...result,
    label: band?.label ?? "Beyond Extreme",
    sceneDistance,
    units: sceneDistance === null ? "" : grid.units,
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

function destroyOverlay() {
  if (overlayContainer && !overlayContainer.destroyed)
    overlayContainer.destroy({ children: true });
  overlayContainer = null;
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

function drawOrigin(container, token, profile, { preview = false } = {}) {
  const origin = tokenCenter(token);
  if (!origin) return;
  const group = container.addChild(new PIXI.Container());
  const graphics = group.addChild(new PIXI.Graphics());
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
    graphics
      .beginFill(entry.color, preview ? 0.12 : 0.075)
      .drawCircle(origin.x, origin.y, radius)
      .endFill();
  }
  graphics.lineStyle({ color: 0xf8f4dc, alpha: 0.95, width: 2 });
  graphics
    .drawCircle(origin.x, origin.y, 10)
    .moveTo(origin.x - 16, origin.y)
    .lineTo(origin.x + 16, origin.y)
    .moveTo(origin.x, origin.y - 16)
    .lineTo(origin.x, origin.y + 16);

  const angle = -Math.PI / 4;
  for (const entry of profile.bands) {
    if (entry.radiusPx > cap) continue;
    const distance =
      entry.distance === null
        ? ""
        : ` · ${formatDistance(entry.distance)} ${entry.units}`;
    const label = group.addChild(
      new PIXI.Text(`${entry.label}${distance}`, textStyle(18)),
    );
    label.anchor.set(0.5, 1);
    label.position.set(
      origin.x + Math.cos(angle) * entry.radiusPx,
      origin.y + Math.sin(angle) * entry.radiusPx - 4,
    );
  }

  const actorName = token?.actor?.name ?? token?.document?.name ?? "Range origin";
  const title = group.addChild(
    new PIXI.Text(
      `${actorName} · ${profile.scaleLabel}${preview ? " · SET RANGE" : ""}`,
      textStyle(20, preview ? "#fff2a8" : "#ffffff"),
    ),
  );
  title.anchor.set(0.5, 0);
  title.position.set(origin.x, origin.y + 20);
}

export function refreshRangeOverlay({ preview = null } = {}) {
  const container = getOverlayContainer();
  if (!container) return;
  clearOverlay();
  const visible = setting("rangeOverlayVisible", false);
  if (!visible && !preview) return;
  const scene = currentScene();
  if (!scene) return;
  const profile = preview?.profile ?? getSceneRangeProfile(scene);
  if (!profile) return;
  if (preview?.token) {
    drawOrigin(container, preview.token, profile, { preview: true });
    return;
  }
  for (const id of originIds(scene)) {
    const token = resolveToken(id);
    if (token) drawOrigin(container, token, profile);
  }
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
}

function handleOverlayToggle(active) {
  if (active) seedOrigins();
  void game.settings.set(SYSTEM_ID, "rangeOverlayVisible", active);
  if (active && !getSceneRangeProfile())
    ui.notifications.info(
      "Select a token, then use Calibrate range on this Theatre-of-the-Mind scene.",
    );
  refreshRangeOverlay();
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
  await ui.controls?.render?.({ reset: true });
  return next.scale;
}

export async function openRangeScaleDialog() {
  const scene = currentScene();
  if (!scene) throw new Error("Open a scene before choosing a range scale.");
  const state = getRangeOverlaySceneState(scene);
  const grid = sceneGrid(scene);
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Star Wars FFG · Range scale" },
    classes: ["star-wars"],
    position: { width: 520 },
    content: `<div class="sf-dialog sf-range-scale-dialog">
      <p>Choose the narrative scale for this scene. Ground vehicles on a city-scale map use Battlefield; spacecraft use Ship / vehicle.</p>
      <label>Scene range scale<select name="scale">
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
      label: "Use scale",
      icon: "fa-solid fa-ruler-combined",
      callback: (_event, button) =>
        new FormData(button.form).get("scale"),
    },
    rejectClose: false,
  });
  if (!result) return state.scale;
  const selected = await setSceneRangeScale(result, scene);
  ui.notifications.info(`Range scale set to ${RANGE_SCALES[selected].label}.`);
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
      [state.scale]: {
        ...calibration,
        updatedAt: new Date().toISOString(),
        updatedBy: game.user.id,
      },
    },
  });
  await ui.controls?.activate?.({ control: CONTROL, tool: SELECT_TOOL });
  refreshRangeOverlay();
  ui.notifications.info(
    `${RANGE_SCALES[state.scale].anchorBand === "short" ? "Short" : "Close"} range calibrated for this scene.`,
  );
}

function previewCalibration(event) {
  const session = calibrationSession;
  if (!session) return;
  const pointer = event.getLocalPosition(canvas.stage);
  const radius = Math.hypot(
    pointer.x - session.origin.x,
    pointer.y - session.origin.y,
  );
  if (!Number.isFinite(radius) || radius < 1) return;
  const profile = createRangeProfile({
    scale: session.scale,
    grid: { type: 0 },
    calibration: { anchorRadiusPx: radius },
  });
  refreshRangeOverlay({ preview: { token: session.token, profile } });
}

async function startCalibration() {
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
  seedOrigins();
  const token = resolveToken(originIds(scene).at(-1));
  const origin = tokenCenter(token);
  if (!token || !origin) {
    ui.notifications.warn("Select an actor token before calibrating range.");
    await ui.controls?.activate?.({ control: CONTROL, tool: SELECT_TOOL });
    return;
  }
  if (!setting("rangeOverlayVisible", false))
    await game.settings.set(SYSTEM_ID, "rangeOverlayVisible", true);
  const scale = getRangeOverlaySceneState(scene).scale;
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
  delete calibrations[state.scale];
  await writeSceneState({ calibrations });
  refreshRangeOverlay();
  ui.notifications.info("The current scene scale calibration was cleared.");
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
  const anchor = RANGE_SCALES[state.scale].anchorBand;
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
      rangeScale: {
        name: "rangeScale",
        order: 4,
        title: `Range scale · ${RANGE_SCALES[state.scale].label}`,
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
        order: 5,
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
        order: 6,
        title: "Clear range origins",
        icon: "fa-solid fa-eraser",
        button: true,
        onChange: () => {
          setOriginIds([]);
          refreshRangeOverlay();
        },
      },
      resetCalibration: {
        name: "resetCalibration",
        order: 7,
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
  Hooks.on("getSceneControlButtons", addRangeSceneControl);
  Hooks.on("canvasReady", () => {
    seedOrigins();
    refreshRangeOverlay();
  });
  Hooks.on("canvasTearDown", () => {
    stopCalibration();
    destroyOverlay();
  });
  Hooks.on("controlToken", handleTokenControl);
  Hooks.on("refreshToken", (token) => {
    if (originIds().includes(token.id)) refreshRangeOverlay();
  });
  Hooks.on("updateToken", (document) => {
    if (document.parent?.id === currentScene()?.id) refreshRangeOverlay();
  });
  Hooks.on("deleteToken", (document) => {
    const scene = currentScene();
    if (!scene || document.parent?.id !== scene.id) return;
    setOriginIds(
      originIds(scene).filter((id) => id !== document.id),
      scene,
    );
    refreshRangeOverlay();
  });
  Hooks.on("updateScene", (scene) => {
    if (scene.id !== currentScene()?.id) return;
    refreshRangeOverlay();
    void ui.controls?.render?.({ reset: true });
  });
}

export const rangeOverlayApi = Object.freeze({
  getProfile: getSceneRangeProfile,
  getSceneState: getRangeOverlaySceneState,
  measureTokenRange,
  measureActorTargetRange,
  findActorOrigin: findActorRangeOrigin,
  setSceneScale: setSceneRangeScale,
  openScaleDialog: openRangeScaleDialog,
  refresh: refreshRangeOverlay,
});
