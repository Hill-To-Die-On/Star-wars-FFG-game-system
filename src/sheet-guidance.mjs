import { CHARACTERISTICS, SKILLS } from "./config.mjs";

// Original, brief play aids. These describe when a skill is relevant; they do not set difficulty or grant effects.
export const SKILL_GUIDANCE = Object.freeze({
  astrogation: "Plot or revise a spacecraft route through hyperspace, accounting for travel data and hazards. An ordinary access terminal calls for Computers instead.",
  athletics: "Climb, leap, swim, run, or push through a demanding feat of whole-body strength and endurance.",
  brawl: "Fight at close quarters with fists, claws, or other unarmed attacks and suitable brawling weapons.",
  charm: "Win willing cooperation through warmth, appeal, or a sincere personal connection.",
  coercion: "Pressure someone into compliance through threats, fear, or a display of force.",
  computers: "Search, operate, secure, or bypass computer systems, terminals, and networks. Physical repair belongs to Mechanics.",
  cool: "Stay composed when pressure is expected; it can also set initiative when a character is ready for trouble.",
  coordination: "Keep balance, tumble, squeeze through a tight space, or make another precise full-body movement.",
  deception: "Conceal the truth, sustain a false story, or mislead someone who might detect the lie.",
  discipline: "Hold focus and self-control against fear, temptation, pain, or a contest of will.",
  gunnery: "Aim and fire heavy emplacements, vehicle weapons, or other weapons that use the Gunnery skill.",
  leadership: "Direct, rally, or coordinate people who might follow the character's authority or example.",
  lightsaber: "Fight with a lightsaber or another weapon assigned to this skill; the weapon and talents determine the pool.",
  mechanics: "Diagnose, repair, modify, or build physical machinery, droids, vehicles, and equipment.",
  medicine: "Assess injuries, provide treatment, or stabilize someone using medical knowledge and supplies.",
  melee: "Attack at close quarters with hand-held weapons governed by Melee rather than Brawl or Lightsaber.",
  negotiation: "Reach an agreement through bargaining, trade, or mutually understood terms.",
  perception: "Notice a clue, person, sound, or other detail through active observation and the senses.",
  pilotingPlanetary: "Control a ground, air, or other planetary vehicle during demanding travel or manoeuvres.",
  pilotingSpace: "Control a spacecraft in flight or combat; charting its hyperspace route uses Astrogation.",
  rangedLight: "Attack with pistols and other ranged weapons assigned to Ranged (Light).",
  rangedHeavy: "Attack with rifles and other ranged weapons assigned to Ranged (Heavy).",
  resilience: "Withstand sickness, poison, exhaustion, environmental hardship, or another physical strain.",
  skulduggery: "Pick locks, palm objects, disable simple security hardware, or work by discreet manual trickery.",
  stealth: "Move or act without being noticed, using cover, timing, and quiet movement.",
  streetwise: "Find people, goods, or rumors through local contacts and the practical habits of a community's underworld.",
  survival: "Navigate and endure wilderness conditions, track signs, or find food and shelter away from settled places.",
  vigilance: "React to sudden danger and remain alert; it can set initiative when trouble catches a character unprepared.",
  coreWorlds: "Recall the politics, cultures, places, and institutions of the galaxy's central regions.",
  education: "Apply formal learning such as science, academic history, mathematics, or established scholarship.",
  lore: "Recall ancient traditions, mysteries, and accounts connected with the Force and older galactic history.",
  outerRim: "Recall the worlds, routes, cultures, and events of the Outer Rim and frontier regions.",
  underworld: "Know criminal groups, illicit trade, and the customs and reputations of the underworld.",
  warfare: "Understand military forces, tactics, strategy, and the history of armed conflict.",
  xenology: "Recognize species and their biology, customs, habitats, and common differences.",
});

export const CHARACTERISTIC_GUIDANCE = Object.freeze({
  brawn: "Physical power and toughness. This rating forms the base pool for feats of strength and bodily resistance.",
  agility: "Reflexes, coordination, and precise motion. This rating forms the base pool for piloting and many attacks.",
  intellect: "Reasoning, learning, and technical understanding. This rating forms the base pool for knowledge and technical checks.",
  cunning: "Instinct, improvisation, and reading a situation. This rating forms the base pool for subtle or perceptive checks.",
  willpower: "Resolve, focus, and mental endurance. This rating forms the base pool for discipline and vigilance checks.",
  presence: "Confidence, empathy, and social impact. This rating forms the base pool for many social checks.",
});

