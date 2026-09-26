import {
  CHARACTERISTICS,
  ITEM_TYPES,
  SKILLS,
} from "./config.mjs";
import { validateTree } from "./advancement.mjs";

export const INTEGRATION_FORMAT = "star-wars-ffg-interchange";
export const INTEGRATION_VERSION = 3;
export const INTEGRATION_VERSIONS = Object.freeze([1, 2, 3]);
export const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
export const MAX_HANDOFF_BYTES = 192 * 1024;
export const MAX_ACTOR_GROUP_ACTORS = 200;
export const MAX_ACTOR_GROUP_RELATIONSHIPS = 1000;

const PACKAGE_KINDS = Object.freeze({
  1: ["character", "rulePack", "bundle"],
  2: ["actor", "rulePack", "bundle"],
  3: ["actorGroup"],
});
const ACTOR_TYPES = Object.freeze([
  "character",
  "minion",
  "rival",
  "nemesis",
  "vehicle",
  "group",
]);
const ACTOR_GROUP_ROLES = Object.freeze([
  "player-character",
  "ally",
  "neutral",
  "enemy-minion",
  "enemy-rival",
  "enemy-nemesis",
  "organisation",
  "vehicle",
  "location",
]);
const ACTOR_GROUP_RELATIONSHIP_KINDS = Object.freeze([
  "commands",
  "reports-to",
  "employs",
  "protects",
  "pursues",
  "allied-with",
  "rivals",
  "related-to",
  "member-of",
  "located-at",
]);
const EXTERNAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const ACTOR_SYSTEM_FIELDS = new Set([
  "theme",
  "line",
  "phase",
  "species",
  "career",
  "motivation",
  "motivations",
  "biography",
  "characteristics",
  "skills",
  "customSkills",
  "wounds",
  "strain",
  "soak",
  "defense",
  "credits",
  "xp",
  "forceRating",
  "committedForce",
  "obligation",
  "duty",
  "morality",
  "groupSize",
  "criticals",
  "advancement",
  "creation",
  "source",
  "incomplete",
]);
const ITEM_SYSTEM_FIELDS = new Set([
  "description",
  "quantity",
  "price",
  "rarity",
  "encumbrance",
  "hardpoints",
  "restricted",
  "equipped",
  "skill",
  "damage",
  "critical",
  "range",
  "qualities",
  "scale",
  "soak",
  "defense",
  "rank",
  "ranked",
  "activation",
  "career",
  "careerSkills",
  "forceRating",
  "universal",
  "grantedForceRating",
  "eligibleCareers",
  "abilityCategory",
  "matchingNodes",
  "linkedSpecializationId",
  "tree",
  "source",
  "metadata",
  "incomplete",
]);
const VEHICLE_SYSTEM_FIELDS = new Set([
  "theme",
  "hullTrauma",
  "systemStrain",
  "armor",
  "silhouette",
  "speed",
  "handling",
  "shields",
  "model",
  "manufacturer",
  "crew",
  "passengers",
  "hyperdrive",
  "cargo",
  "notes",
  "source",
  "incomplete",
  "metadata",
]);
const GROUP_SYSTEM_FIELDS = new Set([
  "theme",
  "base",
  "members",
  "credits",
  "resources",
  "possessions",
  "contacts",
  "notes",
]);
const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SOURCE_FIELDS = new Set(["book", "page", "table", "id"]);
const CUSTOM_SKILL_FIELDS = new Set([
  "id",
  "label",
  "characteristic",
  "type",
  "rank",
  "career",
  "group",
]);
const MOTIVATION_FIELDS = new Set([
  "id",
  "name",
  "category",
  "description",
  "active",
  "source",
]);

const plainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function objectAt(value, path) {
  if (!plainObject(value)) fail(path, "expected an object");
  return value;
}

function allowedFields(value, allowed, path) {
  objectAt(value, path);
  for (const key of Object.keys(value))
    if (!allowed.has(key)) fail(`${path}.${key}`, "unsupported field");
}

function stringAt(value, path, { min = 0, max = 1000, pattern } = {}) {
  if (typeof value !== "string") fail(path, "expected text");
  const text = value.trim();
  if (text.length < min || text.length > max)
    fail(path, `must contain ${min}-${max} characters`);
  if (pattern && !pattern.test(text)) fail(path, "has an invalid format");
  return text;
}

function integerAt(value, path, min, max) {
  if (!Number.isInteger(value) || value < min || value > max)
    fail(path, `must be an integer from ${min} to ${max}`);
  return value;
}

function booleanAt(value, path) {
  if (typeof value !== "boolean") fail(path, "expected true or false");
  return value;
}

