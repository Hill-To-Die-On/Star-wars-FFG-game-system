import { count } from "./dice/core.mjs";
import { skillCost } from "./mechanics.mjs";
import { validateTalentNodeRules } from "./talent-rules.mjs";
export function validateTree(tree) {
  if (!tree || !Array.isArray(tree.nodes) || !Array.isArray(tree.edges))
    throw new Error("A talent tree needs nodes and edges.");
  if (tree.nodes.length > 100 || tree.edges.length > 300)
    throw new Error("Talent tree exceeds size limits.");
  const ids = new Set();
  for (const node of tree.nodes) {
    if (!node.id || ids.has(node.id) || !String(node.name ?? "").trim())
      throw new Error("Every talent node needs a unique id and name.");
    ids.add(node.id);
    count(node.cost, "talent cost", 100);
    count(node.row, "row", 20);
    count(node.col, "column", 20);
    validateTalentNodeRules(node);
  }
  for (const edge of tree.edges)
    if (
      !Array.isArray(edge) ||
      edge.length !== 2 ||
      edge[0] === edge[1] ||
      !edge.every((id) => ids.has(id))
    )
      throw new Error("Talent links must join two existing nodes.");
  return tree;
}
export function availableTalents(tree, purchased = [], knownUnranked = []) {
  validateTree(tree);
  const owned = new Set(purchased),
    known = new Set(knownUnranked.map((s) => s.toLowerCase()));
  // Traverse already-known, unranked nodes without charging their XP again.
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of tree.nodes) {
      const connected =
        node.entry ||
        tree.edges.some(
          ([a, b]) =>
            (a === node.id && owned.has(b)) || (b === node.id && owned.has(a)),
        );
      if (
        !owned.has(node.id) &&
        node.ranked === false &&
        known.has(node.name.toLowerCase()) &&
        connected
      ) {
        owned.add(node.id);
        changed = true;
      }
    }
  }
  return tree.nodes.filter(
    (node) =>
      !owned.has(node.id) &&
      (node.entry ||
        tree.edges.some(
          ([a, b]) =>
            (a === node.id && owned.has(b)) || (b === node.id && owned.has(a)),
        )),
  );
}
export function talentPurchase(
  tree,
  purchased,
  nodeId,
  xp,
  knownUnranked = [],
) {
  const node = availableTalents(tree, purchased, knownUnranked).find(
    (node) => node.id === nodeId,
  );
  if (!node)
    throw new Error(
      "This talent is already owned or its path is not unlocked.",
    );
  if (node.cost > xp) throw new Error("Not enough available XP.");
  return { xp: xp - node.cost, purchased: [...purchased, node.id], node };
}
export function skillPurchase(rank, career, xp, creation = false) {
  if (rank >= (creation ? 2 : 5))
    throw new Error(
      creation
        ? "Creation ranks cannot exceed 2."
        : "Skill ranks cannot exceed 5.",
    );
  const cost = skillCost(rank, career);
  if (xp < cost) throw new Error("Not enough available XP.");
  return { rank: rank + 1, xp: xp - cost, cost };
}
export function specializationCost(ownedCount, inCareer, universal = false) {
  return (
    (count(ownedCount, "specializations", 100) + 1) * 10 +
    (inCareer || universal ? 0 : 10)
  );
}
export function characteristicPurchase(current, xp, phase) {
  if (phase !== "creation")
    throw new Error(
      "Direct characteristic purchases are only available during creation.",
    );
  if (current >= 5)
    throw new Error("Creation characteristics cannot exceed 5.");
  const cost = (count(current, "characteristic", 4) + 1) * 10;
  if (xp < cost) throw new Error("Not enough available XP.");
  return { value: current + 1, xp: xp - cost, cost };
}