const TITLES = Object.freeze({
  Overview: "Current characteristics, resources, and readiness for play.",
  Skills: "Training and dice pools for actions with uncertain outcomes. A skill rank upgrades dice from its linked characteristic.",
  Inventory: "Equipment, weapons, armor, and carried items recorded for this actor.",
  Advancement: "Available XP, purchased improvements, specialization trees, and talent paths.",
  Story: "Motivations, background, narrative hooks, and personal notes used during play.",
  Crew: "Assignments and responsibilities for a vehicle's crew.",
  "Crew & Passengers": "Crew roles and available passenger places for this vehicle.",
  Characteristics: "The six broad abilities that set the starting dice pool for skill checks.",
  Vitals: "Wounds and strain already suffered, compared with their thresholds.",
  Condition: "Damage and strain currently recorded for this vehicle.",
  Readiness: "Defenses, Force use, and credits available to this character.",
  "Flight profile": "A vehicle's speed, handling, durability, and other recorded operating values.",
  Wounds: "Physical harm. A character is incapacitated when wounds exceed the wound threshold.",
  Strain: "Mental and physical stress. A character is incapacitated when strain exceeds the strain threshold.",
  "Hull trauma": "Damage to a vehicle's hull, compared with its threshold.",
  "System strain": "Stress on a vehicle's systems, compared with its threshold.",
  "Deflector shields": "Shield ratings assigned to a vehicle's firing arcs.",
  "Canvas footprint": "How much scene space the vehicle token occupies at the current scale.",
  "A place in the galaxy": "Campaign obligations, duties, and moral choices that can drive scenes.",
  Obligation: "A pressure or debt tying the character to the wider story; its value measures its weight in the group.",
  Duty: "A commitment to a cause; its value tracks the character's contribution to that cause.",
  Morality: "A Force user's ethical arc, shaped by choices and conflict rather than a single roll.",
  "Minion group": "A linked group of lesser adversaries that acts and loses members together.",
  General: "Skills for non-combat tasks and broad practical actions.",
  Combat: "Skills used to attack with the matching type of weapon.",
  Knowledge: "Skills used to recall or research facts within a particular field.",
  Custom: "Skills added for this world or character; the GM defines their exact scope.",
  Alphabetical: "All recorded skills in name order.",
  Equipment: "Weapons, armor, gear, and attachments. Their recorded play statistics are shown here; open an item to edit it.",
  Abilities: "Species, career, specialization, talents, Force powers, and reference abilities recorded for this actor.",
  "Build a character. Follow a path.": "Spend XP on allowed skills, characteristics, talents, and other advances.",
  "Advancement record": "A history of XP purchases recorded for this actor.",
  Logbook: "The character's story information and source references.",
  "Story hooks": "Rolled or chosen narrative pressures and ideals that can influence future scenes.",
  "Background story": "A short combined account of species, career, and active story hooks.",
  Motivations: "Goals and beliefs that help the GM portray the character consistently.",
  "Species background": "How this individual's upbringing and species experiences shaped them.",
  "Career background": "How this individual came to their profession and what it means to them.",
  "Bio Notes": "Freeform owner notes about personality, choices, and growth; background entries stay separate.",
  "Source reference": "Book and page used to verify this actor's source-dependent details.",
  "Homebrew identity": "A custom identity whose starting values and abilities need a GM review.",
  "Species abilities": "Starting exceptions and abilities associated with the chosen species.",
  "Campaign rules": "The rule lines enabled by the GM for this campaign.",
  "Advancement phase": "Whether the actor is still in character creation or already in campaign play.",
});