function validateJson(value, path = "package", depth = 0, ancestors = new Set()) {
  if (depth > 24) fail(path, "data is nested too deeply");
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    if (typeof value === "string" && value.length > 100000)
      fail(path, "text exceeds 100,000 characters");
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(path, "numbers must be finite");
    return;
  }
  if (typeof value !== "object") fail(path, "contains non-JSON data");
  if (ancestors.has(value)) fail(path, "contains a circular reference");
  ancestors.add(value);
  if (Array.isArray(value)) {
    if (value.length > 10000) fail(path, "array exceeds 10,000 entries");
    value.forEach((entry, index) =>
      validateJson(entry, `${path}[${index}]`, depth + 1, ancestors),
    );
  } else {
    objectAt(value, path);
    const keys = Object.keys(value);
    if (keys.length > 2000) fail(path, "object exceeds 2,000 fields");
    for (const key of keys) {
      if (UNSAFE_KEYS.has(key)) fail(`${path}.${key}`, "unsafe field name");
      if (key.length > 160) fail(path, "field name exceeds 160 characters");
      validateJson(value[key], `${path}.${key}`, depth + 1, ancestors);
    }
  }
  ancestors.delete(value);
}

function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateSourceReference(value, path) {
  if (value === undefined) return;
  allowedFields(value, SOURCE_FIELDS, path);
  for (const [key, entry] of Object.entries(value))
    stringAt(entry, `${path}.${key}`, { max: key === "page" ? 40 : 240 });
}

function validateAsset(value, path) {
  if (value === undefined) return;
  const asset = stringAt(value, path, { min: 1, max: 2048 });
  if (/^[a-z][a-z0-9+.-]*:/i.test(asset)) {
    let url;
    try {
      url = new URL(asset);
    } catch {
      fail(path, "has an invalid URL");
    }
    if (!["http:", "https:", "data:"].includes(url.protocol))
      fail(path, "only HTTP, HTTPS or data images are supported");
    if (url.protocol === "data:" && !/^data:image\/(?:png|jpeg|webp);base64,/i.test(asset))
      fail(path, "data URLs must contain a PNG, JPEG or WebP image");
  }
}

function validateResource(value, path, max = 100000) {
  if (value === undefined) return;
  allowedFields(value, new Set(["value", "max"]), path);
  if (value.value !== undefined) integerAt(value.value, `${path}.value`, 0, max);
  if (value.max !== undefined) integerAt(value.max, `${path}.max`, 0, max);
}

function validateStringArray(value, path, maxItems = 10000) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > maxItems)
    fail(path, `must contain no more than ${maxItems} text entries`);
  value.forEach((entry, index) =>
    stringAt(entry, `${path}[${index}]`, { max: 100000 }),
  );
}

function validateStoryScore(value, path, fields) {
  if (value === undefined) return;
  allowedFields(value, new Set(Object.keys(fields)), path);
  for (const [key, [kind, maximum]] of Object.entries(fields)) {
    if (value[key] === undefined) continue;
    if (kind === "integer") integerAt(value[key], `${path}.${key}`, 0, maximum);
    else stringAt(value[key], `${path}.${key}`, { max: maximum });
  }
}

