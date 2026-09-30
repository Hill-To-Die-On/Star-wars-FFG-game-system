import { SYSTEM_ID, SYSTEM_PATH } from "./config.mjs";
import {
  ACTOR_ICON_PALETTES,
  actorIconDescriptor,
  actorPortraitSource,
  isDefaultActorImage,
  isProceduralActorIcon,
  isProceduralIconSource,
} from "./actor-icons.mjs";
import {
  vehicleTokenCreationUpdate,
  vehicleTokenDimensions,
} from "./vehicle-footprints.mjs";

export const PROCEDURAL_ICON_VERSION = 5;

const defaultPath = (type) =>
  `${SYSTEM_PATH}/assets/${type === "vehicle" ? "vehicle" : "character"}.svg`;

const nested = (source, path) => {
  if (source && Object.hasOwn(source,path)) return source[path];
  let value = source;
  for (const key of path.split(".")) value = value?.[key];
  return value;
};

const managedTokenFlags = (descriptor) => ({
  [SYSTEM_ID]: {
    proceduralToken: {
      enabled: true,
      version: PROCEDURAL_ICON_VERSION,
      fingerprint: descriptor.fingerprint,
    },
  },
});

const setPath = (target, path, value) => {
  const keys = path.split("."),
    last = keys.pop();
  let current = target;
  for (const key of keys) current = current[key] ??= {};
  current[last] = value;
  return target;
};

const mergeNested = (target, source) => {
  for (const [key, value] of Object.entries(source ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const current =
        target[key] && typeof target[key] === "object" && !Array.isArray(target[key])
          ? target[key]
          : {};
      target[key] = mergeNested(current, value);
    } else target[key] = value;
  }
  return target;
};

const flattenedKeys = (value, prefix = "") =>
  Object.entries(value ?? {}).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return entry && typeof entry === "object" && !Array.isArray(entry)
      ? [path, ...flattenedKeys(entry, path)]
      : [path];
  });

const actorLike = (actor, data = {}) => {
  const source = actor?.toObject?.() ?? actor ?? {};
  return {
    ...source,
    ...data,
    type: data.type ?? actor?.type ?? source.type,
    name: data.name ?? actor?.name ?? source.name,
    system: { ...(source.system ?? {}), ...(actor?.system ?? {}), ...(data.system ?? {}) },
    prototypeToken: {
      ...(source.prototypeToken ?? {}),
      ...(actor?.prototypeToken ?? {}),
      ...(data.prototypeToken ?? {}),
    },
    flags: { ...(source.flags ?? {}), ...(actor?.flags ?? {}), ...(data.flags ?? {}) },
    hasPlayerOwner:
      data.hasPlayerOwner ?? actor?.hasPlayerOwner ?? source.hasPlayerOwner,
  };
};

export function canPersistProceduralArtwork(user = globalThis.game?.user) {
  if (user?.isGM) return true;
  try {
    return user?.hasPermission?.("FILES_UPLOAD") === true;
  } catch {
    return false;
  }
}

