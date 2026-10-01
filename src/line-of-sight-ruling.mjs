export function gmSightRuling({ needsRuling, isGM, manual, approved, reason = "" }) {
  if (!needsRuling) return { allowed: true, note: "" };
  if (!isGM) return { allowed: false, reason: "A GM must approve this blocked line of sight." };
  if (!manual) return { allowed: false, reason: "Use Manual mode for a GM line of sight ruling." };
  if (!approved) return { allowed: false, reason: "Approve the line of sight override before rolling." };
  const explanation = String(reason).trim();
  if (!explanation) return { allowed: false, reason: "Record why this effect can reach the target without line of sight." };
  return { allowed: true, note: `GM line of sight override: ${explanation}` };
}
