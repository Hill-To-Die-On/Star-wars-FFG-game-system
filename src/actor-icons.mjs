import { SYSTEM_ID, SYSTEM_PATH } from "./config.mjs";
import {
  CHARACTER_ARCHETYPE_LABELS,
  SPECIES_ARCHETYPE_BY_NAME,
  VEHICLE_ARCHETYPE_LABELS,
  VEHICLE_ARCHETYPE_RULES,
} from "./actor-icon-taxonomy.mjs";

export const ACTOR_ICON_PALETTES = Object.freeze({
  player: Object.freeze({
    label: "Player",
    background: "#173D4D",
    foreground: "#F7E5B2",
    secondary: "#83AEB7",
  }),
  ally: Object.freeze({
    label: "Ally",
    background: "#23483F",
    foreground: "#F7E5B2",
    secondary: "#8DB8A8",
  }),
  npc: Object.freeze({
    label: "NPC",
    background: "#343B43",
    foreground: "#F7E5B2",
    secondary: "#A8B2B9",
  }),
  minion: Object.freeze({
    label: "Minion",
    background: "#503B22",
    foreground: "#F7E5B2",
    secondary: "#C0A36D",
  }),
  rival: Object.freeze({
    label: "Rival",
    background: "#493653",
    foreground: "#F7E5B2",
    secondary: "#BA9BC1",
  }),
  nemesis: Object.freeze({
    label: "Nemesis",
    background: "#572930",
    foreground: "#F7E5B2",
    secondary: "#C68D91",
  }),
  vehicle: Object.freeze({
    label: "Ship / vehicle",
    background: "#263D49",
    foreground: "#F7E5B2",
    secondary: "#7FA3AD",
  }),
  group: Object.freeze({
    label: "Group",
    background: "#4D472C",
    foreground: "#F7E5B2",
    secondary: "#B9AA72",
  }),
});

export const CHARACTER_ICON_ARCHETYPES = CHARACTER_ARCHETYPE_LABELS;

export const VEHICLE_ICON_ARCHETYPES = VEHICLE_ARCHETYPE_LABELS;

const LEGACY_VEHICLE_ARCHETYPE_ALIASES = Object.freeze({
  capital: "destroyer",
  speeder: "landspeeder",
});