export function actorCreationUpdate(
  actor,
  data = {},
  { persist = canPersistProceduralArtwork() } = {},
) {
  const candidate = actorLike(actor, data),
    type = candidate.type,
    suppliedImage = data.img ?? actor?.img ?? candidate.img,
    suppliedTokenImage =
      data.prototypeToken?.texture?.src ?? actor?.prototypeToken?.texture?.src,
    procedural =
      isProceduralActorIcon(candidate) || isDefaultActorImage(suppliedImage, type),
    descriptor = actorIconDescriptor(candidate),
    generatedSource = persist ? descriptor.src : defaultPath(type),
    vehicle = type === "vehicle",
    group = type === "group",
    footprint = vehicleTokenCreationUpdate(candidate, null),
    update = {
      prototypeToken: {
        actorLink: group || type === "character",
        bar1: { attribute: group ? null : vehicle ? "hullTrauma" : "wounds" },
        bar2: { attribute: group ? null : vehicle ? "systemStrain" : "strain" },
        sort: vehicle ? -10 : 0,
        texture: { fit: "contain" },
      },
    };
  if (footprint)
    Object.assign(update.prototypeToken, {
      width: footprint.width,
      height: footprint.height,
    });
  if (procedural) {
    update.img = generatedSource;
    if (followsActorPortrait(candidate.prototypeToken, suppliedTokenImage, type)) {
      update.prototypeToken.texture.src = generatedSource;
      update.prototypeToken.flags = managedTokenFlags(descriptor);
      update.prototypeToken.rotation = data.prototypeToken?.rotation ?? 180;
    }
    update.flags = {
      [SYSTEM_ID]: {
        proceduralIcon: {
          enabled: true,
          version: PROCEDURAL_ICON_VERSION,
          fingerprint: descriptor.fingerprint,
          family: descriptor.family,
          archetype: descriptor.archetype,
          category: descriptor.category,
        },
      },
    };
  } else if (
    suppliedImage &&
    !isDefaultActorImage(suppliedImage, type) &&
    isDefaultActorImage(suppliedTokenImage, type)
  ) {
    update.prototypeToken.texture.src = suppliedImage;
    update.prototypeToken.flags = managedTokenFlags(descriptor);
    update.prototypeToken.rotation = data.prototypeToken?.rotation ?? 180;
  }
  return update;
}

function tokenFlag(token, key) {
  try {
    return token?.getFlag?.(SYSTEM_ID, key) ?? nested(token, `flags.${SYSTEM_ID}.${key}`);
  } catch {
    return nested(token, `flags.${SYSTEM_ID}.${key}`);
  }
}

function followsActorPortrait(token, source, type) {
  const enabled = tokenFlag(token, "proceduralToken.enabled");
  return enabled === true || isDefaultActorImage(source, type) ||
    (enabled !== false && isProceduralIconSource(source));
}

export function tokenArtworkUpdate(
  actor,
  token = {},
  { persist = canPersistProceduralArtwork() } = {},
) {
  if (!actor) return null;
  const currentSource = token?.texture?.src ?? token?._source?.texture?.src;
  if (!followsActorPortrait(token, currentSource, actor.type)) return null;

  const portraitSource =
      actor.img && !isDefaultActorImage(actor.img, actor.type)
        ? actor.img
        : persist
          ? actorPortraitSource(actor)
          : actor.img || defaultPath(actor.type),
    proceduralVehicle = actor.type === "vehicle" && (isDefaultActorImage(portraitSource, actor.type) || isProceduralIconSource(portraitSource)),
    descriptor = actorIconDescriptor(actor, proceduralVehicle ? { width: token.width, height: token.height } : {}),
    source = proceduralVehicle && persist ? descriptor.src : portraitSource;
  return {
    texture: { src: source, fit: "contain" },
    flags: managedTokenFlags(descriptor),
  };
}

function relevantActorIconChange(changes) {
  const keys = flattenedKeys(changes);
  return keys.some((key) =>
    [
      "name",
      "ownership",
      "system.species",
      "system.model",
      "system.silhouette",
      "system.metadata",
      "system.footprint.hull",
      "prototypeToken.disposition",
    ].some((prefix) => key === prefix || key.startsWith(`${prefix}.`)),
  );
}

function relevantVehicleFootprintChange(changes) {
  const keys = flattenedKeys(changes);
  return keys.some((key) =>
    [
      "name",
      "system.model",
      "system.silhouette",
      "system.metadata",
      "system.footprint",
    ].some((prefix) => key === prefix || key.startsWith(`${prefix}.`)),
  );
}