function validateCharacterSystem(system, path, { skillRankMax = 5 } = {}) {
  allowedFields(system, ACTOR_SYSTEM_FIELDS, path);
  if (system.theme !== undefined && !["auto", "frontier", "rebellion", "mystic"].includes(system.theme))
    fail(`${path}.theme`, "unsupported theme");
  if (system.line !== undefined && !["edge", "age", "force"].includes(system.line))
    fail(`${path}.line`, "unsupported rule line");
  if (system.phase !== undefined && !["creation", "play"].includes(system.phase))
    fail(`${path}.phase`, "unsupported character phase");
  for (const key of ["species", "career", "motivation", "biography"])
    if (system[key] !== undefined)
      stringAt(system[key], `${path}.${key}`, { max: 100000 });
  if (system.characteristics !== undefined) {
    allowedFields(system.characteristics, new Set(Object.keys(CHARACTERISTICS)), `${path}.characteristics`);
    for (const [key, value] of Object.entries(system.characteristics))
      integerAt(value, `${path}.characteristics.${key}`, 0, 7);
  }
  if (system.skills !== undefined) {
    allowedFields(system.skills, new Set(Object.keys(SKILLS)), `${path}.skills`);
    for (const [key, skill] of Object.entries(system.skills)) {
      const skillPath = `${path}.skills.${key}`;
      allowedFields(skill, new Set(["rank", "career", "group", "characteristic"]), skillPath);
      if (skill.rank !== undefined)
        integerAt(skill.rank, `${skillPath}.rank`, 0, skillRankMax);
      if (skill.career !== undefined) booleanAt(skill.career, `${skillPath}.career`);
      if (skill.group !== undefined) booleanAt(skill.group, `${skillPath}.group`);
      if (
        skill.characteristic !== undefined &&
        !Object.hasOwn(CHARACTERISTICS, skill.characteristic)
      )
        fail(`${skillPath}.characteristic`, "unknown characteristic");
    }
  }
  if (system.customSkills !== undefined) {
    if (!Array.isArray(system.customSkills) || system.customSkills.length > 100)
      fail(`${path}.customSkills`, "must contain no more than 100 skills");
    const ids = new Set();
    system.customSkills.forEach((skill, index) => {
      const skillPath = `${path}.customSkills[${index}]`;
      allowedFields(skill, CUSTOM_SKILL_FIELDS, skillPath);
      const id = stringAt(skill.id, `${skillPath}.id`, {
        min: 1,
        max: 80,
        pattern: /^[A-Za-z0-9._-]+$/,
      });
      if (ids.has(id)) fail(`${skillPath}.id`, "duplicate custom skill id");
      ids.add(id);
      stringAt(skill.label, `${skillPath}.label`, { min: 1, max: 80 });
      if (!Object.hasOwn(CHARACTERISTICS, skill.characteristic))
        fail(`${skillPath}.characteristic`, "unknown characteristic");
      if (!["general", "melee", "ranged"].includes(skill.type))
        fail(`${skillPath}.type`, "unsupported custom skill type");
      integerAt(skill.rank, `${skillPath}.rank`, 0, skillRankMax);
      booleanAt(skill.career, `${skillPath}.career`);
      booleanAt(skill.group, `${skillPath}.group`);
    });
  }
  if (system.motivations !== undefined) {
    if (!Array.isArray(system.motivations) || system.motivations.length > 100)
      fail(`${path}.motivations`, "must contain no more than 100 motivations");
    const motivationIds = new Set();
    system.motivations.forEach((motivation, index) => {
      const motivationPath = `${path}.motivations[${index}]`;
      allowedFields(motivation, MOTIVATION_FIELDS, motivationPath);
      const id = stringAt(motivation.id, `${motivationPath}.id`, {
        min: 1,
        max: 80,
      });
      if (motivationIds.has(id))
        fail(`${motivationPath}.id`, "duplicate motivation id");
      motivationIds.add(id);
      stringAt(motivation.name, `${motivationPath}.name`, { min: 1, max: 160 });
      if (motivation.category !== undefined)
        stringAt(motivation.category, `${motivationPath}.category`, { max: 100 });
      if (motivation.description !== undefined)
        stringAt(motivation.description, `${motivationPath}.description`, { max: 4000 });
      if (motivation.active !== undefined)
        booleanAt(motivation.active, `${motivationPath}.active`);
      validateSourceReference(motivation.source, `${motivationPath}.source`);
    });
  }
  validateResource(system.wounds, `${path}.wounds`);
  validateResource(system.strain, `${path}.strain`);
  for (const [key, maximum] of Object.entries({
    soak: 100000,
    credits: 1000000000000,
    forceRating: 10,
    committedForce: 10,
    groupSize: 100,
  }))
    if (system[key] !== undefined)
      integerAt(system[key], `${path}.${key}`, 0, maximum);
  validateStoryScore(system.defense, `${path}.defense`, {
    melee: ["integer", 4],
    ranged: ["integer", 4],
  });
  validateStoryScore(system.xp, `${path}.xp`, {
    available: ["integer", 100000],
    total: ["integer", 100000],
  });
  validateStoryScore(system.obligation, `${path}.obligation`, {
    value: ["integer", 100],
    label: ["string", 100000],
  });
  validateStoryScore(system.duty, `${path}.duty`, {
    value: ["integer", 100],
    label: ["string", 100000],
    contribution: ["integer", 100000],
  });
  validateStoryScore(system.morality, `${path}.morality`, {
    value: ["integer", 100],
    conflict: ["integer", 100000],
    strength: ["string", 100000],
    weakness: ["string", 100000],
  });
  validateStringArray(system.incomplete, `${path}.incomplete`);
  if (system.criticals !== undefined && !Array.isArray(system.criticals))
    fail(`${path}.criticals`, "expected an array");
  if (system.creation !== undefined) objectAt(system.creation, `${path}.creation`);
  validateSourceReference(system.source, `${path}.source`);
  if (system.advancement !== undefined && (!Array.isArray(system.advancement) || system.advancement.length > 1000))
    fail(`${path}.advancement`, "must contain no more than 1,000 entries");
}

function validateTheme(value, path) {
  if (value !== undefined && !["auto", "frontier", "rebellion", "mystic"].includes(value))
    fail(path, "unsupported theme");
}

function validateVehicleSystem(system, path) {
  allowedFields(system, VEHICLE_SYSTEM_FIELDS, path);
  validateTheme(system.theme, `${path}.theme`);
  validateResource(system.hullTrauma, `${path}.hullTrauma`, 100000);
  validateResource(system.systemStrain, `${path}.systemStrain`, 100000);
  validateResource(system.speed, `${path}.speed`, 20);
  for (const [key, maximum] of Object.entries({ armor: 100000, silhouette: 20 }))
    if (system[key] !== undefined)
      integerAt(system[key], `${path}.${key}`, 0, maximum);
  if (system.handling !== undefined)
    integerAt(system.handling, `${path}.handling`, -10, 10);
  if (system.shields !== undefined) {
    allowedFields(
      system.shields,
      new Set(["fore", "aft", "port", "starboard"]),
      `${path}.shields`,
    );
    for (const [key, value] of Object.entries(system.shields))
      integerAt(value, `${path}.shields.${key}`, 0, 4);
  }
  for (const key of [
    "model",
    "manufacturer",
    "crew",
    "passengers",
    "hyperdrive",
    "cargo",
    "notes",
  ])
    if (system[key] !== undefined)
      stringAt(system[key], `${path}.${key}`, { max: 100000 });
  validateSourceReference(system.source, `${path}.source`);
  validateStringArray(system.incomplete, `${path}.incomplete`);
  if (system.metadata !== undefined) objectAt(system.metadata, `${path}.metadata`);
}

