const prompts = Object.freeze({
  ace: ["Which flight first made others trust your judgment?", "Who still remembers a landing or decision you wish you could redo?"],
  "bounty hunter": ["Who was the first person you were asked to find?", "Which contract taught you where your own limits lie?"],
  "clone soldier": ["What did you learn about yourself outside a training exercise?", "Which comrade would you cross a battlefield to help?"],
  colonist: ["What place did you help build or keep alive?", "Who relies on you when that community faces a hard choice?"],
  commander: ["When did others first follow your orders?", "Which decision still shapes how you lead?"],
  consular: ["Who taught you to listen before acting?", "Which disagreement are you still trying to resolve?"],
  diplomat: ["What conversation changed the course of your life?", "Which person trusts you to speak for them?"],
  engineer: ["What did you repair when no one else could?", "Who depends on something you built?"],
  explorer: ["What discovery made you leave familiar ground?", "Who or what are you hoping to find beyond the next route?"],
  guardian: ["Whom did you first choose to protect?", "What cost of that choice do you still carry?"],
  "hired gun": ["What job taught you to survive under pressure?", "Who knows what you do when the payment is not enough?"],
  jedi: ["Which lesson do you still struggle to practice?", "Who has challenged your idea of what service requires?"],
  mystic: ["What experience changed how you understand the Force?", "Who helps you stay grounded when your instincts pull elsewhere?"],
  seeker: ["What trail has kept you moving?", "Who taught you to read a place before taking a step?"],
  sentinel: ["What secret did you uncover in an ordinary place?", "Whom do you watch over without asking for recognition?"],
  smuggler: ["Which journey taught you the value of an unexpected route?", "Who would recognize your ship or your name on sight?"],
  soldier: ["When did your training first meet a real crisis?", "Which fellow fighter changed the way you face danger?"],
  spy: ["Which identity was hardest to leave behind?", "Who knows a truth about you that your cover must hide?"],
  technician: ["What machine first earned your patience?", "Who calls you when a clever fix matters more than a new part?"],
  warrior: ["What conflict taught you restraint or resolve?", "Who sees the person behind your fighting reputation?"],
});
const clean = (value) => String(value ?? "").trim().slice(0, 80);
const careerDefaults = Object.freeze({
  ace: "This pilot learned to trust quick judgment in a cockpit and still answers for a flight that changed someone else's course.",
  "bounty hunter": "This hunter follows people others cannot find, balancing a contract's reward against a personal line they will not cross.",
  colonist: "This colonist helped keep a community alive and carries its needs into every new place.",
  commander: "This commander has learned that orders shape lives and must decide whom to trust when the plan breaks.",
  consular: "This consular approaches conflict through patience and counsel, though one unresolved dispute still follows them.",
  diplomat: "This diplomat speaks for others and remembers a negotiation whose result was more complicated than the agreement.",
  engineer: "This engineer solves problems by building and repairing, with people now depending on what they made.",
  explorer: "This explorer left a familiar place to follow a discovery and is still searching for what lies beyond the next route.",
  guardian: "This guardian chose someone to protect and carries the cost of that promise.",
  "hired gun": "This fighter knows how to survive dangerous work and has learned that payment cannot settle every debt.",
  jedi: "This Jedi tries to turn training into service while a difficult lesson tests their judgment.",
  mystic: "This mystic follows a personal understanding of the Force and relies on a grounding bond when instinct pulls too hard.",
  seeker: "This seeker reads places and tracks before acting, drawn onward by a trail that has not ended.",
  sentinel: "This sentinel keeps watch where ordinary life hides extraordinary threats and protects someone without recognition.",
  smuggler: "This smuggler survives by reading routes, people and risk; an unfinished delivery or promise makes the next journey personal.",
  soldier: "This soldier's training met a real crisis, and a fellow fighter changed how they face danger.",
  spy: "This spy has lived behind a cover identity and must protect the person who knows the truth.",
  technician: "This technician earns trust through careful fixes and is called when a working solution matters more than a new part.",
  warrior: "This warrior's reputation was forged in conflict, but someone close knows the restraint behind it.",
});

export function careerBackgroundDefault(career) {
  const name = clean(career);
  if (!name) return "";
  return careerDefaults[name.toLowerCase()] ?? `This ${name} followed a distinctive path into their work and carries an unfinished promise into the next adventure.`;
}

export function speciesBackgroundDefault(species) {
  const name = clean(species);
  if (!name) return "";
  if (name === "Human") return "This Human grew up among many ways of life and learned to adapt, choosing which people and places feel like home.";
  return `This ${name} was shaped by a particular community and history, but chooses which inherited expectations to keep and which new bonds to build.`;
}

const appendSection = (biography, heading, content) => {
  const existing = String(biography ?? "").trim();
  return existing.includes(heading) ? existing : [existing, `${heading}\n${content}`].filter(Boolean).join("\n\n");
};

export function defaultOriginBiography(species, career) {
  let biography = "";
  if (speciesBackgroundDefault(species)) biography = appendSection(biography, `Species origin · ${clean(species)}`, speciesBackgroundDefault(species));
  if (careerBackgroundDefault(career)) biography = appendSection(biography, `Career origin · ${clean(career)}`, careerBackgroundDefault(career));
  return biography;
}

export function careerStoryPrompts(career) {
  const name = clean(career);
  if (!name) return [];
  const specific = prompts[name.toLowerCase()] ?? [
    `What choice led you toward life as a ${name}?`,
    "Who shaped the way you use your abilities?",
  ];
  return [...specific, "What unfinished promise, question, or ambition draws you into the next adventure?"];
}

export function appendCareerStoryPrompts(biography, career) {
  const name = clean(career);
  const existing = String(biography ?? "").trim();
  const questions = careerStoryPrompts(name);
  if (!questions.length) return existing;
  const heading = `Career background · ${name}`;
  if (existing.includes(heading)) return existing;
  return [existing, `${heading}\n${careerBackgroundDefault(name)}\n${questions.map((question) => `- ${question}`).join("\n")}`]
    .filter(Boolean).join("\n\n");
}

export function speciesStoryPrompts(species) {
  const name = clean(species);
  if (!name) return [];
  return [
    `Which people or place shaped what being ${name} means to you?`,
    "Which expectation about your background do you accept, resist, or ignore?",
    "What bond or ambition defines you beyond your ancestry?",
  ];
}

export function appendSpeciesStoryPrompts(biography, species) {
  const name = clean(species);
  const existing = String(biography ?? "").trim();
  const questions = speciesStoryPrompts(name);
  if (!questions.length) return existing;
  const heading = `Species background · ${name}`;
  if (existing.includes(heading)) return existing;
  return [existing, `${heading}\n${speciesBackgroundDefault(name)}\n${questions.map((question) => `- ${question}`).join("\n")}`]
    .filter(Boolean).join("\n\n");
}