export function generatedActorUpdate(actor, changes, persist) {
  const candidate = actorLike(actor, changes),
    descriptor = actorIconDescriptor(candidate),
    src = persist ? descriptor.src : actor.img,
    prototypeToken = portraitPrototypeUpdate(actor, descriptor, src);
  return {
    img: src,
    ...(prototypeToken ? { prototypeToken } : {}),
    flags: {
      [SYSTEM_ID]: {
        proceduralIcon: {
          enabled: true,
          version: PROCEDURAL_ICON_VERSION,
          fingerprint: descriptor.fingerprint,
          family: descriptor.family,
          archetype: descriptor.archetype,
          category: descriptor.category,
        },
      },
    },
  };
}

function portraitPrototypeUpdate(actor, descriptor, src) {
  const prototype = actor.prototypeToken;
  if (!followsActorPortrait(prototype, prototype?.texture?.src, actor.type)) return null;
  const update = {
    texture: { src, fit: "contain" },
    flags: managedTokenFlags(descriptor),
  };
  // Only the untouched prototype default changes. Placed-token bearings are
  // deliberately absent from the artwork migration.
  if ((Number(prototype?.rotation) || 0) === 0 &&
      Number(tokenFlag(prototype, "proceduralToken.version") ?? 0) < 4)
    update.rotation = 180;
  return update;
}

export function tokenFrameGeometry(actor, {
  width, height, artworkWidth = width, artworkHeight = height, rotation = 0,
}) {
  const vehicle = actor?.type === "vehicle",
    centerX = width / 2,
    centerY = height / 2,
    offsetX = (width - artworkWidth) / 2,
    offsetY = (height - artworkHeight) / 2,
    inset = Math.max(3, Math.min(artworkWidth, artworkHeight) * 0.07),
    ring = vehicle
      ? {
          kind: "roundedRect",
          x: offsetX + inset,
          y: offsetY + inset,
          width: Math.max(1, artworkWidth - inset * 2),
          height: Math.max(1, artworkHeight - inset * 2),
          radius: Math.max(5, Math.min(artworkWidth, artworkHeight) * 0.13),
        }
      : {
          kind: "ellipse",
          x: centerX,
          y: centerY,
          radiusX: Math.max(1, artworkWidth / 2 - inset),
          radiusY: Math.max(1, artworkHeight / 2 - inset),
        },
    marks = vehicle
      ? [[0.0633, 0.0633, 0.1529, 0.1529], [0.9367, 0.0633, 0.8471, 0.1529]]
      : [[0.12, 0.22, 0.21, 0.27], [0.88, 0.22, 0.79, 0.27]];
  return {
    family: vehicle ? "vehicle" : "character",
    ring,
    marks: marks.map(([x1, y1, x2, y2]) => [
      offsetX + x1 * artworkWidth, offsetY + y1 * artworkHeight,
      offsetX + x2 * artworkWidth, offsetY + y2 * artworkHeight,
    ]),
    pivot: { x: centerX, y: centerY },
    rotation,
  };
}

const portraitFacingAngle = (document) => document?.lockRotation
  ? 0
  : (Number(document?.rotation) || 0) + 180;

/** Keep the north-facing artwork aligned with Foundry's south-at-zero bearings. */
export function createStarWarsTokenClass(BaseToken) {
  return class StarWarsToken extends BaseToken {
    _refreshRotation() {
      super._refreshRotation();
      const source = this.document?.texture?.src, actor = this.actor;
      if (!this.mesh || !actor || this.document.lockRotation) return;
      if (
        isDefaultActorImage(source, actor.type) || isProceduralIconSource(source) ||
        tokenFlag(this.document, "proceduralToken.enabled") === true || source === actor.img
      ) this.mesh.angle = portraitFacingAngle(this.document);
    }
  };
}