function validateGroupSystem(system, path) {
  allowedFields(system, GROUP_SYSTEM_FIELDS, path);
  validateTheme(system.theme, `${path}.theme`);
  if (system.base !== undefined) {
    allowedFields(
      system.base,
      new Set(["name", "location", "description"]),
      `${path}.base`,
    );
    for (const key of ["name", "location", "description"])
      if (system.base[key] !== undefined)
        stringAt(system.base[key], `${path}.base.${key}`, { max: 100000 });
  }
  if (system.members !== undefined) {
    objectAt(system.members, `${path}.members`);
    const entries = Object.entries(system.members);
    if (entries.length > 100) fail(`${path}.members`, "must contain no more than 100 members");
    for (const [id, member] of entries) {
      stringAt(id, `${path}.members key`, { min: 1, max: 100 });
      const memberPath = `${path}.members.${id}`;
      allowedFields(
        member,
        new Set([
          "actorId",
          "playerName",
          "characterName",
          "obligation",
          "obligationType",
          "description",
          "motivation",
          "duty",
          "dutyType",
          "morality",
        ]),
        memberPath,
      );
      for (const key of [
        "actorId",
        "playerName",
        "characterName",
        "obligationType",
        "description",
        "motivation",
        "dutyType",
      ])
        if (member[key] !== undefined)
          stringAt(member[key], `${memberPath}.${key}`, { max: 100000 });
      for (const key of ["obligation", "duty", "morality"])
        if (member[key] !== undefined)
          integerAt(member[key], `${memberPath}.${key}`, 0, 100);
    }
  }
  if (system.credits !== undefined)
    integerAt(system.credits, `${path}.credits`, 0, 1000000000000);
  for (const key of ["resources", "possessions", "contacts", "notes"])
    if (system[key] !== undefined)
      stringAt(system[key], `${path}.${key}`, { max: 100000 });
}

function validateItemSystem(system, path) {
  allowedFields(system, ITEM_SYSTEM_FIELDS, path);
  if (system.description !== undefined)
    stringAt(system.description, `${path}.description`, { max: 50000 });
  validateSourceReference(system.source, `${path}.source`);
  for (const [key, maximum] of Object.entries({
    quantity: 100000,
    price: 1000000000000,
    rarity: 20,
    encumbrance: 100000,
    hardpoints: 100000,
    critical: 10,
    soak: 100000,
    defense: 4,
    rank: 100,
    forceRating: 10,
    grantedForceRating: 10,
  }))
    if (system[key] !== undefined)
      integerAt(system[key], `${path}.${key}`, 0, maximum);
  for (const key of ["restricted", "equipped", "ranked", "universal"])
    if (system[key] !== undefined) booleanAt(system[key], `${path}.${key}`);
  for (const key of [
    "skill",
    "damage",
    "range",
    "qualities",
    "scale",
    "activation",
    "career",
    "abilityCategory",
    "linkedSpecializationId",
  ])
    if (system[key] !== undefined)
      stringAt(system[key], `${path}.${key}`, { max: 100000 });
  for (const key of ["careerSkills", "eligibleCareers", "incomplete"])
    validateStringArray(system[key], `${path}.${key}`);
  if (system.matchingNodes !== undefined) {
    if (!Array.isArray(system.matchingNodes) || system.matchingNodes.length > 10000)
      fail(`${path}.matchingNodes`, "must contain no more than 10,000 flags");
    system.matchingNodes.forEach((value, index) =>
      booleanAt(value, `${path}.matchingNodes[${index}]`),
    );
  }
  if (system.metadata !== undefined) objectAt(system.metadata, `${path}.metadata`);
  if (system.tree !== undefined) {
    try {
      validateTree(system.tree);
    } catch (error) {
      fail(`${path}.tree`, error.message);
    }
  }
}

function normalizeItem(value, path, { allowId = false, requireKey = false } = {}) {
  const fields = new Set(["name", "type", "img", "system"]);
  if (allowId) fields.add("id");
  if (requireKey) fields.add("key");
  allowedFields(value, fields, path);
  const item = {
    ...(allowId && value.id !== undefined
      ? {
          id: stringAt(value.id, `${path}.id`, {
            min: 16,
            max: 16,
            pattern: /^[A-Za-z0-9]{16}$/,
          }),
        }
      : {}),
    ...(requireKey
      ? {
          key: stringAt(value.key, `${path}.key`, {
            min: 1,
            max: 128,
            pattern: /^[a-z0-9][a-z0-9._-]*$/,
          }),
        }
      : {}),
    name: stringAt(value.name, `${path}.name`, { min: 1, max: 160 }),
    type: stringAt(value.type, `${path}.type`, { min: 1, max: 40 }),
    ...(value.img !== undefined ? { img: value.img } : {}),
    system: jsonClone(objectAt(value.system, `${path}.system`)),
  };
  if (!ITEM_TYPES.includes(item.type)) fail(`${path}.type`, "unsupported item type");
  validateAsset(item.img, `${path}.img`);
  validateItemSystem(item.system, `${path}.system`);
  return item;
}