const DEFAULT_ACTOR_IMAGES = new Set([
  `${SYSTEM_PATH}/assets/character.svg`,
  `${SYSTEM_PATH}/assets/vehicle.svg`,
  "icons/svg/mystery-man.svg",
  "icons/svg/mystery-man-black.svg",
  "icons/svg/ship-wheel.svg",
]);

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const escapeXml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const stableHash = (value) => {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const nested = (source, path) => {
  let value = source;
  for (const key of path.split(".")) value = value?.[key];
  return value;
};

export function actorIconCategory(actor) {
  const override = nested(actor, `flags.${SYSTEM_ID}.iconRole`);
  if (override in ACTOR_ICON_PALETTES) return override;
  const type = String(actor?.type ?? "character");
  if (type === "vehicle") return "vehicle";
  if (type === "group") return "group";
  if (type === "minion") return "minion";
  if (type === "rival") return "rival";
  if (type === "nemesis") return "nemesis";
  const disposition = Number(
    actor?.prototypeToken?.disposition ?? actor?.prototypeToken?._source?.disposition,
  );
  if (actor?.hasPlayerOwner === true) return "player";
  if (disposition === 1) return "ally";
  if (disposition === -1) return "npc";
  return type === "character" ? "player" : "npc";
}

export function characterIconProfile(species, explicitArchetype = "") {
  const explicit = String(explicitArchetype ?? "");
  if (explicit in CHARACTER_ICON_ARCHETYPES)
    return { archetype: explicit, known: true, source: "override" };

  const raw = String(species ?? "").trim(),
    databaseArchetype = SPECIES_ARCHETYPE_BY_NAME[raw.toLocaleLowerCase("en-GB")];
  if (databaseArchetype)
    return { archetype: databaseArchetype, known: true, source: "database" };

  const value = normalize(raw);
  const inferred = [
    ["droid", /droid|robot|automaton|mechanical/],
    ["lekku", /twi.?lek|lekku/],
    ["montral", /togruta|montral/],
    ["horned", /zabrak|devaronian|horn|antenna/],
    ["hooded", /jawa|hooded/],
    ["masked", /masked|respirator|helmet/],
    ["furred", /wookie|ewok|bothan|togorian|talz|shistavanen|fur/],
    ["feline", /feline|cat|felid/],
    ["tentacled", /quarren|nautolan|tentacl/],
    ["aquatic", /mon calamari|selkath|aquatic|amphib/],
    ["reptilian", /trandosh|nikto|reptil|saur/],
    ["insectoid", /insect|arachnid|verpine|geonosian/],
    ["avian", /avian|bird|beak/],
    ["snouted", /rodian|aqualish|snout|tusk/],
    ["small", /small|diminutive/],
  ].find(([, expression]) => expression.test(value))?.[0];
  return {
    archetype: inferred ?? "humanoid",
    known: Boolean(inferred),
    source: inferred ? "inferred" : "fallback",
  };
}

export function characterIconArchetype(species) {
  return characterIconProfile(species).archetype;
}

function vehicleSearchText(actor) {
  const system = actor?.system ?? {};
  return normalize(
    [
      actor?.name,
      system.model,
      system.manufacturer,
      system.metadata?.Purpose,
      system.metadata?.purpose,
      system.metadata?.Hull,
      system.metadata?.hull,
      system.metadata?.Class,
      system.metadata?.class,
    ].join(" "),
  );
}

export function vehicleIconProfile(actor, explicitArchetype = "") {
  const requested = normalize(
      explicitArchetype ||
        nested(actor, `flags.${SYSTEM_ID}.iconArchetype`) ||
        actor?.system?.footprint?.hull,
    ),
    explicit = LEGACY_VEHICLE_ARCHETYPE_ALIASES[requested] ?? requested;
  if (explicit in VEHICLE_ICON_ARCHETYPES)
    return { archetype: explicit, known: true, source: "override" };

  const value = vehicleSearchText(actor),
    matched = VEHICLE_ARCHETYPE_RULES.find(([, expression]) => expression.test(value));
  if (matched) return { archetype: matched[0], known: true, source: "database" };

  const silhouette = Number(actor?.system?.silhouette);
  return {
    archetype: silhouette >= 5 ? "destroyer" : silhouette >= 4 ? "freighter" : "fighter",
    known: false,
    source: "fallback",
  };
}

export function vehicleIconArchetype(actor) {
  return vehicleIconProfile(actor).archetype;
}

const STANDARD_BUST =
  '<path data-part="body" data-body-center="50" d="M21 82C22 69 29 61 42 56V51H58V56C71 61 78 69 79 82"/>';

function characterGlyph(archetype) {
  const heads = {
    humanoid:
      '<ellipse data-part="head" data-head-center="50" cx="50" cy="34" rx="14" ry="16"/>',
    armored:
      '<path data-part="head" data-head-center="50" d="M35 31Q38 18 50 17Q62 18 65 31V43L58 51H42L35 43Z"/><path d="M39 34H61L58 41H42ZM44 47H56"/>',
    droid:
      '<path data-part="head" data-head-center="50" d="M35 33Q36 19 50 18Q64 19 65 33V47H35Z"/><path d="M39 33H61M43 27V17M43 39h3M54 39h3"/><circle cx="44.5" cy="39" r="1"/><circle cx="55.5" cy="39" r="1"/>',
    lekku:
      '<path d="M41 43C36 54 36 68 31 78M59 43C64 54 64 68 69 78"/><ellipse data-part="head" data-head-center="50" cx="50" cy="33" rx="13" ry="15"/><path d="M41 26Q50 21 59 26"/>',
    montral:
      '<path d="M39 28 36 13 46 24 50 10 54 24 64 13 61 28M41 45C36 58 36 70 32 79M59 45C64 58 64 70 68 79"/><ellipse data-part="head" data-head-center="50" cx="50" cy="35" rx="12" ry="14"/>',
    horned:
      '<path d="M38 27 35 17 43 24 47 14 50 23 53 14 57 24 65 17 62 27"/><ellipse data-part="head" data-head-center="50" cx="50" cy="36" rx="13" ry="15"/>',
    furred:
      '<path data-part="head" data-head-center="50" d="M34 29 31 20 41 24Q50 18 59 24L69 20 66 29V43L61 52 56 48 50 53 44 48 39 52 34 43Z"/><path d="M41 34h3M56 34h3M45 43Q50 47 55 43"/>',
    feline:
      '<path data-part="head" data-head-center="50" d="M35 31 34 17 43 23Q50 19 57 23L66 17 65 31V43Q61 51 50 52Q39 51 35 43Z"/><path d="M41 34h4M55 34h4M46 42 50 45 54 42"/>',
    longEared:
      '<path d="M37 28 19 20 31 37M63 28 81 20 69 37"/><ellipse data-part="head" data-head-center="50" cx="50" cy="35" rx="14" ry="16"/><path d="M43 36h3M54 36h3"/>',
    aquatic:
      '<path data-part="head" data-head-center="50" d="M33 35Q34 18 50 18T67 35Q66 51 50 53Q34 51 33 35Z"/><circle cx="35" cy="34" r="4"/><circle cx="65" cy="34" r="4"/><path d="M43 44Q50 48 57 44M30 43l-7 5M70 43l7 5"/>',
    tentacled:
      '<path data-part="head" data-head-center="50" d="M35 34Q35 18 50 18Q65 18 65 34V42M35 42V34"/><path d="M38 40C34 48 40 49 36 56M46 41C42 49 47 50 44 57M54 41C58 49 53 50 56 57M62 40C66 48 60 49 64 56M42 31h3M55 31h3"/>',
    reptilian:
      '<path data-part="head" data-head-center="50" d="M36 29 43 20 50 17 57 20 64 29 62 43 54 51H46L38 43Z"/><path d="M39 33l7-2M61 33l-7-2M43 43H57M50 20v7"/>',
    snouted:
      '<ellipse data-part="head" data-head-center="50" cx="50" cy="34" rx="15" ry="17"/><path d="M42 39Q50 34 58 39V47Q50 52 42 47ZM40 43l-5 5M60 43l5 5M42 31h3M55 31h3"/>',
    domed:
      '<path data-part="head" data-head-center="50" d="M33 34Q34 16 50 15Q66 16 67 34L63 47 56 53H44L37 47Z"/><path d="M39 35h5M56 35h5M44 45H56"/>',
    tall:
      '<path data-part="head" data-head-center="50" d="M40 39Q38 19 50 10Q62 19 60 39Q59 51 50 54Q41 51 40 39Z"/><path d="M44 35h3M53 35h3"/>',
    hammerhead:
      '<path data-part="head" data-head-center="50" d="M22 28Q31 20 41 24Q50 17 59 24Q69 20 78 28L69 42 58 45Q54 52 50 52Q46 52 42 45L31 42Z"/><circle cx="29" cy="30" r="2"/><circle cx="71" cy="30" r="2"/>',
    hooded:
      '<path data-part="head" data-head-center="50" d="M31 54 38 25Q41 15 50 14Q59 15 62 25L69 54 58 48H42Z"/><path d="M40 34Q50 29 60 34L57 42Q50 46 43 42Z"/><circle cx="45" cy="37" r="1.5"/><circle cx="55" cy="37" r="1.5"/>',
    masked:
      '<path data-part="head" data-head-center="50" d="M35 30Q38 17 50 17Q62 17 65 30L62 45 55 52H45L38 45Z"/><path d="M40 31H60M43 37 50 33 57 37 55 47H45ZM37 41l-6 4M63 41l6 4"/>',
    insectoid:
      '<path d="M42 22 35 12M58 22 65 12"/><path data-part="head" data-head-center="50" d="M37 25 50 18 63 25 60 43 53 51H47L40 43Z"/><path d="M41 30l6 3M59 30l-6 3M42 44l-6 5M58 44l6 5"/>',
    avian:
      '<path data-part="head" data-head-center="50" d="M37 29Q41 17 50 17Q59 17 63 29L59 43 50 52 41 43Z"/><path d="M43 35 50 30 57 35 50 43ZM40 29h4M56 29h4"/>',
    multiLimbed:
      '<ellipse data-part="head" data-head-center="50" cx="50" cy="33" rx="14" ry="15"/><path d="M31 62 16 72M69 62 84 72M28 72 17 82M72 72 83 82"/>',
    hutt:
      '<path data-part="head" data-head-center="50" d="M38 32Q39 18 50 17Q61 18 62 32L59 47H41Z"/><path data-part="body" data-body-center="50" d="M41 47Q31 53 28 66Q25 78 13 82H76Q86 80 87 73Q87 64 72 64Q70 53 59 47Z"/><path d="M42 31h4M54 31h4M43 40Q50 44 57 40"/>',
    small:
      '<ellipse data-part="head" data-head-center="50" cx="50" cy="38" rx="12" ry="14"/><path d="M33 31 20 25 36 40M67 31 80 25 64 40"/>',
    unusual:
      '<path data-part="head" data-head-center="50" d="M50 14 64 27 61 45 50 54 39 45 36 27Z"/><path d="M50 14v40M36 27h28M39 45h22M43 34h4M53 34h4"/>',
  };
  const body = archetype === "hutt" ? "" : STANDARD_BUST;
  return `<g data-archetype="${archetype}" data-centerline="50" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${heads[archetype]}${body}</g>`;
}

function vehicleGlyph(archetype) {
  const glyphs = {
    fighter:
      '<path data-part="hull" d="M50 15 63 42 82 69 61 62 58 84 50 73 42 84 39 62 18 69 37 42Z"/><path d="M50 27V67M29 62l21-9 21 9"/>',
    bomber:
      '<path data-part="hull" d="M50 18 61 38 79 48 68 60 61 58 58 82H42L39 58 32 60 21 48 39 38Z"/><path d="M50 26v45M32 48h36"/>',
    freighter:
      '<path data-part="hull" d="M24 58 31 36 50 22 69 36 76 58 60 63 50 82 40 63Z"/><path d="M31 43H69M39 61H61M50 22V82"/>',
    shuttle:
      '<path data-part="hull" d="M50 16 64 63 82 76 60 72 50 84 40 72 18 76 36 63Z"/><path d="M50 28V71M36 63H64"/>',
    gunship:
      '<path data-part="hull" d="M26 36H68L78 49 69 64H31L22 52Z"/><path d="M37 36 43 24H61L66 36M29 64 24 76M67 64l9 12M18 47H8M78 47h14"/>',
    cruiser:
      '<path data-part="hull" d="M50 15 71 70 50 82 29 70Z"/><path d="M50 25V72M35 65l15-10 15 10M43 45H57"/>',
    destroyer:
      '<path data-part="hull" d="M50 13 82 78 50 69 18 78Z"/><path d="M50 25V69M30 70l20-12 20 12M43 49H57"/>',
    carrier:
      '<path data-part="hull" d="M23 30H77V70H23Z"/><path d="M35 22V78M65 22V78M43 42H57M43 58H57"/>',
    station:
      '<circle data-part="hull" cx="50" cy="50" r="27"/><circle cx="50" cy="50" r="11"/><path d="M50 14V39M50 61V86M14 50H39M61 50H86M25 25l17 17M58 58l17 17M75 25 58 42M42 58 25 75"/>',
    tank:
      '<path data-part="hull" d="M20 58H80L74 76H26Z"/><path d="M31 58 37 38H65L72 58M45 38V29H67M67 25V33"/><circle cx="34" cy="68" r="4"/><circle cx="50" cy="68" r="4"/><circle cx="66" cy="68" r="4"/>',
    walker:
      '<path data-part="hull" d="M29 31H71L77 54 64 62H37L23 54Z"/><path d="M39 62 34 83M59 62l7 21M29 43H16M71 41H84M30 83H41M61 83H72"/>',
    airspeeder:
      '<path data-part="hull" d="M18 57 34 39H66L82 57 66 65H34Z"/><path d="M30 50H70M40 39l6-13h8l6 13M18 70H37M63 70H82"/>',
    landspeeder:
      '<path data-part="hull" d="M18 56 31 42H70L82 56 68 65H32Z"/><path d="M28 52H72M36 42l5-9h23l7 9M15 72H37M63 72H85"/>',
    bike:
      '<path data-part="hull" d="M18 58H65L79 51 85 57 70 66H26Z"/><path d="M38 58 48 40H62M59 40h13M28 66 21 77M70 66l8 11"/><circle cx="20" cy="79" r="5"/><circle cx="80" cy="79" r="5"/>',
    podracer:
      '<path data-part="hull" d="M40 57 50 46 60 57 56 69H44Z"/><path d="M18 37H35L39 49H17ZM82 37H65L61 49H83ZM35 43H65M26 49 43 62M74 49 57 62"/>',
    crawler:
      '<path data-part="hull" d="M18 52H75L82 68 72 77H25L16 68Z"/><path d="M31 52V37H60L69 52M39 37V28H55V37"/><circle cx="31" cy="68" r="5"/><circle cx="50" cy="68" r="5"/><circle cx="69" cy="68" r="5"/>',
    barge:
      '<path data-part="hull" d="M15 55H85L75 72H25Z"/><path d="M26 55 34 38H66L74 55M42 38V27H58V38M21 78H79"/>',
    submarine:
      '<path data-part="hull" d="M17 54Q25 37 50 37Q75 37 83 54Q75 70 50 70Q25 70 17 54Z"/><path d="M43 37V28H60L66 37M30 54H70M17 54H9M83 54H91"/>',
    drone:
      '<path data-part="hull" d="M35 36 50 25 65 36 61 60 50 72 39 60Z"/><path d="M35 43 17 34M65 43 83 34M39 58 19 68M61 58 81 68"/><circle cx="50" cy="46" r="7"/>',
    industrial:
      '<path data-part="hull" d="M20 59H64L72 74H28Z"/><path d="M31 59 38 38H61L66 59M61 38 75 24M75 24H87V61M79 61H92M37 74v8M63 74v8"/>',
  };
  return `<g data-archetype="${archetype}" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${glyphs[archetype]}</g>`;
}

function groupGlyph() {
  return `<g data-archetype="group" data-centerline="50" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><circle cx="50" cy="31" r="10"/><circle cx="29" cy="43" r="8"/><circle cx="71" cy="43" r="8"/><path d="M31 79C32 63 39 55 50 55S68 63 69 79M14 76C15 63 21 57 30 57 36 57 40 60 43 65M86 76C85 63 79 57 70 57 64 57 60 60 57 65"/></g>`;
}

const svgNumber = value => Number(Number(value).toFixed(6));

function frameSvg(family, palette, width = 100, height = 100) {
  if (family === "vehicle")
    {
      const scale = Math.min(width,height)/100, n = svgNumber;
      return `<rect data-frame="vehicle" width="${width}" height="${height}" rx="${n(18*scale)}" fill="${palette.background}"></rect><rect x="${n(7*scale)}" y="${n(7*scale)}" width="${n(width-14*scale)}" height="${n(height-14*scale)}" rx="${n(13*scale)}" fill="none" stroke="${palette.secondary}" stroke-width="${n(1.5*scale)}"/>`;
    }
  return `<circle data-frame="character" cx="50" cy="50" r="50" fill="${palette.background}"></circle><circle cx="50" cy="50" r="43" fill="none" stroke="${palette.secondary}" stroke-width="1.5"/>`;
}

function facingMarks(family, palette, width = 100, height = 100) {
  const scale = family === "vehicle" ? Math.min(width,height)/100 : 1, n = svgNumber;
  const paths =
    family === "vehicle"
      ? `<path data-facing="port" d="M${n(6.33*scale)} ${n(6.33*scale)}L${n(15.29*scale)} ${n(15.29*scale)}"/><path data-facing="starboard" d="M${n(width-6.33*scale)} ${n(6.33*scale)}L${n(width-15.29*scale)} ${n(15.29*scale)}"/>`
      : '<path data-facing="port" d="M12 22l9 5"/><path data-facing="starboard" d="M88 22l-9 5"/>';
  return `<g fill="none" stroke="${palette.foreground}" stroke-width="${n(3*scale)}" stroke-linecap="round">${paths}</g>`;
}

function encodeSvg(svg) {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

export function actorIconDescriptor(actor, dimensions = {}) {
  const category = actorIconCategory(actor),
    palette = ACTOR_ICON_PALETTES[category],
    family = actor?.type === "vehicle" ? "vehicle" : actor?.type === "group" ? "group" : "character",
    explicitArchetype = nested(actor, `flags.${SYSTEM_ID}.iconArchetype`),
    archetype =
      family === "vehicle"
        ? vehicleIconProfile(actor, explicitArchetype).archetype
        : family === "group"
          ? "group"
          : characterIconProfile(actor?.system?.species, explicitArchetype).archetype,
    seed = `${actor?.name ?? "Actor"}|${actor?.system?.species ?? ""}|${actor?.system?.model ?? ""}|${category}|${archetype}`,
    title = `${actor?.name || "Actor"} · ${palette.label} · ${family === "group" ? "Group" : family === "vehicle" ? VEHICLE_ICON_ARCHETYPES[archetype] : CHARACTER_ICON_ARCHETYPES[archetype]}`,
    glyph =
      family === "vehicle"
        ? vehicleGlyph(archetype)
        : family === "group"
          ? groupGlyph()
          : characterGlyph(archetype);
  // Foundry rasterizes SVG assets once at their intrinsic size. Keep the compact
  // vector geometry but give large vehicle footprints enough texture pixels.
  const pixels = family === "vehicle" ? 2048 : 512;
  const validSize = value => Number.isFinite(Number(value)) && Number(value)>0;
  const adaptive = family === "vehicle" && validSize(dimensions.width) && validSize(dimensions.height);
  const longest = adaptive ? Math.max(Number(dimensions.width),Number(dimensions.height)) : 1;
  const width = adaptive ? svgNumber(100*Number(dimensions.width)/longest) : 100;
  const height = adaptive ? svgNumber(100*Number(dimensions.height)/longest) : 100;
  const short = Math.min(width,height);
  const fittedGlyph = family === "vehicle"
    ? `<g data-hull-fit="uniform" transform="translate(${svgNumber((width-short)/2)} ${svgNumber((height-short)/2)}) scale(${svgNumber(short/100)})">${glyph}</g>` : glyph;
  const fingerprint = stableHash(`${seed}|${width}:${height}`).toString(16).padStart(8, "0");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels*width/100}" height="${pixels*height/100}" viewBox="0 0 ${width} ${height}" data-system-icon="${SYSTEM_ID}" role="img" aria-label="${escapeXml(title)}" style="color:${palette.foreground}"><title>${escapeXml(title)}</title>${frameSvg(family, palette,width,height)}${fittedGlyph}${facingMarks(family, palette,width,height)}</svg>`;
  return {
    category,
    palette,
    family,
    archetype,
    fingerprint,
    svg,
    src: encodeSvg(svg),
  };
}

export function proceduralActorSvg(actor) {
  return actorIconDescriptor(actor).svg;
}

export function isDefaultActorImage(source, type = "character") {
  const path = String(source ?? "").split(/[?#]/)[0];
  if (!path) return true;
  if (DEFAULT_ACTOR_IMAGES.has(path)) return true;
  return path === `${SYSTEM_PATH}/assets/${type === "vehicle" ? "vehicle" : "character"}.svg`;
}

export function isProceduralActorIcon(actor) {
  return nested(actor, `flags.${SYSTEM_ID}.proceduralIcon.enabled`) === true ||
    isProceduralIconSource(actor?.img);
}

const proceduralSourceCache = new Map();

/** Recognize embedded badges even when an unlinked actor has older flags. */
export function isProceduralIconSource(source) {
  if (typeof source !== "string") return false;
  if (proceduralSourceCache.has(source)) return proceduralSourceCache.get(source);
  let generated = false;
  try {
    const svg = source.startsWith("data:image/svg+xml;base64,")
      ? atob(source.slice("data:image/svg+xml;base64,".length))
      : "";
    generated = svg.includes(`data-system-icon="${SYSTEM_ID}"`) ||
      (/data-frame="(?:character|vehicle)"/.test(svg) &&
        /data-archetype="[a-zA-Z]+"/.test(svg) && svg.includes('data-facing="port"'));
  } catch {
    // Malformed or unrelated images are never treated as system artwork.
  }
  if (proceduralSourceCache.size >= 128)
    proceduralSourceCache.delete(proceduralSourceCache.keys().next().value);
  proceduralSourceCache.set(source, generated);
  return generated;
}

export function actorPortraitSource(actor) {
  return isProceduralActorIcon(actor) || isDefaultActorImage(actor?.img, actor?.type)
    ? actorIconDescriptor(actor).src
    : actor.img;
}