function drawTokenPortraitFrame(token) {
  const actor = token?.actor;
  if (!actor || !globalThis.PIXI) return;
  let graphics = token._starWarsPortraitFrame;
  const source = token.document?.texture?.src ?? actor.img,
    custom = !isDefaultActorImage(source, actor.type) && !isProceduralIconSource(source);
  if (!custom) {
    if (graphics) {
      token.removeChild?.(graphics);
      graphics.destroy?.();
      token._starWarsPortraitFrame = null;
    }
    return;
  }
  graphics ??= token.addChild(new PIXI.Graphics());
  token._starWarsPortraitFrame = graphics;
  graphics.clear();
  graphics.eventMode = "none";
  graphics.zIndex = 4;
  const size = token.document?.getSize?.() ?? {
      width: token.w ?? token.width,
      height: token.h ?? token.height,
    },
    width = Number(size.width) || 1,
    height = Number(size.height) || 1,
    geometry = tokenFrameGeometry(actor, {
      width,
      height,
      artworkWidth: Number(token.mesh?.width) || width,
      artworkHeight: Number(token.mesh?.height) || height,
      rotation: portraitFacingAngle(token.document),
    }),
    palette = ACTOR_ICON_PALETTES[actorIconDescriptor(actor).category],
    color = Number.parseInt(palette.foreground.slice(1), 16),
    lineWidth = Math.max(2, Math.min(5, Math.min(width, height) * 0.035));
  graphics.lineStyle({ color, alpha: 0.92, width: lineWidth });
  if (geometry.ring.kind === "roundedRect")
    graphics.drawRoundedRect(
      geometry.ring.x,
      geometry.ring.y,
      geometry.ring.width,
      geometry.ring.height,
      geometry.ring.radius,
    );
  else
    graphics.drawEllipse(
      geometry.ring.x,
      geometry.ring.y,
      geometry.ring.radiusX,
      geometry.ring.radiusY,
    );
  for (const [x1, y1, x2, y2] of geometry.marks) {
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
  }
  graphics.pivot.set(geometry.pivot.x, geometry.pivot.y);
  graphics.position.set(geometry.pivot.x, geometry.pivot.y);
  graphics.angle = geometry.rotation;
}

async function rescaleVehicleTokens(actor) {
  if (actor?.type !== "vehicle" || !globalThis.game?.user?.isGM) return;
  for (const scene of game.scenes ?? []) {
    const updates = [];
    for (const token of scene.tokens ?? []) {
      if (token.actorId !== actor.id) continue;
      // Older worlds have no opt-in flag; their placed sizes are deliberate until reset explicitly.
      if (token.getFlag?.(SYSTEM_ID, "automaticFootprint") !== true) continue;
      const update = vehicleTokenCreationUpdate(actor, scene);
      if (update)
        updates.push({
          _id: token.id,
          ...update,
        });
    }
    if (updates.length)
      await scene.updateEmbeddedDocuments("Token", updates, {
        starWarsAutomaticFootprint: true,
      });
  }
}

async function refreshActorTokenArtwork(actor) {
  if (!actor || !globalThis.game?.user?.isGM) return;
  for (const scene of game.scenes ?? []) {
    const updates = [];
    for (const token of scene.tokens ?? []) {
      if (token.actorId !== actor.id) continue;
      const update = tokenArtworkUpdate(actor, token, { persist: true });
      if (update) updates.push({ _id: token.id, ...update });
    }
    if (updates.length)
      await scene.updateEmbeddedDocuments("Token", updates, {
        starWarsProceduralToken: true,
      });
  }
}

async function rescaleSceneVehicles(scene) {
  if (!globalThis.game?.user?.isGM) return;
  const updates = [];
  for (const token of scene?.tokens ?? []) {
    if (token.getFlag?.(SYSTEM_ID, "automaticFootprint") !== true) continue;
    const actor = token.actor ?? game.actors?.get?.(token.actorId),
      update = vehicleTokenCreationUpdate(actor, scene);
    if (update) updates.push({ _id: token.id, ...update });
  }
  if (updates.length)
    await scene.updateEmbeddedDocuments("Token", updates, {
      starWarsAutomaticFootprint: true,
    });
}