function normalizeSource(value, path) {
  allowedFields(value, new Set(["id", "name", "version", "url"]), path);
  const source = {
    id: stringAt(value.id, `${path}.id`, {
      min: 1,
      max: 100,
      pattern: /^[a-z0-9][a-z0-9._-]*$/,
    }),
    name: stringAt(value.name, `${path}.name`, { min: 1, max: 160 }),
  };
  if (value.version !== undefined)
    source.version = stringAt(value.version, `${path}.version`, { min: 1, max: 40 });
  if (value.url !== undefined) {
    const url = new URL(stringAt(value.url, `${path}.url`, { min: 1, max: 2048 }));
    if (!["http:", "https:"].includes(url.protocol))
      fail(`${path}.url`, "must use HTTP or HTTPS");
    source.url = url.href;
  }
  return source;
}

function normalizeCharacter(payload, path) {
  allowedFields(payload, new Set(["name", "type", "img", "system", "items"]), path);
  if (payload.type !== "character")
    fail(`${path}.type`, "version 1 imports player characters only");
  const result = {
    name: stringAt(payload.name, `${path}.name`, { min: 1, max: 160 }),
    type: "character",
    ...(payload.img !== undefined ? { img: payload.img } : {}),
    system: jsonClone(objectAt(payload.system, `${path}.system`)),
    items: [],
  };
  validateAsset(result.img, `${path}.img`);
  validateCharacterSystem(result.system, `${path}.system`);
  if (payload.items !== undefined && !Array.isArray(payload.items))
    fail(`${path}.items`, "expected an array");
  if ((payload.items?.length ?? 0) > 250)
    fail(`${path}.items`, "must contain no more than 250 items");
  const ids = new Set();
  result.items = Array.from(payload.items ?? [], (item, index) => {
    const normalized = normalizeItem(item, `${path}.items[${index}]`, { allowId: true });
    if (normalized.id && ids.has(normalized.id))
      fail(`${path}.items[${index}].id`, "duplicate embedded item id");
    if (normalized.id) ids.add(normalized.id);
    return normalized;
  });
  return result;
}

function normalizeActor(payload, path) {
  allowedFields(payload, new Set(["name", "type", "img", "system", "items"]), path);
  const type = stringAt(payload.type, `${path}.type`, { min: 1, max: 40 });
  if (!ACTOR_TYPES.includes(type)) fail(`${path}.type`, "unsupported actor type");
  const result = {
    name: stringAt(payload.name, `${path}.name`, { min: 1, max: 160 }),
    type,
    ...(payload.img !== undefined ? { img: payload.img } : {}),
    system: jsonClone(objectAt(payload.system, `${path}.system`)),
    items: [],
  };
  validateAsset(result.img, `${path}.img`);
  if (["character", "minion", "rival", "nemesis"].includes(type))
    validateCharacterSystem(result.system, `${path}.system`, {
      skillRankMax: type === "character" ? 5 : 10,
    });
  else if (type === "vehicle")
    validateVehicleSystem(result.system, `${path}.system`);
  else validateGroupSystem(result.system, `${path}.system`);
  if (payload.items !== undefined && !Array.isArray(payload.items))
    fail(`${path}.items`, "expected an array");
  if ((payload.items?.length ?? 0) > 250)
    fail(`${path}.items`, "must contain no more than 250 items");
  const ids = new Set();
  result.items = Array.from(payload.items ?? [], (item, index) => {
    const normalized = normalizeItem(item, `${path}.items[${index}]`, { allowId: true });
    if (normalized.id && ids.has(normalized.id))
      fail(`${path}.items[${index}].id`, "duplicate embedded item id");
    if (normalized.id) ids.add(normalized.id);
    return normalized;
  });
  return result;
}

function normalizeRulePack(payload, path) {
  allowedFields(payload, new Set(["id", "name", "version", "rules"]), path);
  if (!Array.isArray(payload.rules) || !payload.rules.length || payload.rules.length > 500)
    fail(`${path}.rules`, "must contain 1-500 rules");
  const keys = new Set();
  const rules = payload.rules.map((rule, index) => {
    const normalized = normalizeItem(rule, `${path}.rules[${index}]`, {
      requireKey: true,
    });
    if (keys.has(normalized.key))
      fail(`${path}.rules[${index}].key`, "duplicate rule key");
    keys.add(normalized.key);
    return normalized;
  });
  return {
    id: stringAt(payload.id, `${path}.id`, {
      min: 1,
      max: 100,
      pattern: /^[a-z0-9][a-z0-9._-]*$/,
    }),
    name: stringAt(payload.name, `${path}.name`, { min: 1, max: 160 }),
    version: stringAt(payload.version, `${path}.version`, { min: 1, max: 40 }),
    rules,
  };
}