const FIELDS = Object.freeze({
  "system.theme": "Choose the sheet's visual theme; this does not change rules.",
  name: "The name shown for this actor in the world and on the canvas.",
  "system.species": "The character's species, which sets starting traits and abilities.",
  "system.career": "The character's career, which determines starting career skills and available paths.",
  "system.registration": "A vehicle's recorded registration or identifying code.",
  "system.soak": "Damage absorbed after a hit, before wounds are applied; some effects can bypass it.",
  "system.defense.melee": "Setback dice added to eligible incoming melee attacks.",
  "system.defense.ranged": "Setback dice added to eligible incoming ranged attacks.",
  "system.forceRating": "The number of Force dice available before commitments and other limits.",
  "system.committedForce": "Force dice tied to ongoing powers and unavailable for other Force checks.",
  "system.credits": "Money currently held; unspent credits can be saved for later.",
  "system.speed.value": "The vehicle's current speed in its movement rules.",
  "system.speed.max": "The highest speed the vehicle can currently reach.",
  "system.crew": "People or roles needed to operate the vehicle.",
  "system.passengers": "Additional occupants the vehicle can carry besides its crew.",
  "system.hyperdrive": "The vehicle's recorded hyperspace drive rating and related details.",
  "system.cargo": "The vehicle's recorded carrying capacity or cargo notes.",
  "system.footprint.hull": "Choose the silhouette drawn inside this token's occupied space.",
  "system.footprint.mode": "Choose estimated sizing from silhouette or enter the craft's actual dimensions.",
  "system.footprint.length": "Physical length used to size this vehicle token on the scene.",
  "system.footprint.width": "Physical width used to size this vehicle token on the scene.",
  "system.obligation.label": "Name the pressure or debt represented by this Obligation.",
  "system.obligation.value": "Obligation's current weight in the campaign; this is separate from Morality and Duty.",
  "system.duty.label": "Name the cause or service represented by this Duty.",
  "system.duty.value": "Duty earned toward a shared cause or mission.",
  "system.duty.contribution": "The character's recorded contribution toward Duty rewards.",
  "system.morality.value": "Current position on the Morality scale, influenced by recorded choices.",
  "system.morality.conflict": "Conflict accumulated through choices and resolved under the Morality rules.",
  "system.groupSize": "How many members the minion group started with.",
  "system.xp.available": "XP the character can spend now; it may be saved for a later purchase.",
  "system.xp.total": "Total XP earned or granted to this character, including XP already spent.",
  "system.notes": "Freeform notes for this vehicle or actor.",
  "system.motivation": "Optional summary of the character's goals and guiding beliefs.",
  "system.creation.speciesBackground": "Edit the individual's species history; the starter text is only a prompt.",
  "system.creation.careerBackground": "Edit the individual's career history; the starter text is only a prompt.",
  "system.biography": "Owner-written notes about personality, decisions, and development.",
  "system.morality.strength": "An emotional tendency that can guide the character toward constructive choices.",
  "system.morality.weakness": "An emotional tendency that can complicate the character's choices.",
  "system.source.book": "The book used as the source for this record.",
  "system.source.page": "The page where the source can be checked.",
});

export function skillGuidance(key, label = "") {
  return SKILL_GUIDANCE[key] ?? `Custom skill${label ? ` “${label}”` : ""}. Ask the GM which tasks it covers and how it applies.`;
}

export function sheetTitleGuidance(title) {
  const text = String(title ?? "").trim();
  if (Object.hasOwn(TITLES, text)) return TITLES[text];
  if (text.startsWith("Signature ability ·")) return "A high-level ability linked to a specialization and its upgrade path.";
  return "";
}

export function sheetFieldGuidance(name) {
  const field = String(name ?? "");
  if (Object.hasOwn(FIELDS, field)) return FIELDS[field];
  let match = /^system\.characteristics\.([a-z]+)$/.exec(field);
  if (match) return CHARACTERISTIC_GUIDANCE[match[1]] ?? "";
  match = /^system\.skills\.([\w]+)\.rank$/.exec(field);
  if (match) return skillGuidance(match[1]);
  if (/^system\.[\w]+\.(value|max)$/.test(field))
    return field.endsWith(".max") ? "The threshold for this resource; compare it with the current value." : "The current amount recorded for this resource.";
  return "";
}

/** Add native hover help to existing headings and labels without changing their visible text. */
export function bindSheetGuidance(root) {
  if (!root?.querySelectorAll) return;
  for (const element of root.querySelectorAll(".sf-tabs [data-tab], h2, h3, h4, legend, .sf-origin-label, .sf-phase-status > span, label")) {
    if (element.hasAttribute("title")) continue;
    const control = element.matches("label") ? element.querySelector("input[name],select[name],textarea[name]") : null;
    const help = (control && sheetFieldGuidance(control.name)) ||
      sheetTitleGuidance(element.textContent?.replace(/\s+/g, " ").trim()) ||
      sheetTitleGuidance(element.firstChild?.textContent?.trim());
    if (!help) continue;
    element.setAttribute("title", help);
    element.setAttribute("aria-description", help);
  }
}

export const SHEET_GUIDANCE = Object.freeze({skills: SKILL_GUIDANCE, characteristics: CHARACTERISTIC_GUIDANCE, titles: TITLES, fields: FIELDS});

if (Object.keys(SKILL_GUIDANCE).length !== Object.keys(SKILLS).length ||
    Object.keys(CHARACTERISTIC_GUIDANCE).length !== Object.keys(CHARACTERISTICS).length)
  throw new Error("Native sheet guidance is incomplete.");