export async function resetVehicleTokenFootprint(token) {
  const scene = token?.parent ?? globalThis.canvas?.scene,
    actor = token?.actor ?? globalThis.game?.actors?.get?.(token?.actorId),
    update = vehicleTokenCreationUpdate(actor, scene);
  if (!update) throw new Error("Choose a vehicle token.");
  return token.update(update, { starWarsAutomaticFootprint: true });
}

async function refreshWorldProceduralIcons() {
  if (!canPersistProceduralArtwork() || !globalThis.game?.user?.isGM) return;
  const updates = [];
  for (const actor of game.actors ?? []) {
    const eligible = isProceduralActorIcon(actor) || isDefaultActorImage(actor.img, actor.type);
    const descriptor = actorIconDescriptor(actor),
      current = actor.getFlag?.(SYSTEM_ID, "proceduralIcon") ?? {},
      prototypeSource = actor.prototypeToken?.texture?.src,
      prototypeManaged =
        actor.prototypeToken?.getFlag?.(SYSTEM_ID, "proceduralToken.enabled") ??
        nested(actor.prototypeToken, `flags.${SYSTEM_ID}.proceduralToken.enabled`);
    if (eligible) {
      const desiredSource = descriptor.src;
      if (
        current.version !== PROCEDURAL_ICON_VERSION ||
        current.fingerprint !== descriptor.fingerprint ||
        actor.img !== desiredSource ||
        (followsActorPortrait(actor.prototypeToken, prototypeSource, actor.type) &&
          (prototypeSource !== desiredSource || prototypeManaged !== true))
      )
        updates.push({ _id: actor.id, ...generatedActorUpdate(actor, {}, true) });
    } else if (
      actor.img &&
      !isDefaultActorImage(actor.img, actor.type) &&
      followsActorPortrait(actor.prototypeToken, prototypeSource, actor.type) &&
      (prototypeSource !== actor.img ||
        Number(tokenFlag(actor.prototypeToken, "proceduralToken.version") ?? 0) < PROCEDURAL_ICON_VERSION)
    )
      updates.push({
        _id: actor.id,
        prototypeToken: portraitPrototypeUpdate(actor, descriptor, actor.img),
      });
  }
  if (updates.length)
    await globalThis.Actor.updateDocuments(updates, {
      starWarsProceduralIcon: true,
    });
  for (const actor of game.actors ?? []) {
    await refreshActorTokenArtwork(actor);
    if (actor.type === "vehicle") await rescaleVehicleTokens(actor);
  }
}

