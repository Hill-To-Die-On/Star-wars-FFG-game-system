import { bookAllowed } from "./rules.mjs";

const STORY_VALUES = Object.freeze({
  2: 20,
  3: 15,
  4: 10,
  5: 10,
});

const OPTIONS = Object.freeze({
  edge: Object.freeze({
    "xp-5": Object.freeze({ xp: 5, credits: 0, cost: 5 }),
    "xp-10": Object.freeze({ xp: 10, credits: 0, cost: 10 }),
    "credits-1000": Object.freeze({ xp: 0, credits: 1000, cost: 5 }),
    "credits-2500": Object.freeze({ xp: 0, credits: 2500, cost: 10 }),
  }),
  age: Object.freeze({
    "xp-5": Object.freeze({ xp: 5, credits: 0, cost: 5 }),
    "xp-10": Object.freeze({ xp: 10, credits: 0, cost: 10 }),
    "credits-1000": Object.freeze({ xp: 0, credits: 1000, cost: 5 }),
    "credits-2500": Object.freeze({ xp: 0, credits: 2500, cost: 10 }),
  }),
  force: Object.freeze({
    "xp-10": Object.freeze({ xp: 10, credits: 0, morality: 0 }),
    "credits-2500": Object.freeze({ xp: 0, credits: 2500, morality: 0 }),
    "xp-5-credits-1000": Object.freeze({ xp: 5, credits: 1000, morality: 0 }),
    "morality-light": Object.freeze({ xp: 0, credits: 0, morality: 21 }),
    "morality-dark": Object.freeze({ xp: 0, credits: 0, morality: -21 }),
  }),
});

export const CREATION_RESOURCE_CHOICES = Object.freeze({
  edge: Object.freeze([
    Object.freeze({ id: "xp-5", label: "+5 starting XP", cost: "+5 Obligation" }),
    Object.freeze({ id: "xp-10", label: "+10 starting XP", cost: "+10 Obligation" }),
    Object.freeze({ id: "credits-1000", label: "+1,000 starting credits", cost: "+5 Obligation" }),
    Object.freeze({ id: "credits-2500", label: "+2,500 starting credits", cost: "+10 Obligation" }),
  ]),
  age: Object.freeze([
    Object.freeze({ id: "xp-5", label: "+5 starting XP", cost: "−5 Duty" }),
    Object.freeze({ id: "xp-10", label: "+10 starting XP", cost: "−10 Duty" }),
    Object.freeze({ id: "credits-1000", label: "+1,000 starting credits", cost: "−5 Duty" }),
    Object.freeze({ id: "credits-2500", label: "+2,500 starting credits", cost: "−10 Duty" }),
  ]),
  force: Object.freeze([
    Object.freeze({ id: "standard", label: "Keep Morality 50", cost: "No additional benefit" }),
    Object.freeze({ id: "xp-10", label: "+10 starting XP", cost: "Keep Morality 50" }),
    Object.freeze({ id: "credits-2500", label: "+2,500 starting credits", cost: "Keep Morality 50" }),
    Object.freeze({ id: "xp-5-credits-1000", label: "+5 XP and +1,000 credits", cost: "Keep Morality 50" }),
    Object.freeze({ id: "morality-light", label: "Start at Morality 71", cost: "No XP or credit benefit" }),
    Object.freeze({ id: "morality-dark", label: "Start at Morality 29", cost: "No XP or credit benefit" }),
  ]),
});

const SOURCES = Object.freeze({
  edge: Object.freeze({
    book: "Edge of The Empire - Core Book",
    pages: Object.freeze(["40", "97"]),
  }),
  age: Object.freeze({
    book: "Age of Rebellion - Core Book",
    pages: Object.freeze(["46", "108", "111"]),
  }),
  force: Object.freeze({
    book: "Force & Destiny - Core Book",
    pages: Object.freeze(["49", "107"]),
  }),
});

function partyStoryValue(partySize) {
  if (!Number.isInteger(partySize) || partySize < 2)
    throw new Error("Party size must be at least 2 for the printed starting-value table.");
  return STORY_VALUES[partySize] ?? 5;
}

function selectedChoices(line, choices) {
  if (!Array.isArray(choices)) throw new Error("Starting resource choices must be a list.");
  const selected = choices.filter((choice) => choice !== "standard").map(String);
  if (new Set(selected).size !== selected.length)
    throw new Error("Each starting resource option may be selected only once.");
  const definitions = OPTIONS[line];
  if (!definitions || selected.some((choice) => !definitions[choice]))
    throw new Error("Choose only starting resource options from the selected rule line.");
  return selected;
}

