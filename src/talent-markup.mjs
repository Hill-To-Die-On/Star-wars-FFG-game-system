import { escapeHTML } from "./mechanics.mjs";

const DICE = Object.freeze({
  AB: ["ability", "Ability die"], PR: ["proficiency", "Proficiency die"],
  BO: ["boost", "Boost die"], DI: ["difficulty", "Difficulty die"],
  CH: ["challenge", "Challenge die"], SE: ["setback", "Setback die"],
  FO: ["force", "Force die"], FORCE: ["force", "Force die"],
});
const SYMBOLS = Object.freeze({
  SU: ["success", "Success", "✦"], SUCCESS: ["success", "Success", "✦"],
  FA: ["failure", "Failure", "✕"], AD: ["advantage", "Advantage", "▲"],
  TR: ["threat", "Threat", "▼"], TH: ["triumph", "Triumph", "✷"],
  TRIUMPH: ["triumph", "Triumph", "✷"], DE: ["despair", "Despair", "◆"],
  LI: ["light", "Light side", "○"], DA: ["dark", "Dark side", "●"],
  FP: ["force-point", "Force point", "◈"],
});

function tokenParts(value) {
  const input = String(value ?? ""), parts = [];
  let start = 0;
  for (const match of input.matchAll(/\[\/?[A-Za-z]+\]/g)) {
    if (match.index > start) parts.push({ text: input.slice(start, match.index) });
    parts.push({ tag: match[0] });
    start = match.index + match[0].length;
  }
  if (start < input.length) parts.push({ text: input.slice(start) });
  return parts;
}

export function renderTalentMarkup(value) {
  let bold = false, html = "";
  for (const part of tokenParts(value)) {
    if (part.text !== undefined) {
      html += escapeHTML(part.text).replace(/\r?\n/g, "<br>");
      continue;
    }
    const tag = part.tag.slice(1, -1);
    if (tag === "B" && !bold) { html += "<strong>"; bold = true; continue; }
    if ((tag === "b" || tag === "/B" || tag === "/b") && bold) {
      html += "</strong>"; bold = false; continue;
    }
    if (tag === "P") { html += "<br>"; continue; }
    if (DICE[tag]) {
      const [key, label] = DICE[tag];
      html += `<span class="sf-talent-die sf-die-shape sf-die-${key}" role="img" aria-label="${label}" title="${label}"></span>`;
      continue;
    }
    if (SYMBOLS[tag]) {
      const [key, label, glyph] = SYMBOLS[tag];
      html += `<span class="sf-talent-symbol sf-talent-symbol-${key}" role="img" aria-label="${label}" title="${label}">${glyph}</span>`;
      continue;
    }
    html += escapeHTML(part.tag);
  }
  return html + (bold ? "</strong>" : "");
}

export function talentMarkupText(value) {
  const parts = tokenParts(value);
  return parts.map((part, index) => {
    if (part.text !== undefined) return part.text;
    const tag = part.tag.slice(1, -1);
    if (tag === "B" || tag === "b" || tag === "/B" || tag === "/b") return "";
    if (tag === "P") return " ";
    const label = DICE[tag]?.[1] ?? SYMBOLS[tag]?.[1];
    if (label) return label + (DICE[parts[index + 1]?.tag?.slice(1, -1)] ? " " : "");
    return part.tag;
  }).join("").replace(/\s+/g, " ").trim();
}