export function registerActorArtwork() {
  if (globalThis.CONFIG?.Token?.objectClass)
    CONFIG.Token.objectClass = createStarWarsTokenClass(CONFIG.Token.objectClass);
  Hooks.on("preCreateActor", (actor, data) => {
    actor.updateSource(actorCreationUpdate(actor, data));
  });
  Hooks.on("preUpdateActor", (actor, changes, options = {}) => {
    if ("img" in changes && changes.img !== actor.img && !options.starWarsProceduralIcon) {
      if (isDefaultActorImage(changes.img, changes.type ?? actor.type)) {
        mergeNested(
          changes,
          generatedActorUpdate(actor, changes, canPersistProceduralArtwork()),
        );
        return;
      }
      setPath(changes, `flags.${SYSTEM_ID}.proceduralIcon.enabled`, false);
      const prototypeSource = actor.prototypeToken?.texture?.src,
        prototypeManaged =
          tokenFlag(actor.prototypeToken, "proceduralToken.enabled") === true;
      if (
        prototypeManaged ||
        followsActorPortrait(actor.prototypeToken, prototypeSource, actor.type)
      ) {
        setPath(changes, "prototypeToken.texture.src", changes.img);
        setPath(
          changes,
          `prototypeToken.flags.${SYSTEM_ID}.proceduralToken`,
          managedTokenFlags(actorIconDescriptor(actor))[SYSTEM_ID].proceduralToken,
        );
      }
      return;
    }
    if (
      !options.starWarsProceduralIcon &&
      nested(changes, "prototypeToken.texture.src") !== undefined &&
      nested(changes, "prototypeToken.texture.src") !== actor.prototypeToken?.texture?.src
    )
      setPath(
        changes,
        `prototypeToken.flags.${SYSTEM_ID}.proceduralToken.enabled`,
        false,
      );
    if (
      relevantActorIconChange(changes) &&
      (isProceduralActorIcon(actor) || isDefaultActorImage(actor.img, actor.type))
    )
      mergeNested(
        changes,
        generatedActorUpdate(actor, changes, canPersistProceduralArtwork()),
      );
  });
  Hooks.on("preCreateToken", (token) => {
    const actor = token.actor ?? game.actors?.get?.(token.actorId),
      scene = token.parent ?? globalThis.canvas?.scene,
      footprint = vehicleTokenCreationUpdate(actor, scene),
      artwork = tokenArtworkUpdate(actor, footprint ? {
        width: footprint.width, height: footprint.height, texture: token.texture, flags: token.flags,
      } : token),
      update = footprint ?? {};
    if (artwork) mergeNested(update, artwork);
    if (Object.keys(update).length) token.updateSource(update);
  });
  Hooks.on("preUpdateToken", (token, changes, options = {}) => {
    const incomingImage = nested(changes, "texture.src"),
      selectedImage = !options.starWarsProceduralToken && incomingImage !== undefined && incomingImage !== token.texture?.src;
    if (selectedImage)
      setPath(changes, `flags.${SYSTEM_ID}.proceduralToken.enabled`, false);
    if (
      !options.starWarsAutomaticFootprint &&
      (Object.hasOwn(changes, "width") || Object.hasOwn(changes, "height"))
    )
      setPath(changes, `flags.${SYSTEM_ID}.automaticFootprint`, false);
    if (!selectedImage && token.actor?.type === "vehicle" &&
        (Object.hasOwn(changes,"width") || Object.hasOwn(changes,"height"))) {
      const artwork = tokenArtworkUpdate(token.actor, {
        width: changes.width ?? token.width, height: changes.height ?? token.height,
        texture: token.texture, flags: token.flags,
      });
      if (artwork && isProceduralIconSource(artwork.texture.src)) {
        if (Object.hasOwn(changes,"texture.src")) changes["texture.src"] = artwork.texture.src;
        mergeNested(changes,artwork);
      }
    }
  });
  Hooks.on("updateActor", (actor, changes) => {
    if (
      "img" in changes ||
      relevantActorIconChange(changes) ||
      flattenedKeys(changes).some((key) => key.startsWith(`flags.${SYSTEM_ID}.proceduralIcon`))
    )
      refreshActorTokenArtwork(actor).catch((error) =>
        console.error(`${SYSTEM_ID} token artwork update failed`, error),
      );
    if (actor.type === "vehicle" && relevantVehicleFootprintChange(changes))
      rescaleVehicleTokens(actor).catch((error) =>
        console.error(`${SYSTEM_ID} vehicle footprint update failed`, error),
      );
  });
  Hooks.on("updateScene", (scene, changes) => {
    const keys = flattenedKeys(changes);
    if (keys.some((key) => key === "grid" || key.startsWith("grid.")))
      rescaleSceneVehicles(scene).catch((error) =>
        console.error(`${SYSTEM_ID} scene footprint update failed`, error),
      );
  });
  Hooks.on("drawToken", drawTokenPortraitFrame);
  Hooks.on("refreshToken", drawTokenPortraitFrame);
  Hooks.once("ready", () => {
    refreshWorldProceduralIcons().catch((error) =>
      console.error(`${SYSTEM_ID} procedural artwork migration failed`, error),
    );
  });
}
