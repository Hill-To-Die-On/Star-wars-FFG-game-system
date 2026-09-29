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
  return [existing, `${heading}\n${questions.map((question) => `- ${question}`).join("\n")}`]
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
  return [existing, `${heading}\n${questions.map((question) => `- ${question}`).join("\n")}`]
    .filter(Boolean).join("\n\n");
}