export function creationResourcePlan({
  line,
  partySize = 4,
  choices = [],
  ageStartingResource = "lambda",
} = {}) {
  if (!Object.hasOwn(OPTIONS, line)) throw new Error("Choose a supported creation rule line.");
  const selected = selectedChoices(line, choices);
  if (line === "force" && selected.length > 1)
    throw new Error("Choose at most one Force and Destiny option.");
  const values = selected.map((choice) => OPTIONS[line][choice]),
    xpBonus = values.reduce((total, value) => total + value.xp, 0),
    creditBonus = values.reduce((total, value) => total + value.credits, 0);
  let story;
  if (line === "force") {
    const delta = values[0]?.morality ?? 0;
    story = { mechanic: "morality", base: 50, delta, value: 50 + delta };
  } else {
    const base = partyStoryValue(partySize),
      cost = values.reduce((total, value) => total + value.cost, 0),
      name = line === "edge" ? "Obligation" : "Duty";
    if (cost > base)
      throw new Error(`Selected benefits exceed the original starting ${name} value.`);
    const delta = line === "edge" ? cost : -cost;
    story = { mechanic: name.toLowerCase(), base, delta, value: base + delta };
  }
  if (!["lambda", "y-wings", "base"].includes(ageStartingResource))
    throw new Error("Choose a supported Age of Rebellion group resource.");
  return {
    line,
    choices: selected,
    xpBonus,
    baseCredits: 500,
    creditBonus,
    cashBudget: 500 + creditBonus,
    gearGrant: line === "age" && ageStartingResource === "base" ? 1000 : 0,
    story,
    source: { book: SOURCES[line].book, pages: [...SOURCES[line].pages] },
  };
}

const documentId = (entry) => String(entry?.id ?? entry?._id ?? "");
const validPrice = (entry) => {
  const price = Number(entry?.system?.price);
  return Number.isSafeInteger(price) && price >= 0;
};

export function startingEquipmentOptions(entries, campaign) {
  return Array.from(entries ?? [])
    .filter((entry) =>
      ["weapon", "armor", "gear"].includes(entry?.type),
    )
    .filter((entry) => entry.type !== "weapon" || entry.system?.scale !== "vehicle")
    .filter((entry) => documentId(entry) && validPrice(entry))
    .filter(
      (entry) =>
        !(entry.system?.incomplete ?? []).some((value) =>
          /price/i.test(String(value)),
        ),
    )
    .filter((entry) => bookAllowed(entry.system?.source?.book, campaign))
    .map((entry) => ({
      id: documentId(entry),
      name: String(entry.name ?? "").trim(),
      type: entry.type,
      price: Number(entry.system.price),
      restricted: entry.system?.restricted === true,
      source: {
        book: String(entry.system?.source?.book ?? ""),
        page: String(entry.system?.source?.page ?? ""),
      },
    }))
    .filter((entry) => entry.name)
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.source.book.localeCompare(b.source.book) ||
        a.id.localeCompare(b.id),
    );
}

function budgetValue(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0)
    throw new Error(`${label} must be a non-negative whole number.`);
  return number;
}

export function buildStartingLoadout({
  options,
  selections = [],
  cashBudget,
  gearGrant = 0,
  allowRestricted = false,
} = {}) {
  const cash = budgetValue(cashBudget, "Starting credit budget"),
    grant = budgetValue(gearGrant, "Starting gear grant"),
    available = new Map(Array.from(options ?? [], (option) => [option.id, option]));
  if (available.size !== Array.from(options ?? []).length)
    throw new Error("Starting equipment options require unique database IDs.");
  if (!Array.isArray(selections)) throw new Error("Starting equipment selections must be a list.");
  const ids = new Set(),
    items = [];
  let cost = 0;
  for (const selection of selections) {
    const id = String(selection?.id ?? ""),
      quantity = Number(selection?.quantity),
      option = available.get(id);
    if (!option) throw new Error("Choose starting equipment from the available database entries.");
    if (ids.has(id)) throw new Error("Combine duplicate equipment into one quantity.");
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99)
      throw new Error("Starting equipment quantity must be between 1 and 99.");
    if (option.restricted && !allowRestricted)
      throw new Error(`${option.name} requires explicit GM approval because it is Restricted.`);
    const itemCost = option.price * quantity;
    if (!Number.isSafeInteger(itemCost)) throw new Error("Starting equipment cost is too large.");
    cost += itemCost;
    if (!Number.isSafeInteger(cost)) throw new Error("Starting equipment cost is too large.");
    ids.add(id);
    items.push({ id, quantity, price: option.price, cost: itemCost, restricted: option.restricted });
  }
  if (cost > cash + grant)
    throw new Error(`Starting equipment exceeds the ${cash + grant}-credit allowance.`);
  const cashSpent = Math.max(0, cost - grant);
  return {
    items,
    cost,
    cashSpent,
    gearGrantUsed: Math.min(grant, cost),
    gearGrantUnused: Math.max(0, grant - cost),
    credits: cash - cashSpent,
  };
}

export function finalizePocketMoney(system, amount) {
  if (!system?.creation?.applied || system.creation.pocketMoneyPending !== true)
    throw new Error("Starting pocket money was already applied or character creation is incomplete.");
  const value = Number(amount);
  if (!Number.isInteger(value) || value < 1 || value > 100)
    throw new Error("Starting pocket money must be between 1 and 100.");
  return {
    credits: budgetValue(system.credits, "Current credits") + value,
    creation: {
      ...system.creation,
      pocketMoneyPending: false,
      pocketMoney: value,
    },
  };
}