function externalId(value, path) {
  return stringAt(value, path, { min: 1, max: 200, pattern: EXTERNAL_ID_PATTERN });
}

function normalizeActorGroup(payload, path) {
  allowedFields(payload, new Set(["id", "name", "actors", "nodes", "relationships"]), path);
  if (!Array.isArray(payload.actors) || !payload.actors.length || payload.actors.length > MAX_ACTOR_GROUP_ACTORS)
    fail(`${path}.actors`, `must contain 1-${MAX_ACTOR_GROUP_ACTORS} actors`);
  if (!Array.isArray(payload.nodes) || !payload.nodes.length || payload.nodes.length > MAX_ACTOR_GROUP_ACTORS)
    fail(`${path}.nodes`, `must contain 1-${MAX_ACTOR_GROUP_ACTORS} nodes`);
  if (!Array.isArray(payload.relationships) || payload.relationships.length > MAX_ACTOR_GROUP_RELATIONSHIPS)
    fail(`${path}.relationships`, `must contain no more than ${MAX_ACTOR_GROUP_RELATIONSHIPS} relationships`);

  const actorIds = new Set();
  const actors = payload.actors.map((entry, index) => {
    const entryPath = `${path}.actors[${index}]`;
    allowedFields(entry, new Set(["id", "actor"]), entryPath);
    const id = externalId(entry.id, `${entryPath}.id`);
    if (actorIds.has(id)) fail(`${entryPath}.id`, "duplicate actor reference");
    actorIds.add(id);
    return { id, actor: normalizeActor(entry.actor, `${entryPath}.actor`) };
  });

  const nodeIds = new Set();
  const assignedActors = new Set();
  const nodes = payload.nodes.map((node, index) => {
    const nodePath = `${path}.nodes[${index}]`;
    allowedFields(node, new Set(["id", "name", "role", "position", "actorRefs"]), nodePath);
    const id = externalId(node.id, `${nodePath}.id`);
    if (nodeIds.has(id)) fail(`${nodePath}.id`, "duplicate node id");
    nodeIds.add(id);
    const role = stringAt(node.role, `${nodePath}.role`, { min: 1, max: 40 });
    if (!ACTOR_GROUP_ROLES.includes(role)) fail(`${nodePath}.role`, "unsupported actor-group role");
    allowedFields(node.position, new Set(["x", "y"]), `${nodePath}.position`);
    const position = {
      x: integerAt(node.position.x, `${nodePath}.position.x`, 0, 100000),
      y: integerAt(node.position.y, `${nodePath}.position.y`, 0, 100000),
    };
    if (!Array.isArray(node.actorRefs) || !node.actorRefs.length || node.actorRefs.length > 50)
      fail(`${nodePath}.actorRefs`, "must contain 1-50 actor references");
    const actorRefs = node.actorRefs.map((value, actorIndex) => {
      const actorPath = `${nodePath}.actorRefs[${actorIndex}]`;
      const actorId = externalId(value, actorPath);
      if (!actorIds.has(actorId)) fail(actorPath, "refers to an unknown actor");
      if (assignedActors.has(actorId)) fail(actorPath, "each actor reference must belong to exactly one node");
      assignedActors.add(actorId);
      return actorId;
    });
    return {
      id,
      name: stringAt(node.name, `${nodePath}.name`, { min: 1, max: 160 }),
      role,
      position,
      actorRefs,
    };
  });
  if (assignedActors.size !== actorIds.size)
    fail(`${path}.actors`, "each actor reference must belong to exactly one node");

  const relationshipIds = new Set();
  const relationships = payload.relationships.map((relationship, index) => {
    const relationshipPath = `${path}.relationships[${index}]`;
    allowedFields(relationship, new Set(["id", "fromNodeId", "toNodeId", "kind", "label"]), relationshipPath);
    const id = externalId(relationship.id, `${relationshipPath}.id`);
    if (relationshipIds.has(id)) fail(`${relationshipPath}.id`, "duplicate relationship id");
    relationshipIds.add(id);
    const fromNodeId = externalId(relationship.fromNodeId, `${relationshipPath}.fromNodeId`);
    const toNodeId = externalId(relationship.toNodeId, `${relationshipPath}.toNodeId`);
    if (!nodeIds.has(fromNodeId)) fail(`${relationshipPath}.fromNodeId`, "refers to an unknown node");
    if (!nodeIds.has(toNodeId)) fail(`${relationshipPath}.toNodeId`, "refers to an unknown node");
    if (fromNodeId === toNodeId) fail(relationshipPath, "self-relationships are not supported");
    const kind = stringAt(relationship.kind, `${relationshipPath}.kind`, { min: 1, max: 40 });
    if (!ACTOR_GROUP_RELATIONSHIP_KINDS.includes(kind))
      fail(`${relationshipPath}.kind`, "unsupported relationship kind");
    return {
      id,
      fromNodeId,
      toNodeId,
      kind,
      label: stringAt(relationship.label, `${relationshipPath}.label`, { max: 120 }),
    };
  });

  return {
    id: externalId(payload.id, `${path}.id`),
    name: stringAt(payload.name, `${path}.name`, { min: 1, max: 160 }),
    actors,
    nodes,
    relationships,
  };
}

