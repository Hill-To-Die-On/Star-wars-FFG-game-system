/** Source scopes preserve every occurrence; grouping is not an authorship decision. */
export function reviewScopes(review) {
  const groups = new Map();
  for (const entry of review.entries) for (const occurrence of entry.occurrences) {
    const id = JSON.stringify([occurrence.path, entry.category]);
    if (!groups.has(id)) groups.set(id, { id, path: occurrence.path, category: entry.category, entryIds: new Set() });
    groups.get(id).entryIds.add(entry.id);
  }
  return [...groups.values()].map(group => ({ ...group, entryIds: [...group.entryIds] }));
}

/** Drafts may be unfinished. Identity and structural checks still apply. */
export function normalizeReviewDraft(review, input) {
  if (!input || input.archiveSha256 !== review.archiveSha256) throw Error('Review decisions belong to a different archive.');
  const allowed = new Set(['pending', 'human-origin', 'third-party-rights', 'technical-only', 'rewrite-required']);
  const ids = new Set(review.entries.map(entry => entry.id));
  const scopes = new Set(reviewScopes(review).map(scope => scope.id));
  const object = (value, label) => {
    if (value === undefined) return {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid ' + label + '.');
    return value;
  };
  const entries = Object.fromEntries(Object.entries(object(input.entries, 'entry decisions')).map(([id, value]) => {
    if (!ids.has(id) || !value || !allowed.has(value.decision)) throw Error('Unknown review entry or decision.');
    return [id, { decision: value.decision, evidence: String(value.evidence ?? ''), replacement: String(value.replacement ?? '') }];
  }));
  const scopeReviews = Object.fromEntries(Object.entries(object(input.scopeReviews, 'source reviews')).map(([id, value]) => {
    if (!scopes.has(id) || !value || !['pending', 'evidence-recorded'].includes(value.state)) throw Error('Unknown source scope or review state.');
    return [id, { state: value.state, reviewer: String(value.reviewer ?? ''), evidence: String(value.evidence ?? '') }];
  }));
  const gates = object(input.humanGates, 'human gates');
  const gateIds = new Set(review.humanGates.map(gate => gate.id));
  for (const id of Object.keys(gates)) if (!gateIds.has(id)) throw Error('Unknown human gate.');
  return {
    schemaVersion: 1, archiveSha256: review.archiveSha256, reviewer: String(input.reviewer ?? ''),
    listingText: String(input.listingText ?? ''), entries, scopeReviews,
    humanGates: Object.fromEntries(Object.entries(gates).map(([id, value]) => [id, String(value ?? '')])),
    submissionReady: false,
  };
}

/** Explain incomplete changed decisions without blocking a backup or creating approval. */
export function reviewDraftIssues(review, input) {
  const draft = normalizeReviewDraft(review, input), issues = [];
  const byId = new Map(review.entries.map(entry => [entry.id, entry]));
  for (const [id, value] of Object.entries(draft.entries)) {
    if (value.decision === 'pending') continue;
    const entry = byId.get(id);
    const sourceEvidence = entry.occurrences.every(occurrence => {
      const source = draft.scopeReviews[JSON.stringify([occurrence.path, entry.category])];
      return source?.state === 'evidence-recorded' && source.reviewer.trim() && source.evidence.trim();
    });
    if (!draft.reviewer.trim() || (!value.evidence.trim() && !sourceEvidence)) {
      const missing = [!draft.reviewer.trim() && 'reviewer identity', !value.evidence.trim() && !sourceEvidence && 'authorship or classification evidence'].filter(Boolean);
      issues.push({ kind: 'entry-evidence', entryId: id, path: entry.occurrences[0].path,
        message: entry.occurrences[0].path + ' — ' + entry.text.slice(0, 100) + ': missing ' + missing.join(' and ') + '.' });
    }
  }
  for (const [id, value] of Object.entries(draft.scopeReviews)) {
    if (value.state === 'evidence-recorded' && (!value.reviewer.trim() || !value.evidence.trim())) {
      issues.push({ kind: 'scope-evidence', scopeId: id, message: JSON.parse(id)[0] + ': recorded source evidence needs a named reviewer and evidence note.' });
    }
  }
  return issues;
}
