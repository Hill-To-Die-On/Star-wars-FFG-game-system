import { count } from "./dice/core.mjs";
export function minionState(size, wounds, threshold) {
  count(size, "group size", 100);
  count(wounds, "wounds", 100000);
  count(threshold, "threshold", 1000);
  if (!threshold)
    throw new RangeError("A minion needs a positive wound threshold.");
  const defeated = Math.min(
    size,
    wounds > 0 ? Math.max(0, Math.ceil(wounds / threshold) - 1) : 0,
  );
  return {
    defeated,
    remaining: size - defeated,
    rank: Math.max(0, size - defeated - 1),
    threshold: size * threshold,
  };
}
export function damageAfterSoak(
  damage,
  soak,
  pierce = 0,
  breach = 0,
  scale = "personal",
) {
  for (const [name, n] of Object.entries({ damage, soak, pierce, breach }))
    count(n, name, 100000);
  if (!["personal", "vehicle"].includes(scale))
    throw new RangeError("Unknown damage scale.");
  if (scale === "vehicle" && pierce)
    throw new Error(
      "Resolve Pierce against vehicle armor with the GM using the source rules.",
    );
  return Math.max(
    0,
    damage -
      Math.max(0, soak - pierce - breach * (scale === "vehicle" ? 1 : 10)),
  );
}
export function weaponDamage(base, brawn, successes) {
  const text = String(base).trim();
  if (!/^(?:\+)?\d+$/.test(text))
    throw new Error(
      "Weapon damage needs a number or a Brawn modifier such as +2.",
    );
  return (
    Number(text) +
    (text.startsWith("+") ? brawn : 0) +
    count(successes, "successes")
  );
}
export function skillCost(currentRank, career = false) {
  return (count(currentRank, "rank", 4) + 1) * 5 + (career ? 0 : 5);
}
export function initiativeScore(outcome, player = false) {
  // Every legal pool has < 1000 net advantage, so success always has priority.
  return (
    Math.max(0, outcome.netSuccess) +
    Math.max(0, outcome.netAdvantage) / 1000 +
    (player ? 0.000001 : 0)
  );
}
export function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