function normalizePackage(value, path = "package", allowBundle = true) {
  allowedFields(value, new Set(["format", "version", "kind", "source", "payload"]), path);
  if (value.format !== INTEGRATION_FORMAT)
    fail(`${path}.format`, `expected ${INTEGRATION_FORMAT}`);
  if (!INTEGRATION_VERSIONS.includes(value.version))
    fail(`${path}.version`, `unsupported interchange version ${value.version}`);
  if (!PACKAGE_KINDS[value.version].includes(value.kind))
    fail(`${path}.kind`, "unsupported package kind");
  const source = normalizeSource(value.source, `${path}.source`);
  let payload;
  if (value.kind === "character") payload = normalizeCharacter(value.payload, `${path}.payload`);
  else if (value.kind === "actor") payload = normalizeActor(value.payload, `${path}.payload`);
  else if (value.kind === "actorGroup") payload = normalizeActorGroup(value.payload, `${path}.payload`);
  else if (value.kind === "rulePack")
    payload = normalizeRulePack(value.payload, `${path}.payload`);
  else {
    if (!allowBundle) fail(`${path}.kind`, "nested bundles are not supported");
    allowedFields(value.payload, new Set(["packages"]), `${path}.payload`);
    if (
      !Array.isArray(value.payload.packages) ||
      !value.payload.packages.length ||
      value.payload.packages.length > 20
    )
      fail(`${path}.payload.packages`, "must contain 1-20 packages");
    payload = {
      packages: value.payload.packages.map((entry, index) => {
        const entryPath = `${path}.payload.packages[${index}]`;
        if (entry?.version !== value.version)
          fail(
            `${entryPath}.version`,
            `bundle entries must use version ${value.version}`,
          );
        return normalizePackage(entry, entryPath, false);
      }),
    };
  }
  return { format: INTEGRATION_FORMAT, version: value.version, kind: value.kind, source, payload };
}

export function validateIntegrationPackage(value) {
  validateJson(value);
  if (jsonBytes(value) > MAX_PACKAGE_BYTES)
    throw new Error(`Package exceeds ${MAX_PACKAGE_BYTES} bytes.`);
  return normalizePackage(value);
}

export function integrationCapabilities() {
  return {
    format: INTEGRATION_FORMAT,
    versions: [...INTEGRATION_VERSIONS],
    schema: "systems/star-wars-ffg/docs/schemas/integration-v3.schema.json",
    schemas: {
      1: "systems/star-wars-ffg/docs/schemas/integration-v1.schema.json",
      2: "systems/star-wars-ffg/docs/schemas/integration-v2.schema.json",
      3: "systems/star-wars-ffg/docs/schemas/integration-v3.schema.json",
    },
    imports: ["character", "actor", "actorGroup", "rulePack", "bundle"],
    exports: ["character", "actor"],
    transports: ["json-file", "url-fragment", "post-message"],
    actorTypes: [...ACTOR_TYPES],
    itemTypes: [...ITEM_TYPES],
    limits: {
      packageBytes: MAX_PACKAGE_BYTES,
      handoffBytes: MAX_HANDOFF_BYTES,
      characterItems: 250,
      rulePackRules: 500,
      bundlePackages: 20,
      actorGroupActors: MAX_ACTOR_GROUP_ACTORS,
      actorGroupRelationships: MAX_ACTOR_GROUP_RELATIONSHIPS,
    },
  };
}

export function integrationSummary(value) {
  const pkg = validateIntegrationPackage(value);
  if (pkg.kind === "character")
    return {
      kind: pkg.kind,
      label: pkg.payload.name,
      source: pkg.source.name,
      entries: 1,
      items: pkg.payload.items.length,
    };
  if (pkg.kind === "actor")
    return {
      kind: pkg.kind,
      label: pkg.payload.name,
      source: pkg.source.name,
      entries: 1,
      items: pkg.payload.items.length,
      actorType: pkg.payload.type,
    };
  if (pkg.kind === "rulePack")
    return {
      kind: pkg.kind,
      label: pkg.payload.name,
      source: pkg.source.name,
      entries: pkg.payload.rules.length,
      items: pkg.payload.rules.length,
    };
  if (pkg.kind === "actorGroup")
    return {
      kind: pkg.kind,
      label: pkg.payload.name,
      source: pkg.source.name,
      entries: pkg.payload.actors.length,
      items: pkg.payload.actors.reduce((total, entry) => total + entry.actor.items.length, 0),
      actors: pkg.payload.actors.length,
      relationships: pkg.payload.relationships.length,
    };
  const summaries = pkg.payload.packages.map(integrationSummary);
  return {
    kind: pkg.kind,
    label: `${summaries.length} integration packages`,
    source: pkg.source.name,
    entries: summaries.reduce((total, entry) => total + entry.entries, 0),
    items: summaries.reduce((total, entry) => total + entry.items, 0),
    packages: summaries,
  };
}

