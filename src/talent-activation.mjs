import catalogue from "../data/talent-activations.json" with { type: "json" };

const HINTS = Object.freeze({
  Action: "Use one action to activate this talent. Resolve the check and effect described in its text; it is not automatic.",
  Maneuver: "Use one manoeuvre to activate this talent. Apply its listed conditions and cost.",
  Incidental: "Activate when its stated trigger occurs, without spending an action or manoeuvre.",
  "OOT Incidental": "Activate at its stated trigger, even outside this character's turn.",
  Active: "Activate deliberately when its stated conditions are met; consult the cited rule for timing and cost.",
  Passive: "Applies while its conditions hold. The GM checks the rule text; supported structured effects are applied automatically.",
  Guidance: "Rule text is available for GM adjudication; no automatic effect is recorded.",
  "Book reference": "Use the cited book to verify this talent before applying its effect.",
});

export function talentActivation(name, fallback = "") {
  return catalogue.activations[String(name ?? "").trim().toLowerCase()] || String(fallback ?? "");
}

export function talentActivationBadge(node) {
  const activation = talentActivation(node?.name, node?.activation);
  const automatic = activation === "Passive" && (node?.effects?.length ?? 0) > 0;
  const label = activation || (node?.summary ? "Guidance" : "Book reference");
  return { activation, automatic, label: automatic ? "Auto" : label,
    hint: HINTS[label] || HINTS.Guidance };
}