function bytesToToken(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function tokenToBytes(token, maxBytes) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]+$/.test(token))
    throw new Error("Handoff token is invalid.");
  if (token.length > Math.ceil((maxBytes * 4) / 3) + 4)
    throw new Error("Handoff token exceeds its size limit.");
  const padded = token.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(token.length / 4) * 4, "=");
  let binary;
  try {
    binary = atob(padded);
  } catch {
    throw new Error("Handoff token is invalid.");
  }
  if (binary.length > maxBytes) throw new Error("Handoff token exceeds its size limit.");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeIntegrationPackage(value) {
  const pkg = validateIntegrationPackage(value),
    bytes = new TextEncoder().encode(JSON.stringify(pkg));
  if (bytes.length > MAX_HANDOFF_BYTES)
    throw new Error(
      `Direct-link handoffs are limited to ${MAX_HANDOFF_BYTES} bytes. Use the postMessage or JSON-file transport for this package.`,
    );
  return bytesToToken(bytes);
}

export function decodeIntegrationPackage(token) {
  const bytes = tokenToBytes(token, MAX_HANDOFF_BYTES);
  try {
    return validateIntegrationPackage(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    throw new Error(`Handoff package is invalid: ${error.message}`);
  }
}

export function encodeConnectionRequest({ origin, nonce }) {
  const url = new URL(origin);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin)
    throw new Error("Connection origin must be an exact HTTP or HTTPS origin.");
  stringAt(nonce, "connection.nonce", {
    min: 16,
    max: 128,
    pattern: /^[A-Za-z0-9._-]+$/,
  });
  return bytesToToken(new TextEncoder().encode(JSON.stringify({ origin, nonce })));
}

export function decodeConnectionRequest(token) {
  let value;
  try {
    value = JSON.parse(new TextDecoder().decode(tokenToBytes(token, 4096)));
  } catch (error) {
    throw new Error(`Connection request is invalid: ${error.message}`);
  }
  allowedFields(value, new Set(["origin", "nonce"]), "connection");
  const url = new URL(value.origin);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== value.origin)
    throw new Error("Connection origin must be an exact HTTP or HTTPS origin.");
  return {
    origin: url.origin,
    nonce: stringAt(value.nonce, "connection.nonce", {
      min: 16,
      max: 128,
      pattern: /^[A-Za-z0-9._-]+$/,
    }),
  };
}

export function parseIntegrationHash(hash) {
  const value = String(hash ?? "");
  const importPrefix = "#star-wars-ffg-import=";
  const connectPrefix = "#star-wars-ffg-connect=";
  if (value.startsWith(importPrefix))
    return { type: "package", package: decodeIntegrationPackage(value.slice(importPrefix.length)) };
  if (value.startsWith(connectPrefix))
    return { type: "connection", request: decodeConnectionRequest(value.slice(connectPrefix.length)) };
  return null;
}

export function validateConnectorManifest(value) {
  allowedFields(value, new Set(["id", "name", "version", "url", "capabilities"]), "connector");
  if (!Array.isArray(value.capabilities) || !value.capabilities.length || value.capabilities.length > 30)
    fail("connector.capabilities", "must contain 1-30 entries");
  const capabilities = value.capabilities.map((entry, index) =>
    stringAt(entry, `connector.capabilities[${index}]`, {
      min: 3,
      max: 80,
      pattern: /^[a-z][a-z0-9.-]*$/,
    }),
  );
  if (new Set(capabilities).size !== capabilities.length)
    fail("connector.capabilities", "contains duplicates");
  const url = new URL(stringAt(value.url, "connector.url", { min: 1, max: 2048 }));
  if (!["http:", "https:"].includes(url.protocol))
    fail("connector.url", "must use HTTP or HTTPS");
  return {
    id: stringAt(value.id, "connector.id", {
      min: 1,
      max: 100,
      pattern: /^[a-z0-9][a-z0-9._-]*$/,
    }),
    name: stringAt(value.name, "connector.name", { min: 1, max: 160 }),
    version: stringAt(value.version, "connector.version", { min: 1, max: 40 }),
    url: url.href,
    capabilities,
  };
}

export function createConnectorRegistry() {
  const connectors = new Map();
  return Object.freeze({
    register(value) {
      const connector = validateConnectorManifest(value);
      if (connectors.has(connector.id))
        throw new Error(`Connector ${connector.id} is already registered.`);
      connectors.set(connector.id, Object.freeze(connector));
      return jsonClone(connector);
    },
    unregister(id) {
      return connectors.delete(String(id));
    },
    get(id) {
      const connector = connectors.get(String(id));
      return connector ? jsonClone(connector) : null;
    },
    list() {
      return Array.from(connectors.values(), jsonClone);
    },
  });
}
